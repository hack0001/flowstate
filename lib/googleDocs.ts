// ============================================================
// Google Docs REST API client — real in-place editing for scripts
//
// Reuses the exact same "flowstate-drive" service account and access token
// as lib/googleDrive.ts (the 'drive' OAuth scope already covers the Docs
// API). This is what makes true in-place edits possible — unlike Claude's
// built-in Drive connector (claude.ai / Cowork's own Drive tools), which can
// only read a doc or create a new one, this calls docs.googleapis.com's
// batchUpdate directly, the same underlying mechanic third-party "Claude can
// edit Google Docs" tools use.
//
// SETUP REQUIRED (one-time, done by Tom in his own Google account):
//   1. Share the specific Google Doc (or its parent folder) with the
//      service account's email (GOOGLE_DRIVE_CLIENT_EMAIL) as Editor —
//      same step already done for SOUND MONEY HQ in Drive.
//   2. Make sure the "Google Docs API" is enabled for the same Google Cloud
//      project the service account belongs to (Drive API being enabled
//      does not automatically enable this — it's a separate API to flip on
//      in the Cloud Console's "APIs & Services" page). If a request below
//      fails with something like "Docs API has not been used in project...",
//      that's the fix.
//
// SERVER-ONLY — goes through lib/googleDrive.ts's getAccessToken(), which
// reads process.env.GOOGLE_DRIVE_PRIVATE_KEY. Never import this from a
// client component; all access goes through app/api/gdocs/route.ts.
// ============================================================

import { getAccessToken } from './googleDrive'

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
  const token = await getAccessToken()
  const res = await fetch(DOCS_API + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    // Suggest mode (writeControl.writeMode = 'SUGGEST') is currently gated
    // behind Google's Workspace Developer Preview Program -- surface a
    // specific, actionable message instead of a raw API error when that's
    // the likely cause, so the UI can tell Tom exactly what to do.
    if (body.includes('SUGGEST') || /developer preview/i.test(body)) {
      throw new Error('Suggestion mode isn\'t available on this Google Cloud project yet -- it requires enrolling in the Google Workspace Developer Preview Program (needs a Workspace-domain email, not a personal Gmail). See https://developers.google.com/workspace/preview. Raw error: ' + body)
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
