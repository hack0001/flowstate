import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { runStrategiesOnce, setStrategies, strategiesSnapshot } from '@/lib/betfair/stratRun'
import { hasCredentials } from '@/lib/betfair/live'

// Football strategy paper tests (the Strategies tab of /betfair).
//   GET                         -> scoreboard snapshot
//   POST {action:'tick'}        -> run one poll (the page calls this while running)
//   POST {action:'start'|'stop'|'reset'|'mode', mode?:'demo'|'live'}
//
// Pinned to London: Betfair refuses logins from US IPs (Vercel's default region).
export const preferredRegion = 'lhr1'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json({ ...(await strategiesSnapshot(auth.supabase)), liveReady: hasCredentials() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({})) as { action?: string; mode?: string }
  const mode = body.mode === 'live' || body.mode === 'demo' ? body.mode : undefined
  let tickError: string | undefined
  try {
    switch (body.action) {
      case 'tick':
        tickError = (await runStrategiesOnce(auth.supabase)).error
        break
      case 'start':
        if ((mode ?? (await strategiesSnapshot(auth.supabase)).mode) === 'live' && !hasCredentials()) {
          return NextResponse.json({ error: 'Add BF_USERNAME, BF_PASSWORD and BF_APP_KEY in Vercel → Settings → Environment Variables, then redeploy.' }, { status: 400 })
        }
        if (mode) await setStrategies(auth.supabase, { mode })
        await setStrategies(auth.supabase, { running: true })
        break
      case 'stop':
        await setStrategies(auth.supabase, { running: false })
        break
      case 'reset':
        await setStrategies(auth.supabase, { reset: true, mode })
        break
      case 'mode':
        if (mode) await setStrategies(auth.supabase, { mode })
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ...(await strategiesSnapshot(auth.supabase)), liveReady: hasCredentials(), tickError })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
