import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'

// The fade-drift paper bot's trades (written by the recorder server, migration 059).
//   GET -> { trades: [...latest 200 with horse names], totals }
export const dynamic = 'force-dynamic'

type Row = { market_id: string; selection_id: number; race: string | null; start_at: string; entry_at: string; entry_price: number; exit_at: string | null
  exit_price: number | null; drift_ticks: number; ref_price: number; pnl: number | null; stake: number; status: string }

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const db = auth.supabase
  const { data, error } = await db.from('bf_paper_fade').select('*').order('entry_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) ? 'Run supabase/migrations/059_betfair_paper_fade.sql in the Supabase SQL editor to switch the paper bot on.' : error.message })
  const rows = (data ?? []) as Row[]
  // horse names from the recorded race details
  const ids = Array.from(new Set(rows.slice(0, 200).map(r => r.market_id)))
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data: ms } = await db.from('bf_markets').select('market_id, runners').in('market_id', ids.slice(i, i + 100))
    for (const m of (ms ?? []) as { market_id: string; runners: { id: number; name: string }[] | null }[]) for (const r of m.runners ?? []) names.set(`${m.market_id}:${r.id}`, r.name)
  }
  const done = rows.filter(r => r.pnl !== null)
  const pnl = done.reduce((a, r) => a + (r.pnl ?? 0), 0), staked = done.reduce((a, r) => a + (r.stake ?? 2), 0)
  const rets = done.map(r => (r.pnl ?? 0) / (r.stake || 2)), m = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((a, x) => a + (x - m) ** 2, 0) / (rets.length - 1)) : 0
  return NextResponse.json({
    trades: rows.slice(0, 200).map(r => ({ ...r, horse: names.get(`${r.market_id}:${r.selection_id}`) ?? String(r.selection_id) })),
    totals: { trades: done.length, open: rows.length - done.length, won: done.filter(r => (r.pnl ?? 0) > 0).length, pnl, staked, roi: staked ? pnl / staked : 0, t: sd > 0 ? m / (sd / Math.sqrt(rets.length)) : 0,
      first: rows.length ? rows[rows.length - 1].entry_at : null },
  })
}
