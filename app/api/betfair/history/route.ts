import { NextRequest, NextResponse } from 'next/server'
import type { BtSport } from '@/lib/betfair/backtest'
import { requireUser } from '@/lib/supabaseServer'
import { readHistoryIndex, readScoutReport } from '@/lib/betfair/archiveFile'

// What Betfair history has been imported (for the Backtest and Insights tabs).
//   GET ?sport=racing|football|tennis|golf -> { days, races (markets), from, to } or { days: 0 }
//   GET ?report=latest -> { report: markdown | null } (the scout's latest report)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  if (req.nextUrl.searchParams.get('report') === 'latest') {
    const r = await readScoutReport(auth.supabase)
    return NextResponse.json(r && typeof r === 'object' ? { report: null, error: r.error } : { report: r })
  }
  const q = req.nextUrl.searchParams.get('sport') ?? 'racing'
  const sport = (['racing', 'football', 'tennis', 'golf'].includes(q) ? q : 'racing') as BtSport
  const idx = await readHistoryIndex(auth.supabase, sport)
  if (!idx) return NextResponse.json({ days: 0, races: 0 })
  if ('error' in idx) return NextResponse.json({ days: 0, races: 0, error: idx.error })
  const days = Object.keys(idx.days).sort()
  return NextResponse.json({ days: days.length, races: Object.values(idx.days).reduce((a, b) => a + b, 0), from: days[0] ?? null, to: days[days.length - 1] ?? null, updated: idx.updated })
}
