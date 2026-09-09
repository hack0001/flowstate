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
function writeControlFor(suggest: boolean) {
  return suggest ? { writeControl: { writeMode: 'SUGGEST' } } : {}
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

export type GoogleDocSnapshot = { docId: string; title: string; text: string; endIndex: number }

export async function getGoogleDocText(docIdOrUrl: string): Promise<GoogleDocSnapshot> {
  const docId = extractDocId(docIdOrUrl)
  if (!docId) throw new Error('Could not find a Google Doc ID in that link.')
  const doc = await docsFetch('/' + docId)
  const content = doc.body?.content ?? []
  const endIndex = content.length ? (content[content.length - 1].endIndex ?? 1) : 1
  return { docId, title: doc.title ?? 'Untitled', text: extractText(doc), endIndex }
}

// Wipes the whole doc body and replaces it with newText. Simple and
// reliable — avoids tracking structural indices for partial in-place edits,
// which Google's API makes fiddly (indices shift as content changes). Best
// for "rewrite this whole script" / "tighten the intro" style requests
// where Claude regenerates the full text; for a single surgical swap use
// findReplaceInGoogleDoc instead, which doesn't touch anything else.
export async function replaceGoogleDocText(docIdOrUrl: string, newText: string, suggest = false): Promise<void> {
  const { docId, endIndex } = await getGoogleDocText(docIdOrUrl)
  const requests: any[] = []
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } })
  }
  if (newText) requests.push({ insertText: { location: { index: 1 }, text: newText } })
  await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest) }) })
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
function computeDiffRequests(oldText: string, newText: string): any[] {
  if (oldText === newText) return []
  const parts = diffWordsWithSpace(oldText, newText)
  type Hunk = { kind: 'delete' | 'insert'; start: number; text: string }
  const hunks: Hunk[] = []
  let origIndex = 1
  for (const part of parts) {
    if (part.added) {
      if (part.value) hunks.push({ kind: 'insert', start: origIndex, text: part.value })
    } else if (part.removed) {
      if (part.value) hunks.push({ kind: 'delete', start: origIndex, text: part.value })
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
export async function patchGoogleDocText(docIdOrUrl: string, newText: string, suggest = false): Promise<{ changed: boolean }> {
  const { docId, text: currentText } = await getGoogleDocText(docIdOrUrl)
  const requests = computeDiffRequests(currentText, newText)
  if (requests.length === 0) return { changed: false }
  await docsFetch('/' + docId + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests, ...writeControlFor(suggest) }) })
  return { changed: true }
}

// Surgical find/replace across the whole doc — swap a name, fix a repeated
// phrase, tighten one line — without regenerating or touching anything
// else. Returns how many occurrences were changed.
export async function findReplaceInGoogleDoc(docIdOrUrl: string, findText: string, replaceText: string, matchCase = false, suggest = false): Promise<number> {
  const docId = extractDocId(docIdOrUrl)
  if (!docId) throw new Error('Could not find a Google Doc ID in that link.')
  const data = await docsFetch('/' + docId + ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ replaceAllText: { containsText: { text: findText, matchCase }, replaceText } }], ...writeControlFor(suggest) }),
  })
  return data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0
}

// Appends text to the end of the doc — e.g. adding a new section — without
// touching what's already there.
export async function appendToGoogleDoc(docIdOrUrl: string, text: string, suggest = false): Promise<void> {
  const { docId, endIndex } = await getGoogleDocText(docIdOrUrl)
  await docsFetch('/' + docId + ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ insertText: { location: { index: Math.max(1, endIndex - 1) }, text } }], ...writeControlFor(suggest) }),
  })
}
