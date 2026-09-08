import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDocText, replaceGoogleDocText, findReplaceInGoogleDoc, appendToGoogleDoc } from '@/lib/googleDocs'

// Powers app/script-editor/page.tsx — real in-place Google Docs edits via
// the Docs API (not just Drive read/create, which is all Claude's built-in
// connector can do). See lib/googleDocs.ts header for the one-time setup
// (share the doc with the service account, enable the Docs API).

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 })
  try {
    const snapshot = await getGoogleDocText(url)
    return NextResponse.json(snapshot)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // TEMPORARY: verbose diagnostics on the REAL endpoint, not a parallel
  // replica -- every hand-built replica of this exact operation (see
  // app/api/gdocs/debug/route.ts, probes 1-4) has succeeded against the same
  // doc, same token, same request shape, including a full-document
  // delete+reinsert and a SUGGEST-mode write. So the gap has to be something
  // about what THIS route actually receives or does at runtime that isn't
  // reproduced by a synthetic test -- logging it here is the only way left
  // to see it. Safe to trim back down once this is resolved.
  let parsed: { action?: string; url?: string; text?: string; find?: string; replace?: string; matchCase?: boolean; suggest?: boolean } = {}
  try {
    parsed = await req.json()
    const { action, url, text, find, replace, matchCase, suggest } = parsed
    console.log('[gdocs POST] received', { action, url, textLen: text?.length, find, replace, matchCase, suggest })
    if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 })

    if (action === 'replace_all') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      await replaceGoogleDocText(url, text, !!suggest)
      return NextResponse.json({ ok: true })
    }
    if (action === 'find_replace') {
      if (typeof find !== 'string' || typeof replace !== 'string') return NextResponse.json({ error: 'Missing find/replace.' }, { status: 400 })
      const occurrencesChanged = await findReplaceInGoogleDoc(url, find, replace, !!matchCase, !!suggest)
      return NextResponse.json({ ok: true, occurrencesChanged })
    }
    if (action === 'append') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      await appendToGoogleDoc(url, text, !!suggest)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Unknown action — use 'replace_all', 'find_replace', or 'append'." }, { status: 400 })
  } catch (e) {
    console.error('[gdocs POST] threw', e)
    return NextResponse.json({
      error: String(e),
      debug: {
        receivedAction: parsed.action ?? null,
        receivedUrl: parsed.url ?? null,
        receivedTextLen: parsed.text?.length ?? null,
        receivedSuggest: parsed.suggest ?? null,
        errorName: e instanceof Error ? e.name : typeof e,
        errorStack: e instanceof Error ? e.stack : undefined,
      },
    }, { status: 500 })
  }
}
