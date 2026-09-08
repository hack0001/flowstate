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
  try {
    const { action, url, text, find, replace, matchCase } = await req.json()
    if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 })

    if (action === 'replace_all') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      await replaceGoogleDocText(url, text)
      return NextResponse.json({ ok: true })
    }
    if (action === 'find_replace') {
      if (typeof find !== 'string' || typeof replace !== 'string') return NextResponse.json({ error: 'Missing find/replace.' }, { status: 400 })
      const occurrencesChanged = await findReplaceInGoogleDoc(url, find, replace, !!matchCase)
      return NextResponse.json({ ok: true, occurrencesChanged })
    }
    if (action === 'append') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      await appendToGoogleDoc(url, text)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Unknown action — use 'replace_all', 'find_replace', or 'append'." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
