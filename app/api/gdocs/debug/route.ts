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
  } else {
    result.docSkipped = 'Pass ?docId=... to also test the Docs API call.'
  }

  return NextResponse.json(result)
}
