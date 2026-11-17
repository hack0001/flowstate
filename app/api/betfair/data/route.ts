import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'

// Recorded Betfair prices (the Data tab of /betfair).
//   GET ?view=summary                                    -> counts and date range
//   GET ?view=export&sport=racing|football&from&to&page  -> one page of markets and their snapshots
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PAGE = 20   // markets per export page (a race has up to ~50 snapshots)
const missing = 'The price recorder tables are missing: run supabase/migrations/052_betfair_prices.sql in the Supabase SQL editor.'

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
      const [rm, rr, fm, fr, snaps, first, last] = await Promise.all([
        count('bf_markets', b => b.eq('sport', 'racing')), count('bf_markets', b => b.eq('sport', 'racing').not('status', 'is', null)),
        count('bf_markets', b => b.eq('sport', 'football')), count('bf_markets', b => b.eq('sport', 'football').not('status', 'is', null)),
        count('bf_snaps'), edge(true), edge(false),
      ])
      return NextResponse.json({ racing: { markets: rm, results: rr }, football: { markets: fm, results: fr }, snaps, first, last })
    }

    if (q.get('view') === 'export') {
      const sport = q.get('sport') === 'football' ? 'football' : 'racing'
      const from = q.get('from') ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
      const to = q.get('to') ?? new Date().toISOString()
      const page = Math.max(0, Number(q.get('page') ?? 0) || 0)
      const { data: markets, error } = await db.from('bf_markets')
        .select('market_id, sport, market_type, event_id, event, venue, start_at, runners, status, winners, removed')
        .eq('sport', sport).gte('start_at', from).lt('start_at', to).order('start_at', { ascending: true }).order('market_id')
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? missing : error.message)
      const ids = (markets ?? []).map(m => m.market_id)
      const snaps: unknown[] = []
      for (let i = 0; ids.length && i < 20_000; i += 1000) {     // Supabase returns at most 1000 rows per request
        const { data, error: e2 } = await db.from('bf_snaps').select('market_id, at, inplay, matched, runners').in('market_id', ids).order('id').range(i, i + 999)
        if (e2) throw new Error(e2.message)
        snaps.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      return NextResponse.json({ markets: markets ?? [], snaps, more: (markets?.length ?? 0) === PAGE })
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
