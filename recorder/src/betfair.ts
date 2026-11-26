// Read-only Betfair client for the recorder.
//
// Only listMarketCatalogue and listMarketBook (plus listing and downloading
// files from Betfair's historical data site) can be called: anything else is
// refused before a request is made, so this cannot place, change or cancel a bet.
// Every request has a time limit and is retried on network trouble. Logins are
// rate-limited, and a wrong username, password or key pauses logins for 30
// minutes so the account is never locked by repeated attempts.

import fs from 'fs'
import path from 'path'
import { REQUEST_TIMEOUT_MS } from './config'
import { errText, log } from './log'

const SSO = 'https://identitysso.betfair.com/api/login'
const API = 'https://api.betfair.com/exchange/betting/rest/v1.0/'
const READ_ONLY_OPS = ['listMarketCatalogue', 'listMarketBook'] as const
type Op = (typeof READ_ONLY_OPS)[number]
// Betfair's historical data site (free Basic plan and paid plans): listing and downloading files only.
const HISTORIC = 'https://historicdata.betfair.com/api/'
const HISTORIC_OPS = ['GetMyData', 'GetCollectionOptions', 'GetAdvBasketDataSize', 'DownloadListOfFiles', 'DownloadFile'] as const
export type HistoricOp = (typeof HISTORIC_OPS)[number]

const CREDENTIAL_ERRORS = /INVALID_USERNAME_OR_PASSWORD|ACCOUNT_NOW_LOCKED|ACCOUNT_ALREADY_LOCKED|INVALID_APP_KEY|APP_KEY_CREATION_FAILED|KYC_SUSPEND|SUSPENDED|CLOSED|SECURITY_RESTRICTED_LOCATION|ACCOUNT_PENDING_PASSWORD_CHANGE|NOT_AUTHORIZED_BY_REGULATOR|DUPLICATE_CARDS|SELF_EXCLUDED|PERSONAL_MESSAGE_REQUIRED|BETTING_RESTRICTED_LOCATION|TRADING_MASTER|AUTHORIZED_ONLY_FOR_DOMAIN|CERT_AUTH_REQUIRED|BLOCKED/
const SESSION_MAX_MS = 6 * 3600_000
const MIN_LOGIN_GAP_MS = 60_000
const CREDENTIAL_PAUSE_MS = 30 * 60_000

export class BetfairError extends Error {
  constructor(message: string, public code = '', public transient = false) { super(message) }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export class Betfair {
  private token: string | null = null
  private tokenAt = 0
  private lastLoginTry = 0
  private pausedUntil = 0
  private loggingIn: Promise<string> | null = null

  private sessionFile: string

  // The session and the time of the last login attempt are kept on disk (readable
  // only by the recorder), so restarts reuse the session and still respect the
  // gap between logins: a crash loop can never turn into a login every few seconds.
  constructor(private creds: { username: string; password: string; appKey: string }, stateDir: string) {
    this.sessionFile = path.join(stateDir, 'betfair-session.json')
    try {
      const s = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')) as { token?: string; tokenAt?: number; lastLoginTry?: number; pausedUntil?: number }
      if (s.token && s.tokenAt) { this.token = s.token; this.tokenAt = s.tokenAt }
      this.lastLoginTry = s.lastLoginTry ?? 0
      this.pausedUntil = s.pausedUntil ?? 0
    } catch { /* first run */ }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true })
      fs.writeFileSync(this.sessionFile, JSON.stringify({ token: this.token, tokenAt: this.tokenAt, lastLoginTry: this.lastLoginTry, pausedUntil: this.pausedUntil }), { mode: 0o600 })
    } catch { /* not fatal */ }
  }

  get paused() { return Date.now() < this.pausedUntil }

  private async login(): Promise<string> {
    if (this.paused) throw new BetfairError(`Betfair logins paused until ${new Date(this.pausedUntil).toISOString()} after a login problem`, 'PAUSED')
    const wait = this.lastLoginTry + MIN_LOGIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastLoginTry = Date.now()
    this.save()
    let res: Response
    try {
      res = await fetch(SSO, {
        method: 'POST',
        headers: { 'X-Application': this.creds.appKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: this.creds.username, password: this.creds.password }).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (e) {
      throw new BetfairError('Betfair login request failed: ' + errText(e), 'NETWORK', true)
    }
    const j = await res.json().catch(() => ({})) as { token?: string; status?: string; error?: string }
    if (j.status === 'SUCCESS' && j.token) {
      this.token = j.token; this.tokenAt = Date.now()
      this.save()
      log.info('Logged in to Betfair')
      return j.token
    }
    const code = j.error ?? (res.status === 403 ? 'BLOCKED' : 'HTTP_' + res.status)
    if (CREDENTIAL_ERRORS.test(code)) {
      this.pausedUntil = Date.now() + CREDENTIAL_PAUSE_MS
      this.save()
      throw new BetfairError(`Betfair login refused (${code}). Pausing logins for 30 minutes. Check the username, password and app key in /etc/flowstate-recorder.env.`, code)
    }
    throw new BetfairError(`Betfair login failed (${code})`, code, true)
  }

  private async session(forceNew = false): Promise<string> {
    if (!forceNew && this.token && Date.now() - this.tokenAt < SESSION_MAX_MS) return this.token
    // one login at a time, however many requests are waiting
    this.loggingIn ??= this.login().finally(() => { this.loggingIn = null })
    return this.loggingIn
  }

  private async once<T>(op: Op, body: unknown, token: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(API + op + '/', {
        method: 'POST',
        headers: { 'X-Application': this.creds.appKey, 'X-Authentication': token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (e) {
      throw new BetfairError(`Betfair ${op} request failed: ${errText(e)}`, 'NETWORK', true)
    }
    const j = await res.json().catch(() => null)
    if (res.ok && j !== null) return j as T
    const code: string = j?.detail?.APINGException?.errorCode ?? j?.faultstring ?? 'HTTP_' + res.status
    const transient = res.status >= 500 || /TOO_MANY_REQUESTS|SERVICE_BUSY|TIMEOUT_ERROR|UNEXPECTED_ERROR/.test(code)
    throw new BetfairError(`Betfair ${op} failed: ${code}`, code, transient)
  }

  // Betfair's historical data site, with the same login. JSON for the listing
  // calls; the raw file (a Buffer) for DownloadFile. Up to 3 tries.
  async historic<T>(op: HistoricOp, body: unknown, filePath?: string): Promise<T> {
    if (!HISTORIC_OPS.includes(op)) throw new BetfairError('Operation not allowed: ' + op, 'NOT_ALLOWED')
    let last: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = await this.session()
        const url = HISTORIC + op + (filePath ? '?filePath=' + encodeURIComponent(filePath) : '')
        const get = op === 'DownloadFile' || op === 'GetMyData'            // these two are GET; the rest are POST with a JSON body
        const res = await fetch(url, {
          method: get ? 'GET' : 'POST',
          headers: { ssoid: token, 'X-Authentication': token, 'X-Application': this.creds.appKey, ...(get ? {} : { 'Content-Type': 'application/json' }), Accept: op === 'DownloadFile' ? '*/*' : 'application/json' },
          body: get ? undefined : JSON.stringify(body ?? {}),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.status === 401 || res.status === 403) { this.token = null; throw new BetfairError(`Historical data ${op}: not signed in (HTTP ${res.status})`, 'NO_SESSION', true) }
        if (!res.ok) throw new BetfairError(`Historical data ${op} failed: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`, 'HTTP_' + res.status, res.status >= 500 || res.status === 429)
        return (op === 'DownloadFile' ? Buffer.from(await res.arrayBuffer()) : await res.json()) as T
      } catch (e) {
        last = e
        const transient = !(e instanceof BetfairError) || e.transient
        if (!transient) throw e
        await sleep(2000 * (attempt + 1) * (attempt + 1))
      }
    }
    throw last
  }

  // A read with up to 3 tries: retried after a pause on network or server trouble,
  // and with a fresh login when the session has expired.
  async read<T>(op: Op, body: unknown): Promise<T> {
    if (!READ_ONLY_OPS.includes(op)) throw new BetfairError('Operation not allowed: ' + op, 'NOT_ALLOWED')
    let last: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.once<T>(op, body, await this.session())
      } catch (e) {
        last = e
        if (!(e instanceof BetfairError)) throw e
        if (/INVALID_SESSION|NO_SESSION/.test(e.code)) { this.token = null; continue }
        if (!e.transient) throw e
        await sleep(1000 * (attempt + 1) * (attempt + 1))
      }
    }
    throw last
  }
}
