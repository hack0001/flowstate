import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { readArchiveDay, readHistoryDay } from '@/lib/betfair/archiveFile'
import { expandHistory } from '@/lib/betfair/history'
import type { BtSport } from '@/lib/betfair/backtest'
import type { BtPoint } from '@/lib/betfair/backtest'
import { pickPath } from '@/lib/betfair/insights'

// Price paths for the Insights tab: one day of recorded markets (by start date,
// UTC), each with its prices at set times before the start and at the off.
//   GET ?sport=racing&day=2026-11-20&offsets=3600,1200,600,0&types=MATCH_ODDS
// Days in the database use bf_bt_path (migration 056); archived days are read
// from their compressed file and picked the same way here.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS = ['racing', 'football', 'tennis', 'golf']
const TOL_SEC = 180
const COLS = 'market_id, sport, market_type, event, venue, competition, country, market_name, race_type, start_at, off_at, runners, winners, removed, bsp, total_matched, status, archived_at'
type Row = Record<string, unknown> & { market_id: string; start_at: string; off_at: string | null; archived_at: string | null }

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const db = auth.supabase
  const q = req.nextUrl.searchParams
  const sport = q.get('sport') ?? '', day = q.get('day') ?? ''
  const offsets = Array.from(new Set((q.get('offsets') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 30 * 86_400))).slice(0, 12)
  const types = (q.get('types') ?? '').split(',').map(s => s.trim()).filter(s => /^[A-Z0-9_]+$/.test(s))
  if (!SPORTS.includes(sport) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !offsets.length) return NextResponse.json({ error: 'Bad sport, day or times' }, { status: 400 })
  const from = `${day}T00:00:00Z`, to = new Date(new Date(from).getTime() + 86_400_000).toISOString()

  try {
    if (q.get('source') === 'history') {           // the imported Betfair history instead of your recordings
      const h = await readHistoryDay(db, sport as BtSport, day)
      if (!h) return NextResponse.json({ day, markets: [], warnings: [] })
      if ('error' in h) return NextResponse.json({ day, markets: [], warnings: [h.error] })
      const { markets, snaps } = expandHistory(h, sport as BtSport)
      return NextResponse.json({ day, warnings: [], markets: markets.filter(m => !types.length || types.includes(m.market_type))
        .map(m => ({ ...m, path: pickPath(m, snaps.get(m.market_id) ?? [], offsets, TOL_SEC) })).filter(m => Object.keys(m.path).length) })
    }
    const markets: Row[] = []
    for (let i = 0; ; i += 1000) {
      let b = db.from('bf_markets').select(COLS).eq('sport', sport).gte('start_at', from).lt('start_at', to).order('start_at').range(i, i + 999)
      if (types.length) b = b.in('market_type', types)
      const { data, error } = await b
      if (error) throw new Error(/competition|does not exist|schema cache/i.test(error.message) ? 'Run migrations 053 and 054 in the Supabase SQL editor first.' : error.message)
      markets.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < 1000) break
    }
    const paths = new Map<string, Record<string, BtPoint>>()
    const warnings: string[] = []

    if (markets.some(m => !m.archived_at)) {
      for (let i = 0; ; i += 1000) {          // Supabase returns at most 1000 rows per request
        const { data, error } = await db.rpc('bf_bt_path', { p_sport: sport, p_from: from, p_to: to, p_offsets: offsets, p_tol_sec: TOL_SEC, p_types: types.length ? types : null })
          .order('market_id').order('offset_sec').range(i, i + 999)
        if (error) throw new Error(/bf_bt_path|function/i.test(error.message) ? 'Insights need migration 056: run supabase/migrations/056_betfair_insights.sql in the Supabase SQL editor.' : error.message)
        for (const r of (data ?? []) as { market_id: string; offset_sec: number; at: string; matched: number | null; runners: BtPoint['runners'] }[]) {
          const p = paths.get(r.market_id) ?? {}
          p[String(r.offset_sec)] = { at: r.at, matched: r.matched, runners: r.runners }
          paths.set(r.market_id, p)
        }
        if (!data || data.length < 1000) break
      }
    }

    const archived = markets.filter(m => m.archived_at)
    if (archived.length) {
      const parsed = await readArchiveDay(db, day)
      if ('error' in parsed) warnings.push(parsed.error)
      else {
      const want = new Set(archived.map(m => m.market_id)), by = new Map<string, BtPoint[]>()
      for (const s of parsed.snaps) if (want.has(s.market_id)) by.set(s.market_id, [...(by.get(s.market_id) ?? []), s])
      for (const m of archived) paths.set(m.market_id, pickPath(m, by.get(m.market_id) ?? [], offsets, TOL_SEC))
      }
    }

    const out = markets.filter(m => paths.has(m.market_id)).map(({ archived_at, ...m }) => { void archived_at; return { ...m, path: paths.get(m.market_id)! } })
    return NextResponse.json({ day, markets: out, warnings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
