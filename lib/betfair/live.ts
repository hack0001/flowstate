// ============================================================
// Read-only Betfair Exchange client. SERVER-ONLY.
//
// Calls exactly two betting operations -- listMarketCatalogue and
// listMarketBook -- so it cannot place, change or cancel a bet.
//
// Credentials come from env vars (never the browser):
//   BF_USERNAME, BF_PASSWORD, BF_APP_KEY   (a free delayed app key is fine)
//
// Betfair refuses logins from some countries, including the US, which is
// where Vercel runs functions by default. The API routes that use this pin
// themselves to London (preferredRegion = 'lhr1').
// ============================================================

import type { Book, Feed, Market } from './engine'

const SSO = 'https://identitysso.betfair.com/api/login'
const API = 'https://api.betfair.com/exchange/betting/rest/v1.0/'

export class BetfairError extends Error {
  constructor(message: string, public code?: string) { super(message) }
}

function creds() {
  const username = process.env.BF_USERNAME, password = process.env.BF_PASSWORD, appKey = process.env.BF_APP_KEY
  if (!username || !password || !appKey) {
    throw new BetfairError('Betfair isn\'t set up yet: add BF_USERNAME, BF_PASSWORD and BF_APP_KEY to your Vercel environment variables, then redeploy.', 'NO_CREDENTIALS')
  }
  return { username, password, appKey }
}

export function hasCredentials(): boolean {
  return !!(process.env.BF_USERNAME && process.env.BF_PASSWORD && process.env.BF_APP_KEY)
}

export async function login(): Promise<string> {
  const { username, password, appKey } = creds()
  const res = await fetch(SSO, {
    method: 'POST',
    headers: { 'X-Application': appKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }).toString(),
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({})) as { token?: string; status?: string; error?: string }
  if (j.status !== 'SUCCESS' || !j.token) {
    const hint: Record<string, string> = {
      INVALID_USERNAME_OR_PASSWORD: 'username or password is wrong',
      ACCOUNT_NOW_LOCKED: 'account locked after failed logins; unlock it on betfair.com',
      ACCOUNT_PENDING_PASSWORD_CHANGE: 'log in on betfair.com and change your password first',
      SECURITY_RESTRICTED_LOCATION: 'login came from a blocked country; check the function region is London',
      KYC_SUSPEND: 'your account needs ID verification on betfair.com',
      TEMPORARY_BAN_TOO_MANY_REQUESTS: 'too many logins; wait 20 minutes',
    }
    throw new BetfairError(`Betfair login failed: ${hint[j.error ?? ''] ?? j.error ?? 'HTTP ' + res.status}`, j.error)
  }
  return j.token
}

async function call<T>(op: string, body: unknown, token: string): Promise<T> {
  const { appKey } = creds()
  const res = await fetch(API + op + '/', {
    method: 'POST',
    headers: { 'X-Application': appKey, 'X-Authentication': token, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const j = await res.json().catch(() => null)
  if (!res.ok) {
    const code = j?.detail?.APINGException?.errorCode ?? j?.faultstring ?? 'HTTP ' + res.status
    throw new BetfairError(`Betfair ${op} failed: ${code}`, code)
  }
  return j as T
}

type RawCatalogue = { marketId: string; marketStartTime: string; event: { name: string; venue?: string } }

export class LiveFeed implements Feed {
  constructor(private getToken: (forceNew?: boolean) => Promise<string>) {}

  // Retries once with a fresh login when the cached session has expired.
  private async withSession<T>(fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.getToken())
    } catch (e) {
      if (e instanceof BetfairError && /INVALID_SESSION|NO_SESSION/.test(e.code ?? '')) return fn(await this.getToken(true))
      throw e
    }
  }

  async catalogue(now: Date): Promise<Market[]> {
    const to = new Date(now.getTime() + 60 * 60_000)
    const cats = await this.withSession(t => call<RawCatalogue[]>('listMarketCatalogue', {
      filter: { eventTypeIds: ['7'], marketCountries: ['GB', 'IE'], marketTypeCodes: ['WIN'],
        marketStartTime: { from: now.toISOString(), to: to.toISOString() } },
      marketProjection: ['EVENT', 'MARKET_START_TIME'], sort: 'FIRST_TO_START', maxResults: 50,
    }, t))
    return cats.map(c => ({
      id: c.marketId,
      name: `${c.event.venue ?? c.event.name} ${new Date(c.marketStartTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}`,
      start: c.marketStartTime,
    }))
  }

  async books(ids: string[]): Promise<Record<string, Book>> {
    const out: Record<string, Book> = {}
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10)
      const books = await this.withSession(t => call<Book[]>('listMarketBook', {
        marketIds: chunk, priceProjection: { priceData: ['EX_BEST_OFFERS'], exBestOffersOverrides: { bestPricesDepth: 1 } },
      }, t))
      for (const b of books) out[b.marketId] = b
    }
    return out
  }
}
