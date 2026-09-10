import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDocText, patchGoogleDocText, findReplaceInGoogleDoc, appendToGoogleDoc, applyProposedEdit, insertVisualNoteInGoogleDoc } from '@/lib/googleDocs'

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
  // Kept lightweight debug info on errors -- the earlier "permission denied"
  // saga turned out to be a wrong doc URL (a stale link saved against a
  // focus-video's script_url), not an auth bug, and having the received
  // URL/text length surface in the UI is what caught that. Cheap to keep.
  let parsed: { action?: string; url?: string; text?: string; find?: string; replace?: string; matchCase?: boolean; suggest?: boolean; originalText?: string; replacementText?: string; scriptLine?: string; noteText?: string; colorHex?: string } = {}
  try {
    parsed = await req.json()
    const { action, url, text, find, replace, matchCase, suggest, originalText, replacementText, scriptLine, noteText, colorHex } = parsed
    if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 })

    if (action === 'replace_all') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      const { changed, suggestionWarning } = await patchGoogleDocText(url, text, !!suggest)
      return NextResponse.json({ ok: true, changed, suggestionWarning })
    }
    if (action === 'find_replace') {
      if (typeof find !== 'string' || typeof replace !== 'string') return NextResponse.json({ error: 'Missing find/replace.' }, { status: 400 })
      const { occurrencesChanged, suggestionWarning } = await findReplaceInGoogleDoc(url, find, replace, !!matchCase, !!suggest)
      return NextResponse.json({ ok: true, occurrencesChanged, suggestionWarning })
    }
    if (action === 'append') {
      if (typeof text !== 'string') return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
      const { suggestionWarning } = await appendToGoogleDoc(url, text, !!suggest)
      return NextResponse.json({ ok: true, suggestionWarning })
    }
    if (action === 'apply_edit') {
      // Accept-one-proposed-edit -- the write side of the app-level AI
      // review flow (see app/script-editor/page.tsx's edit cards). Each
      // call is independent and re-locates originalText fresh in the live
      // doc, so accepting edits out of order or one at a time is safe.
      if (typeof originalText !== 'string' || typeof replacementText !== 'string') {
        return NextResponse.json({ error: 'Missing originalText/replacementText.' }, { status: 400 })
      }
      const { suggestionWarning } = await applyProposedEdit(url, originalText, replacementText, !!suggest)
      return NextResponse.json({ ok: true, suggestionWarning })
    }
    if (action === 'insert_visual_note') {
      // Write side of the Script Editor's storyboard tab -- Accept on a
      // visual-breakdown card lands here, inserting a colored note line
      // right under the script line it describes.
      if (typeof scriptLine !== 'string' || typeof noteText !== 'string' || typeof colorHex !== 'string') {
        return NextResponse.json({ error: 'Missing scriptLine/noteText/colorHex.' }, { status: 400 })
      }
      const { suggestionWarning } = await insertVisualNoteInGoogleDoc(url, scriptLine, noteText, colorHex, !!suggest)
      return NextResponse.json({ ok: true, suggestionWarning })
    }
    return NextResponse.json({ error: "Unknown action — use 'replace_all', 'find_replace', 'append', 'apply_edit', or 'insert_visual_note'." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({
      error: String(e),
      debug: {
        receivedAction: parsed.action ?? null,
        receivedUrl: parsed.url ?? null,
        receivedTextLen: parsed.text?.length ?? null,
        receivedSuggest: parsed.suggest ?? null,
      },
    }, { status: 500 })
  }
}
