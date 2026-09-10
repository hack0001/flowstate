// ============================================================
// Google Docs REST API client — real in-place editing for scripts
//
// Authenticates via Workspace domain-wide delegation, impersonating Tom's
// own Google account (see getImpersonatedAccessToken() in lib/googleDrive.ts)
// rather than the bare "flowstate-drive" service account. Tom's Workspace
// blocks sharing files with external accounts outright (confirmed: Google
// shows a "can't share outside your organization" warning), so per-doc
// sharing was a dead end — delegation sidesteps that by acting AS Tom, who
// already owns/has access to whatever doc he pastes in.
//
// This is what makes true in-place edits possible at all — unlike Claude's
// built-in Drive connector (claude.ai / Cowork's own Drive tools), which can
// only read a doc or create a new one, this calls docs.googleapis.com's
// batchUpdate directly, the same underlying mechanic third-party "Claude can
// edit Google Docs" tools use.
//
// SETUP REQUIRED (one-time, done by Tom as a Workspace Super Admin) — see
// the getImpersonatedAccessToken() header comment in lib/googleDrive.ts for
// the exact steps (Cloud Console domain-wide delegation + Admin Console
// authorization + GOOGLE_WORKSPACE_IMPERSONATE_EMAIL env var). Also make
// sure the "Google Docs API" is enabled for the same Google Cloud project
// the service account belongs to — Drive API being enabled doesn't
// automatically enable this, it's a separate flip in the Cloud Console's
// "APIs & Services" page.
//
// SERVER-ONLY — goes through lib/googleDrive.ts's getImpersonatedAccessToken(),
// which reads process.env.GOOGLE_DRIVE_PRIVATE_KEY. Never import this from a
// client component; all access goes through app/api/gdocs/route.ts.
// ============================================================

import { diffWordsWithSpace } from 'diff'
import { getImpersonatedAccessToken } from './googleDrive'

const DOCS_API = 'https://docs.googleapis.com/v1/documents'

// Accepts either a full Google Docs URL or a bare document ID.
export function extractDocId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
  return null
}

async function docsFetch(path: string, opts: RequestInit = {}) {
  const attempt = async (forceRefresh: boolean) => {
    const token = await getImpersonatedAccessToken(forceRefresh)
    const res = await fetch(DOCS_API + path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    })
    return res
  }

  let res = await attempt(false)

  // A cached token minted moments before a delegation grant fully propagated
  // (or before per-doc sharing was fixed) can look valid but keep getting
  // denied for up to its full ~1hr lifetime, even after the underlying
  // access is actually fine now -- a warm serverless instance holds onto it
  // in memory rather than re-minting. One automatic retry with a forced
  // fresh token clears that without needing a redeploy or a wait.
  if (res.status === 403) {
    res = await attempt(true)
  }

  if (!res.ok) {
    const body = await res.text()
    // Suggest mode (writeControl.writeMode = 'SUGGEST') is currently gated
    // behind Google's Workspace Developer Preview Program -- surface a
    // specific, actionable message instead of a raw API error when that's
    // the likely cause, so the UI can tell Tom exactly what to do.
    if (body.includes('SUGGEST') || /developer preview/i.test(body)) {
      throw new Error('Suggestion mode isn\'t available on this Google Cloud project yet -- it requires enrolling in the Google Workspace Developer Preview Program (needs a Workspace-domain email, not a personal Gmail). See https://developers.google.com/workspace/preview. Raw error: ' + body)
    }
    // A bare 403/PERMISSION_DENIED that survives even a forced-fresh token
    // is a real configuration problem, not a caching artifact.
    if (res.status === 403 && /PERMISSION_DENIED/i.test(body)) {
      throw new Error(
        'Permission denied (persisted after retrying with a fresh token). Since this uses domain-wide delegation (not per-doc sharing), check: (1) the service account\'s Client ID is authorized in Admin Console -> Security -> API Controls -> Domain-wide Delegation with scopes ' +
        'https://www.googleapis.com/auth/drive and https://www.googleapis.com/auth/documents, (2) GOOGLE_WORKSPACE_IMPERSONATE_EMAIL matches the Google account that actually owns/has access to this doc. Raw error: ' + body
      )
    }
    throw new Error('Google Docs API error ' + res.status + ': ' + body)
  }
  return res.json()
}

// Requests processed with writeMode 'SUGGEST' show up in Google Docs as
// real, colored suggestions -- exactly what you see when a collaborator
// edits in Suggesting mode -- which Tom can then Accept/Reject right there
// in the Docs UI, instead of the edit landing directly in the document.
//
// requiredRevisionId ties the write to the exact revision the indexes were
// calculated against (from documents.get). If the doc changed in between --
// e.g. Tom had it open and typed something while this was being prepared --
// Google rejects the whole batchUpdate instead of silently applying it
// against positions that have since shifted. Every write path refetches a
// snapshot right before diffing/writing, and patchGoogleDocText retries
// once (refetch + recompute) if this specific conflict happens.
function writeControlFor(suggest: boolean, revisionId?: string) {
  const writeControl: Record<string, string> = {}
  if (suggest) writeControl.writeMode = 'SUGGEST'
  if (revisionId) writeControl.requiredRevisionId = revisionId
  return Object.keys(writeControl).length ? { writeControl } : {}
}

function isRevisionConflict(e: unknown): boolean {
  return e instanceof Error && /revision/i.test(e.message)
}

// Google documents a "partial failure" mode for suggestion writes: the
// actual content change (insertText/deleteContentRange/etc) can commit
// successfully even when the metadata that marks it as a reviewable
// suggestion fails to save -- and the batchUpdate call still returns 200
// with no error when that happens. The only way to tell is this field on
// the response. This is what was happening here: the edit landed
// correctly, but silently as a direct edit instead of a suggestion,
// because the suggestion thread itself failed to save (most likely because
// this Cloud project isn't actually enrolled in the Workspace Developer
// Preview Program that real suggestion support requires -- see
// https://developers.google.com/workspace/docs/api/how-tos/suggestions#update-status).
function suggestionWarning(data: any, suggest: boolean): string | null {
  if (!suggest) return null
  const state = data?.commentUpdateState
  if (state && state !== 'ALL_SAVED') {
    return 'Applied directly instead of as a suggestion. Google confirmed the content change went through, but failed to save the "this is a suggestion" marker (commentUpdateState: ' + state + ') -- a partial failure Google documents as possible. This usually means the Cloud project behind the service account isn\'t enrolled in the Workspace Developer Preview Program for suggestions (https://developers.google.com/workspace/preview). Nothing was lost, but review the change directly in the doc since it wasn\'t left pending for Accept/Reject.'
  }
  return null
}

// Google's doc JSON is a deeply nested structural-element tree — this walks
// paragraphs (and paragraphs nested inside table cells, the only nesting a
// script doc is likely to have) and concatenates their text runs. Good
// enough for "show Claude the script" and "here's the plain text" — it
// intentionally does not try to preserve inline formatting (bold, links),
// since round-tripping that back through insertText isn't worth the
// complexity for a scripting workflow.
function extractParagraphText(paragraph: any): string {
  let text = ''
  for (const pe of paragraph?.elements ?? []) {
    if (pe.textRun?.content) text += pe.textRun.content
  }
  return text
}

function extractText(doc: any): string {
  let text = ''
  for (const el of doc.body?.content ?? []) {
    if (el.paragraph) text += extractParagraphText(el.paragraph)
    else if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellEl of cell.content ?? []) {
            if (cellEl.paragraph) text += extractParagraphText(cellEl.paragraph)
          }
        }
      }
    }
  }
  return text
}

export type GoogleDocSnapshot = { docId: string; title: string; text: string; endIndex: number; revisionId?: string }

export async function getGoogleDocText(docIdOrUrl: string): Promise<GoogleDocSnapshot> {
  const docId = extractDocId(docIdOrUrl)
  if (!docId) throw new Error('Could not find a Google Doc ID in that link.')
  // Explicitly request SUGGESTIONS_INLINE -- Google's docs warn that the
  // indices in a documents.get response can shift depending on this
  // parameter when a doc has pending suggestions in it (Tom's script doc
  // does), and that SUGGESTIONS_INLINE is specifically the representation
  // whose indices are safe to feed into a subsequent batchUpdate. Without
  // it, the API falls back to a privilege-based default that isn't
  // guaranteed to match -- harmless so far since it's happened to line up,
  // but not something to keep relying on for a diff that depends on exact
  // character offsets.
  const doc = await docsFetch('/' + docId + '?suggestionsViewMode=SUGGESTIONS_INLINE')
  const content = doc.body?.content ?? []
  const endIndex = content.length ? (content[content.length - 1].endIndex ?? 1) : 1
  return { docId, title: doc.title ?? 'Untitled', text: extractText(doc), endIndex, revisionId: doc.revisionId }
}

// Wipes the whole doc body and replaces it with newText. Simple and
// reliable — avoids tracking structural indices for partial in-place edits,
// which Google's API makes fiddly (indices shift as content changes). Best
// for "rewrite this whole script" / "tighten the intro" style requests
// where Claude regenerates the full text; for a single surgical swap use
// findReplaceInGoogleDoc instead, which doesn't touch anything else.
export async function replaceGoogleDocText(docIdOrUrl: string, newText: string, suggest = false): Promise<{ suggestionWarning: string | null }> {
  const { docId, endIndex, revisionId } = await getGoogleDocText(docIdOrUrl)
  const requests: any[] = []
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } })
  }
  if (newText) requests.push({ insertText: { location: { index: 1 }, text: newText } })
  const data = await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest, revisionId) }) })
  return { suggestionWarning: suggestionWarning(data, suggest) }
}

// Turns a word-level diff between the doc's current text and Claude's
// proposed text into targeted insertText/deleteContentRange requests, so
// "Apply to Google Doc" only touches what actually changed instead of
// nuking and reinserting the whole body. This matters a lot in suggestion
// mode: a whole-doc replace shows up in Google Docs as one giant
// accept-everything-or-reject-everything block, whereas this shows up as
// normal, reviewable track-changes-style suggestions -- strikethrough on
// the words that changed, underline on their replacements, everything
// else in the doc left completely alone (so unrelated formatting on
// untouched text survives too).
//
// Index bookkeeping: Google Docs body indices are 1-based UTF-16 offsets.
// We walk the diff parts in document order, tracking `origIndex` -- the
// position we're at in the ORIGINAL (currently-live) text. Unchanged and
// removed parts advance it (they exist in the original); added parts
// don't (they're new, so they don't correspond to any original position --
// an addition is recorded at whatever origIndex has reached so far, i.e.
// immediately after anything already consumed). A "word changed" diff
// produces a removed part immediately followed (or preceded) by an added
// part -- since only `removed` advances origIndex, both end up anchored at
// the same start position, which is exactly what you want for an in-place
// replacement.
//
// A single batchUpdate call applies its requests in order, and each one's
// indices are evaluated against the document AS MUTATED BY THE PRIOR
// requests in that same call -- not the original. So requests are emitted
// back-to-front (highest original position first): once you've mutated
// something near the end of the doc, positions before that mutation are
// completely unaffected and can still use their original index values.
// For a delete+insert pair anchored at the exact same position, delete is
// ordered before insert -- deleting the old range first leaves a gap at
// that same start index, and inserting there lands the new text exactly
// where the old text was.
// docEndIndex is the document body's real endIndex from the API (not
// inferred) -- every paragraph, and the body as a whole, ends with an
// implicit newline that Google will not let any request touch: insertText
// must land strictly before it, and deleteContentRange must stop strictly
// before it too (mirroring replaceGoogleDocText's own `endIndex - 1`
// above). Skipping this clamp is what caused "Index N must be less than
// the end index of the referenced segment, N" -- a diff that adds new
// content at the very end of the doc naturally lands its insert exactly
// on that reserved boundary.
function computeDiffRequests(oldText: string, newText: string, docEndIndex: number): any[] {
  if (oldText === newText) return []
  const maxIndex = docEndIndex - 1
  const parts = diffWordsWithSpace(oldText, newText)
  type Hunk = { kind: 'delete' | 'insert'; start: number; text: string }
  const hunks: Hunk[] = []
  let origIndex = 1
  for (const part of parts) {
    if (part.added) {
      if (part.value) hunks.push({ kind: 'insert', start: Math.min(origIndex, maxIndex), text: part.value })
    } else if (part.removed) {
      if (part.value) {
        const start = origIndex
        const end = Math.min(origIndex + part.value.length, maxIndex)
        if (end > start) hunks.push({ kind: 'delete', start, text: part.value.slice(0, end - start) })
      }
      origIndex += part.value.length
    } else {
      origIndex += part.value.length
    }
  }
  hunks.sort((a, b) => (b.start !== a.start ? b.start - a.start : (a.kind === 'delete' ? -1 : 1)))
  return hunks.map(h => h.kind === 'delete'
    ? { deleteContentRange: { range: { startIndex: h.start, endIndex: h.start + h.text.length } } }
    : { insertText: { location: { index: h.start }, text: h.text } })
}

// The real "Apply to Google Doc" path for the Rewrite tool -- fetches the
// doc fresh (so it diffs against whatever's live right now, self-healing
// against any staleness since the text was generated), diffs it against
// Claude's proposed text, and sends only the targeted edits. Falls back to
// doing nothing if the diff finds no actual changes.
export async function patchGoogleDocText(docIdOrUrl: string, newText: string, suggest = false): Promise<{ changed: boolean; suggestionWarning: string | null }> {
  const attempt = async (): Promise<{ changed: boolean; suggestionWarning: string | null }> => {
    const { docId, text: currentText, endIndex, revisionId } = await getGoogleDocText(docIdOrUrl)
    // The diff walk assumes every character of currentText maps 1:1 to a
    // document index -- true for plain paragraphs of text, which covers a
    // normal script doc. If the doc has something that occupies index space
    // without producing extracted text (an inline image, a page break, a
    // structural element extractText() doesn't walk), that assumption
    // breaks and a positional diff could misplace edits elsewhere in the doc.
    if (currentText.length !== endIndex - 1) {
      // In suggest mode, the only safe fallback left is a whole-document
      // delete+insert -- which would show up in Docs as ONE giant
      // accept-or-reject-everything suggestion, exactly the "overwriter"
      // behavior this feature exists to avoid. Refuse instead of silently
      // doing that; a direct edit (suggest=false) is still fine since it
      // doesn't create a misleading suggestion.
      if (suggest) {
        throw new Error('This document has something (an image, table, or other structural element) that makes precise, per-word suggestions unsafe to compute right now. Turn off "Apply as a suggestion" to apply this as a direct edit instead, or make this particular change by hand in Google Docs.')
      }
      const { suggestionWarning: warning } = await replaceGoogleDocText(docIdOrUrl, newText, suggest)
      return { changed: true, suggestionWarning: warning }
    }
    const requests = computeDiffRequests(currentText, newText, endIndex)
    if (requests.length === 0) return { changed: false, suggestionWarning: null }
    const data = await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest, revisionId) }) })
    return { changed: true, suggestionWarning: suggestionWarning(data, suggest) }
  }
  try {
    return await attempt()
  } catch (e) {
    // The doc changed between our read and our write -- e.g. it was open
    // and being typed into at the same time. Refetch and recompute the
    // diff against the new state once before giving up, rather than either
    // applying against stale positions or failing on a race that a simple
    // retry would clear.
    if (isRevisionConflict(e)) return await attempt()
    throw e
  }
}

// Applies ONE specific, already-approved edit -- the write side of the
// app-level review flow (Claude proposes a list of small {originalText,
// replacementText} edits, the app shows each as a card, and only clicking
// Accept calls this). This exists as an alternative to Google's native
// writeMode: SUGGEST, which is gated behind Google's Workspace Developer
// Preview Program and has proven unreliable here (see suggestionWarning
// above) -- this doesn't depend on that at all. The review/approval step
// happens in the app; by the time this runs, the edit is already decided,
// so it's applied as a normal direct edit (small and precise, not a
// whole-doc replace) unless suggest is explicitly requested too, in which
// case it also tries writeMode: SUGGEST for this one small range.
//
// Always re-fetches fresh and locates originalText by an exact, live
// string search rather than trusting any previously-computed index --
// self-healing against the doc having changed (including from *other*
// edits in the same review batch that were just accepted) without needing
// to track shifting positions across multiple accepts. Refuses to guess if
// the text isn't found, or is ambiguous (appears more than once), rather
// than risk touching the wrong occurrence.
export async function applyProposedEdit(docIdOrUrl: string, originalText: string, replacementText: string, suggest = false): Promise<{ suggestionWarning: string | null }> {
  const attempt = async (): Promise<{ suggestionWarning: string | null }> => {
    const { docId, text: currentText, revisionId } = await getGoogleDocText(docIdOrUrl)
    const occurrences: number[] = []
    let searchFrom = 0
    while (true) {
      const idx = currentText.indexOf(originalText, searchFrom)
      if (idx === -1) break
      occurrences.push(idx)
      searchFrom = idx + Math.max(originalText.length, 1)
    }
    if (occurrences.length === 0) {
      throw new Error('Could not find that exact text in the document anymore -- it may have already changed. Refresh and try again.')
    }
    if (occurrences.length > 1) {
      throw new Error('That text appears ' + occurrences.length + ' times in the document -- too ambiguous to apply safely without risking the wrong spot. Edit it directly in Google Docs instead, or ask for a more specific edit.')
    }
    const startIndex = occurrences[0] + 1 // 1-based Google Docs index
    const requests: any[] = []
    if (originalText.length > 0) requests.push({ deleteContentRange: { range: { startIndex, endIndex: startIndex + originalText.length } } })
    if (replacementText) requests.push({ insertText: { location: { index: startIndex }, text: replacementText } })
    if (requests.length === 0) return { suggestionWarning: null }
    const data = await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest, revisionId) }) })
    return { suggestionWarning: suggestionWarning(data, suggest) }
  }
  try {
    return await attempt()
  } catch (e) {
    if (isRevisionConflict(e)) return await attempt()
    throw e
  }
}

function hexToRgbColor(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace('#', '')
  return {
    red: parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue: parseInt(clean.substring(4, 6), 16) / 255,
  }
}

// Inserts a short, colored visual-direction note as its own new line
// directly under a specific script line -- the write side of the Script
// Editor's storyboard tab (Accept on a visual-breakdown card calls this).
// Locates the script line by exact, live string match (same self-healing
// approach as applyProposedEdit, not a stored index), then inserts
// "\n" + noteText right after the line so the note becomes its own
// paragraph immediately following the line's paragraph, and colors just
// the note text via updateTextStyle (bold + the category's color) so it
// reads as a director's note rather than more script.
export async function insertVisualNoteInGoogleDoc(docIdOrUrl: string, scriptLine: string, noteText: string, colorHex: string, suggest = false): Promise<{ suggestionWarning: string | null }> {
  const attempt = async (): Promise<{ suggestionWarning: string | null }> => {
    const { docId, text: currentText, endIndex, revisionId } = await getGoogleDocText(docIdOrUrl)
    const occurrences: number[] = []
    let searchFrom = 0
    while (true) {
      const idx = currentText.indexOf(scriptLine, searchFrom)
      if (idx === -1) break
      occurrences.push(idx)
      searchFrom = idx + Math.max(scriptLine.length, 1)
    }
    if (occurrences.length === 0) {
      throw new Error('Could not find that line in the document anymore -- it may have already changed. Reload and try again.')
    }
    if (occurrences.length > 1) {
      throw new Error('That line appears ' + occurrences.length + ' times in the document -- too ambiguous to place the note safely. Edit it directly in Google Docs instead.')
    }
    const maxIndex = endIndex - 1
    const insertAt = Math.min(occurrences[0] + 1 + scriptLine.length, maxIndex)
    const noteStart = insertAt + 1 // +1 to skip the leading newline we're inserting
    const requests: any[] = [
      { insertText: { location: { index: insertAt }, text: '\n' + noteText } },
      { updateTextStyle: {
          range: { startIndex: noteStart, endIndex: noteStart + noteText.length },
          textStyle: { foregroundColor: { color: { rgbColor: hexToRgbColor(colorHex) } }, bold: true },
          fields: 'foregroundColor,bold',
        } },
    ]
    const data = await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest, revisionId) }) })
    return { suggestionWarning: suggestionWarning(data, suggest) }
  }
  try {
    return await attempt()
  } catch (e) {
    if (isRevisionConflict(e)) return await attempt()
    throw e
  }
}

// Surgical find/replace across the whole doc — swap a name, fix a repeated
// phrase, tighten one line — without regenerating or touching anything
// else. Returns how many occurrences were changed.
// No requiredRevisionId here on purpose -- replaceAllText matches by live
// text content, not fixed positions, so a doc that changed since it was
// last viewed doesn't create the corruption risk a positional edit would;
// requiring an exact revision match would only add failures for no benefit.
export async function findReplaceInGoogleDoc(docIdOrUrl: string, findText: string, replaceText: string, matchCase = false, suggest = false): Promise<{ occurrencesChanged: number; suggestionWarning: string | null }> {
  const docId = extractDocId(docIdOrUrl)
  if (!docId) throw new Error('Could not find a Google Doc ID in that link.')
  const data = await docsFetch('/' + docId + ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ replaceAllText: { containsText: { text: findText, matchCase }, replaceText } }], ...writeControlFor(suggest) }),
  })
  return { occurrencesChanged: data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0, suggestionWarning: suggestionWarning(data, suggest) }
}

// Appends text to the end of the doc — e.g. adding a new section — without
// touching what's already there.
export async function appendToGoogleDoc(docIdOrUrl: string, text: string, suggest = false): Promise<{ suggestionWarning: string | null }> {
  const { docId, endIndex, revisionId } = await getGoogleDocText(docIdOrUrl)
  const data = await docsFetch('/' + docId + ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ insertText: { location: { index: Math.max(1, endIndex - 1) }, text } }], ...writeControlFor(suggest, revisionId) }),
  })
  return { suggestionWarning: suggestionWarning(data, suggest) }
}
