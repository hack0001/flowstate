// ============================================================
// Server-side Supabase access + the API-route auth guard.
//
// SERVER-ONLY (uses next/headers). Never import from a client component.
//
// Why this exists: the browser client in lib/supabase.ts carries the signed-in
// user's session, and Row Level Security (migration 048) only lets that
// signed-in owner read or write anything. API routes that talk to Supabase
// therefore need the SAME session on the server -- reading it from the
// request cookies -- rather than a bare anon-key client, which RLS now
// treats as nobody.
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAllowedEmail } from './authConfig'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Cookie-bound client: acts as whoever is signed in on this request.
export function createSupabaseServerClient(): SupabaseClient {
  const cookieStore = cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(list) {
        // Route handlers can set cookies; Server Components can't (throws).
        // Token refreshes are also handled in middleware, so ignoring a
        // failed write here is safe.
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}

// Service-role client: BYPASSES Row Level Security. Only for trusted
// server-to-server jobs with no user session (the nightly Search Console
// cron). Never expose to the browser, never pass user input into it unchecked.
export function createSupabaseServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set -- needed for the scheduled Search Console sync (Supabase dashboard -> Project Settings -> API -> service_role key).')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export type AuthResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

// Defence in depth: middleware.ts already blocks unauthenticated requests to
// /api/*, but every sensitive route also checks for itself, so a middleware
// misconfiguration or matcher gap can't silently expose it.
//
//   const auth = await requireUser()
//   if (!auth.ok) return auth.response
export async function requireUser(): Promise<AuthResult> {
  const supabase = createSupabaseServerClient()
  // getUser() re-validates the token with Supabase's auth server (unlike
  // getSession(), which only trusts the cookie contents).
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user || !isAllowedEmail(data.user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, user: data.user, supabase }
}
