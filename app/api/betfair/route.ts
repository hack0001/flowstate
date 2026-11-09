import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { runOnce, setBot, snapshot } from '@/lib/betfair/run'
import { hasCredentials } from '@/lib/betfair/live'

// Betfair paper desk API.
//   GET                         -> dashboard snapshot
//   POST {action:'tick'}        -> run one poll (the page calls this every 5s while running)
//   POST {action:'start'|'stop'|'reset', mode?:'demo'|'live'}
//
// Pinned to London: Betfair refuses logins from US IPs (Vercel's default region).
export const preferredRegion = 'lhr1'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json({ ...(await snapshot(auth.supabase)), liveReady: hasCredentials() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({})) as { action?: string; mode?: string }
  const mode = body.mode === 'live' || body.mode === 'demo' ? body.mode : undefined
  try {
    switch (body.action) {
      case 'tick': {
        const r = await runOnce(auth.supabase)
        if (r.error) return NextResponse.json({ ...(await snapshot(auth.supabase)), liveReady: hasCredentials(), tickError: r.error })
        break
      }
      case 'start':
        if ((mode ?? (await snapshot(auth.supabase)).mode) === 'live' && !hasCredentials()) {
          return NextResponse.json({ error: 'Add BF_USERNAME, BF_PASSWORD and BF_APP_KEY in Vercel → Settings → Environment Variables, then redeploy.' }, { status: 400 })
        }
        if (mode) await setBot(auth.supabase, { mode })
        await setBot(auth.supabase, { running: true })
        break
      case 'stop':
        await setBot(auth.supabase, { running: false })
        break
      case 'reset':
        await setBot(auth.supabase, { reset: true, mode })
        break
      case 'mode':
        if (mode) await setBot(auth.supabase, { mode })
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ...(await snapshot(auth.supabase)), liveReady: hasCredentials() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
