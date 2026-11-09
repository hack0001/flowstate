import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { allowedEmails, isAllowedEmail } from '@/lib/authConfig'

// ============================================================
// Gate for the whole app: nothing is reachable without a signed-in session
// belonging to an address in ALLOWED_EMAILS.
//
//  - Pages:      redirect to /login (remembering where you were headed)
//  - /api/*:     401 JSON
//  - Exceptions: /login, /auth/callback (needed to sign in) and
//                /api/gsc/cron + /api/betfair/cron (Vercel Cron has no
//                session; those routes verify their own CRON_SECRET bearer
//                token instead)
//
// This is the first of several layers, not the only one: sensitive API routes
// re-check via requireUser(), and Row Level Security (migration 048) is what
// actually protects the data even if someone had the public anon key.
// ============================================================

const PUBLIC_PATHS = ['/login', '/auth/callback']
const SELF_AUTHENTICATED_PATHS = ['/api/gsc/cron', '/api/betfair/cron']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (SELF_AUTHENTICATED_PATHS.includes(pathname)) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(list, headers) {
          // Token refresh: write the new cookies to both the request (so
          // server code in this same request sees them) and the response.
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // getUser() validates the session with Supabase rather than trusting the
  // cookie -- a forged or revoked token fails here.
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const authorised = !!user && isAllowedEmail(user.email)

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublic) {
    if (authorised && pathname === '/login') {
      const home = request.nextUrl.clone()
      home.pathname = '/'
      home.search = ''
      return NextResponse.redirect(home)
    }
    return response
  }

  if (!authorised) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = ''
    if (pathname !== '/') login.searchParams.set('next', pathname + request.nextUrl.search)
    // Signed in, but with an address that isn't on the allow-list (or the
    // allow-list env var is missing) -- say so rather than looping silently.
    if (user) login.searchParams.set('denied', allowedEmails().length === 0 ? 'unconfigured' : '1')
    return NextResponse.redirect(login)
  }

  return response
}

export const config = {
  // Everything except Next internals and the static files a signed-out
  // browser legitimately needs (favicon/icons/manifest). Public assets are
  // not sensitive; pages and APIs all go through the gate above.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.json|icons/).*)'],
}
