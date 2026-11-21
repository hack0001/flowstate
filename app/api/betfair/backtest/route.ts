import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { readArchiveDay, readHistoryDay } from '@/lib/betfair/archiveFile'
import { expandHistory } from '@/lib/betfair/history'
import type { BtSport } from '@/lib/betfair/backtest'
import { pickPoints, type BtPoint } from '@/lib/betfair/backtest'

// Points for the Backtest tab: one day of recorded markets (by start date, UTC),
// each with just two snapshots, the one to enter on and the one to exit on.
//   GET ?sport=racing&day=2026-11-20&entry=1200&tol=120&exit=off|before|inplay&exitSec=0&types=MATCH_ODDS,OVER_UNDER_25
//   &source=history  reads the imported Betfair history (last traded prices each minute) instead of your recordings
// Days still in the database use bf_bt_points (migration 055); archived days
// are read from their compressed file and picked the same way here.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS = ['racing', 'football', 'tennis', 'golf']
const EXITS = ['off', 'before', 'inplay'] as const
const COLS = 'market_id, sport, market_type, event, venue, competition, country, market_name, race_type, start_at, off_at, runners, winners, removed, bsp, total_matched, status, archived_at'
type Row = Record<string, unknown> & { market_id: string; start_at: string; off_at: string | null; archived_at: string | null }

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const db = auth.supabase
  const q = req.nextUrl.searchParams
  const sport = q.get('sport') ?? ''
  const day = q.get('day') ?? ''
  const exit = (EXITS as readonly string[]).includes(q.get('exit') ?? '') ? q.get('exit') as (typeof EXITS)[number] : 'off'
  const int = (k: string, d: number, max: number) => Math.min(max, Math.max(0, Math.round(Number(q.get(k) ?? d) || 0)))
  const entrySec = int('entry', 1200, 30 * 86_400), tolSec = int('tol', 120, 86_400), exitSec = int('exitSec', 0, 86_400)
  const types = (q.get('types') ?? '').split(',').map(s => s.trim()).filter(s => /^[A-Z0-9_]+$/.test(s))
  if (!SPORTS.includes(sport) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: 'Bad sport or day' }, { status: 400 })
  const from = `${day}T00:00:00Z`, to = new Date(new Date(from).getTime() + 86_400_000).toISOString()

  try {
    if (q.get('source') === 'history') {
      const h = await readHistoryDay(db, sport as BtSport, day)
      if (!h) return NextResponse.json({ day, markets: [], warnings: [] })
      if ('error' in h) return NextResponse.json({ day, markets: [], warnings: [h.error] })
      const { markets, snaps } = expandHistory(h, sport as BtSport)
      const out = markets.filter(m => !types.length || types.includes(m.market_type)).map(m => {
        const p = pickPoints(m, snaps.get(m.market_id) ?? [], { entrySec, tolSec, exit, exitSec })
        return { ...m, entry: p.entry, exit: p.exit }
      })
      return NextResponse.json({ day, markets: out, warnings: [] })
    }

    // 1. the day's markets
    const markets: Row[] = []
    for (let i = 0; ; i += 1000) {
      let b = db.from('bf_markets').select(COLS).eq('sport', sport).gte('start_at', from).lt('start_at', to).order('start_at').range(i, i + 999)
      if (types.length) b = b.in('market_type', types)
      const { data, error } = await b
      if (error) throw new Error(/competition|does not exist|schema cache/i.test(error.message) ? 'Run migrations 053 and 054 in the Supabase SQL editor first.' : error.message)
      markets.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < 1000) break
    }
    const points = new Map<string, { entry: BtPoint | null; exit: BtPoint | null }>()
    const warnings: string[] = []

    // 2. markets still in the database: two snapshots each, picked by the database
    if (markets.some(m => !m.archived_at)) {
      const data: unknown[] = []
      for (let i = 0; ; i += 1000) {          // Supabase returns at most 1000 rows per request
        const { data: page, error } = await db.rpc('bf_bt_points', { p_sport: sport, p_from: from, p_to: to, p_entry_sec: entrySec, p_tol_sec: tolSec,
          p_exit_mode: exit, p_exit_sec: exitSec, p_types: types.length ? types : null }).order('market_id').range(i, i + 999)
        if (error) throw new Error(/bf_bt_points|function/i.test(error.message) ? 'The backtester needs migration 055: run supabase/migrations/055_betfair_backtest.sql in the Supabase SQL editor.' : error.message)
        data.push(...(page ?? []))
        if (!page || page.length < 1000) break
      }
      for (const r of data as { market_id: string; entry_at: string; entry_matched: number | null; entry_runners: BtPoint['runners']; exit_at: string | null; exit_inplay: boolean | null; exit_matched: number | null; exit_runners: BtPoint['runners'] | null }[]) {
        points.set(r.market_id, {
          entry: { at: r.entry_at, matched: r.entry_matched, runners: r.entry_runners },
          exit: r.exit_at ? { at: r.exit_at, inplay: !!r.exit_inplay, matched: r.exit_matched, runners: r.exit_runners ?? [] } : null,
        })
      }
    }

    // 3. archived markets: read the day's compressed file (private bucket, so via the server key)
    const archived = markets.filter(m => m.archived_at)
    if (archived.length) {
      const parsed = await readArchiveDay(db, day)
      if ('error' in parsed) warnings.push(parsed.error)
      else {
      const by = new Map<string, BtPoint[]>()
      const want = new Set(archived.map(m => m.market_id))
      for (const s of parsed.snaps) if (want.has(s.market_id)) by.set(s.market_id, [...(by.get(s.market_id) ?? []), s])
      for (const m of archived) {
        const p = pickPoints(m, by.get(m.market_id) ?? [], { entrySec, tolSec, exit, exitSec })
        if (p.entry) points.set(m.market_id, { entry: strip(p.entry), exit: p.exit && strip(p.exit) })
      }
      }
    }

    const out = markets.map(({ archived_at, ...m }) => { void archived_at; return { ...m, entry: points.get(m.market_id)?.entry ?? null, exit: points.get(m.market_id)?.exit ?? null } })
    return NextResponse.json({ day, markets: out, warnings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

const strip = (s: BtPoint): BtPoint => ({ at: s.at, matched: s.matched, runners: s.runners, inplay: !!s.inplay })
