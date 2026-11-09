// ============================================================
// Betfair paper desk -- the six agents.
//
//   SCOUT     GB/IE horse-racing WIN markets off within the hour
//   FILTER    8 hard rules; the first rule a market fails kills it
//   ANALYST   scores what's left 0-100 on 5 signals; 70+ goes through,
//             and only when the signals agree on direction
//   EXECUTOR  opens a PAPER back or lay on the favourite
//   RISK      sizes it, sets the stop before entry, trails, flat before off
//   LOGGER    returns every kill and every trade for the caller to store
//
// Pure: no database, no network. One call to tick() is one poll of the
// market. The caller (lib/betfair/run.ts) loads state, passes a Feed, and
// saves what comes back. Nothing here can place a real bet.
// ============================================================

export const CONFIG = {
  startBank: 500,
  stakePct: 0.05,          // RISK: max 5% of bank per trade
  maxStake: 50,
  commission: 0.05,        // set to your Betfair market base rate
  stopTicks: 3,            // stop set before entry
  targetTicks: 4,
  trailAfterTicks: 2,      // trailing stop switches on after +2 ticks
  trailGapTicks: 2,
  exitSecsBeforeOff: 30,   // always flat before the off
  minScore: 70,
  maxOpen: 3,
  minPolls: 4,             // watch a market this many polls before judging momentum
  catalogueEveryMs: 3 * 60_000,
  demoStepMs: 30_000,      // demo clock advances 30s per tick
} as const

export const RULES = [
  'market open, not in-play',
  'off in 3–20 min',
  'matched ≥ £20k',
  '5+ active runners',
  'favourite price 2.0–8.0',
  'favourite spread ≤ 2 ticks',
  'back book ≤ 105%',
  '£300+ at best on both sides',
] as const

// ---------------------------------------------------------------- types
export type PriceSize = { price: number; size: number }
export type Runner = { selectionId: number; status: string; ex?: { availableToBack?: PriceSize[]; availableToLay?: PriceSize[] } }
export type Book = { marketId: string; status: string; inplay: boolean; totalMatched: number; runners: Runner[] }
export type Market = { id: string; name: string; start: string }
export type Side = 'BACK' | 'LAY'
export type Signals = { weight_of_money: number; momentum: number; spread: number; volume: number; depth: number }

export interface Feed {
  catalogue(now: Date): Promise<Market[]>
  books(ids: string[], now: Date): Promise<Record<string, Book>>
}

export type Position = {
  marketId: string; market: string; sel: number; side: Side; entry: number
  stake: number; score: number; start: string; peak: number; openedAt: string
}

export type SimMarket = Market & {
  runners: number; fav: number; drift: number; matched: number; spread: number; depth: number; overround: number
}

export type BotState = {
  bank: number
  clock?: string                 // demo only: simulated time
  seed?: number                  // demo only: RNG state
  sim?: SimMarket[]              // demo only
  catalogue: Market[]
  catalogueAt?: string
  watch: Record<string, { hist: number[]; done: boolean }>
  positions: Record<string, Position>
  counts: { scanned: number; killed: number; scored: number; traded: number; stops: number; logged: number }
  ruleKills: number[]
  lastScore: ({ market: string; score: number; stage: 'traded' | 'dropped' } & Signals) | null
}

export type TradeOut = {
  market_id: string; market: string; side: Side; entry: number; exit: number; stake: number
  gross_pl: number; commission: number; net_pl: number; score: number; reason: string; closed_at: string
}
export type EventOut = { type: string; market: string; detail: string; at: string }

export function freshState(): BotState {
  return {
    bank: CONFIG.startBank, catalogue: [], watch: {}, positions: {},
    counts: { scanned: 0, killed: 0, scored: 0, traded: 0, stops: 0, logged: 0 },
    ruleKills: [0, 0, 0, 0, 0, 0, 0, 0], lastScore: null,
  }
}

// ---------------------------------------------------------------- Betfair tick ladder
const LADDER: [number, number, number][] = [
  [1.01, 2, 0.01], [2, 3, 0.02], [3, 4, 0.05], [4, 6, 0.1], [6, 10, 0.2], [10, 20, 0.5],
  [20, 30, 1], [30, 50, 2], [50, 100, 5], [100, 1000, 10],
]
export const TICKS: number[] = (() => {
  const out: number[] = []
  for (const [lo, hi, step] of LADDER) {
    const n = Math.round((hi - lo) / step)
    for (let i = 0; i < n; i++) out.push(Math.round((lo + i * step) * 100) / 100)
  }
  out.push(1000)
  return out
})()

export function tickIndex(price: number): number {
  let best = 0
  for (let i = 1; i < TICKS.length; i++) if (Math.abs(TICKS[i] - price) < Math.abs(TICKS[best] - price)) best = i
  return best
}
export const tickMove = (price: number, n: number) => TICKS[Math.max(0, Math.min(TICKS.length - 1, tickIndex(price) + n))]
export const tickDiff = (a: number, b: number) => tickIndex(b) - tickIndex(a)

// ---------------------------------------------------------------- helpers
const r2 = (n: number) => Math.round(n * 100) / 100
function best(r: Runner | undefined, side: 'availableToBack' | 'availableToLay'): [number | null, number] {
  const l = r?.ex?.[side]
  return l && l.length ? [l[0].price, l[0].size] : [null, 0]
}
function favourite(book: Book): Runner | undefined {
  const act = book.runners.filter(r => r.status === 'ACTIVE' && best(r, 'availableToBack')[0])
  return act.sort((a, b) => (best(a, 'availableToBack')[0] as number) - (best(b, 'availableToBack')[0] as number))[0]
}

// Green-up profit (equal on every outcome) for back-then-lay or lay-then-back.
export function hedgePl(side: Side, stake: number, entry: number, exit: number): number {
  return side === 'BACK' ? stake * (entry / exit - 1) : stake * (1 - entry / exit)
}

// ---------------------------------------------------------------- FILTER
// Returns the number (1-8) of the first rule the market fails, or 0 if it passes all.
export function filterAgent(m: Market, book: Book | undefined, now: Date): number {
  if (!book || book.status !== 'OPEN' || book.inplay) return 1
  const mins = (new Date(m.start).getTime() - now.getTime()) / 60_000
  if (mins < 3 || mins > 20) return 2
  if ((book.totalMatched ?? 0) < 20_000) return 3
  const active = book.runners.filter(r => r.status === 'ACTIVE')
  if (active.length < 5) return 4
  const fav = favourite(book)
  if (!fav) return 5
  const [bp, bs] = best(fav, 'availableToBack'); const [lp, ls] = best(fav, 'availableToLay')
  if (bp === null || bp < 2 || bp > 8) return 5
  if (lp === null || tickDiff(bp, lp) > 2) return 6
  const bookPct = active.reduce((s, r) => { const p = best(r, 'availableToBack')[0]; return p ? s + 1 / p : s }, 0)
  if (bookPct > 1.05) return 7
  if (bs < 300 || ls < 300) return 8
  return 0
}

// ---------------------------------------------------------------- ANALYST
export function analystAgent(book: Book, hist: number[]): { score: number; side: Side; sig: Signals } {
  const fav = favourite(book) as Runner
  const [bp, bs] = best(fav, 'availableToBack'); const [lp, ls] = best(fav, 'availableToLay')
  const wom = bs + ls ? bs / (bs + ls) : 0.5                       // money waiting to back vs lay
  const moves = hist.length > 1 ? tickDiff(hist[0], bp as number) : 0 // +ve = drifting
  const sig: Signals = {
    weight_of_money: Math.round(Math.abs(wom - 0.5) * 200),
    momentum: Math.min(100, Math.abs(moves) * 25),
    spread: tickDiff(bp as number, lp as number) <= 1 ? 100 : 50,
    volume: Math.min(100, Math.round(book.totalMatched / 1500)),
    depth: Math.min(100, Math.round(Math.min(bs, ls) / 20)),
  }
  const shortening = wom > 0.5 && moves <= 0
  const drifting = wom < 0.5 && moves >= 0
  const vals = Object.values(sig)
  const score = shortening || drifting ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  return { score, side: shortening ? 'BACK' : 'LAY', sig }
}

// ---------------------------------------------------------------- one poll
export async function tick(state: BotState, feed: Feed, now: Date) {
  const trades: TradeOut[] = []
  const events: EventOut[] = []
  const at = now.toISOString()
  const log = (type: string, market: string, detail: string) => { events.push({ type, market, detail, at }); state.counts.logged++ }

  // SCOUT: refresh the market list every few minutes, not every poll
  if (!state.catalogueAt || now.getTime() - new Date(state.catalogueAt).getTime() > CONFIG.catalogueEveryMs) {
    state.catalogue = await feed.catalogue(now)
    state.catalogueAt = at
  }
  const upcoming = state.catalogue.filter(m => {
    const mins = (new Date(m.start).getTime() - now.getTime()) / 60_000
    return mins > 0 && mins <= 25
  })
  const ids = Array.from(new Set([...upcoming.map(m => m.id), ...Object.keys(state.positions)]))
  const books = ids.length ? await feed.books(ids, now) : {}

  // RISK: manage open paper positions
  for (const [mid, pos] of Object.entries(state.positions)) {
    const b = books[mid]
    const fav = b?.runners.find(r => r.selectionId === pos.sel)
    // to close a BACK you lay (best lay price); to close a LAY you back
    const px = best(fav, pos.side === 'BACK' ? 'availableToLay' : 'availableToBack')[0]
    const secs = (new Date(pos.start).getTime() - now.getTime()) / 1000
    if (!px) {
      if (secs <= 0) { delete state.positions[mid]; log('VOID', pos.market, 'no price at the off · position dropped, no P&L') }
      continue
    }
    const gain = pos.side === 'BACK' ? -tickDiff(pos.entry, px) : tickDiff(pos.entry, px)
    pos.peak = Math.max(pos.peak, gain)
    let reason: string | null = null
    if (gain <= -CONFIG.stopTicks) reason = 'stop'
    else if (gain >= CONFIG.targetTicks) reason = 'target'
    else if (pos.peak >= CONFIG.trailAfterTicks && gain <= pos.peak - CONFIG.trailGapTicks) reason = 'trailed out'
    else if (secs <= CONFIG.exitSecsBeforeOff || b?.inplay) reason = 'flat before off'
    if (!reason) continue
    const gross = r2(hedgePl(pos.side, pos.stake, pos.entry, px))
    const comm = r2(Math.max(gross, 0) * CONFIG.commission)
    const net = r2(gross - comm)
    state.bank = r2(state.bank + net)
    if (reason === 'stop') state.counts.stops++
    trades.push({ market_id: mid, market: pos.market, side: pos.side, entry: pos.entry, exit: px, stake: pos.stake,
      gross_pl: gross, commission: comm, net_pl: net, score: pos.score, reason, closed_at: at })
    log(reason === 'stop' ? 'STOP' : net > 0 ? 'WIN' : 'LOSS', pos.market, `${pos.side} ${pos.entry}→${px} · £${net.toFixed(2)} · ${reason}`)
    delete state.positions[mid]
  }

  // FILTER → ANALYST → EXECUTOR for markets not yet judged
  for (const m of upcoming) {
    const b = books[m.id]
    if (!b || state.positions[m.id]) continue
    const w = (state.watch[m.id] ??= { hist: [], done: false })
    const fav = favourite(b)
    if (fav) { w.hist.push(best(fav, 'availableToBack')[0] as number); w.hist = w.hist.slice(-12) }
    if (w.done) continue
    const rule = filterAgent(m, b, now)
    if (rule) {
      if (rule === 1 || rule === 2) continue   // can still change: keep watching, don't log
      w.done = true
      state.counts.scanned++; state.counts.killed++; state.ruleKills[rule - 1]++
      log('KILL', m.name, `failed rule ${rule}/8 · ${RULES[rule - 1]}`)
      continue
    }
    if (w.hist.length < CONFIG.minPolls) continue
    w.done = true
    state.counts.scanned++; state.counts.scored++
    const { score, side, sig } = analystAgent(b, w.hist)
    const go = score >= CONFIG.minScore && Object.keys(state.positions).length < CONFIG.maxOpen
    state.lastScore = { market: m.name, score, stage: go ? 'traded' : 'dropped', ...sig }
    log(go ? 'PASS' : 'SCORE', m.name, `${score} → ${go ? 'executor' : 'dropped'}`)
    if (!go || !fav) continue
    const entry = best(fav, side === 'BACK' ? 'availableToBack' : 'availableToLay')[0] as number
    const stake = r2(Math.min(state.bank * CONFIG.stakePct, CONFIG.maxStake))
    state.positions[m.id] = { marketId: m.id, market: m.name, sel: fav.selectionId, side, entry, stake, score,
      start: m.start, peak: 0, openedAt: at }
    state.counts.traded++
    log('ENTER', m.name, `${side} @ ${entry} · £${stake.toFixed(2)} · stop −${CONFIG.stopTicks} ticks`)
  }

  // forget markets that have gone off
  for (const id of Object.keys(state.watch)) {
    const m = state.catalogue.find(c => c.id === id)
    if (!m || new Date(m.start).getTime() < now.getTime() - 60_000) delete state.watch[id]
  }
  return { trades, events }
}

// ---------------------------------------------------------------- DEMO feed
// Simulated markets so the desk can be tried without a Betfair account.
// Not real prices. Its state lives inside BotState so it survives between
// serverless calls.
function rng(state: BotState) {
  return () => {
    let t = (state.seed = ((state.seed ?? 1) + 0x6d2b79f5) | 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class DemoFeed implements Feed {
  private state: BotState
  private r: () => number
  constructor(state: BotState) { this.state = state; this.r = rng(state) }
  private pick<T>(a: T[]): T { return a[Math.floor(this.r() * a.length)] }

  private topUp(now: Date) {
    const sim = (this.state.sim ??= []).filter(m => new Date(m.start).getTime() > now.getTime() - 5 * 60_000)
    const venues = ['Kempton', 'Wolverhampton', 'Newcastle', 'Lingfield', 'Southwell', 'Dundalk', 'Chelmsford', 'Ascot']
    let last = sim.length ? new Date(sim[sim.length - 1].start).getTime() : now.getTime() + 2 * 60_000
    while (last < now.getTime() + 70 * 60_000) {
      last += (3 + Math.floor(this.r() * 3)) * 60_000
      const start = new Date(last)
      sim.push({
        id: '1.' + (230000000 + Math.floor(this.r() * 9_000_000)),
        name: `${this.pick(venues)} ${start.toISOString().slice(11, 16)}`,
        start: start.toISOString(), runners: 4 + Math.floor(this.r() * 11),
        fav: tickMove(1.8 + this.r() * 6.7, 0), drift: this.pick([-0.8, -0.5, 0.5, 0.8]),
        matched: 15_000 + this.r() * 385_000, spread: this.pick([1, 1, 1, 1, 2, 3]),
        depth: 250 + this.r() * 2750, overround: 1 + this.r() * 0.06,
      })
    }
    this.state.sim = sim
  }

  async catalogue(now: Date): Promise<Market[]> {
    this.topUp(now)
    return (this.state.sim ?? [])
      .filter(m => { const t = new Date(m.start).getTime(); return t > now.getTime() && t < now.getTime() + 60 * 60_000 })
      .map(({ id, name, start }) => ({ id, name, start }))
  }

  async books(ids: string[], now: Date): Promise<Record<string, Book>> {
    this.topUp(now)
    const out: Record<string, Book> = {}
    for (const m of this.state.sim ?? []) {
      if (!ids.includes(m.id)) continue
      if (this.r() < 0.06) m.drift = -m.drift                // sentiment flips: signals can be wrong
      const step = this.r() < 0.5 + m.drift * 0.5 ? 1 : -1
      if (this.r() < 0.2) m.fav = tickMove(m.fav, step)
      m.matched *= 1.01
      const back = m.fav, lay = tickMove(back, m.spread)
      const wom = 0.5 - m.drift * 0.3 + (this.r() - 0.5) * 0.2
      const runners: Runner[] = [{ selectionId: 1, status: 'ACTIVE', ex: {
        availableToBack: [{ price: back, size: m.depth * wom * 2 }],
        availableToLay: [{ price: lay, size: m.depth * (1 - wom) * 2 }] } }]
      const others = m.runners - 1
      const share = Math.max(m.overround - 1 / back, 0.05) / Math.max(others, 1)
      for (let j = 2; j <= m.runners; j++) {
        const p = tickMove(Math.min(1 / share, 999), 0)
        runners.push({ selectionId: j, status: 'ACTIVE', ex: {
          availableToBack: [{ price: p, size: 200 }], availableToLay: [{ price: tickMove(p, 2), size: 200 }] } })
      }
      out[m.id] = { marketId: m.id, status: 'OPEN', inplay: now.getTime() >= new Date(m.start).getTime(), totalMatched: m.matched, runners }
    }
    return out
  }
}
