// Horse racing price recorder: GB and IE win markets.
//
//   race list     every 5 min: races in the next 6 hours, with race type,
//                 venue, runners, jockeys, trainers and so on (bf_markets)
//   matched       every minute: total matched on races in the window
//   prices        every 5 s it checks which races are due a snapshot:
//                 every minute from 75 to 30 min out, every 30 s to 10 min,
//                 every 5 s in the last 10 minutes and until the off.
//                 A snapshot is only saved if a price moved, or a minute has passed.
//   the off       first moment the race is seen in-play (or suspended at its time)
//   results       winners, non-runners and Starting Prices once Betfair settles it
//
// Reads Betfair only. One failed request skips one check; nothing else stops.

import { Betfair, BetfairError } from './betfair'
import { Store } from './store'
import { CADENCE, LATE_OFF_MAX_MIN, SAVE_UNCHANGED_EVERY_MS } from './config'
import { errText, log } from './log'
import { toSnap, type SnapRec } from '../../lib/betfair/recorder'

type Meta = Record<string, string | null>
type RawCat = {
  marketId: string; marketName: string; marketStartTime: string; totalMatched?: number
  description?: { raceType?: string; marketType?: string }
  event?: { id: string; name: string; venue?: string; countryCode?: string }
  runners?: { selectionId: number; runnerName: string; sortPriority?: number; metadata?: Meta }[]
}
type RawBook = {
  marketId: string; status: string; inplay: boolean; totalMatched?: number
  runners: { selectionId: number; status: string; lastPriceTraded?: number; sp?: { actualSP?: number | string }
    ex?: { availableToBack?: { price: number; size: number }[]; availableToLay?: { price: number; size: number }[] } }[]
}

type Race = {
  id: string; start: number; name: string
  stage: 'pre' | 'off'            // 'off' = waiting for the result
  offAt: number | null
  matched: number | null
  lastPolled: number
  lastSaved: number
  lastKey: string
}

export type Counters = { checksOk: number; checksFailed: number; snaps: number }

const num = (v: string | null | undefined) => { const n = v == null ? NaN : Number(v); return Number.isFinite(n) ? n : null }

// The runner details worth keeping for breakdowns. Betfair sends "None" for blanks.
function runnerMeta(m: Meta | undefined) {
  if (!m) return {}
  const v = (k: string) => (m[k] && m[k] !== 'None' ? m[k] : null)
  const fn = num(v('FORECASTPRICE_NUMERATOR')), fd = num(v('FORECASTPRICE_DENOMINATOR'))
  return {
    jockey: v('JOCKEY_NAME'), trainer: v('TRAINER_NAME'), age: num(v('AGE')), sex: v('SEX_TYPE'),
    weight_lbs: num(v('WEIGHT_VALUE')), official_rating: num(v('OFFICIAL_RATING')), stall: num(v('STALL_DRAW')),
    cloth: num(v('CLOTH_NUMBER')), days_since_run: num(v('DAYS_SINCE_LAST_RUN')), form: v('FORM'),
    forecast: fn !== null && fd ? Math.round((fn / fd + 1) * 100) / 100 : null,
  }
}

function everyMs(minsToOff: number): number | null {
  if (minsToOff < -LATE_OFF_MAX_MIN) return null
  for (const c of CADENCE) if (minsToOff <= c.beforeMin) return c.everyMs
  return null
}

export type PriceHooks = {
  prices: (marketId: string, name: string, start: number, now: number, runners: SnapRec['runners']) => void
  off: (marketId: string, now: number) => void
}

export class RacingRecorder {
  races = new Map<string, Race>()
  hooks: PriceHooks | null = null              // e.g. the fade-drift paper bot
  private settled = new Set<string>()    // races already finished with: never pick them up again
  lastOkAt = 0
  lastError: string | null = null
  private lastCatalogue = 0

  constructor(private bf: Betfair, private store: Store, private count: Counters) {}

  private fail(what: string, e: unknown) {
    this.count.checksFailed++
    const msg = `${what}: ${errText(e)}`
    if (msg !== this.lastError) log.warn(msg)
    this.lastError = msg
  }
  private ok() { this.count.checksOk++; this.lastOkAt = Date.now(); this.lastError = null }

  // ---------------------------------------------------------------- race list
  async refreshCatalogue(now = Date.now()) {
    try {
      const ask = (maxResults: number) => this.bf.read<RawCat[]>('listMarketCatalogue', {
        filter: { eventTypeIds: ['7'], marketCountries: ['GB', 'IE'], marketTypeCodes: ['WIN'],
          marketStartTime: { from: new Date(now - 30 * 60_000).toISOString(), to: new Date(now + 6 * 3600_000).toISOString() } },
        marketProjection: ['EVENT', 'MARKET_START_TIME', 'MARKET_DESCRIPTION', 'RUNNER_DESCRIPTION', 'RUNNER_METADATA'],
        sort: 'FIRST_TO_START', maxResults,
      })
      // Betfair caps how much one request may ask for; if it says no, ask for fewer races.
      let cats: RawCat[] | null = null
      for (const n of [100, 50, 25]) {
        try { cats = await ask(n); break } catch (e) { if (!(e instanceof BetfairError && e.code === 'TOO_MUCH_DATA') || n === 25) throw e }
      }
      if (!cats) return
      this.ok()
      this.lastCatalogue = now
      const rows = cats.map(c => {
        const start = c.marketStartTime
        const time = new Date(start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
        const venue = c.event?.venue ?? c.event?.name ?? 'Unknown'
        if (this.settled.has(c.marketId)) return null
        if (!this.races.has(c.marketId)) {
          this.races.set(c.marketId, { id: c.marketId, start: new Date(start).getTime(), name: `${venue} ${time}`, stage: 'pre', offAt: null,
            matched: c.totalMatched ?? null, lastPolled: 0, lastSaved: 0, lastKey: '' })
        } else {
          const r = this.races.get(c.marketId)!
          r.start = new Date(start).getTime()            // starts sometimes move
          if (c.totalMatched) r.matched = c.totalMatched
        }
        return {
          market_id: c.marketId, sport: 'racing', market_type: 'WIN', event_id: c.event?.id ?? null, event: `${venue} ${time}`,
          market_name: c.marketName, venue, country: c.event?.countryCode ?? null, race_type: c.description?.raceType ?? null,
          start_at: start, total_matched: c.totalMatched ?? null, updated_at: new Date(now).toISOString(),
          runners: (c.runners ?? []).map(r => ({ id: r.selectionId, name: r.runnerName, sort: r.sortPriority ?? null, ...runnerMeta(r.metadata) })),
        }
      })
      // Merge: refreshes the details, never touches a saved result.
      this.store.add({ kind: 'upsert', table: 'bf_markets', rows: rows.filter((r): r is NonNullable<typeof r> => !!r), onConflict: 'market_id' })
    } catch (e) {
      this.fail('Race list', e)
    }
  }

  // ---------------------------------------------------------------- total matched
  // The free delayed key leaves total matched out of the price data; the race list has it.
  async refreshMatched(now = Date.now()) {
    const ids = [...this.races.values()].filter(r => r.stage === 'pre' && everyMs((r.start - now) / 60_000) !== null).map(r => r.id)
    for (let i = 0; i < ids.length; i += 100) {
      try {
        const cats = await this.bf.read<RawCat[]>('listMarketCatalogue', { filter: { marketIds: ids.slice(i, i + 100) }, maxResults: 100 })
        this.ok()
        for (const c of cats) { const r = this.races.get(c.marketId); if (r && typeof c.totalMatched === 'number') r.matched = c.totalMatched }
      } catch (e) {
        this.fail('Total matched', e)
      }
    }
  }

  // ---------------------------------------------------------------- prices
  async pollPrices(now = Date.now()) {
    if (now - this.lastCatalogue > 15 * 60_000 && this.races.size === 0) return   // nothing known yet
    const due = [...this.races.values()].filter(r => {
      if (r.stage !== 'pre') return false
      const every = everyMs((r.start - now) / 60_000)
      return every !== null && now - r.lastPolled >= every - 250
    })
    if (!due.length) return
    const at = new Date(now).toISOString()
    const snaps: SnapRec[] = []
    const offs: { id: string; offAt: string }[] = []
    for (let i = 0; i < due.length; i += 40) {          // 40 markets keeps each request inside Betfair's size limit
      const chunk = due.slice(i, i + 40)
      try {
        const books = await this.bf.read<RawBook[]>('listMarketBook', {
          marketIds: chunk.map(r => r.id),
          priceProjection: { priceData: ['EX_BEST_OFFERS'], exBestOffersOverrides: { bestPricesDepth: 1 } },
        })
        this.ok()
        for (const r of chunk) r.lastPolled = now
        for (const b of books) {
          const r = this.races.get(b.marketId)
          if (!r) continue
          const atOrAfterStart = now >= r.start - 2 * 60_000
          if (b.inplay || b.status === 'CLOSED' || (b.status === 'SUSPENDED' && atOrAfterStart)) {
            r.stage = 'off'; r.offAt = now
            offs.push({ id: r.id, offAt: at })
            this.hooks?.off(r.id, now)
            continue
          }
          if (b.status !== 'OPEN') continue                // e.g. suspended for a non-runner: keep watching
          const snap = toSnap(b, at)
          snap.matched = r.matched
          try { this.hooks?.prices(r.id, r.name, r.start, now, snap.runners) } catch (e) { log.warn('Paper bot:', errText(e)) }
          const key = JSON.stringify(snap.runners)
          if (key === r.lastKey && now - r.lastSaved < SAVE_UNCHANGED_EVERY_MS) continue
          r.lastKey = key; r.lastSaved = now
          snaps.push(snap)
        }
        // A race Betfair no longer returns has closed or been removed.
        for (const r of chunk) if (!books.some(b => b.marketId === r.id) && now > r.start) { r.stage = 'off'; r.offAt ??= now; this.hooks?.off(r.id, now) }
      } catch (e) {
        this.fail('Prices', e)
      }
    }
    if (snaps.length) {
      this.store.add({ kind: 'upsert', table: 'bf_snaps', rows: snaps, onConflict: 'market_id,at', ignoreDuplicates: true })
      this.count.snaps += snaps.length
    }
    for (const o of offs) {
      const r = this.races.get(o.id)
      this.store.add({ kind: 'update', table: 'bf_markets', match: { market_id: o.id }, values: { off_at: o.offAt, total_matched: r?.matched ?? null, updated_at: o.offAt } })
    }
  }

  // ---------------------------------------------------------------- results
  // extraIds: unsettled races found in the database (e.g. from before a restart).
  async collectResults(now = Date.now(), extraIds: string[] = []) {
    const waiting = [...this.races.values()].filter(r =>
      (r.stage === 'off' && now - (r.offAt ?? now) > 5 * 60_000) || (r.stage === 'pre' && now - r.start > LATE_OFF_MAX_MIN * 60_000))
    const ids = Array.from(new Set([...waiting.map(r => r.id), ...extraIds])).slice(0, 80)
    for (let i = 0; i < ids.length; i += 40) {
      try {
        const books = await this.bf.read<RawBook[]>('listMarketBook', { marketIds: ids.slice(i, i + 40), priceProjection: { priceData: ['SP_TRADED'] } })
        this.ok()
        for (const b of books) {
          if (b.status !== 'CLOSED') continue
          const bsp: Record<string, number> = {}
          for (const x of b.runners) { const sp = Number(x.sp?.actualSP); if (Number.isFinite(sp) && sp > 1) bsp[x.selectionId] = sp }
          this.store.add({ kind: 'update', table: 'bf_markets', match: { market_id: b.marketId }, values: {
            status: 'CLOSED', winners: b.runners.filter(x => x.status === 'WINNER').map(x => x.selectionId),
            removed: b.runners.filter(x => x.status === 'REMOVED').map(x => x.selectionId),
            bsp: Object.keys(bsp).length ? bsp : null, result_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
          } })
          this.races.delete(b.marketId)
          this.settled.add(b.marketId)
        }
      } catch (e) {
        this.fail('Results', e)
      }
    }
    // Give up on races more than two days old (abandoned or never settled).
    for (const r of this.races.values()) if (now - r.start > 48 * 3600_000) { this.races.delete(r.id); this.settled.add(r.id) }
    if (this.settled.size > 5000) this.settled = new Set([...this.settled].slice(-2000))
  }
}
