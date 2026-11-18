import { NextRequest, NextResponse } from 'next/server'
import zlib from 'zlib'
import { createSupabaseServiceClient, requireUser } from '@/lib/supabaseServer'
import { recorderStatus } from '@/lib/betfair/recorderStatus'

// Recorded Betfair prices (the Data tab of /betfair).
//   GET ?view=summary                                    -> counts and date range
//   GET ?view=export&sport=racing|football&from&to&page  -> one page of markets and their snapshots
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
