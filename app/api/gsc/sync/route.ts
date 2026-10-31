import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { discoverSites, syncSite, recordSyncError } from '@/lib/searchConsole'

// Manual sync, driven by the buttons on the SEO dashboard (app/seo).
//   { action: 'discover' }              -> find new Search Console properties
//   { action: 'site', siteUrl: '...' }  -> pull fresh data for ONE site
// One site per request on purpose, so a long list of sites can never run into
// a serverless time limit -- the dashboard just calls this once per site.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const db = auth.supabase

  const body = await req.json().catch(() => ({})) as { action?: string; siteUrl?: string }

  try {
    if (body.action === 'discover') {
      const sites = await discoverSites(db)
      return NextResponse.json({ ok: true, found: sites.length })
    }

    if (body.action === 'site') {
      if (!body.siteUrl) return NextResponse.json({ error: 'Missing siteUrl.' }, { status: 400 })
      // Only sync properties we already know about (discovered from the
      // account's own list) -- never an arbitrary caller-supplied URL.
      const { data: known } = await db.from('gsc_sites').select('site_url').eq('site_url', body.siteUrl).maybeSingle()
      if (!known) return NextResponse.json({ error: 'Unknown site. Run discovery first.' }, { status: 404 })
      try {
        const result = await syncSite(db, body.siteUrl)
        return NextResponse.json({ ok: true, result })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await recordSyncError(db, body.siteUrl, message)
        return NextResponse.json({ error: message }, { status: 502 })
      }
    }

    return NextResponse.json({ error: "Unknown action — use 'discover' or 'site'." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
