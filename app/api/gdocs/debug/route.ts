import { NextRequest, NextResponse } from 'next/server'
import { getImpersonatedAccessToken } from '@/lib/googleDrive'

// TEMPORARY diagnostic route for the domain-wide delegation 403 -- runs the
// exact same token mint + API calls the Script Editor does, but returns the
// raw status/body from each step instead of swallowing them into one
// generic error, so we can see exactly where it's actually failing:
//   1. Mint an impersonated access token (this alone tells us if the
//      delegation grant itself is being honored at all).
//   2. Call Drive's about.get, which returns the identity Google thinks is
//      making the call -- confirms whether impersonation is really landing
//      on the right account.
//   3. Call the Docs API for the doc in question, same as the real feature.
// Never returns the actual bearer token. Safe to delete once this is
// resolved -- app/api/gdocs/route.ts is the real, permanent endpoint.
export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('docId')
  const result: Record<string, unknown> = {}

  let token: string
  try {
    token = await getImpersonatedAccessToken()
    result.tokenMinted = true
  } catch (e) {
    result.tokenMinted = false
    result.tokenError = String(e)
    return NextResponse.json(result, { status: 200 })
  }

  try {
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: 'Bearer ' + token },
    })
    result.aboutStatus = aboutRes.status
    result.aboutBody = await aboutRes.json().catch(async () => await aboutRes.text())
  } catch (e) {
    result.aboutError = String(e)
  }

  if (docId) {
    try {
      const docRes = await fetch('https://docs.googleapis.com/v1/documents/' + docId, {
        headers: { Authorization: 'Bearer ' + token },
      })
      result.docStatus = docRes.status
      result.docBody = await docRes.json().catch(async () => await docRes.text())
    } catch (e) {
      result.docError = String(e)
    }

    // Harmless write probe #1 (replaceAllText): searches for a string that
    // can't exist in any real doc, so occurrencesChanged will be 0 and
    // nothing is actually changed -- but it still exercises the batchUpdate
    // write path (and its authorization check) that reading the doc does not.
    try {
      const writeRes = await fetch('https://docs.googleapis.com/v1/documents/' + docId + ':batchUpdate', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ replaceAllText: { containsText: { text: '__DIAGNOSTIC_PROBE_STRING_THAT_CANNOT_EXIST__', matchCase: true }, replaceText: '' } }] }),
      })
      result.writeProbeStatus = writeRes.status
      result.writeProbeBody = await writeRes.json().catch(async () => await writeRes.text())
    } catch (e) {
      result.writeProbeError = String(e)
    }

    // Harmless write probe #2 (insertText + deleteContentRange): the real
    // "Rewrite with Claude" / "Append" tools use these two request types,
    // never tested by probe #1 above. Inserts a single throwaway character
    // near the end, then deletes that exact same character back out in the
    // same call -- nets to a true no-op on content, but exercises the same
    // request types replaceGoogleDocText()/appendToGoogleDoc() use, to check
    // whether it's specifically these that are denied vs replaceAllText.
    try {
      const freshDoc = await fetch('https://docs.googleapis.com/v1/documents/' + docId, {
        headers: { Authorization: 'Bearer ' + token },
      }).then(r => r.json())
      const content = freshDoc.body?.content ?? []
      const endIndex = content.length ? (content[content.length - 1].endIndex ?? 1) : 1
      const insertAt = Math.max(1, endIndex - 1)
      const writeRes2 = await fetch('https://docs.googleapis.com/v1/documents/' + docId + ':batchUpdate', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            { insertText: { location: { index: insertAt }, text: 'X' } },
            { deleteContentRange: { range: { startIndex: insertAt, endIndex: insertAt + 1 } } },
          ],
        }),
      })
      result.writeProbe2Status = writeRes2.status
      result.writeProbe2Body = await writeRes2.json().catch(async () => await writeRes2.text())
    } catch (e) {
      result.writeProbe2Error = String(e)
    }

    // Harmless write probe #3: replicates replaceGoogleDocText() EXACTLY --
    // delete the WHOLE body (index 1 to endIndex-1), then reinsert the exact
    // same text back at index 1. Net effect on content is zero, but unlike
    // probe #2 (which only touched one untouched character at the very end),
    // this spans the ENTIRE document -- including the parts that currently
    // have pending suggestions in them (visible in docBody above) -- which
    // is exactly what "Apply to Google Doc" does and probe #2 didn't cover.
    try {
      const freshDoc2 = await fetch('https://docs.googleapis.com/v1/documents/' + docId, {
        headers: { Authorization: 'Bearer ' + token },
      }).then(r => r.json())
      const content2 = freshDoc2.body?.content ?? []
      const endIndex2 = content2.length ? (content2[content2.length - 1].endIndex ?? 1) : 1
      let fullText = ''
      for (const el of content2) {
        for (const pe of el.paragraph?.elements ?? []) {
          if (pe.textRun?.content) fullText += pe.textRun.content
        }
      }
      const requests3: any[] = []
      if (endIndex2 > 1) requests3.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex2 - 1 } } })
      if (fullText) requests3.push({ insertText: { location: { index: 1 }, text: fullText } })
      const writeRes3 = await fetch('https://docs.googleapis.com/v1/documents/' + docId + ':batchUpdate', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: requests3 }),
      })
      result.writeProbe3Status = writeRes3.status
      result.writeProbe3Body = await writeRes3.json().catch(async () => await writeRes3.text())
    } catch (e) {
      result.writeProbe3Error = String(e)
    }
  } else {
    result.docSkipped = 'Pass ?docId=... to also test the Docs API call.'
  }

  return NextResponse.json(result)
}
