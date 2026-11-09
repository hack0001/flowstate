import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import { runOnce } from '@/lib/betfair/run'

// OPTIONAL background runner, so the desk keeps polling with the tab closed.
//
// Not scheduled by default: Vercel's free (Hobby) plan only allows crons once
// a day, and adding a per-minute one there makes deployments fail. On Vercel
// Pro, add this to vercel.json "crons":
//   { "path": "/api/betfair/cron", "schedule": "* * * * *" }
// It then polls every 10s for ~50s of each minute.
//
// Exempt from the login middleware (cron has no session), so it checks the
// CRON_SECRET bearer token itself and fails closed without it, like
// /api/gsc/cron. Only ever does the fixed paper-trading poll below.
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

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createSupabaseServiceClient()
  const started = Date.now()
  let polls = 0
  const errors: string[] = []
  while (Date.now() - started < 50_000) {
    const r = await runOnce(db)
    if (r.error) errors.push(r.error)
    if (!r.ran && !r.error) break      // bot is stopped
    polls++
    await new Promise(res => setTimeout(res, 10_000))
  }
  return NextResponse.json({ ok: true, polls, errors })
}
