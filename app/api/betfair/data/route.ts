import { NextRequest, NextResponse } from 'next/server'
import zlib from 'zlib'
import { createSupabaseServiceClient, requireUser } from '@/lib/supabaseServer'
import { recorderStatus } from '@/lib/betfair/recorderStatus'

// Recorded Betfair prices (the Data tab of /betfair).
//   GET ?view=summary                                    -> counts and date range
//   GET ?view=export&sport=racing|football&from&to&page  -> one page of markets and their snapshots
//   GET ?view=recent                                     -> races from 6 hours ago to 3 hours ahead, with snapshot counts
//   GET ?view=race&id=1.234                              -> one race and all its snapshots (for the price chart)
//
// Snapshots older than a week are moved by the recorder server into one
// compressed file per day (Storage bucket betfair-archive); this reads those
// transparently, so exports and replays cover every day ever recorded.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PAGE = 20   // markets per export page (a race has up to ~50 snapshots)
const missing = 'The price recorder tables or columns are missing: run supabase/migrations/052_betfair_prices.sql and 053_betfair_recorder.sql in the Supabase SQL editor.'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const db = auth.supabase
  const q = req.nextUrl.searchParams
  try {
    if (q.get('view') === 'summary') {
      const count = async (table: string, f?: (b: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        let b = db.from(table).select('*', { count: 'exact', head: true })
        if (f) b = f(b)
        const { count: n, error } = await b
        if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? missing : error.message)
        return n ?? 0
      }
      const edge = async (asc: boolean) => (await db.from('bf_snaps').select('at').order('at', { ascending: asc }).limit(1)).data?.[0]?.at ?? null
      const firstMarket = (await db.from('bf_markets').select('start_at').order('start_at', { ascending: true }).limit(1)).data?.[0]?.start_at ?? null
      const [rm, rr, fm, fr, snaps, archived, first, last, server, gaps] = await Promise.all([
        count('bf_markets', b => b.eq('sport', 'racing')), count('bf_markets', b => b.eq('sport', 'racing').not('status', 'is', null)),
        count('bf_markets', b => b.eq('sport', 'football')), count('bf_markets', b => b.eq('sport', 'football').not('status', 'is', null)),
        count('bf_snaps'), count('bf_markets', b => b.not('archived_at', 'is', null)).catch(() => 0), edge(true), edge(false),
        recorderStatus(db),
        // minutes in the last 24 hours where every Betfair check failed
        db.from('bf_recorder_min').select('minute', { count: 'exact', head: true }).gt('minute', new Date(Date.now() - 86_400_000).toISOString())
          .eq('checks_ok', 0).gt('checks_failed', 0).then(r => r.count ?? 0, () => 0),
      ])
      return NextResponse.json({ racing: { markets: rm, results: rr }, football: { markets: fm, results: fr }, snaps, archivedMarkets: archived,
        first: firstMarket && (!first || firstMarket < first) ? firstMarket : first, last, server, failedMinutes24h: gaps })
    }

    if (q.get('view') === 'recent') {
      const now = Date.now()
      const { data: markets, error } = await db.from('bf_markets')
        .select('market_id, event, venue, market_name, race_type, start_at, off_at, runners, status, winners, total_matched, archived_at')
        .eq('sport', 'racing').gte('start_at', new Date(now - 6 * 3600_000).toISOString()).lt('start_at', new Date(now + 3 * 3600_000).toISOString())
        .order('start_at', { ascending: true }).limit(80)
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? missing : error.message)
      // one small request per race: how many snapshots, and when the latest was saved
      const races = await Promise.all((markets ?? []).map(async m => {
        const { data, count } = await db.from('bf_snaps').select('at', { count: 'exact' }).eq('market_id', m.market_id).order('at', { ascending: false }).limit(1)
        const runners = Array.isArray(m.runners) ? m.runners.length : 0
        return { market_id: m.market_id, venue: m.venue ?? m.event, name: m.market_name, race_type: m.race_type, start_at: m.start_at, off_at: m.off_at,
          runners, status: m.status, winners: m.winners, matched: m.total_matched, snaps: count ?? 0, last_snap: data?.[0]?.at ?? null }
      }))
      return NextResponse.json({ races, now: new Date(now).toISOString() })
    }

    if (q.get('view') === 'race') {
      const id = q.get('id') ?? ''
      if (!/^1\.\d+$/.test(id)) return NextResponse.json({ error: 'Bad market id' }, { status: 400 })
      const { data: market, error } = await db.from('bf_markets')
        .select('market_id, event, venue, market_name, race_type, start_at, off_at, runners, status, winners, removed, total_matched, bsp').eq('market_id', id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!market) return NextResponse.json({ error: 'Race not found' }, { status: 404 })
      const { data: snaps, error: e2 } = await db.from('bf_snaps').select('at, inplay, matched, runners').eq('market_id', id).order('at', { ascending: true }).limit(1000)
      if (e2) throw new Error(e2.message)
      return NextResponse.json({ market, snaps: snaps ?? [] })
    }

    if (q.get('view') === 'export') {
      const sport = q.get('sport') === 'football' ? 'football' : 'racing'
      const from = q.get('from') ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
      const to = q.get('to') ?? new Date().toISOString()
      const page = Math.max(0, Number(q.get('page') ?? 0) || 0)
      const { data: markets, error } = await db.from('bf_markets')
        .select('market_id, sport, market_type, event_id, event, venue, start_at, runners, status, winners, removed, market_name, country, race_type, total_matched, off_at, bsp, archived_at')
        .eq('sport', sport).gte('start_at', from).lt('start_at', to).order('start_at', { ascending: true }).order('market_id')
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? missing : error.message)
      const live = (markets ?? []).filter(m => !m.archived_at).map(m => m.market_id)
      const snaps: { market_id: string }[] = []
      for (let i = 0; live.length && i < 20_000; i += 1000) {     // Supabase returns at most 1000 rows per request
        const { data, error: e2 } = await db.from('bf_snaps').select('market_id, at, inplay, matched, runners').in('market_id', live).order('id').range(i, i + 999)
        if (e2) throw new Error(e2.message)
        snaps.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      // Archived markets: read their day's file (the bucket is private, so via the server key).
      const archivedDays = new Map<string, Set<string>>()
      for (const m of (markets ?? []).filter(x => x.archived_at)) {
        const day = String(m.start_at).slice(0, 10)
        archivedDays.set(day, (archivedDays.get(day) ?? new Set()).add(m.market_id))
      }
      if (archivedDays.size) {
        const svc = createSupabaseServiceClient()
        for (const [day, ids] of archivedDays) {
          const { data: file, error: fe } = await svc.storage.from('betfair-archive').download(`${day}.json.gz`)
          if (fe || !file) throw new Error(`Archived file for ${day} could not be read: ${fe?.message ?? 'missing'}`)
          const parsed = JSON.parse(zlib.gunzipSync(Buffer.from(await file.arrayBuffer())).toString('utf8')) as { snaps: { market_id: string }[] }
          snaps.push(...parsed.snaps.filter(x => ids.has(x.market_id)))
        }
      }
      return NextResponse.json({ markets: markets ?? [], snaps, more: (markets?.length ?? 0) === PAGE })
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
