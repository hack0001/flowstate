// Football, tennis and golf price recorder.
//
//   football  the big leagues and cups (plus any match with a lot of money on it):
//             Match Odds, Over/Under 2.5 and Both Teams to Score before and during
//             the match; Over/Under 1.5 and 3.5 and Correct Score up to kick-off
//             (the football strategies use them).
//   tennis    ATP, WTA, Grand Slam and team-event singles: Match Odds before and
//             during the match.
//   golf      PGA Tour, DP World Tour, majors, LIV, Ryder/Presidents Cup:
//             the tournament Winner market, before and during the event.
//
// For each market:
//   catalogue  every 10 min (golf 30): which events and markets to follow (bf_markets)
//   prices     every 5 s it checks which markets are due a snapshot (see SPORTS
//              below for how often). A snapshot is only saved if a price moved, or
//              a while has passed.
//   in play    the first moment Betfair shows it in-play is saved as off_at
//   results    the winning selection(s) once Betfair settles the market
//
// Reads Betfair only. One failed request skips one check; nothing else stops.

import { Betfair, BetfairError } from './betfair'
import { Store } from './store'
import { errText, log } from './log'
import { toSnap, type SnapRec } from '../../lib/betfair/recorder'
import type { Counters } from './racing'

type Sport = 'football' | 'tennis' | 'golf'
type RawCat = {
  marketId: string; marketName: string; marketStartTime: string; totalMatched?: number
  description?: { marketType?: string }
  event?: { id: string; name: string; countryCode?: string }
  competition?: { id: string; name: string }
  runners?: { selectionId: number; runnerName: string; sortPriority?: number }[]
}
type RawBook = {
  marketId: string; status: string; inplay: boolean; totalMatched?: number
  runners: { selectionId: number; status: string; lastPriceTraded?: number
    ex?: { availableToBack?: { price: number; size: number }[]; availableToLay?: { price: number; size: number }[] } }[]
}

type SportDef = {
  sport: Sport
  eventTypeId: string
  main: string                                    // market type used to find events
  extra: { code: string; inPlay: boolean }[]      // more market types for the chosen events
  mainInPlay: boolean
  lookBackH: number; lookAheadH: number           // catalogue window around now
  catalogueEveryMs: number
  pre: { beforeMin: number; everyMs: number }[]   // by minutes to the scheduled start, smallest first
  lateEveryMs: number                             // after the scheduled start, before Betfair turns it in-play
  inPlayEveryMs: number
  giveUpAfterStartH: number                       // stop following it this long after the scheduled start
  pick: (c: RawCat) => boolean
}

const MIN = 60_000, H = 3600_000
const has = (re: RegExp, s?: string) => !!s && re.test(s)

const FOOTBALL_COMPS = new RegExp([
  'English Premier League', 'English Championship', 'English FA Cup', 'English League Cup', 'EFL Cup', 'Carabao',
  'UEFA Champions League', 'UEFA Europa League', 'Conference League', 'UEFA Super Cup', 'UEFA Nations League',
  'Spanish La Liga', 'Italian Serie A', 'German Bundesliga', 'French Ligue 1', 'Scottish Premiership',
  'Dutch Eredivisie', 'Portuguese Primeira Liga', 'FIFA World Cup', 'FIFA Club World Cup', 'UEFA Euro', 'Copa America',
  'World Cup Qualifiers - Europe', 'UEFA Euro Qualifiers', 'Copa del Rey', 'DFB Pokal', 'Coppa Italia', 'Coupe de France',
].map(s => '^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
const BIG_MATCH = 200_000          // £ matched on Match Odds: follow it whatever the competition

export const SPORTS: SportDef[] = [
  {
    sport: 'football', eventTypeId: '1', main: 'MATCH_ODDS', mainInPlay: true,
    extra: [
      { code: 'OVER_UNDER_25', inPlay: true }, { code: 'BOTH_TEAMS_TO_SCORE', inPlay: true },
      { code: 'OVER_UNDER_15', inPlay: false }, { code: 'OVER_UNDER_35', inPlay: false }, { code: 'CORRECT_SCORE', inPlay: false },
    ],
    lookBackH: 3, lookAheadH: 3.5, catalogueEveryMs: 10 * MIN,
    pre: [{ beforeMin: 10, everyMs: 15_000 }, { beforeMin: 60, everyMs: MIN }, { beforeMin: 180, everyMs: 5 * MIN }],
    lateEveryMs: 15_000, inPlayEveryMs: MIN, giveUpAfterStartH: 3.5,
    pick: c => !!c.event?.name.includes(' v ') && (c.runners?.length ?? 0) === 3
      && (has(FOOTBALL_COMPS, c.competition?.name) || (c.totalMatched ?? 0) >= BIG_MATCH),
  },
  {
    sport: 'tennis', eventTypeId: '2', main: 'MATCH_ODDS', mainInPlay: true, extra: [],
    lookBackH: 8, lookAheadH: 2.5, catalogueEveryMs: 10 * MIN,
    pre: [{ beforeMin: 15, everyMs: 30_000 }, { beforeMin: 60, everyMs: MIN }, { beforeMin: 120, everyMs: 5 * MIN }],
    // Tennis start times are only a guide: later matches on a court start hours after.
    lateEveryMs: 2 * MIN, inPlayEveryMs: 30_000, giveUpAfterStartH: 14,
    pick: c => !!c.event?.name.includes(' v ') && !c.event.name.includes('/') && (c.runners?.length ?? 0) === 2
      && has(/\b(ATP|WTA)\b|Wimbledon|Australian Open|French Open|Roland Garros|US Open|Davis Cup|Billie Jean King|United Cup|Laver Cup|Olympic/i, c.competition?.name)
      && !has(/Challenger|ITF|UTR|Doubles|Qualif|Futures/i, c.competition?.name),
  },
  {
    sport: 'golf', eventTypeId: '3', main: 'WINNER', mainInPlay: true, extra: [],
    lookBackH: 6 * 24, lookAheadH: 3.5 * 24, catalogueEveryMs: 30 * MIN,
    pre: [{ beforeMin: 24 * 60, everyMs: 30 * MIN }, { beforeMin: 3 * 24 * 60, everyMs: 2 * H }],
    lateEveryMs: 30 * MIN, inPlayEveryMs: 10 * MIN, giveUpAfterStartH: 6 * 24,
    pick: c => (has(/PGA Tour|DP World|European Tour|Masters|US Open|The Open|Open Championship|PGA Championship|Ryder|Presidents|LIV/i, c.competition?.name)
      || has(/Masters|US Open|The Open|Open Championship|PGA Championship|Ryder Cup|Presidents Cup/i, c.event?.name)
      || (c.totalMatched ?? 0) >= 50_000)
      && !has(/Senior|Champions Tour|Korn Ferry|Challenge Tour|LPGA|Ladies|Women|Amateur/i, (c.competition?.name ?? '') + ' ' + (c.event?.name ?? '')),
  },
]

type Tracked = {
  id: string; def: SportDef; type: string; recordInPlay: boolean
  start: number; stage: 'pre' | 'inplay'; offAt: number | null
  matched: number | null; lastPolled: number; lastSaved: number; lastKey: string; seenAt: number
}

export class SportsRecorder {
  markets = new Map<string, Tracked>()
  private settled = new Set<string>()
  private lastCatalogue: Record<string, number> = {}
  lastOkAt = 0
  lastError: string | null = null
  enabled = true                      // switched off if the database isn't ready (migration 054)

  constructor(private bf: Betfair, private store: Store, private count: Counters) {}

  private fail(what: string, e: unknown) {
    this.count.checksFailed++
    const msg = `${what}: ${errText(e)}`
    if (msg !== this.lastError) log.warn(msg)
    this.lastError = msg
  }
  private ok() { this.count.checksOk++; this.lastOkAt = Date.now(); this.lastError = null }

  private everyMs(m: Tracked, now: number): number | null {
    const d = m.def
    if (now - m.start > d.giveUpAfterStartH * H) return null
    if (m.stage === 'inplay') return m.recordInPlay ? d.inPlayEveryMs : null
    const minsTo = (m.start - now) / MIN
    if (minsTo < 0) return d.lateEveryMs
    for (const c of d.pre) if (minsTo <= c.beforeMin) return c.everyMs
    return null
  }

  // Betfair limits how much one catalogue request may return: ask for less if it says no.
  // (MARKET_DESCRIPTION counts against that limit, so it's only asked for when needed.)
  private async catalogue(filter: object, sizes: number[], withType = false): Promise<RawCat[]> {
    for (const n of sizes) {
      try {
        return await this.bf.read<RawCat[]>('listMarketCatalogue', {
          filter, marketProjection: ['EVENT', 'COMPETITION', 'MARKET_START_TIME', 'RUNNER_DESCRIPTION', ...(withType ? ['MARKET_DESCRIPTION'] : [])],
          sort: 'MAXIMUM_TRADED', maxResults: n,
        })
      } catch (e) { if (!(e instanceof BetfairError && e.code === 'TOO_MUCH_DATA') || n === sizes[sizes.length - 1]) throw e }
    }
    return []
  }

  // ---------------------------------------------------------------- what to follow
  async refreshCatalogue(now = Date.now()) {
    if (!this.enabled) return
    for (const d of SPORTS) {
      if (now - (this.lastCatalogue[d.sport] ?? 0) < d.catalogueEveryMs - 5000) continue
      try {
        const window = { from: new Date(now - d.lookBackH * H).toISOString(), to: new Date(now + d.lookAheadH * H).toISOString() }
        const mains = (await this.catalogue({ eventTypeIds: [d.eventTypeId], marketTypeCodes: [d.main], marketStartTime: window }, [500, 200, 100])).filter(d.pick)
        const cats: { c: RawCat; inPlay: boolean }[] = mains.map(c => ({ c, inPlay: d.mainInPlay }))
        if (d.extra.length && mains.length) {
          const eventIds = Array.from(new Set(mains.map(c => c.event!.id)))
          for (let i = 0; i < eventIds.length; i += 25) {
            const more = await this.catalogue({ eventIds: eventIds.slice(i, i + 25), marketTypeCodes: d.extra.map(x => x.code) }, [200, 100], true)
            for (const c of more) cats.push({ c, inPlay: d.extra.find(x => x.code === c.description?.marketType)?.inPlay ?? false })
          }
        }
        this.ok()
        this.lastCatalogue[d.sport] = now
        const rows = []
        for (const { c, inPlay } of cats) {
          if (this.settled.has(c.marketId)) continue
          const type = c.description?.marketType ?? d.main     // main markets are asked for without a description
          const start = new Date(c.marketStartTime).getTime()
          const m = this.markets.get(c.marketId)
          if (!m) {
            this.markets.set(c.marketId, { id: c.marketId, def: d, type, recordInPlay: inPlay, start, stage: 'pre', offAt: null,
              matched: c.totalMatched ?? null, lastPolled: 0, lastSaved: 0, lastKey: '', seenAt: now })
          } else {
            m.start = start
            m.seenAt = now
            if (typeof c.totalMatched === 'number') m.matched = c.totalMatched
          }
          rows.push({
            market_id: c.marketId, sport: d.sport, market_type: type, event_id: c.event?.id ?? null, event: c.event?.name ?? c.marketName,
            market_name: c.marketName, venue: c.competition?.name ?? null, competition: c.competition?.name ?? null, country: c.event?.countryCode ?? null,
            start_at: c.marketStartTime, total_matched: c.totalMatched ?? null, updated_at: new Date(now).toISOString(),
            runners: (c.runners ?? []).map(r => ({ id: r.selectionId, name: r.runnerName, sort: r.sortPriority ?? null })),
          })
        }
        // Merge: refreshes the details, never touches a saved result.
        this.store.add({ kind: 'upsert', table: 'bf_markets', rows, onConflict: 'market_id' })
      } catch (e) {
        this.fail(`${d.sport[0].toUpperCase() + d.sport.slice(1)} list`, e)
      }
    }
  }

  // ---------------------------------------------------------------- prices
  async pollPrices(now = Date.now()) {
    if (!this.enabled || !this.markets.size) return
    const due = [...this.markets.values()].filter(m => { const e = this.everyMs(m, now); return e !== null && now - m.lastPolled >= e - 250 })
    if (!due.length) return
    const at = new Date(now).toISOString()
    const snaps: SnapRec[] = []
    for (let i = 0; i < due.length; i += 40) {
      const chunk = due.slice(i, i + 40)
      try {
        const books = await this.bf.read<RawBook[]>('listMarketBook', {
          marketIds: chunk.map(m => m.id),
          priceProjection: { priceData: ['EX_BEST_OFFERS'], exBestOffersOverrides: { bestPricesDepth: 1 } },
        })
        this.ok()
        for (const m of chunk) m.lastPolled = now
        for (const b of books) {
          const m = this.markets.get(b.marketId)
          if (!m) continue
          if (b.status === 'CLOSED') { this.settle(b, now); continue }
          if (b.inplay && m.stage === 'pre') {
            m.stage = 'inplay'; m.offAt = now
            this.store.add({ kind: 'update', table: 'bf_markets', match: { market_id: m.id }, values: { off_at: at, total_matched: m.matched, updated_at: at } })
            if (!m.recordInPlay) continue
          }
          if (b.status !== 'OPEN') continue                          // suspended (a goal, between rounds): wait
          const snap = toSnap(b, at)
          if (snap.matched === null) snap.matched = m.matched
          const key = JSON.stringify(snap.runners)
          const every = this.everyMs(m, now) ?? MIN
          if (key === m.lastKey && now - m.lastSaved < Math.max(MIN, every * 5)) continue
          m.lastKey = key; m.lastSaved = now
          snaps.push(snap)
        }
      } catch (e) {
        this.fail('Football/tennis/golf prices', e)
      }
    }
    if (snaps.length) {
      this.store.add({ kind: 'upsert', table: 'bf_snaps', rows: snaps, onConflict: 'market_id,at', ignoreDuplicates: true })
      this.count.snaps += snaps.length
    }
  }

  private settle(b: RawBook, now: number) {
    const iso = new Date(now).toISOString()
    this.store.add({ kind: 'update', table: 'bf_markets', match: { market_id: b.marketId }, values: {
      status: 'CLOSED', winners: b.runners.filter(x => x.status === 'WINNER').map(x => x.selectionId),
      removed: b.runners.filter(x => x.status === 'REMOVED').map(x => x.selectionId), result_at: iso, updated_at: iso,
    } })
    this.markets.delete(b.marketId)
    this.settled.add(b.marketId)
  }

  // ---------------------------------------------------------------- results
  // Markets no longer being priced (kick-off passed for pre-match-only markets,
  // or past the give-up time) are checked for a result every couple of minutes.
  // extraIds: unsettled markets found in the database (e.g. from before a restart).
  async collectResults(now = Date.now(), extraIds: string[] = []) {
    if (!this.enabled) return
    const waiting = [...this.markets.values()].filter(m => this.everyMs(m, now) === null && now > m.start).map(m => m.id)
    const ids = Array.from(new Set([...waiting, ...extraIds])).slice(0, 200)
    for (let i = 0; i < ids.length; i += 40) {
      try {
        const books = await this.bf.read<RawBook[]>('listMarketBook', { marketIds: ids.slice(i, i + 40) })
        this.ok()
        for (const b of books) if (b.status === 'CLOSED') this.settle(b, now)
      } catch (e) {
        this.fail('Football/tennis/golf results', e)
      }
    }
    // Forget markets long past their give-up time (abandoned, or never settled).
    for (const m of this.markets.values()) if (now - m.start > m.def.giveUpAfterStartH * H + 24 * H) { this.markets.delete(m.id); this.settled.add(m.id) }
    if (this.settled.size > 20_000) this.settled = new Set([...this.settled].slice(-10_000))
  }

  summary(): string {
    const n: Record<string, number> = {}
    for (const m of this.markets.values()) n[m.def.sport] = (n[m.def.sport] ?? 0) + 1
    return Object.entries(n).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'
  }
}
