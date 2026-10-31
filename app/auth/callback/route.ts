import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { isAllowedEmail, safeNextPath } from '@/lib/authConfig'

// Landing point for the "email me a sign-in link" flow: swaps the one-time
// ?code= for a real session (set as cookies), then sends you on your way.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data } = await supabase.auth.getUser()
      if (isAllowedEmail(data.user?.email)) return NextResponse.redirect(origin + next)
      // Valid Supabase user but not on our allow-list: don't leave a session behind.
      await supabase.auth.signOut()
      return NextResponse.redirect(origin + '/login?denied=1')
    }
  }
  return NextResponse.redirect(origin + '/login?error=callback')
}
