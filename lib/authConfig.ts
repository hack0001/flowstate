// ============================================================
// Who is allowed into FlowState.
//
// Pure helpers with NO Node/Next-only imports, so they're safe to use from
// middleware.ts (Edge runtime) as well as server routes.
//
// ALLOWED_EMAILS is a comma-separated env var (server-only, no NEXT_PUBLIC_
// prefix), e.g. ALLOWED_EMAILS=admin@derivativemedia.co.uk
//
// Fails CLOSED: if it's missing or empty, nobody gets in -- including you.
// That's deliberate (a forgotten env var should lock the app, not open it);
// the login page tells you when that's the reason you're being refused.
// ============================================================

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return allowedEmails().includes(email.trim().toLowerCase())
}

// Only same-site relative paths are allowed as a post-login redirect target,
// otherwise /login?next=https://evil.example would be an open redirect.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
