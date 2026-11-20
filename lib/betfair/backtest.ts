// ============================================================
// Backtester for recorded Betfair prices (the Backtest tab).
//
// A test is: at a set time before the start, pick selection(s) by a rule,
// back (or lay) them at the price then, and close the position later
// (at the off, a set time before, a set time into play, or at the
// starting price) by hedging so the profit is the same whoever wins.
//
// For every trade it works out the price move (%, ticks), the ticks won,
// the hedge ("green up") stake and the profit or loss from a flat stake
// after commission, plus what would have happened if left to run.
// Pure functions: the tab runs them in the browser on points fetched from
// /api/betfair/backtest (two snapshots per market, not the whole history).
// ============================================================

import { ticksBetween } from './ticks'

export type BtSport = 'racing' | 'football' | 'tennis' | 'golf'
// [selectionId, best back, £ at back, best lay, £ at lay, last traded]
export type BtRunnerPrice = [number, number | null, number, number | null, number, number | null]
export type BtPoint = { at: string; matched: number | null; runners: BtRunnerPrice[]; inplay?: boolean }
export type BtMarket = {
  market_id: string; sport: BtSport; market_type: string; event: string; venue: string | null; competition?: string | null
  country?: string | null; market_name?: string | null; race_type?: string | null; start_at: string; off_at?: string | null
  runners: { id: number; name: string }[]; winners: number[] | null; removed: number[] | null; bsp?: Record<string, number> | null
  total_matched?: number | null; status: string | null
  entry: BtPoint | null; exit: BtPoint | null
}

export type ExitMode = 'off' | 'before' | 'inplay' | 'bsp'
export type Pick = 'fav' | 'fav2' | 'fav3' | 'outsider' | 'random' | 'all' | 'name' | 'home' | 'away'
export type Rule = {
  sport: BtSport
  side: 'back' | 'lay'
  pick: Pick
  name: string                 // for pick = 'name': part of the selection name, e.g. "Draw" or "Over"
  basis: 'cross' | 'back' | 'ltp'
  exit: ExitMode
  stake: number                // £ flat (backer's stake, or the lay stake)
  commission: number           // 0.05 = 5% of net winnings on the market
  oddsMin: number; oddsMax: number
  runnersMin: number; runnersMax: number
  matchedMin: number
  raceTypes: string[]          // empty = all
  contains: string             // filter on venue, competition, event or market name
  seed: number
}

export const DEFAULT_RULE: Rule = {
  sport: 'racing', side: 'back', pick: 'fav', name: '', basis: 'cross', exit: 'off', stake: 2, commission: 0.05,
  oddsMin: 1.01, oddsMax: 1000, runnersMin: 0, runnersMax: 99, matchedMin: 0, raceTypes: [], contains: '', seed: 1,
}

export type Trade = {
  market_id: string; start_at: string; label: string; selection: string; selectionId: number; rank: number; runners: number
  entryAt: string; exitAt: string; holdSec: number
  entryQuote: number; exitQuote: number; movePct: number; moveTicks: number      // the price itself (best back), entry to exit
  entryFill: number; exitFill: number; ticksWon: number                         // the prices actually traded at
  stake: number; hedgeStake: number; pnlGross: number; pnl: number               // hedged, after commission
  runPnl: number | null; won: boolean | null                                     // if left to run instead
  spreadTicks: number | null; matched: number | null
  dims: Record<string, string>
}

export type Stats = {
  n: number; wins: number; scratches: number; losses: number
  avgMovePct: number; avgMoveTicks: number; netTicksWon: number; avgTicksWon: number
  pnl: number; avgPnl: number; roi: number; sd: number; t: number; maxDrawdown: number
  runN: number; runWins: number; runPnl: number; runRoi: number
  avgSpreadTicks: number | null; avgHoldSec: number
}
export type Breakdown = { dim: string; rows: ({ key: string } & Stats)[] }
export type Result = { trades: Trade[]; skipped: Record<string, number>; stats: Stats; breakdowns: Breakdown[]; equity: { at: string; pnl: number; run: number }[] }

const r2 = (n: number) => Math.round(n * 100) / 100
const TZ = 'Europe/London'

// Small seeded random generator, so a "random" test gives the same picks each run.
function rng(seed: number, key: string) {
  let h = seed >>> 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 2654435761) >>> 0
  return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function band(v: number, edges: number[], labels: string[]): string {
  for (let i = 0; i < edges.length; i++) if (v < edges[i]) return labels[i]
  return labels[labels.length - 1]
}
const money = (n: number) => n >= 1_000_000 ? `£${n / 1_000_000}m` : `£${n / 1000}k`

// Race distance in furlongs from a Betfair race name such as "2m4f Hcap Chs" or "7f Mdn Stks".
export function furlongs(name?: string | null): number | null {
  if (!name) return null
  const m = name.match(/(?:(\d+)m)?\s*(?:(\d+)f)?/i)
  const mi = Number(m?.[1] ?? 0), f = Number(m?.[2] ?? 0)
  return mi || f ? mi * 8 + f : null
}

function dimsFor(m: BtMarket, sel: { id: number; name: string }, rank: number, runners: number, entryQuote: number, matched: number | null): Record<string, string> {
  const start = new Date(m.start_at)
  const hour = Number(start.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }))
  const d: Record<string, string> = {
    'Entry price': band(entryQuote, [1.5, 2, 3, 4, 6, 10, 20], ['under 1.5', '1.5 to 2', '2 to 3', '3 to 4', '4 to 6', '6 to 10', '10 to 20', '20+']),
    'Matched at entry': matched == null ? 'unknown' : band(matched, [10_000, 50_000, 200_000, 1_000_000], ['under £10k', '£10k to £50k', '£50k to £200k', '£200k to £1m', '£1m+']),
    'Day': start.toLocaleDateString('en-GB', { weekday: 'short', timeZone: TZ }),
    'Start time': band(hour, [13, 15, 17, 19], ['before 1pm', '1pm to 3pm', '3pm to 5pm', '5pm to 7pm', '7pm or later']),
    'Price rank': rank === 1 ? 'Favourite' : rank === 2 ? '2nd favourite' : rank === 3 ? '3rd favourite' : rank <= 6 ? '4th to 6th' : '7th or longer',
  }
  if (m.sport === 'racing') {
    d['Race type'] = m.race_type ?? 'unknown'
    d['Venue'] = m.venue ?? m.event
    d['Country'] = m.country ?? 'unknown'
    d['Runners'] = band(runners, [6, 9, 12, 16], ['5 or fewer', '6 to 8', '9 to 11', '12 to 15', '16+'])
    const f = furlongs(m.market_name)
    d['Distance'] = f == null ? 'unknown' : band(f, [8, 11, 15, 20, 24], ['up to 7f', '1m to 1m2f', '1m3f to 1m6f', '1m7f to 2m3f', '2m4f to 2m7f', '3m+'])
    d['Handicap'] = /hcap|handicap/i.test(m.market_name ?? '') ? 'Handicap' : 'Not a handicap'
  } else {
    d['Competition'] = m.competition ?? m.venue ?? 'unknown'
    if (m.sport === 'football') {
      d['Market'] = m.market_type
      const idx = m.runners.findIndex(r => r.id === sel.id)
      d['Selection'] = m.market_type === 'MATCH_ODDS' ? (/draw/i.test(sel.name) ? 'Draw' : idx === 0 ? 'Home' : idx === 1 ? 'Away' : sel.name) : sel.name
    }
    if (m.sport === 'football' || m.sport === 'tennis') d['Country'] = m.country ?? 'unknown'
  }
  return d
}

export const DIMS: Record<BtSport, string[]> = {
  racing: ['Race type', 'Distance', 'Handicap', 'Runners', 'Venue', 'Country', 'Matched at entry', 'Entry price', 'Price rank', 'Day', 'Start time'],
  football: ['Competition', 'Market', 'Selection', 'Matched at entry', 'Entry price', 'Price rank', 'Country', 'Day', 'Start time'],
  tennis: ['Competition', 'Matched at entry', 'Entry price', 'Price rank', 'Day', 'Start time'],
  golf: ['Competition', 'Matched at entry', 'Entry price', 'Price rank'],
}

export function stats(trades: Trade[]): Stats {
  const n = trades.length
  const sum = (f: (t: Trade) => number) => trades.reduce((a, t) => a + f(t), 0)
  const pnl = sum(t => t.pnl), mean = n ? pnl / n : 0
  const sd = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + (t.pnl - mean) ** 2, 0) / (n - 1)) : 0
  let peak = 0, cum = 0, dd = 0
  for (const t of [...trades].sort((a, b) => a.entryAt.localeCompare(b.entryAt))) { cum += t.pnl; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak) }
  const run = trades.filter(t => t.runPnl !== null)
  const spreads = trades.filter(t => t.spreadTicks !== null)
  const stake = n ? trades[0].stake : 0          // flat stake
  return {
    n, wins: trades.filter(t => t.pnl > 0.0001).length, scratches: trades.filter(t => Math.abs(t.pnl) <= 0.0001).length, losses: trades.filter(t => t.pnl < -0.0001).length,
    avgMovePct: n ? sum(t => t.movePct) / n : 0, avgMoveTicks: n ? sum(t => t.moveTicks) / n : 0,
    netTicksWon: sum(t => t.ticksWon), avgTicksWon: n ? sum(t => t.ticksWon) / n : 0,
    pnl, avgPnl: mean, roi: n && stake ? pnl / (n * stake) : 0, sd, t: n > 1 && sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, maxDrawdown: dd,
    runN: run.length, runWins: run.filter(t => t.won).length, runPnl: run.reduce((a, t) => a + (t.runPnl ?? 0), 0),
    runRoi: run.length && stake ? run.reduce((a, t) => a + (t.runPnl ?? 0), 0) / (run.length * stake) : 0,
    avgSpreadTicks: spreads.length ? spreads.reduce((a, t) => a + (t.spreadTicks ?? 0), 0) / spreads.length : null,
    avgHoldSec: n ? sum(t => t.holdSec) / n : 0,
  }
}

export function runBacktest(markets: BtMarket[], rule: Rule): Result {
  const trades: Trade[] = []
  const skipped: Record<string, number> = {}
  const skip = (why: string, n = 1) => { skipped[why] = (skipped[why] ?? 0) + n }
  const contains = rule.contains.trim().toLowerCase()

  for (const m of markets) {
    if (contains && ![m.venue, m.competition, m.event, m.market_name].some(s => s?.toLowerCase().includes(contains))) continue
    if (rule.raceTypes.length && !rule.raceTypes.includes(m.race_type ?? 'unknown')) continue
    if (!m.entry) { skip('no prices at the entry time'); continue }
    if (rule.exit === 'bsp' ? !m.bsp : !m.exit) { skip(rule.exit === 'bsp' ? 'no starting prices' : 'no prices at the exit time'); continue }
    const matched = m.entry.matched ?? m.total_matched ?? null
    if (rule.matchedMin && (matched ?? 0) < rule.matchedMin) continue

    // runners with a price at entry, shortest first
    const priced = m.entry.runners.filter(r => r[1] || r[5]).sort((a, b) => ((a[1] ?? a[5] ?? 1e9) - (b[1] ?? b[5] ?? 1e9)) || ((a[5] ?? 1e9) - (b[5] ?? 1e9)))
    const nRunners = priced.length
    if (nRunners < rule.runnersMin || nRunners > rule.runnersMax) continue
    const names = new Map(m.runners.map(r => [r.id, r.name]))
    let picks: BtRunnerPrice[] = []
    switch (rule.pick) {
      case 'fav': picks = priced.slice(0, 1); break
      case 'fav2': picks = priced.slice(1, 2); break
      case 'fav3': picks = priced.slice(2, 3); break
      case 'outsider': picks = priced.slice(-1); break
      case 'all': picks = priced; break
      case 'random': { const rand = rng(rule.seed, m.market_id); picks = priced.length ? [priced[Math.floor(rand() * priced.length)]] : []; break }
      case 'name': { const q = rule.name.trim().toLowerCase(); picks = q ? priced.filter(r => names.get(r[0])?.toLowerCase().includes(q)) : []; break }
      case 'home': case 'away': { const id = m.runners[rule.pick === 'home' ? 0 : 1]?.id; picks = priced.filter(r => r[0] === id); break }
    }
    if (!picks.length) { skip('no selection matched the rule'); continue }

    const exitRunners = new Map((m.exit?.runners ?? []).map(r => [r[0], r]))
    for (const p of picks) {
      const id = p[0], rank = priced.indexOf(p) + 1
      if (m.removed?.includes(id)) { skip('selection was a non-runner'); continue }
      const entryQuote = p[1] ?? p[5]
      if (!entryQuote) { skip('no price for the selection'); continue }
      if (entryQuote < rule.oddsMin || entryQuote > rule.oddsMax) continue
      const x = exitRunners.get(id)
      const bsp = m.bsp?.[String(id)] ?? null
      const exitQuote = rule.exit === 'bsp' ? bsp : (x?.[1] ?? x?.[5] ?? null)
      if (!exitQuote) { skip(rule.exit === 'bsp' ? 'no starting price for the selection' : 'no exit price for the selection'); continue }

      // the prices actually traded at
      let entryFill: number | null, exitFill: number | null
      if (rule.basis === 'ltp') { entryFill = p[5]; exitFill = rule.exit === 'bsp' ? bsp : x?.[5] ?? null }
      else if (rule.basis === 'back') { entryFill = p[1]; exitFill = rule.exit === 'bsp' ? bsp : x?.[1] ?? null }
      else if (rule.side === 'back') { entryFill = p[1]; exitFill = rule.exit === 'bsp' ? bsp : x?.[3] ?? null }   // back at the back price, lay off at the lay price
      else { entryFill = p[3]; exitFill = rule.exit === 'bsp' ? bsp : x?.[1] ?? null }                             // lay at the lay price, back off at the back price
      if (!entryFill || !exitFill) { skip('no price to trade at (empty side of the book)'); continue }

      const s = rule.stake
      const ratio = entryFill / exitFill
      const pnlGross = rule.side === 'back' ? s * (ratio - 1) : s * (1 - ratio)
      const pnl = pnlGross > 0 ? pnlGross * (1 - rule.commission) : pnlGross
      const ticksWon = rule.side === 'back' ? -ticksBetween(entryFill, exitFill) : ticksBetween(entryFill, exitFill)

      let runPnl: number | null = null, won: boolean | null = null
      if (m.status && m.winners) {
        won = m.winners.includes(id)
        runPnl = rule.side === 'back' ? (won ? s * (entryFill - 1) * (1 - rule.commission) : -s) : (won ? -s * (entryFill - 1) : s * (1 - rule.commission))
      }
      const sel = { id, name: names.get(id) ?? String(id) }
      const exitAt = rule.exit === 'bsp' ? (m.off_at ?? m.start_at) : m.exit!.at
      const t: Trade = {
        market_id: m.market_id, start_at: m.start_at, selection: sel.name, selectionId: id, rank, runners: nRunners,
        label: m.sport === 'racing'
          ? `${new Date(m.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })} ${m.venue ?? m.event}`
          : m.sport === 'football' && m.market_type !== 'MATCH_ODDS' ? `${m.event} · ${m.market_name ?? m.market_type}` : m.event,
        entryAt: m.entry.at, exitAt, holdSec: Math.round((new Date(exitAt).getTime() - new Date(m.entry.at).getTime()) / 1000),
        entryQuote, exitQuote, movePct: r2((exitQuote / entryQuote - 1) * 100), moveTicks: ticksBetween(entryQuote, exitQuote),
        entryFill, exitFill, ticksWon, stake: s, hedgeStake: r2(s * ratio), pnlGross: r2(pnlGross), pnl: r2(pnl),
        runPnl: runPnl === null ? null : r2(runPnl), won,
        spreadTicks: p[1] && p[3] ? ticksBetween(p[1], p[3]) : null, matched,
        dims: dimsFor(m, sel, rank, nRunners, entryQuote, matched),
      }
      trades.push(t)
    }
  }

  trades.sort((a, b) => a.entryAt.localeCompare(b.entryAt))
  let cum = 0, run = 0
  const equity = trades.map(t => { cum += t.pnl; run += t.runPnl ?? 0; return { at: t.entryAt, pnl: r2(cum), run: r2(run) } })
  const breakdowns: Breakdown[] = DIMS[rule.sport].map(dim => {
    const groups = new Map<string, Trade[]>()
    for (const t of trades) { const k = t.dims[dim]; if (k !== undefined) groups.set(k, [...(groups.get(k) ?? []), t]) }
    return { dim, rows: [...groups.entries()].map(([key, ts]) => ({ key, ...stats(ts) })).sort((a, b) => b.n - a.n) }
  }).filter(b => b.rows.length > 1)
  return { trades, skipped, stats: stats(trades), breakdowns, equity }
}

// The same test with a randomly chosen selection in each market, many times over:
// what "no skill" looks like on exactly these markets, times and prices.
export function randomBaseline(markets: BtMarket[], rule: Rule, runs = 50) {
  const totals: number[] = [], ticks: number[] = [], runTotals: number[] = []
  let n = 0
  for (let i = 1; i <= runs; i++) {
    const r = runBacktest(markets, { ...rule, pick: 'random', seed: i * 7919 })
    totals.push(r.stats.pnl); ticks.push(r.stats.avgTicksWon); runTotals.push(r.stats.runPnl); n = r.stats.n
  }
  const sorted = [...totals].sort((a, b) => a - b), q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
  return { runs, trades: n, meanPnl: avg(totals), p5: q(0.05), p95: q(0.95), meanTicks: avg(ticks), meanRunPnl: avg(runTotals) }
}

export function tradesCsv(trades: Trade[], sport: BtSport): string {
  const dims = DIMS[sport]
  const head = ['market_id', 'start', 'market', 'selection', 'price_rank', 'runners', 'entry_at', 'exit_at', 'hold_s', 'entry_price', 'exit_price', 'move_pct', 'move_ticks',
    'traded_in', 'traded_out', 'ticks_won', 'hedge_stake', 'pnl_before_commission', 'pnl', 'won', 'left_to_run_pnl', 'spread_ticks', 'matched', ...dims]
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [head.join(','), ...trades.map(t => [t.market_id, t.start_at, t.label, t.selection, t.rank, t.runners, t.entryAt, t.exitAt, t.holdSec, t.entryQuote, t.exitQuote, t.movePct, t.moveTicks,
    t.entryFill, t.exitFill, t.ticksWon, t.hedgeStake, t.pnlGross, t.pnl, t.won, t.runPnl, t.spreadTicks, t.matched, ...dims.map(d => t.dims[d])].map(esc).join(','))].join('\n')
}

// The entry and exit snapshots for one market, from its full list of snapshots.
// The same rules as the database function bf_bt_points (migration 055); used for
// days the recorder has moved to the compressed archive.
export type PointParams = { entrySec: number; tolSec: number; exit: 'off' | 'before' | 'inplay'; exitSec: number }
export function pickPoints(m: { start_at: string; off_at?: string | null }, snaps: BtPoint[], p: PointParams): { entry: BtPoint | null; exit: BtPoint | null } {
  const start = new Date(m.start_at).getTime(), off = m.off_at ? new Date(m.off_at).getTime() : null
  const sorted = [...snaps].sort((a, b) => a.at.localeCompare(b.at))
  const t = (s: BtPoint) => new Date(s.at).getTime()
  const entryBy = start - p.entrySec * 1000
  let entry: BtPoint | null = null
  for (const s of sorted) if (!s.inplay && t(s) <= entryBy && t(s) >= entryBy - p.tolSec * 1000) entry = s
  if (!entry) return { entry: null, exit: null }
  const limit = p.exit === 'off' ? (off ?? start + 12 * 3600_000) : p.exit === 'before' ? start - p.exitSec * 1000 : off === null ? -Infinity : off + p.exitSec * 1000
  let exit: BtPoint | null = null
  for (const s of sorted) if (t(s) > t(entry) && t(s) <= limit && (p.exit === 'inplay' || !s.inplay)) exit = s
  return { entry, exit }
}
