import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import { discoverSites, syncSite, recordSyncError } from '@/lib/searchConsole'

// Nightly sync, triggered by Vercel Cron (see vercel.json).
//
// This path is deliberately exempt from the login middleware -- a cron job
// has no browser session -- so it authenticates ITSELF: Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET env var is set.
// If the secret isn't configured the route refuses to run at all (fails
// closed) rather than being callable by anyone who guesses the URL.
export const maxDuration = 60

const TIME_BUDGET_MS = 50_000

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = 'Bearer ' + secret
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const started = Date.now()
  try {
    // Service-role client: no user session exists here. Bypasses RLS, so
    // this file must only ever do the fixed sync work below.
    const db = createSupabaseServiceClient()
    await discoverSites(db)

    // Least-recently-synced first, so if the time budget runs out the
    // stragglers are first in line on the next run.
    const { data: sites } = await db
      .from('gsc_sites').select('site_url').eq('tracked', true)
      .order('last_synced_at', { ascending: true, nullsFirst: true })

    const done: string[] = []
    const failed: { siteUrl: string; error: string }[] = []
    for (const s of sites ?? []) {
      if (Date.now() - started > TIME_BUDGET_MS) break
      try {
        await syncSite(db, s.site_url)
        done.push(s.site_url)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        failed.push({ siteUrl: s.site_url, error: message })
        await recordSyncError(db, s.site_url, message)
      }
    }
    return NextResponse.json({ ok: true, synced: done.length, failed, remaining: (sites?.length ?? 0) - done.length - failed.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
