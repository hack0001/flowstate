// ============================================================
// Insights: how prices and money move before the off, and whether any
// of it says something about results (the Insights tab).
//
// Works on each market's "path": its prices at set times before the
// scheduled start plus the last price before the off. Pure functions,
// run in the browser on data from /api/betfair/insights.
//
//   moneyTimeline   when the money gets matched
//   momentum        do price moves carry on, or reverse?
//   compensation    when the favourite drifts, who shortens?
//   weightOfMoney   does the money waiting at the best prices predict the next move?
//   moveVsResult    do steamers and drifters win more or less than their price says?
//   volumeEffects   do busier markets, or a late rush of money, behave differently?
//   findSystems     scan many simple rules, then check the best on later days
// ============================================================

import { tickUp, ticksBetween } from './ticks'
import { type BtMarket, type BtPoint, type BtRunnerPrice, type BtSport, type Pick } from './backtest'

export type PathMarket = Omit<BtMarket, 'entry' | 'exit'> & { path: Record<string, BtPoint> }   // keyed by seconds before the start; '-1' = the off

export const OFF = '-1'
export const OFFSETS: Record<BtSport, number[]> = {
  racing: [3600, 2700, 1800, 1200, 900, 600, 300, 120, 0],
  football: [10800, 7200, 3600, 1800, 900, 300, 60, 0],
  tennis: [7200, 3600, 1800, 900, 300, 60, 0],
  golf: [259200, 172800, 86400, 43200, 10800, 0],
}
export const label = (k: string | number) => {
  const s = Number(k)
  if (s === -1) return 'the off'
  if (s === 0) return 'the start time'
  return s >= 86_400 ? `${s / 86_400}d` : s >= 7200 ? `${s / 3600}h` : `${s / 60}m`
}
// When each analysis looks (seconds before the start)
export const PLAN: Record<BtSport, { pairs: [number, number][]; mid: number; early: number; lateWindow: number; entries: number[] }> = {
  racing: { pairs: [[3600, 1200], [1800, 600], [1200, 300], [600, 120]], mid: 1200, early: 3600, lateWindow: 600, entries: [3600, 1800, 1200, 600, 300] },
  football: { pairs: [[7200, 1800], [3600, 900], [1800, 300]], mid: 3600, early: 10800, lateWindow: 900, entries: [7200, 3600, 1800, 900, 300] },
  tennis: { pairs: [[3600, 900], [1800, 300]], mid: 1800, early: 7200, lateWindow: 900, entries: [3600, 1800, 900, 300] },
  golf: { pairs: [[172800, 43200]], mid: 86400, early: 259200, lateWindow: 10800, entries: [172800, 86400, 43200] },
}

const price = (r?: BtRunnerPrice) => r ? (r[1] ?? r[5]) : null
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const r2 = (n: number) => Math.round(n * 100) / 100

// Prices to trade at: the best back / lay, or (Betfair history, last traded price only) the last
// traded price as the back price with the lay one tick above.
const backAt = (r?: BtRunnerPrice) => r ? (r[1] ?? r[5]) : null
const layAt = (r?: BtRunnerPrice) => r ? (r[3] ?? (r[5] ? tickUp(r[5]) : null)) : null

function ranked(p?: BtPoint): BtRunnerPrice[] {
  if (!p) return []
  return p.runners.filter(r => price(r)).sort((a, b) => price(a)! - price(b)!)
}
// Chance implied by each price, scaled so the field adds up to 100% (removes the overround)
function chances(p?: BtPoint): Map<number, number> {
  const out = new Map<number, number>()
  if (!p) return out
  let sum = 0
  for (const r of p.runners) { const q = price(r); if (q) { out.set(r[0], 1 / q); sum += 1 / q } }
  for (const [k, v] of out) out.set(k, v / sum)
  return out
}
const runnerAt = (p: BtPoint | undefined, id: number) => p?.runners.find(r => r[0] === id)

// back at entry, close at exit: profit per £stake after commission (lay is the mirror image)
export function hedged(side: 'back' | 'lay', entry: number, exit: number, stake: number, commission: number) {
  const g = side === 'back' ? stake * (entry / exit - 1) : stake * (1 - entry / exit)
  return g > 0 ? g * (1 - commission) : g
}
function settled(side: 'back' | 'lay', p: number, won: boolean, stake: number, commission: number) {
  if (side === 'back') return won ? stake * (p - 1) * (1 - commission) : -stake
  return won ? -stake * (p - 1) : stake * (1 - commission)
}
function tStat(xs: number[]) {
  if (xs.length < 2) return 0
  const m = avg(xs), sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
  return sd > 0 ? m / (sd / Math.sqrt(xs.length)) : 0
}

// ------------------------------------------------------------------ filters
export type Filter = { raceTypes: string[]; runnersMin: number; runnersMax: number; contains: string; matchedMin: number }
export const DEFAULT_FILTER: Filter = { raceTypes: [], runnersMin: 0, runnersMax: 99, contains: '', matchedMin: 0 }
export function applyFilter(ms: PathMarket[], f: Filter): PathMarket[] {
  const q = f.contains.trim().toLowerCase()
  return ms.filter(m => {
    if (f.raceTypes.length && !f.raceTypes.includes(m.race_type ?? 'unknown')) return false
    if (q && ![m.venue, m.competition, m.event, m.market_name].some(s => s?.toLowerCase().includes(q))) return false
    const off = m.path[OFF]
    const n = ranked(off).length
    if (off && (n < f.runnersMin || n > f.runnersMax)) return false
    if (f.matchedMin && (off?.matched ?? m.total_matched ?? 0) < f.matchedMin) return false
    return true
  })
}

// ------------------------------------------------------------------ coverage
export function coverage(ms: PathMarket[]) {
  return {
    markets: ms.length,
    withOff: ms.filter(m => m.path[OFF]).length,
    withResult: ms.filter(m => m.status && m.winners?.length).length,
    withBsp: ms.filter(m => m.bsp && Object.keys(m.bsp).length).length,
    days: new Set(ms.map(m => m.start_at.slice(0, 10))).size,
  }
}

// ------------------------------------------------------------------ when the money comes in
export function moneyTimeline(ms: PathMarket[], sport: BtSport) {
  const offs = ms.map(m => m.path[OFF]?.matched).filter((v): v is number => !!v).sort((a, b) => a - b)
  const rows = OFFSETS[sport].map(o => {
    const shares = ms.map(m => { const a = m.path[String(o)]?.matched, b = m.path[OFF]?.matched; return a != null && b ? Math.min(1, a / b) : null }).filter((v): v is number => v !== null)
    return { key: String(o), label: label(o) + ' before', share: avg(shares), n: shares.length }
  })
  return { rows, medianAtOff: offs.length ? offs[Math.floor(offs.length / 2)] : null }
}

// ------------------------------------------------------------------ do moves carry on?
const MOVE_BUCKETS: [string, (t: number) => boolean][] = [
  ['Shortened 10+ ticks', t => t <= -10], ['Shortened 3 to 9', t => t <= -3 && t > -10], ['Within 2 ticks', t => Math.abs(t) <= 2],
  ['Drifted 3 to 9', t => t >= 3 && t < 10], ['Drifted 10+ ticks', t => t >= 10],
]
export function momentum(ms: PathMarket[], a: number, b: number, opts: { maxRank: number; stake: number; commission: number }) {
  const items: { early: number; late: number; follow: number | null }[] = []
  for (const m of ms) {
    const pa = m.path[String(a)], pb = m.path[String(b)], po = m.path[OFF]
    if (!pa || !pb || !po) continue
    const top = ranked(pb).slice(0, opts.maxRank)
    for (const rb of top) {
      const ra = runnerAt(pa, rb[0]), ro = runnerAt(po, rb[0])
      const xa = price(ra), xb = price(rb), xo = price(ro)
      if (!xa || !xb || !xo) continue
      const early = ticksBetween(xa, xb), late = ticksBetween(xb, xo)
      // follow the move: back a shortener at the back price and lay it off at the off; lay a drifter and back it off
      let follow: number | null = null
      const bIn = backAt(rb), lIn = layAt(rb), bOut = backAt(ro), lOut = layAt(ro)
      if (early <= -3 && bIn && lOut) follow = hedged('back', bIn, lOut, opts.stake, opts.commission)
      if (early >= 3 && lIn && bOut) follow = hedged('lay', lIn, bOut, opts.stake, opts.commission)
      items.push({ early, late, follow })
    }
  }
  const rows = MOVE_BUCKETS.map(([name, test]) => {
    const g = items.filter(i => test(i.early))
    const moved = g.filter(i => i.late !== 0)
    const sameWay = moved.filter(i => Math.sign(i.late) === Math.sign(i.early)).length
    const f = g.map(i => i.follow).filter((v): v is number => v !== null)
    return { name, n: g.length, avgEarly: avg(g.map(i => i.early)), avgLate: avg(g.map(i => i.late)),
      carriedOn: moved.length && !name.startsWith('Within') ? sameWay / moved.length : null,
      followPnl: f.length ? f.reduce((x, y) => x + y, 0) : null, followN: f.length, followT: tStat(f) }
  })
  // correlation between the early and the late move
  const xs = items.map(i => i.early), ys = items.map(i => i.late)
  const mx = avg(xs), my = avg(ys)
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0), vy = ys.reduce((s, y) => s + (y - my) ** 2, 0)
  return { rows, n: items.length, correlation: vx && vy ? cov / Math.sqrt(vx * vy) : 0 }
}

// ------------------------------------------------------------------ when the favourite drifts, who shortens?
export function compensation(ms: PathMarket[], from: number) {
  const classes = ['Favourite drifted', 'Favourite steady', 'Favourite shortened'] as const
  const ranks = ['Fav', '2nd', '3rd', '4th', '5th', '6th+']
  const acc = classes.map(() => ({ n: 0, sums: ranks.map(() => 0), favChanged: 0, newFav: ranks.map(() => 0) }))
  for (const m of ms) {
    const pf = m.path[String(from)], po = m.path[OFF]
    if (!pf || !po) continue
    const order = ranked(pf)
    if (order.length < 3) continue
    const cf = chances(pf), co = chances(po)
    const fav = order[0][0]
    const favA = cf.get(fav) ?? 0, favB = co.get(fav) ?? 0
    if (!favA) continue
    const rel = favB / favA - 1
    const k = rel <= -0.1 ? 0 : rel >= 0.1 ? 2 : 1
    const a = acc[k]
    a.n++
    order.forEach((r, i) => { a.sums[Math.min(i, 5)] += ((co.get(r[0]) ?? 0) - (cf.get(r[0]) ?? 0)) * 100 })
    const offFav = ranked(po)[0]?.[0]
    if (offFav !== undefined && offFav !== fav) { a.favChanged++; const idx = order.findIndex(r => r[0] === offFav); if (idx >= 0) a.newFav[Math.min(idx, 5)]++ }
  }
  return { ranks, rows: classes.map((name, i) => ({ name, n: acc[i].n, change: acc[i].sums.map(s => acc[i].n ? s / acc[i].n : 0),
    favChanged: acc[i].n ? acc[i].favChanged / acc[i].n : 0, newFavFrom: acc[i].newFav })) }
}

// ------------------------------------------------------------------ money waiting at the best prices
// Share of the money at the best prices that is waiting to be backed into (offered by layers).
const WOM_BUCKETS: [string, number, number][] = [['Mostly lay money waiting (under 25%)', 0, 0.25], ['25% to 45%', 0.25, 0.45], ['Balanced (45% to 55%)', 0.45, 0.55], ['55% to 75%', 0.55, 0.75], ['Mostly back money waiting (over 75%)', 0.75, 1.01]]
export function weightOfMoney(ms: PathMarket[], at: number, maxRank: number) {
  const items: { w: number; late: number }[] = []
  for (const m of ms) {
    const p = m.path[String(at)], po = m.path[OFF]
    if (!p || !po) continue
    for (const r of ranked(p).slice(0, maxRank)) {
      const b = r[2], l = r[4]
      const x = price(r), xo = price(runnerAt(po, r[0]))
      if (!x || !xo || b + l <= 0) continue
      items.push({ w: b / (b + l), late: ticksBetween(x, xo) })
    }
  }
  return WOM_BUCKETS.map(([name, lo, hi]) => {
    const g = items.filter(i => i.w >= lo && i.w < hi)
    return { name, n: g.length, avgLate: avg(g.map(i => i.late)), shortened: g.length ? g.filter(i => i.late < 0).length / g.length : 0, drifted: g.length ? g.filter(i => i.late > 0).length / g.length : 0 }
  })
}

// ------------------------------------------------------------------ steamers, drifters and results
const RESULT_BUCKETS: [string, (rel: number) => boolean][] = [
  ['Steamed hard (chance up 30%+)', r => r >= 0.3], ['Steamed (up 10% to 30%)', r => r >= 0.1 && r < 0.3], ['Steady (within 10%)', r => Math.abs(r) < 0.1],
  ['Drifted (down 10% to 30%)', r => r <= -0.1 && r > -0.3], ['Drifted hard (down 30%+)', r => r <= -0.3],
]
export const PRICE_BANDS: [string, number, number][] = [['Under 3.0', 1, 3], ['3.0 to 6.0', 3, 6], ['6.0 to 12', 6, 12], ['12 to 30', 12, 30], ['30+', 30, 1e9]]
export function moveVsResult(ms: PathMarket[], from: number, stake: number, commission: number) {
  type Item = { rel: number; won: boolean; exp: number; sp: number; band: number }
  const items: Item[] = []
  let usedBsp = 0, usedOff = 0
  for (const m of ms) {
    if (!m.status || !m.winners) continue
    const pf = m.path[String(from)], po = m.path[OFF]
    if (!pf || !po) continue
    const cf = chances(pf), co = chances(po)
    for (const r of po.runners) {
      if (m.removed?.includes(r[0])) continue
      const a = cf.get(r[0]), b = co.get(r[0])
      if (!a || !b) continue
      const bsp = m.bsp?.[String(r[0])]
      const sp = bsp ?? r[1] ?? r[5]
      if (!sp) continue
      bsp ? usedBsp++ : usedOff++
      const offPrice = price(r)!
      items.push({ rel: b / a - 1, won: m.winners.includes(r[0]), exp: b, sp, band: PRICE_BANDS.findIndex(([, lo, hi]) => offPrice >= lo && offPrice < hi) })
    }
  }
  const sum = (g: Item[]) => {
    const wins = g.filter(i => i.won).length, exp = g.reduce((s, i) => s + i.exp, 0)
    const back = g.map(i => settled('back', i.sp, i.won, stake, commission)), lay = g.map(i => settled('lay', i.sp, i.won, stake, commission))
    return { n: g.length, wins, winRate: g.length ? wins / g.length : 0, expected: exp, ae: exp ? wins / exp : 0,
      backPnl: back.reduce((s, x) => s + x, 0), backT: tStat(back), layPnl: lay.reduce((s, x) => s + x, 0), layT: tStat(lay) }
  }
  const rows = RESULT_BUCKETS.map(([name, test]) => ({ name, ...sum(items.filter(i => test(i.rel))) }))
  const grid = RESULT_BUCKETS.map(([name, test]) => ({ name, cells: PRICE_BANDS.map((_, bi) => sum(items.filter(i => test(i.rel) && i.band === bi))) }))
  return { rows, grid, priceBy: usedBsp >= usedOff ? 'Betfair SP' : 'the last price before the off', n: items.length }
}

// ------------------------------------------------------------------ busy markets and late money
export function volumeEffects(ms: PathMarket[], sport: BtSport, stake: number, commission: number) {
  const { mid, lateWindow } = PLAN[sport]
  type Item = { matchedMid: number | null; late: number | null; favWon: boolean; favExp: number; favSp: number; favMove: number | null }
  const items: Item[] = []
  for (const m of ms) {
    if (!m.status || !m.winners) continue
    const po = m.path[OFF], pm = m.path[String(mid)], pl = m.path[String(lateWindow)]
    if (!po) continue
    const fav = ranked(po)[0]
    if (!fav) continue
    const co = chances(po)
    const sp = m.bsp?.[String(fav[0])] ?? fav[1] ?? fav[5]
    if (!sp) continue
    const xm = price(runnerAt(pm, fav[0]))
    items.push({
      matchedMid: pm?.matched ?? null,
      late: pl?.matched != null && po.matched ? Math.max(0, 1 - pl.matched / po.matched) : null,
      favWon: m.winners.includes(fav[0]), favExp: co.get(fav[0]) ?? 0, favSp: sp,
      favMove: xm ? Math.abs(ticksBetween(xm, price(fav)!)) : null,
    })
  }
  const terciles = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); return [s[Math.floor(s.length / 3)], s[Math.floor(2 * s.length / 3)]] }
  const group = (key: (i: Item) => number | null, names: (cuts: number[]) => string[]) => {
    const vals = items.map(key).filter((v): v is number => v !== null)
    if (vals.length < 9) return []
    const cuts = terciles(vals), labels = names(cuts)
    return [0, 1, 2].map(k => {
      const g = items.filter(i => { const v = key(i); return v !== null && (k === 0 ? v < cuts[0] : k === 1 ? v >= cuts[0] && v < cuts[1] : v >= cuts[1]) })
      const wins = g.filter(i => i.favWon).length, exp = g.reduce((s, i) => s + i.favExp, 0)
      const back = g.map(i => settled('back', i.favSp, i.favWon, stake, commission))
      const moves = g.map(i => i.favMove).filter((v): v is number => v !== null)
      return { name: labels[k], n: g.length, favWinRate: g.length ? wins / g.length : 0, ae: exp ? wins / exp : 0, backFavPnl: back.reduce((s, x) => s + x, 0), backFavT: tStat(back), avgFavMove: avg(moves) }
    })
  }
  const k = (n: number) => '£' + (n >= 1000 ? Math.round(n / 1000) + 'k' : Math.round(n))
  const pc = (n: number) => Math.round(n * 100) + '%'
  return {
    byMatched: group(i => i.matchedMid, c => [`Quiet (under ${k(c[0])})`, `Middle (${k(c[0])} to ${k(c[1])})`, `Busy (over ${k(c[1])})`]),
    byLateMoney: group(i => i.late, c => [`Little late money (under ${pc(c[0])})`, `Some (${pc(c[0])} to ${pc(c[1])})`, `Late rush (over ${pc(c[1])})`]),
    mid, lateWindow,
  }
}

// ------------------------------------------------------------------ system finder
export type Found = {
  entry: number; pick: Pick; side: 'back' | 'lay'; exit: 'off' | 'bsp'; filter: string
  rule: { oddsMin: number; oddsMax: number; runnersMin: number; runnersMax: number; matchedMin: number; raceTypes: string[]; contains: string }
  n: number; pnl: number; roi: number; t: number; checkN: number; checkPnl: number; checkT: number; heldUp: boolean | null
}
type Cand = { day: string; rank: number; n: number; matched: number; raceType: string; hcap: boolean; entryPrice: number
  eb: number | null; el: number | null; ob: number | null; ol: number | null; bsp: number | null }

export function findSystems(ms: PathMarket[], sport: BtSport, stake: number, commission: number, minTrades = 30) {
  const days = Array.from(new Set(ms.map(m => m.start_at.slice(0, 10)))).sort()
  const cut = days[Math.floor(days.length * 2 / 3)] ?? days[days.length - 1]       // last third of days held back as a check
  const raceTypes = sport === 'racing' ? Array.from(new Set(ms.map(m => m.race_type ?? 'unknown'))) : []
  type F = { name: string; test: (c: Cand) => boolean; rule: Partial<Found['rule']> }
  const filters: F[] = [{ name: 'All markets', test: () => true, rule: {} }]
  for (const rt of raceTypes) filters.push({ name: rt, test: c => c.raceType === rt, rule: { raceTypes: [rt] } })
  if (sport === 'racing') filters.push({ name: 'Handicaps', test: c => c.hcap, rule: { contains: 'hcap' } })
  for (const [lo, hi] of [[0, 8], [9, 12], [13, 99]]) filters.push({ name: hi === 99 ? `${lo}+ runners` : `${lo || 'up to'}${lo ? ' to ' : ' '}${hi} runners`, test: c => c.n >= lo && c.n <= hi, rule: { runnersMin: lo, runnersMax: hi } })
  for (const [lo, hi] of [[1.01, 2], [2, 4], [4, 8], [8, 15], [15, 30]]) filters.push({ name: `price ${lo} to ${hi}`, test: c => c.entryPrice >= lo && c.entryPrice < hi, rule: { oddsMin: lo, oddsMax: hi - 0.01 } })
  for (const mm of [10_000, 50_000, 100_000]) filters.push({ name: `£${mm / 1000}k+ matched`, test: c => c.matched >= mm, rule: { matchedMin: mm } })

  const picks: Pick[] = ['fav', 'fav2', 'fav3', 'all']
  const exits: ('off' | 'bsp')[] = sport === 'racing' ? ['off', 'bsp'] : ['off']
  const found: Found[] = []
  let tested = 0
  for (const entry of PLAN[sport].entries) {
    const cands: Cand[] = []
    for (const m of ms) {
      const pe = m.path[String(entry)], po = m.path[OFF]
      if (!pe || !po) continue
      const order = ranked(pe)
      order.forEach((r, i) => {
        if (m.removed?.includes(r[0])) return
        const ro = runnerAt(po, r[0])
        cands.push({ day: m.start_at.slice(0, 10), rank: i + 1, n: order.length, matched: pe.matched ?? m.total_matched ?? 0, raceType: m.race_type ?? 'unknown',
          hcap: /hcap|handicap/i.test(m.market_name ?? ''), entryPrice: price(r)!, eb: backAt(r), el: layAt(r), ob: backAt(ro), ol: layAt(ro), bsp: m.bsp?.[String(r[0])] ?? null })
      })
    }
    for (const pick of picks) {
      const byPick = cands.filter(c => pick === 'all' || c.rank === (pick === 'fav' ? 1 : pick === 'fav2' ? 2 : 3))
      for (const side of ['back', 'lay'] as const) for (const exit of exits) for (const f of filters) {
        tested++
        const disc: number[] = [], check: number[] = []
        for (const c of byPick) {
          if (!f.test(c)) continue
          const ent = side === 'back' ? c.eb : c.el
          const ex = exit === 'bsp' ? c.bsp : side === 'back' ? c.ol : c.ob
          if (!ent || !ex) continue
          const p = hedged(side, ent, ex, stake, commission);
          (c.day < cut ? disc : check).push(p)
        }
        if (disc.length < minTrades) continue
        const pnl = disc.reduce((a, b) => a + b, 0), t = tStat(disc)
        if (pnl <= 0) continue
        found.push({ entry, pick, side, exit, filter: f.name, n: disc.length, pnl: r2(pnl), roi: pnl / (disc.length * stake), t,
          checkN: check.length, checkPnl: r2(check.reduce((a, b) => a + b, 0)), checkT: tStat(check), heldUp: check.length >= 10 ? check.reduce((a, b) => a + b, 0) > 0 : null,
          rule: { oddsMin: 1.01, oddsMax: 1000, runnersMin: 0, runnersMax: 99, matchedMin: 0, raceTypes: [], contains: '', ...f.rule } })
      }
    }
  }
  found.sort((a, b) => b.t - a.t)
  return { top: found.slice(0, 30), tested, strong: found.filter(x => x.t >= 2).length, expectedByChance: Math.round(tested * 0.023), discoveryDays: days.filter(d => d < cut).length, checkDays: days.filter(d => d >= cut).length, cut }
}

export const ruleName = (f: Pick, side: 'back' | 'lay') =>
  `${side === 'back' ? 'Back' : 'Lay'} ${f === 'fav' ? 'the favourite' : f === 'fav2' ? 'the 2nd favourite' : f === 'fav3' ? 'the 3rd favourite' : 'every selection'}`

// The path for one market from its full list of snapshots: the same rules as
// the database function bf_bt_path (migration 056), for archived days.
export function pickPath(m: { start_at: string; off_at?: string | null }, snaps: BtPoint[], offsets: number[], tolSec: number): Record<string, BtPoint> {
  const start = new Date(m.start_at).getTime(), off = m.off_at ? new Date(m.off_at).getTime() : start + 12 * 3600_000
  const pre = snaps.filter(s => !s.inplay).map(s => ({ s, t: new Date(s.at).getTime() })).sort((a, b) => a.t - b.t)
  const out: Record<string, BtPoint> = {}
  const strip = (s: BtPoint): BtPoint => ({ at: s.at, matched: s.matched, runners: s.runners })
  for (const o of offsets) {
    const by = start - o * 1000, tol = Math.max(30, Math.min(tolSec, Math.floor(o / 4))) * 1000
    let hit: BtPoint | null = null
    for (const { s, t } of pre) if (t <= by && t >= by - tol) hit = s
    if (hit) out[String(o)] = strip(hit)
  }
  let last: BtPoint | null = null
  for (const { s, t } of pre) if (t <= off && t >= start - 15 * 60_000) last = s
  if (last) out[OFF] = strip(last)
  return out
}
