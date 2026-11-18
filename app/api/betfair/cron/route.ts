import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import { runOnce } from '@/lib/betfair/run'
import { runStrategiesOnce } from '@/lib/betfair/stratRun'

// Background runner, so both bots keep going with the tab closed. It only
// keeps running what you started: a bot that is stopped stays stopped.
//
// Two ways to call it every minute:
//   - Free: Supabase Cron (pg_cron + pg_net) in your own Supabase project.
//     The SQL is on the Setup tab. Uses ?polls=1, one quick look per minute.
//   - Vercel Pro: add { "path": "/api/betfair/cron?polls=5", "schedule": "* * * * *" }
//     to vercel.json "crons". (Vercel's free plan only allows daily crons.)
//
// ?polls=N (1-5): how many racing checks to make, 10 seconds apart. The football
// tests always get one check per call.
//
// Exempt from the login middleware (a scheduler has no session), so it checks the
// CRON_SECRET bearer token itself and fails closed without it, like
// /api/gsc/cron. Only ever does the fixed paper-trading polls below.
export const preferredRegion = 'lhr1'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const a = Buffer.from(req.headers.get('authorization') ?? '')
  const b = Buffer.from('Bearer ' + secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function handle(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createSupabaseServiceClient()
  const want = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get('polls') ?? 1) || 1))
  let polls = 0
  const errors: string[] = []
  try {
    const s = await runStrategiesOnce(db)
    if (s.error) errors.push('strategies: ' + s.error)
  } catch (e) {
    errors.push('strategies: ' + (e instanceof Error ? e.message : String(e)))
  }
  for (let i = 0; i < want; i++) {
    if (i) await new Promise(res => setTimeout(res, 10_000))
    try {
      const r = await runOnce(db)
      if (r.error) errors.push('racing: ' + r.error)
      if (!r.ran && !r.error) break      // racing bot is stopped
      polls++
    } catch (e) {
      errors.push('racing: ' + (e instanceof Error ? e.message : String(e)))
      break
    }
  }
  return NextResponse.json({ ok: true, polls, errors })
}

export const GET = handle
export const POST = handle
