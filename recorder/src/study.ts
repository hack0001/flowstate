// The "scout": tests betting ideas on the imported Betfair history and writes a
// report FlowState shows on the Insights tab.
//
//   sudo bash /opt/flowstate/recorder/deploy/study.sh
//
// The yardstick is the efficient market idea: Betfair's starting price (racing)
// and the last price before kick-off (football) have the most money behind them,
// so they are the best estimate of each selection's real chance. Backing earlier
// only pays if the earlier price is better than that, after commission. Every
// idea is measured two ways:
//   value   the price you got compared with the efficient price: if SP is fair, this
//           is what the bet is worth on average (steady, needs fewer races)
//   actual  what really happened, win or lose (the real test, but noisier)
//
// The scout guards against luck: rules are found on the earlier two-thirds of the
// months and must also pay on the later third, most months must be profitable, and
// it reports how many rules it tried and how many would pass by chance alone.
// Systems that pass are kept in a ledger and re-checked every run on new data.
//
// Reads only. Places no bets.

import zlib from 'zlib'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { installGuard } from './guard'
import { errText, log } from './log'
import { HISTORY_BUCKET, expandHistory, historyPath, type HistDay, type HistIndex } from '../../lib/betfair/history'
import { pickPath, OFF } from '../../lib/betfair/insights'
import { ladderMid, tickDown, tickUp, ticksBetween } from '../../lib/betfair/ticks'

const C = 0.05                                      // commission on net winnings
const REPORT_DIR = 'reports'

// ------------------------------------------------------------------ helpers
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
function tStat(xs: number[]) {
  if (xs.length < 3) return 0
  const m = avg(xs), sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
  return sd > 0 ? m / (sd / Math.sqrt(xs.length)) : 0
}
const pct = (x: number, dp = 1) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(dp) + '%'
const fx = (x: number, dp = 2) => x.toFixed(dp)
const band = (v: number, edges: number[], labels: string[]) => { for (let i = 0; i < edges.length; i++) if (v < edges[i]) return labels[i]; return labels[labels.length - 1] }
function table(head: string[], rows: (string | number)[][]) {
  return [`| ${head.join(' | ')} |`, `|${head.map((_, i) => i ? '---:' : '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n')
}

// One bet's two measures, per £1 staked (back) or £1 lay stake (lay).
// p = the efficient market's chance (from SP or the closing price, overround removed).
function backValue(price: number, p: number) { return p * (price - 1) * (1 - C) - (1 - p) }
function backActual(price: number, won: boolean) { return won ? (price - 1) * (1 - C) : -1 }
function layValue(price: number, p: number) { return (1 - p) * (1 - C) - p * (price - 1) }
function layActual(price: number, won: boolean) { return won ? -(price - 1) : 1 - C }

type Bet = { month: string; value: number; actual: number }
type Summary = { n: number; value: number; roi: number; t: number; vt: number; monthsUp: number; months: number; beatEff: number }
function summarise(bets: Bet[], beat?: number[]): Summary {
  const byMonth = new Map<string, number>()
  for (const b of bets) byMonth.set(b.month, (byMonth.get(b.month) ?? 0) + b.actual)
  const months = [...byMonth.values()]
  return { n: bets.length, value: avg(bets.map(b => b.value)), roi: avg(bets.map(b => b.actual)), t: tStat(bets.map(b => b.actual)), vt: tStat(bets.map(b => b.value)),
    monthsUp: months.filter(v => v > 0).length, months: months.length, beatEff: beat ? avg(beat) : NaN }
}

// ------------------------------------------------------------------ data
type Runner = {
  race: string; month: string; day: string; venue: string; rt: string; hcap: boolean; furlongs: number | null; n: number; hour: number
  px: (number | null)[]; rank: number[]; sp: number; p: number; won: boolean
  horse: string; t: number; spRank: number
  h?: HorseHistory                      // the horse's earlier runs in the data (filled in after loading)
}
type HorseHistory = { runs: number; days: number; lastWon: boolean; lastFavLost: boolean; lastSp: number; lastMove: number | null; course: boolean; distDelta: number | null; typeChange: boolean }
const R_OFFSETS = [3600, 1800, 1200, 600, 300]
const F_OFFSETS = [10800, 7200, 3600, 1800, 600]
// prices and ranks are kept as short arrays (one slot per time above) to keep memory down
const ri = (o: number) => R_OFFSETS.indexOf(o)
const fi = (o: number) => F_OFFSETS.indexOf(o)

function furlongs(name?: string | null) {
  const m = (name ?? '').match(/(?:(\d+)m)?\s*(?:(\d+)f)?/i)
  const mi = Number(m?.[1] ?? 0), f = Number(m?.[2] ?? 0)
  return mi || f ? mi * 8 + f : null
}

// Reads each day's file in turn and hands it to fn, so only a few days are in memory at once.
async function forEachDay(store: ReturnType<ReturnType<typeof createClient>['storage']['from']>, sport: 'racing' | 'football' | 'tennis' | 'golf', fn: (d: HistDay) => void): Promise<number> {
  const { data: idxFile } = await store.download(`${sport}/index.json`)
  if (!idxFile) return 0
  const idx = JSON.parse(await idxFile.text()) as HistIndex
  const q = Object.keys(idx.days).sort()
  let n = 0
  const worker = async () => {
    for (let d = q.shift(); d; d = q.shift()) {
      const { data } = await store.download(historyPath(sport, d))
      if (!data) continue
      let day: HistDay
      try { day = JSON.parse(zlib.gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as HistDay } catch { continue }
      fn(day); n++
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return n
}

function racingRunners(days: HistDay[]): Runner[] {
  const rows: Runner[] = []
  for (const d of days) {
    const { markets, snaps } = expandHistory(d, 'racing')
    for (const m of markets) {
      const path = pickPath(m, snaps.get(m.market_id) ?? [], R_OFFSETS, 180)
      const sps = m.runners.filter(r => !m.removed?.includes(r.id) && m.bsp[String(r.id)]).map(r => ({ id: r.id, sp: m.bsp[String(r.id)] }))
      if (sps.length < 3 || !m.winners?.length) continue
      const book = sps.reduce((a, r) => a + 1 / r.sp, 0)
      const priceAt = (o: number, id: number) => { const r = path[String(o)]?.runners.find(x => x[0] === id); return r ? (r[1] ?? r[5]) : null }
      const ranks: Record<number, Map<number, number>> = {}
      for (const o of R_OFFSETS) {
        const pr = sps.map(r => [r.id, priceAt(o, r.id)] as const).filter(([, v]) => v).sort((a, b) => a[1]! - b[1]!)
        ranks[o] = new Map(pr.map(([id], i) => [id, i + 1]))
      }
      const start = new Date(m.start_at)
      const spRank = new Map([...sps].sort((a, b) => a.sp - b.sp).map((r, i) => [r.id, i + 1]))
      for (const r of sps) {
        const px = R_OFFSETS.map(o => priceAt(o, r.id)), rank = R_OFFSETS.map(o => ranks[o].get(r.id) ?? 99)
        rows.push({ race: m.market_id, month: m.start_at.slice(0, 7), day: '', venue: m.venue ?? m.event, rt: m.race_type ?? 'Unknown', hcap: /hcap|handicap/i.test(m.market_name ?? ''),
          furlongs: furlongs(m.market_name), n: sps.length, hour: start.getUTCHours(), px, rank, sp: r.sp, p: (1 / r.sp) / book, won: m.winners.includes(r.id),
          horse: (m.runners.find(x => x.id === r.id)?.name ?? '').replace(/^\d+\.\s*/, '').toLowerCase(), t: start.getTime(), spRank: spRank.get(r.id) ?? 99 })
      }
    }
  }
  return rows
}

type Sel = { month: string; country: string; type: string; side: string; px: (number | null)[]; close: number; p: number; won: boolean }
function footballSelections(days: HistDay[]): Sel[] {
  const rows: Sel[] = []
  for (const d of days) {
    const { markets, snaps } = expandHistory(d, 'football')
    for (const m of markets) {
      if (!['OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE', 'MATCH_ODDS'].includes(m.market_type) || !m.winners?.length) continue
      const path = pickPath(m, snaps.get(m.market_id) ?? [], F_OFFSETS, 300)
      const close = path[OFF]
      if (!close) continue
      const closePx = new Map(close.runners.map(r => [r[0], r[1] ?? r[5]]))
      const book = [...closePx.values()].reduce((acc: number, v) => acc + (v ? 1 / v : 0), 0)
      if (!book) continue
      m.runners.forEach((r, i) => {
        const c = closePx.get(r.id)
        if (!c) return
        const side = m.market_type === 'MATCH_ODDS' ? (/draw/i.test(r.name) ? 'Draw' : i === 0 ? 'Home' : 'Away') : r.name.replace(/ 2\.5 Goals/i, '')
        const px = F_OFFSETS.map(o => { const x = path[String(o)]?.runners.find(q => q[0] === r.id); return x ? (x[1] ?? x[5]) : null })
        rows.push({ month: m.start_at.slice(0, 7), country: m.country ?? '?', type: m.market_type, side, px, close: c, p: (1 / c) / Math.max(1, book), won: m.winners!.includes(r.id) })
      })
    }
  }
  return rows
}

// ------------------------------------------------------------------ rule search with a time split
// knownAt (on filters): seconds before the start when the filter's information is available;
// a rule that bets earlier than that can't use it (that would be using the future).
type Cond = Filter<Runner>
type Found = { rule: string; train: Summary; test: Summary; all: Summary; pTrain: number; pTest: number; pAll: number; q: number; passed: boolean }

// ------------------------------------------------------------------ p-values and the luck check
// p: the chance of a profit at least this big if the rule really had no edge (one-sided, from t).
// With thousands of rules tried, some will have tiny p-values by luck, so each rule also gets a
// q-value (Benjamini-Hochberg): roughly, the share of rules this good that would be luck. A rule
// passes only if all of these hold:
//   p (all months) below ALPHA, the threshold you set (default 0.05)
//   p on the later months alone below 0.05 (it kept working on data it wasn't found on)
//   q below 0.10 (unlikely to be one of the lucky ones out of everything tried)
//   at least 60% of months profitable
export const ALPHA = Number(process.env.SCOUT_ALPHA ?? 0.05)
function normCdf(z: number) {   // Abramowitz-Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
const pOf = (t: number) => 1 - normCdf(t)
const pfmt = (p: number) => p < 0.0001 ? '<0.0001' : p.toFixed(4)

// Fills q-values (over `tested` rules, untested ones counting as p = 1) and the pass flag.
function judge(found: Found[], tested: number) {
  const order = [...found].sort((a, b) => a.pTrain - b.pTrain)
  let minQ = 1
  for (let i = order.length - 1; i >= 0; i--) { minQ = Math.min(minQ, order[i].pTrain * tested / (i + 1)); order[i].q = minQ }
  for (const f of found) f.passed = f.pAll < ALPHA && f.pTest < 0.05 && f.test.roi > 0 && f.q < 0.10 && f.all.monthsUp / Math.max(1, f.all.months) >= 0.6
  found.sort((a, b) => (Number(b.passed) - Number(a.passed)) || a.pAll - b.pAll)
}

function makeFound(rule: string, bets: Bet[], cut: string, valueCheck: boolean): Found | null {
  const train: Bet[] = [], test: Bet[] = []
  for (const b of bets) (b.month < cut ? train : test).push(b)
  if (train.length < 150 || test.length < 50) return null
  const s = summarise(train)
  if (s.roi <= 0 || s.t < 1.5 || (valueCheck && s.value <= -0.02)) return null
  const t = summarise(test), a = summarise(bets)
  return { rule, train: s, test: t, all: a, pTrain: pOf(s.t), pTest: pOf(t.t), pAll: pOf(a.t), q: 1, passed: false }
}

type Filter<T> = { name: string; group: string; test: (x: T) => boolean; knownAt?: number }

// Every rule with every filter, and every pair of filters from different groups
// (e.g. "Hurdle" and "8 to 11 runners"). Masks are worked out once, so pairs stay quick.
function search<T extends { month: string }>(items: T[], rules: { name: string; at?: number; make: (x: T) => Bet | null }[], filters: Filter<T>[], cut: string, valueCheck = true) {
  const masks = filters.map(f => Uint8Array.from(items, x => f.test(x) ? 1 : 0))
  type Combo = { name: string; idx: number[]; knownAt: number }
  const combos: Combo[] = filters.map((f, i) => ({ name: f.name, idx: [i], knownAt: f.knownAt ?? Infinity }))
  for (let i = 0; i < filters.length; i++) for (let j = i + 1; j < filters.length; j++) {
    if (filters[i].group === filters[j].group || filters[i].group === 'all' || filters[j].group === 'all') continue
    combos.push({ name: `${filters[i].name} + ${filters[j].name}`, idx: [i, j], knownAt: Math.min(filters[i].knownAt ?? Infinity, filters[j].knownAt ?? Infinity) })
  }
  const found: Found[] = []
  let tested = 0
  for (const r of rules) {
    const rb: [number, Bet][] = []
    items.forEach((x, i) => { const b = r.make(x); if (b) rb.push([i, b]) })
    if (rb.length < 200) continue
    for (const c of combos) {
      if (r.at !== undefined && r.at > c.knownAt) continue           // no peeking: the filter must be known when the bet is placed
      tested++
      const bets: Bet[] = []
      if (c.idx.length === 1) { const m = masks[c.idx[0]]; for (const [i, b] of rb) if (m[i]) bets.push(b) }
      else { const m1 = masks[c.idx[0]], m2 = masks[c.idx[1]]; for (const [i, b] of rb) if (m1[i] && m2[i]) bets.push(b) }
      const f = makeFound(`${r.name} · ${c.name}`, bets, cut, valueCheck)
      if (f) found.push(f)
    }
  }
  judge(found, tested)
  return { found, tested }
}

// ------------------------------------------------------------------ the report
async function main() {
  const cfg = loadConfig()
  installGuard(cfg.supabase.url)
  const db = createClient(cfg.supabase.url, cfg.supabase.key, { auth: { persistSession: false, autoRefreshToken: false } })
  const store = db.storage.from(HISTORY_BUCKET)
  const L: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  L.push(`# Scout report, ${today}`, '')
  L.push(`Systems must reach p below ${ALPHA} (the chance of results this good from a rule with no real edge), keep working on months they weren't found on, and survive a check for luck across everything tried.`, '')
  L.push(`Commission ${C * 100}% on winnings. "Value" = what each bet is worth if the efficient price (Betfair SP for racing, the last price before kick-off for football) is the true chance. "Actual" = the real result. "Cautious" assumes you got one tick worse than the last traded price (the free history has no back/lay prices).`, '')

  // ================================================================ racing
  log.info('Scout: loading racing history')
  const runners: Runner[] = []
  const signals = new Map<string, Ev[]>()
  const samples: Sample[] = []
  const rdayCount = await forEachDay(store, 'racing', d => { for (const r of racingRunners([d])) runners.push(r); collectSignals([d], signals, samples) })
  const rdays = { length: rdayCount }
  log.info(`Scout: ${rdayCount} racing days, ${runners.length} runners`)
  const months = Array.from(new Set(runners.map(r => r.month))).sort()
  const cut = months[Math.floor(months.length * 2 / 3)] ?? months[months.length - 1]
  L.push(`## Horse racing: back early, let it run`, '', `${rdays.length} days (${months[0]} to ${months[months.length - 1]}), ${new Set(runners.map(r => r.race)).size.toLocaleString('en-GB')} races, ${runners.length.toLocaleString('en-GB')} runners. Systems are found on ${months[0]} to the month before ${cut} and checked on ${cut} onwards.`, '')

  const backAt = (o: number, cautious: boolean) => (x: Runner): Bet | null => {
    const raw = x.px[ri(o)]; if (!raw) return null
    const price = cautious ? tickDown(raw) : raw
    return { month: x.month, value: backValue(price, x.p), actual: backActual(price, x.won) }
  }
  const layAt = (o: number, cautious: boolean) => (x: Runner): Bet | null => {
    const raw = x.px[ri(o)]; if (!raw) return null
    const price = cautious ? tickUp(raw) : raw
    return { month: x.month, value: layValue(price, x.p), actual: layActual(price, x.won) }
  }
  const spBack = (x: Runner): Bet => ({ month: x.month, value: backValue(x.sp, x.p), actual: backActual(x.sp, x.won) })

  // 1. Does the 20-minute price beat SP, by rank?
  const rankName = (k: number) => k === 1 ? 'Favourite' : k === 2 ? '2nd fav' : k === 3 ? '3rd fav' : k <= 6 ? '4th to 6th' : '7th or longer'
  const groups = ['Favourite', '2nd fav', '3rd fav', '4th to 6th', '7th or longer']
  const rows1 = groups.map(g => {
    const xs = runners.filter(x => x.px[ri(1200)] && rankName(x.rank[ri(1200)]) === g)
    const early = summarise(xs.map(backAt(1200, false)).filter((b): b is Bet => !!b), xs.map(x => x.px[ri(1200)]! > x.sp ? 1 : 0))
    const caut = summarise(xs.map(backAt(1200, true)).filter((b): b is Bet => !!b))
    const sp = summarise(xs.map(spBack))
    return [g, early.n.toLocaleString('en-GB'), fx(avg(xs.map(x => x.px[ri(1200)]! / x.sp))), Math.round(early.beatEff * 100) + '%', pct(early.value), pct(early.roi), pct(caut.roi), pct(sp.roi), fx(early.t, 1)]
  })
  L.push('### 1. Is the price 20 minutes before the off better than SP?', '', table(['Rank at 20 min', 'Runners', 'Price ÷ SP', 'Beat SP', 'Value', 'Actual', 'Actual (cautious)', 'Back at SP', 't'], rows1), '')
  L.push('Price ÷ SP above 1 means the early price was bigger than the starting price on average. If SP is efficient, Value is the long-run return of backing at the early price; Actual should drift towards it as the sample grows.', '')

  // 2. Timing: favourites at each entry time
  const rows2 = R_OFFSETS.map(o => {
    const xs = runners.filter(x => x.px[ri(o)] && x.rank[ri(o)] === 1)
    const s = summarise(xs.map(backAt(o, false)).filter((b): b is Bet => !!b), xs.map(x => x.px[ri(o)]! > x.sp ? 1 : 0))
    const c = summarise(xs.map(backAt(o, true)).filter((b): b is Bet => !!b))
    return [`${o / 60} min`, s.n.toLocaleString('en-GB'), fx(avg(xs.map(x => x.px[ri(o)]! / x.sp))), Math.round(s.beatEff * 100) + '%', pct(s.value), pct(s.roi), pct(c.roi), `${s.monthsUp}/${s.months}`]
  })
  L.push('### 2. When to back the favourite', '', table(['Back at', 'Bets', 'Price ÷ SP', 'Beat SP', 'Value', 'Actual', 'Actual (cautious)', 'Months up'], rows2), '')

  // 3. Moves before the entry: steamers and drifters (60 → 20 minutes)
  const move = (x: Runner) => { const a = x.px[ri(3600)], b = x.px[ri(1200)]; if (!a || !b) return null; const ch = (1 / b) / (1 / a) - 1; return ch >= 0.15 ? 'Steamed (chance up 15%+)' : ch >= 0.05 ? 'Shortened 5 to 15%' : ch > -0.05 ? 'Steady' : ch > -0.15 ? 'Drifted 5 to 15%' : 'Drifted (chance down 15%+)' }
  const mg = ['Steamed (chance up 15%+)', 'Shortened 5 to 15%', 'Steady', 'Drifted 5 to 15%', 'Drifted (chance down 15%+)']
  const rows3 = mg.filter(g => runners.some(x => move(x) === g && x.rank[ri(1200)] <= 6)).map(g => {
    const xs = runners.filter(x => move(x) === g && x.rank[ri(1200)] <= 6)
    const b = summarise(xs.map(backAt(1200, false)).filter((v): v is Bet => !!v), xs.map(x => x.px[ri(1200)]! > x.sp ? 1 : 0))
    const l = summarise(xs.map(layAt(1200, false)).filter((v): v is Bet => !!v))
    return [g, b.n.toLocaleString('en-GB'), fx(avg(xs.map(x => x.px[ri(1200)]! / x.sp))), pct(b.value), pct(b.roi), pct(l.value), pct(l.roi)]
  })
  L.push('### 3. Steamers and drifters (top six, move from 60 to 20 minutes, then back or lay at 20)', '', table(['Move 60→20 min', 'Runners', 'Price ÷ SP', 'Back value', 'Back actual', 'Lay value', 'Lay actual'], rows3), '')

  // 4. System search
  const pband = (p: number | null) => p === null ? '?' : band(p, [2, 3, 4, 6, 10, 20], ['under 2.0', '2.0 to 3.0', '3.0 to 4.0', '4.0 to 6.0', '6.0 to 10', '10 to 20', '20+'])
  const conds: Cond[] = [{ name: 'all races', group: 'all', test: () => true }]
  for (const rt of Array.from(new Set(runners.map(r => r.rt)))) conds.push({ name: rt, group: 'type', test: x => x.rt === rt })
  conds.push({ name: 'handicaps', group: 'hcap', test: x => x.hcap }, { name: 'non-handicaps', group: 'hcap', test: x => !x.hcap })
  for (const [lo, hi] of [[2, 7], [8, 11], [12, 16], [17, 99]]) conds.push({ name: `${lo}${hi === 99 ? '+' : ` to ${hi}`} runners`, group: 'field', test: x => x.n >= lo && x.n <= hi })
  for (const g of mg) conds.push({ name: g.toLowerCase(), group: 'move', test: x => move(x) === g, knownAt: 1200 })
  for (const h of [[0, 14], [14, 17], [17, 24]]) conds.push({ name: h[0] === 0 ? 'before 2pm' : h[0] === 14 ? '2pm to 5pm' : 'after 5pm', group: 'time', test: x => x.hour >= h[0] && x.hour < h[1] })
  for (const [lo, hi, nm] of [[0, 9, 'up to 1m1f'], [9, 14, '1m1f to 1m6f'], [14, 20, '1m6f to 2m4f'], [20, 99, '2m4f+']] as const) conds.push({ name: nm, group: 'dist', test: x => x.furlongs !== null && x.furlongs >= lo && x.furlongs < hi })
  const rules: { name: string; at?: number; make: (x: Runner) => Bet | null }[] = []
  for (const o of R_OFFSETS) for (const side of ['Back', 'Lay'] as const) {
    for (const g of ['Favourite', '2nd fav', '3rd fav', '4th to 6th']) rules.push({ name: `${side} ${g.toLowerCase()} ${o / 60} min out (cautious price)`, at: o, make: x => rankName(x.rank[ri(o)]) === g ? (side === 'Back' ? backAt(o, true) : layAt(o, true))(x) : null })
    for (const pb of ['under 2.0', '2.0 to 3.0', '3.0 to 4.0', '4.0 to 6.0', '6.0 to 10', '10 to 20']) rules.push({ name: `${side} any runner priced ${pb} ${o / 60} min out (cautious price)`, at: o, make: x => pband(x.px[ri(o)]) === pb ? (side === 'Back' ? backAt(o, true) : layAt(o, true))(x) : null })
  }
  const rs = search(runners, rules, conds, cut)
  L.push(...systemsSection('racing', rs.found, rs.tested))
  const hh = horseHistory(runners, cut)
  L.push(...hh.lines)
  const lab = signalLab(samples, cut)
  L.push(...lab.lines)
  const pd = priceDiscovery(signals, cut)
  L.push(...pd.lines)

  // ================================================================ football
  log.info('Scout: loading football history')
  const sels: Sel[] = []
  const matches: Match[] = []
  const fmatches: FMatch[] = []
  const fdayCount = await forEachDay(store, 'football', d => { for (const x of footballSelections([d])) sels.push(x); for (const m of inPlayMatches(d)) matches.push(m); for (const m of footballMatches(d)) fmatches.push(m) })
  const fdays = { length: fdayCount }
  let footballFound: Found[] = []
  let inPlayFound: Found[] = []
  let dcFound: Found[] = []
  let tennisFound: Found[] = []
  log.info(`Scout: ${fdays.length} football days, ${sels.length} selections`)
  if (sels.length) {
    const fm = Array.from(new Set(sels.map(s => s.month))).sort()
    const fcut = fm[Math.floor(fm.length * 2 / 3)] ?? fm[fm.length - 1]
    L.push('', `## Football: back early, let it run`, '', `${fdays.length} days (${fm[0]} to ${fm[fm.length - 1]}), ${sels.length.toLocaleString('en-GB')} selections. The efficient price is the last price before kick-off. Checked on ${fcut} onwards.`, '')
    const fBack = (o: number, cautious: boolean) => (s: Sel): Bet | null => { const raw = s.px[fi(o)]; if (!raw) return null; const pr = cautious ? tickDown(raw) : raw; return { month: s.month, value: backValue(pr, s.p), actual: backActual(pr, s.won) } }
    const fLay = (o: number, cautious: boolean) => (s: Sel): Bet | null => { const raw = s.px[fi(o)]; if (!raw) return null; const pr = cautious ? tickUp(raw) : raw; return { month: s.month, value: layValue(pr, s.p), actual: layActual(pr, s.won) } }
    const fClose = (s: Sel): Bet => ({ month: s.month, value: backValue(s.close, s.p), actual: backActual(s.close, s.won) })
    for (const type of ['OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE', 'MATCH_ODDS']) {
      const ts = sels.filter(s => s.type === type)
      if (!ts.length) continue
      const sides = Array.from(new Set(ts.map(s => s.side))).sort()
      const rowsF: (string | number)[][] = []
      for (const sd of sides) for (const o of F_OFFSETS) {
        const xs = ts.filter(s => s.side === sd && s.px[fi(o)])
        const e = summarise(xs.map(fBack(o, false)).filter((b): b is Bet => !!b), xs.map(s => s.px[fi(o)]! > s.close ? 1 : 0))
        const c = summarise(xs.map(fBack(o, true)).filter((b): b is Bet => !!b))
        const cl = summarise(xs.map(fClose))
        rowsF.push([sd, `${o / 60} min`, e.n.toLocaleString('en-GB'), fx(avg(xs.map(s => s.px[fi(o)]! / s.close))), Math.round(e.beatEff * 100) + '%', pct(e.value), pct(e.roi), pct(c.roi), pct(cl.roi)])
      }
      const title = type === 'OVER_UNDER_25' ? 'Over/Under 2.5 goals' : type === 'BOTH_TEAMS_TO_SCORE' ? 'Both teams to score' : 'Match Odds'
      L.push(`### ${title}`, '', table(['Selection', 'Back at', 'Bets', 'Price ÷ close', 'Beat close', 'Value', 'Actual', 'Actual (cautious)', 'Back at close'], rowsF), '')
    }
    const fconds: Filter<Sel>[] = [{ name: 'all matches', group: 'all', test: () => true }]
    for (const cc of Array.from(new Set(sels.map(s => s.country)))) fconds.push({ name: `country ${cc}`, group: 'country', test: s => s.country === cc })
    const fmove = (s: Sel) => { const a = s.px[fi(10800)] ?? s.px[fi(7200)], b = s.px[fi(3600)]; if (!a || !b) return null; const ch = (1 / b) / (1 / a) - 1; return ch >= 0.05 ? 'shortened' : ch <= -0.05 ? 'drifted' : 'steady' }
    for (const g of ['shortened', 'drifted', 'steady']) fconds.push({ name: `${g} from 3h to 1h out`, group: 'move', test: s => fmove(s) === g, knownAt: 3600 })
    for (const [lo, hi] of [[1, 1.7], [1.7, 2.2], [2.2, 3], [3, 5], [5, 1000]]) fconds.push({ name: `priced ${lo} to ${hi === 1000 ? 'any' : hi} an hour out`, group: 'price', test: s => !!s.px[fi(3600)] && s.px[fi(3600)]! >= lo && s.px[fi(3600)]! < hi, knownAt: 3600 })
    const frules: { name: string; at?: number; make: (s: Sel) => Bet | null }[] = []
    for (const type of ['OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE', 'MATCH_ODDS']) for (const sd of Array.from(new Set(sels.filter(s => s.type === type).map(s => s.side)))) for (const o of F_OFFSETS) for (const side of ['Back', 'Lay'] as const)
      frules.push({ name: `${side} ${sd} (${type === 'OVER_UNDER_25' ? 'O/U 2.5' : type === 'BOTH_TEAMS_TO_SCORE' ? 'BTTS' : 'Match Odds'}) ${o / 60} min out (cautious price)`, at: o, make: s => s.type === type && s.side === sd ? (side === 'Back' ? fBack(o, true) : fLay(o, true))(s) : null })
    const fs = search(sels, frules, fconds, fcut)
    footballFound = fs.found
    L.push(...systemsSection('football', fs.found, fs.tested))
    const ip = footballInPlay(matches, fcut)
    L.push(...ip.lines)
    inPlayFound = ip.found
    const dc = dixonColes(fmatches, fcut)
    L.push(...dc.lines)
    dcFound = dc.found
  }

  // ================================================================ your own recordings (real back and lay prices)
  try { L.push(...await recordingsStudy(db)) } catch (e) { log.warn('Recordings study skipped:', errText(e)); L.push('', '## Your own recordings', '', `Skipped: ${errText(e)}`) }

  // ================================================================ tennis
  log.info('Scout: loading tennis history')
  const swings: TSwing[] = []
  const tdays = await forEachDay(store, 'tennis', d => { for (const x of tennisSwings(d)) swings.push(x) })
  log.info(`Scout: ${tdays} tennis days, ${swings.length} swings`)
  if (swings.length) {
    const tm = Array.from(new Set(swings.map(x => x.month))).sort()
    const tcut = tm[Math.floor(tm.length * 2 / 3)] ?? tm[tm.length - 1]
    L.push('', '## Tennis', '')
    const tr = tennisInPlay(swings, tcut)
    L.push(...tr.lines)
    tennisFound = tr.found
  }

  // ================================================================ ledger: systems that passed, re-checked every run
  const { data: ledgerFile } = await store.download(`${REPORT_DIR}/ledger.json`)
  const ledger: Record<string, { first: string; runs: { date: string; passed: boolean; roi: number; n: number }[] }> = ledgerFile ? JSON.parse(await ledgerFile.text()) : {}
  const passedNow = new Map<string, Found>()
  for (const f of rs.found) if (f.passed) passedNow.set('racing: ' + f.rule, f)
  for (const f of pd.found) if (f.passed) passedNow.set('racing trading: ' + f.rule, f)
  for (const f of hh.found) if (f.passed) passedNow.set('racing form: ' + f.rule, f)
  for (const f of lab.found) if (f.passed) passedNow.set('racing short-term: ' + f.rule, f)
  for (const f of footballFound) if (f.passed) passedNow.set('football: ' + f.rule, f)
  for (const f of inPlayFound) if (f.passed) passedNow.set('football in-play: ' + f.rule, f)
  for (const f of dcFound) if (f.passed) passedNow.set('football model: ' + f.rule, f)
  for (const f of tennisFound) if (f.passed) passedNow.set('tennis: ' + f.rule, f)
  for (const k of Object.keys(ledger)) if (!passedNow.has(k)) ledger[k].runs.push({ date: today, passed: false, roi: NaN, n: 0 })
  for (const [k, f] of passedNow) { (ledger[k] ??= { first: today, runs: [] }).runs.push({ date: today, passed: true, roi: f.all.roi, n: f.all.n }) }
  L.push('', '## Ledger: systems that have passed, re-checked each run', '')
  const lrows = Object.entries(ledger).map(([k, v]) => [k, v.first, `${v.runs.filter(r => r.passed).length}/${v.runs.length}`, v.runs[v.runs.length - 1].passed ? 'passing' : 'failed this run'])
  L.push(lrows.length ? table(['System', 'First passed', 'Runs passed', 'Now'], lrows) : 'No system has passed yet. That is normal early on: the bar is set high on purpose.', '')
  L.push('', '_Paper research only. Past results don\'t guarantee future ones; stake small and keep testing on new data before trusting any system._')

  const report = L.join('\n')
  console.log('\n' + report + '\n')
  for (const [path, body, type] of [[`${REPORT_DIR}/latest.md`, report, 'text/markdown'], [`${REPORT_DIR}/scout-${today}.md`, report, 'text/markdown'], [`${REPORT_DIR}/ledger.json`, JSON.stringify(ledger), 'application/json']] as const) {
    const { error } = await store.upload(path, Buffer.from(body), { contentType: type, upsert: true })
    if (error) log.warn(`Couldn't save ${path}: ${error.message}`)
  }
  log.info('Scout: report saved. Open FlowState → Betfair → Insights to read it.')
}

// ------------------------------------------------------------------ horse history ("form" from the data itself)
// Each horse's earlier runs in the history (matched by name): days since it last ran, whether it
// won, whether it was a beaten favourite, its last starting price, whether it drifted or steamed
// last time, whether it has run at this course before, and changes in distance or race type.
// Then: does any of that make backing or laying it (at the 20-minute price or at SP) pay?
function horseHistory(runners: Runner[], cut: string): { lines: string[]; found: Found[] } {
  const byHorse = new Map<string, Runner[]>()
  for (const r of runners) if (r.horse) { const a = byHorse.get(r.horse); if (a) a.push(r); else byHorse.set(r.horse, [r]) }
  for (const runs of byHorse.values()) {
    runs.sort((a, b) => a.t - b.t)
    runs.forEach((r, i) => {
      if (i === 0) { r.h = { runs: 0, days: -1, lastWon: false, lastFavLost: false, lastSp: 0, lastMove: null, course: false, distDelta: null, typeChange: false }; return }
      const last = runs[i - 1]
      const a = last.px[ri(3600)], b = last.px[ri(1200)]
      r.h = {
        runs: i, days: (r.t - last.t) / 86_400_000, lastWon: last.won, lastFavLost: last.spRank === 1 && !last.won, lastSp: last.sp,
        lastMove: a && b ? (1 / b) / (1 / a) - 1 : null, course: runs.slice(0, i).some(x => x.venue === r.venue),
        distDelta: r.furlongs !== null && last.furlongs !== null ? r.furlongs - last.furlongs : null, typeChange: r.rt !== last.rt,
      }
    })
  }
  const items = runners.filter(r => r.h)
  const F: Filter<Runner>[] = [{ name: 'all runners', group: 'all', test: () => true }]
  const h = (r: Runner) => r.h!
  for (const [lo, hi, nm] of [[-1, 0, 'first run in the data'], [0, 15, 'ran within 14 days'], [15, 31, '15 to 30 days since last run'], [31, 91, '1 to 3 months off'], [91, 9999, 'off 3+ months']] as const)
    F.push({ name: nm, group: 'days', test: r => lo === -1 ? h(r).days === -1 : h(r).days >= lo && h(r).days < hi })
  F.push({ name: 'won last time', group: 'last', test: r => h(r).runs > 0 && h(r).lastWon }, { name: 'lost last time', group: 'last', test: r => h(r).runs > 0 && !h(r).lastWon })
  F.push({ name: 'beaten favourite last time', group: 'fav', test: r => h(r).lastFavLost })
  F.push({ name: 'much shorter than last SP', group: 'sp', test: r => !!h(r).lastSp && !!r.px[ri(1200)] && r.px[ri(1200)]! / h(r).lastSp < 0.6 },
    { name: 'similar to last SP', group: 'sp', test: r => !!h(r).lastSp && !!r.px[ri(1200)] && r.px[ri(1200)]! / h(r).lastSp >= 0.6 && r.px[ri(1200)]! / h(r).lastSp <= 1.6 },
    { name: 'much bigger than last SP', group: 'sp', test: r => !!h(r).lastSp && !!r.px[ri(1200)] && r.px[ri(1200)]! / h(r).lastSp > 1.6 })
  F.push({ name: 'steamed last time', group: 'move', test: r => (h(r).lastMove ?? 0) >= 0.15 }, { name: 'drifted last time', group: 'move', test: r => (h(r).lastMove ?? 0) <= -0.15 })
  F.push({ name: 'run at this course before', group: 'course', test: r => h(r).runs > 0 && h(r).course }, { name: 'new to this course', group: 'course', test: r => h(r).runs > 0 && !h(r).course })
  F.push({ name: 'up 2f+ in distance', group: 'dist', test: r => (h(r).distDelta ?? 0) >= 2 }, { name: 'down 2f+ in distance', group: 'dist', test: r => (h(r).distDelta ?? 0) <= -2 },
    { name: 'same distance', group: 'dist', test: r => h(r).distDelta !== null && Math.abs(h(r).distDelta!) < 2 })
  F.push({ name: 'switching race type', group: 'type', test: r => h(r).runs > 0 && h(r).typeChange })
  for (const [lo, hi, nm] of [[1, 3, '1 or 2 earlier runs'], [3, 6, '3 to 5 earlier runs'], [6, 999, '6+ earlier runs']] as const) F.push({ name: nm, group: 'runs', test: r => h(r).runs >= lo && h(r).runs < hi })
  for (const rt of Array.from(new Set(items.map(r => r.rt)))) F.push({ name: rt, group: 'rtype', test: r => r.rt === rt })
  F.push({ name: 'handicaps', group: 'hcap', test: r => r.hcap }, { name: 'non-handicaps', group: 'hcap', test: r => !r.hcap })

  const rankName = (k: number) => k === 1 ? 'favourite' : k === 2 ? '2nd fav' : k === 3 ? '3rd fav' : k <= 6 ? '4th to 6th' : '7th or longer'
  const pb = (p: number) => band(p, [2, 3, 4, 6, 10, 20], ['under 2.0', '2.0 to 3.0', '3.0 to 4.0', '4.0 to 6.0', '6.0 to 10', '10 to 20', '20+'])
  const rules: { name: string; make: (x: Runner) => Bet | null }[] = []
  for (const side of ['Back', 'Lay'] as const) {
    for (const at of ['20 min', 'SP'] as const) {
      const price = (x: Runner) => at === 'SP' ? x.sp : x.px[ri(1200)] ? (side === 'Back' ? tickDown(x.px[ri(1200)]!) : tickUp(x.px[ri(1200)]!)) : null
      const bet = (x: Runner): Bet | null => { const p = price(x); if (!p) return null; return side === 'Back' ? { month: x.month, value: backValue(p, x.p), actual: backActual(p, x.won) } : { month: x.month, value: layValue(p, x.p), actual: layActual(p, x.won) } }
      const where = at === 'SP' ? 'at SP' : '20 min out (cautious price)'
      rules.push({ name: `${side} any runner ${where}`, make: bet })
      for (const g of ['favourite', '2nd fav', '3rd fav', '4th to 6th', '7th or longer']) rules.push({ name: `${side} the ${g} ${where}`, make: x => rankName(x.rank[ri(1200)]) === g ? bet(x) : null })
      for (const b of ['under 2.0', '2.0 to 3.0', '3.0 to 4.0', '4.0 to 6.0', '6.0 to 10', '10 to 20', '20+']) rules.push({ name: `${side} runners priced ${b} ${where}`, make: x => x.px[ri(1200)] && pb(x.px[ri(1200)]!) === b ? bet(x) : null })
    }
  }
  const res = search(items, rules, F, cut, false)
  const L = ['', '### 5. Horse form from the data (back or lay, let it run)', '',
    `Each horse's earlier runs in the history, matched by name (${byHorse.size.toLocaleString('en-GB')} horses, ${items.filter(r => r.h!.runs > 0).length.toLocaleString('en-GB')} runs with at least one earlier run to look back on). Form signals tested: days since the last run, won or lost last time, beaten favourite last time, today's price against last time's SP, steamed or drifted last time, course before or new, distance up or down, switching race type, number of earlier runs; alone and in pairs, and with race type and handicaps. Backed or laid at the 20-minute price (one tick worse) or at Betfair SP (exact). Trainer and jockey aren't in the free history; your recordings have them from 19 November.`, '']
  L.push(...resultsBlock('form rules', res.found, res.tested, false))
  return { lines: L, found: res.found }
}

// ------------------------------------------------------------------ signal lab: predicting the next few minutes
// At 60, 48, 36, 24 and 12 minutes before the off (far enough apart that one horse's trades don't
// overlap), every top-six horse gets a set of signals, and we record what its price did over the
// next 5 and 10 minutes. Then: which signals predict the move, and can a back or lay trade
// (one tick worse each way, hedged) make money from it?
//
// Crossover points: Betfair's tick size doubles at 2.0 (0.01 → 0.02), and changes again at 3, 4,
// 6, 10, 20, 30, 50 and 100. Lay just below a crossover and each tick it drifts past is worth
// more than each tick it shortens, so the same number of ticks either way is a profit. The lab
// tests whether that asymmetry pays, after the spread.
const BOUNDS = [2, 3, 4, 6, 10, 20, 30, 50, 100]
type Sample = {
  month: string; rt: string; n: number; hcap: boolean; t: number; rank: number; price: number
  mom3: number; mom10: number; rangePos: number | null; vol: number; below: number; above: number
  fut5: number | null; fut10: number | null; x5: number | null; x10: number | null   // ticks moved, and the price, 5 and 10 minutes later
  xOff: number | null
}
// ticks to the next crossover above the price (how far below it the price sits), and to the one below
function crossoverDistance(p: number) {
  const up = BOUNDS.find(b => b > p + 1e-9), dn = [...BOUNDS].reverse().find(b => b < p - 1e-9)
  return { below: up ? ticksBetween(p, up) : 999, above: dn ? ticksBetween(dn, p) : 999 }
}
function addSamples(out: Sample[], byMin: Map<number, Map<number, number>>, atOff: Map<number, number>, month: string, rt: string, n: number, name: string | null | undefined, volAt: (t: number) => number) {
  const hcap = /hcap|handicap/i.test(name ?? '')
  for (const t of [60, 48, 36, 24, 12]) {
    const now = byMin.get(t)
    if (!now) continue
    const order = [...now.entries()].sort((a, b) => a[1] - b[1]).slice(0, 6)
    order.forEach(([id, px], i) => {
      const p3 = byMin.get(t + 3)?.get(id), p10 = byMin.get(t + 10)?.get(id)
      const hist: number[] = []
      for (let j = t; j <= t + 10; j++) { const v = byMin.get(j)?.get(id); if (v) hist.push(v) }
      const lo = Math.min(...hist), hi = Math.max(...hist)
      const x5 = byMin.get(t - 5)?.get(id) ?? null, x10 = byMin.get(t - 10)?.get(id) ?? null
      const { below, above } = crossoverDistance(px)
      out.push({ month, rt, n, hcap, t, rank: i + 1, price: px, mom3: p3 ? ticksBetween(p3, px) : 0, mom10: p10 ? ticksBetween(p10, px) : 0,
        rangePos: hist.length >= 5 && hi > lo ? (ticksBetween(lo, px)) / ticksBetween(lo, hi) : null, vol: volAt(t), below, above,
        fut5: x5 ? ticksBetween(px, x5) : null, fut10: x10 ? ticksBetween(px, x10) : null, x5, x10, xOff: atOff.get(id) ?? null })
    })
  }
}

function signalLab(samples: Sample[], cut: string): { lines: string[]; found: Found[] } {
  const L: string[] = ['', '### 7. Predicting the next few minutes (signal lab)', '']
  if (samples.length < 5000) { L.push('Not enough minute-by-minute history yet.'); return { lines: L, found: [] } }
  // A. how well each signal predicts the next 5 minutes (rank correlation), and the move by fifths of the signal
  const sigs: { name: string; get: (x: Sample) => number | null }[] = [
    { name: 'move in the last 3 min (ticks)', get: x => x.mom3 }, { name: 'move in the last 10 min (ticks)', get: x => x.mom10 },
    { name: 'place in its 10-min range (0 = low, 1 = high)', get: x => x.rangePos }, { name: 'race volatility (ticks/min)', get: x => x.vol },
    { name: 'ticks below the next crossover', get: x => Math.min(x.below, 30) }, { name: 'price', get: x => x.price }, { name: 'minutes before the off', get: x => x.t },
  ]
  const spearman = (xs: number[], ys: number[]) => {
    const rank = (v: number[]) => { const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); o.forEach(([, i], k) => { r[i] = k }); return r as number[] }
    const rx = rank(xs), ry = rank(ys), n = xs.length, mx = (n - 1) / 2
    let c = 0, vx = 0, vy = 0
    for (let i = 0; i < n; i++) { c += (rx[i] - mx) * (ry[i] - mx); vx += (rx[i] - mx) ** 2; vy += (ry[i] - mx) ** 2 }
    return c / Math.sqrt(vx * vy)
  }
  const rowsA: (string | number)[][] = []
  for (const sg of sigs) {
    const pairs = samples.map(x => [sg.get(x), x.fut5] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null)
    if (pairs.length < 1000) continue
    const r = spearman(pairs.map(p => p[0]), pairs.map(p => p[1]))
    const tr = r * Math.sqrt((pairs.length - 2) / Math.max(1e-9, 1 - r * r))
    const sorted = [...pairs].sort((a, b) => a[0] - b[0]), q = (k: number) => sorted.slice(Math.floor(sorted.length * k / 5), Math.floor(sorted.length * (k + 1) / 5))
    rowsA.push([sg.name, pairs.length.toLocaleString('en-GB'), fx(r, 3), pfmt(2 * (1 - normCdf(Math.abs(tr)))), ...[0, 1, 2, 3, 4].map(k => sgn1(avg(q(k).map(p => p[1])), 2))])
  }
  L.push('How each signal relates to the price move over the next 5 minutes (in ticks; minus = shortened). The last five columns are the average next move for the lowest fifth of the signal up to the highest. A correlation near zero means the signal tells you little; the p-value says whether it is more than chance.', '')
  L.push(table(['Signal', 'Cases', 'Correlation', 'p', 'Lowest 5th', '2nd', '3rd', '4th', 'Highest 5th'], rowsA), '')

  // B. crossover points: the same number of ticks is worth more on one side of 2.0 (and 3, 4, 6, 10...)
  const near = samples.filter(x => x.below >= 1 && x.below <= 3 && x.fut10 !== null), far = samples.filter(x => x.below >= 8 && x.above >= 8 && x.fut10 !== null)
  const layRet = (x: Sample, exit: number | null) => exit ? hedge('lay', x.price, exit) : null
  const cell = (xs: Sample[], f: (x: Sample) => number | null) => { const v = xs.map(f).filter((z): z is number => z !== null); return v.length ? `${pct(avg(v), 2)} (n ${v.length.toLocaleString('en-GB')}, p ${pfmt(pOf(tStat(v)))})` : '—' }
  L.push('Crossover points: lay a horse 1 to 3 ticks below a crossover (just under 2.0, 3.0, 4.0, 6.0, 10...) against horses well away from one, then hedge. Return per £1, one tick worse each way, after commission:', '')
  L.push(table(['Hedge after', 'Just below a crossover', 'Away from crossovers'], [['5 min', cell(near, x => layRet(x, x.x5)), cell(far, x => layRet(x, x.x5))], ['10 min', cell(near, x => layRet(x, x.x10)), cell(far, x => layRet(x, x.x10))], ['at the off', cell(near, x => layRet(x, x.xOff)), cell(far, x => layRet(x, x.xOff))]]), '')

  // C. rule search: back or lay, hedge after 5 or 10 minutes or at the off, with signal filters (alone and in pairs)
  const rules: { name: string; make: (x: Sample) => Bet | null }[] = []
  for (const side of ['back', 'lay'] as const) for (const [h, nm] of [['x5', 'hedge after 5 min'], ['x10', 'hedge after 10 min'], ['xOff', 'hedge at the off']] as const)
    rules.push({ name: `${side === 'back' ? 'Back' : 'Lay'}, ${nm}`, make: x => { const e = x[h]; return e ? { month: x.month, value: 0, actual: hedge(side, x.price, e) } : null } })
  const F: Filter<Sample>[] = [{ name: 'all', group: 'all', test: () => true }]
  for (const [lo, hi, nm] of [[-999, -6, 'shortened 6+ ticks in 3 min'], [-5, -2, 'shortened 2 to 5 ticks'], [-1, 1, 'steady'], [2, 5, 'drifted 2 to 5 ticks'], [6, 999, 'drifted 6+ ticks in 3 min']] as const) F.push({ name: nm, group: 'mom3', test: x => x.mom3 >= lo && x.mom3 <= hi })
  for (const [lo, hi, nm] of [[-999, -10, 'shortened 10+ ticks in 10 min'], [10, 999, 'drifted 10+ ticks in 10 min']] as const) F.push({ name: nm, group: 'mom10', test: x => x.mom10 >= lo && x.mom10 <= hi })
  F.push({ name: 'at the bottom of its 10-min range', group: 'range', test: x => x.rangePos !== null && x.rangePos <= 0.1 }, { name: 'at the top of its 10-min range', group: 'range', test: x => x.rangePos !== null && x.rangePos >= 0.9 })
  F.push({ name: '1 to 3 ticks below a crossover', group: 'cross', test: x => x.below >= 1 && x.below <= 3 }, { name: '1 to 3 ticks above a crossover', group: 'cross', test: x => x.above >= 1 && x.above <= 3 })
  const vs = samples.map(x => x.vol).sort((a, b) => a - b), v1 = vs[Math.floor(vs.length / 3)], v2 = vs[Math.floor(vs.length * 2 / 3)]
  F.push({ name: 'quiet race', group: 'vol', test: x => x.vol < v1 }, { name: 'volatile race', group: 'vol', test: x => x.vol >= v2 })
  for (const [lo, hi, nm] of [[1, 1, 'favourite'], [2, 3, '2nd or 3rd fav'], [4, 6, '4th to 6th']] as const) F.push({ name: nm, group: 'rank', test: x => x.rank >= lo && x.rank <= hi })
  for (const tt of [60, 48, 36, 24, 12]) F.push({ name: `${tt} min before the off`, group: 'time', test: x => x.t === tt })
  for (const rt of Array.from(new Set(samples.map(x => x.rt)))) F.push({ name: rt, group: 'rtype', test: x => x.rt === rt })
  for (const [lo, hi] of [[2, 7], [8, 11], [12, 99]]) F.push({ name: `${lo}${hi === 99 ? '+' : ` to ${hi}`} runners`, group: 'field', test: x => x.n >= lo && x.n <= hi })
  const res = search(samples, rules, F, cut, false)
  L.push(...resultsBlock('short-term trades (back or lay, hedged after 5 or 10 minutes or at the off; with signals for recent moves, place in the range, crossover points, volatility, rank, time, race type and field size, alone and in pairs)', res.found, res.tested, true))
  L.push('Not in these tests yet: traded volume and which way it pushed the price (the pressure signal). That needs the money matched on each horse, from the live key or Betfair\'s Pro data.', '')
  return { lines: L, found: res.found }
}
const sgn1 = (v: number, dp = 1) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(dp)

// ------------------------------------------------------------------ price discovery: trading the moves
// Minute-by-minute last traded prices in the last hour. A "signal" fires the first time
// in a race that a runner (top six) moves by at least `th` ticks over `k` minutes. Then:
//   follow  back a steamer / lay a drifter, and close (hedge) h minutes later or at the off
//   fade    the opposite: bet on the move overshooting and coming back
//   other   when the favourite drifts (or steams), back (or lay) the 2nd favourite:
//           the money leaving one horse has to go somewhere
// Prices: get in at the last traded price (back) or one tick above (lay), and get out one
// tick worse, so every trade pays a spread. Per £1 hedged stake, after commission.
type Ev = { month: string; rt: string; n: number; kind: 'steam' | 'drift' | 'favDrift' | 'favSteam'; ticks: number; entry: number; exits: (number | null)[]; vol: number }   // exits: one per HOLDS; vol: the race's recent movement
const HOLDS = [2, 5, 10, 0]                    // minutes; 0 = at the off
const holdName = (h: number) => h ? `close after ${h} min` : 'close at the off'

function hedge(side: 'back' | 'lay', entry: number, exit: number) {
  const g = side === 'back' ? entry / tickUp(exit) - 1 : 1 - tickUp(entry) / exit
  return g > 0 ? g * (1 - C) : g
}

// Adds one or more days' signals to groups (key: k|th|kind).
function collectSignals(days: HistDay[], groups: Map<string, Ev[]>, samples?: Sample[]) {
  for (const d of days) {
    const { markets, snaps } = expandHistory(d, 'racing')
    for (const m of markets) {
      if (!m.off_at) continue
      const off = Date.parse(m.off_at)
      const byMin = new Map<number, Map<number, number>>()
      for (const sn of snaps.get(m.market_id) ?? []) {
        if (sn.inplay) continue
        const mins = Math.round((off - Date.parse(sn.at)) / 60_000)
        if (mins < 0 || mins > 75) continue
        byMin.set(mins, new Map(sn.runners.filter(r => r[5]).map(r => [r[0], r[5] as number])))
      }
      const atOff = byMin.get(0)
      if (!atOff || atOff.size < 3) continue
      const month = m.start_at.slice(0, 7), rt = m.race_type ?? 'Unknown', n = atOff.size
      const exitsFor = (id: number, t: number) => HOLDS.map(h => (h ? byMin.get(t - h) : atOff)?.get(id) ?? null)
      // volatility: average ticks moved per minute by the top six over the 10 minutes before minute t
      const volCache = new Map<number, number>()
      const volAt = (t: number) => {
        const c = volCache.get(t); if (c !== undefined) return c
        let sum = 0, cnt = 0
        for (let j = t; j < t + 10; j++) {
          const a = byMin.get(j), b = byMin.get(j + 1)
          if (!a || !b) continue
          for (const [id, px] of [...a.entries()].sort((x, y) => x[1] - y[1]).slice(0, 6)) { const q = b.get(id); if (q) { sum += Math.abs(ticksBetween(q, px)); cnt++ } }
        }
        const v = cnt ? sum / cnt : 0
        volCache.set(t, v); return v
      }
      if (samples) addSamples(samples, byMin, atOff, month, rt, n, m.market_name, volAt)
      for (const k of [2, 3, 5]) for (const th of [4, 8, 15]) {
        const seen = new Set<string>()
        for (let t = 60; t >= 4; t--) {
          const now = byMin.get(t), before = byMin.get(t + k)
          if (!now || !before) continue
          const order = [...now.entries()].sort((a, b) => a[1] - b[1])
          order.slice(0, 6).forEach(([id, px], i) => {
            const was = before.get(id)
            if (!was) return
            const mv = ticksBetween(was, px)
            const kind = mv <= -th ? 'steam' : mv >= th ? 'drift' : null
            if (!kind || seen.has(id + kind)) return
            seen.add(id + kind)
            const key = `${k}|${th}|${kind}`
            if (!groups.has(key)) groups.set(key, [])
            // get in a minute after the signal (reaction time, and the live prices are delayed),
            // and only if the move is still there then: one stray trade at an odd price shows
            // up as a spike in the last traded price that you could never have traded at
            const entry = byMin.get(t - 1)?.get(id)
            if (!entry) return
            const held = ticksBetween(was, entry)
            if (kind === 'steam' ? held > -th : held < th) return
            groups.get(key)!.push({ month, rt, n, kind, ticks: mv, entry, exits: exitsFor(id, t - 1), vol: volAt(t) })
            // the favourite moved: what happens to the 2nd favourite?
            if (i === 0 && order[1]) {
              const k2 = kind === 'drift' ? 'favDrift' : 'favSteam'
              if (!seen.has('fav' + k2)) {
                seen.add('fav' + k2)
                const key2 = `${k}|${th}|${k2}`
                if (!groups.has(key2)) groups.set(key2, [])
                const favNext = byMin.get(t - 1)?.get(id)
                const favHeld = favNext ? ticksBetween(was, favNext) : 0
                if (kind === 'steam' ? favHeld > -th : favHeld < th) return
                const e2 = byMin.get(t - 1)?.get(order[1][0])
                if (e2) groups.get(key2)!.push({ month, rt, n, kind: k2, ticks: mv, entry: e2, exits: exitsFor(order[1][0], t - 1), vol: volAt(t) })
              }
            }
          })
        }
      }
    }
  }

}

function priceDiscovery(groups: Map<string, Ev[]>, cut: string): { lines: string[]; found: Found[] } {
  // the actions to test on each kind of signal
  const actions: { kind: Ev['kind']; name: string; side: 'back' | 'lay' }[] = [
    { kind: 'steam', name: 'Follow a steamer (back it)', side: 'back' }, { kind: 'steam', name: 'Fade a steamer (lay it)', side: 'lay' },
    { kind: 'drift', name: 'Follow a drifter (lay it)', side: 'lay' }, { kind: 'drift', name: 'Fade a drifter (back it)', side: 'back' },
    { kind: 'favDrift', name: 'Favourite drifts: back the 2nd favourite', side: 'back' }, { kind: 'favDrift', name: 'Favourite drifts: lay the 2nd favourite', side: 'lay' },
    { kind: 'favSteam', name: 'Favourite steams: lay the 2nd favourite', side: 'lay' }, { kind: 'favSteam', name: 'Favourite steams: back the 2nd favourite', side: 'back' },
  ]
  const L: string[] = ['', '### 6. Trading the price discovery (hedged, minute by minute)', '',
    'Signals from the minute-by-minute prices in the last hour: the first time a top-six runner moves 8+ ticks within 3 minutes (other sizes and speeds are in the search below). Each trade gets in one minute after the signal, only if the move is still there (time to react, the delay on the free key, and to skip one-off spikes from a single stray trade), and in and out one tick worse than the last traded price, so it pays a spread both ways. Figures per £1 hedged stake, after commission.', '']
  const tbl: (string | number)[][] = []
  for (const a of actions) {
    const evs = groups.get(`3|8|${a.kind}`) ?? []
    for (const h of HOLDS) {
      const r = evs.map(e => { const x = e.exits[HOLDS.indexOf(h)]; return x ? { month: e.month, value: 0, actual: hedge(a.side, e.entry, x) } : null }).filter((b): b is Bet => !!b)
      if (r.length < 30) continue
      const sm = summarise(r)
      tbl.push([a.name, holdName(h), sm.n.toLocaleString('en-GB'), Math.round(r.filter(b => b.actual > 0).length / r.length * 100) + '%', pct(sm.roi, 2), fx(sm.t, 1), `${sm.monthsUp}/${sm.months}`])
    }
  }
  L.push(tbl.length ? table(['Trade', 'Exit', 'Trades', 'Won', 'Return per £1', 't', 'Months up'], tbl) : 'Not enough minute-by-minute history yet.', '')
  L.push('Spreads matter here: one tick each way costs roughly 1% to 4% of the stake depending on the price, so a move has to be large and predictable to pay.', '')

  // search: every speed, size, action, exit and filter, with the same time split as above
  const filters: { name: string; test: (e: Ev) => boolean }[] = [{ name: 'all races', test: () => true }]
  for (const rt of Array.from(new Set([...groups.values()].flat().map(e => e.rt)))) filters.push({ name: rt, test: e => e.rt === rt })
  for (const [lo, hi] of [[2, 7], [8, 11], [12, 99]]) filters.push({ name: `${lo}${hi === 99 ? '+' : ` to ${hi}`} runners`, test: e => e.n >= lo && e.n <= hi })
  // volatility thirds (how much the race's prices had been moving in the 10 minutes before the signal)
  const vols = [...groups.values()].flat().map(e => e.vol).sort((a, b) => a - b)
  const v1 = vols[Math.floor(vols.length / 3)] ?? 0, v2 = vols[Math.floor(vols.length * 2 / 3)] ?? 0
  filters.push({ name: `quiet market (under ${v1.toFixed(1)} ticks/min)`, test: e => e.vol < v1 }, { name: 'normal market', test: e => e.vol >= v1 && e.vol < v2 }, { name: `volatile market (${v2.toFixed(1)}+ ticks/min)`, test: e => e.vol >= v2 })
  const found: Found[] = []
  let tested = 0
  for (const [key, evs] of groups) {
    const [k, th, kind] = key.split('|')
    for (const a of actions.filter(x => x.kind === kind)) for (const h of HOLDS) for (const f of filters) {
      tested++
      const bets = evs.filter(f.test).map(e => { const x = e.exits[HOLDS.indexOf(h)]; return x ? { month: e.month, value: 0, actual: hedge(a.side, e.entry, x) } : null }).filter((b): b is Bet => !!b)
      const fd = makeFound(`${a.name} after ${th}+ ticks in ${k} min, ${holdName(h)} · ${f.name}`, bets, cut, false)
      if (fd) found.push(fd)
    }
  }
  judge(found, tested)
  L.push(...resultsBlock('trading rules (move speed, size, follow or fade, the other-horse trades, exit time, race filters)', found, tested, true))
  L.push('Not tested yet, because the data doesn\'t have it: weight of money across the full ladder, and the money traded on each runner. Betfair\'s free history has only the last traded price, and the free live key gives no traded volume. See the Setup tab for what would add them.', '')
  return { lines: L, found }
}

// ------------------------------------------------------------------ football in play: Over/Under 2.5 and the draw
// The free history has each market's last traded price every minute in play, but not the
// score. Goals are worked out from the Over 2.5 price: when a goal goes in, the Over's chance
// jumps (by 12 points or more within a minute). Minutes are clock minutes from kick-off,
// so half-time sits between about 47 and 62.
type Match = {
  month: string; country: string; preOver: number | null; preDraw: number | null
  over: Float32Array; under: Float32Array; draw: Float32Array   // last traded price at each 5-minute mark (0, 5, ... 150); 0 = none
  goals: number[]                                                 // minutes of the goals worked out from the prices
  atGoal2: { over: number; under: number; draw: number }        // prices 2 minutes after the first goal (0 = none)
  atGoal17: { over: number; draw: number }                      // and 17 minutes after it
  overWon: boolean; drawWon: boolean
  mo: { before: [number, number]; at2: [number, number]; at17: [number, number]; won: [boolean, boolean] } | null   // home, away prices around the first goal
}
const MARKS = Array.from({ length: 31 }, (_, i) => i * 5)

function inPlayMatches(d: HistDay): Match[] {
  const { markets, snaps } = expandHistory(d, 'football')
  const byEvent = new Map<string, { ou?: (typeof markets)[number]; mo?: (typeof markets)[number] }>()
  for (const m of markets) {
    if (!m.off_at || !m.winners?.length) continue
    const k = m.event + '|' + m.start_at
    const e = byEvent.get(k) ?? {}
    if (m.market_type === 'OVER_UNDER_25') e.ou = m
    if (m.market_type === 'MATCH_ODDS') e.mo = m
    byEvent.set(k, e)
  }
  const out: Match[] = []
  for (const { ou, mo } of byEvent.values()) {
    if (!ou) continue
    const off = Date.parse(ou.off_at!)
    const overId = ou.runners.find(r => /over/i.test(r.name))?.id, underId = ou.runners.find(r => /under/i.test(r.name))?.id
    if (overId === undefined || underId === undefined) continue
    const drawId = mo?.runners.find(r => /draw/i.test(r.name))?.id
    // minute-by-minute prices in play (and the last price before kick-off)
    const series = (mk: typeof ou | undefined, id: number | undefined) => {
      const perMin = new Map<number, number>()
      let pre: number | null = null
      if (!mk || id === undefined) return { perMin, pre }
      for (const sn of snaps.get(mk.market_id) ?? []) {
        const px = sn.runners.find(r => r[0] === id)?.[5]
        if (!px) continue
        if (!sn.inplay) { pre = px; continue }
        perMin.set(Math.round((Date.parse(sn.at) - off) / 60_000), px)
      }
      return { perMin, pre }
    }
    const O = series(ou, overId), U = series(ou, underId), D = series(mo, drawId)
    const H = series(mo, mo?.runners[0]?.id), A = series(mo, mo?.runners[1]?.id)
    if (!O.perMin.size) continue
    const at = (m: Map<number, number>, k: number) => { for (let j = k; j >= Math.max(0, k - 2); j--) { const v = m.get(j); if (v) return v } return 0 }
    // goals: a jump in the Over's chance within a minute
    const goals: number[] = []
    let last = O.pre ? 1 / O.pre : 0
    for (let k = 1; k <= 150; k++) {
      const v = O.perMin.get(k)
      if (!v) continue
      const ch = 1 / v
      if (ch - last >= 0.12 && goals.length < 3) goals.push(k)
      last = ch
    }
    const g1 = goals[0]
    out.push({
      month: ou.start_at.slice(0, 7), country: ou.country ?? '?', preOver: O.pre, preDraw: D.pre,
      over: Float32Array.from(MARKS, k => at(O.perMin, k)), under: Float32Array.from(MARKS, k => at(U.perMin, k)), draw: Float32Array.from(MARKS, k => at(D.perMin, k)),
      goals, atGoal2: { over: g1 ? at(O.perMin, g1 + 2) : 0, under: g1 ? at(U.perMin, g1 + 2) : 0, draw: g1 ? at(D.perMin, g1 + 2) : 0 },
      atGoal17: { over: g1 ? at(O.perMin, g1 + 17) : 0, draw: g1 ? at(D.perMin, g1 + 17) : 0 },
      overWon: ou.winners!.includes(overId), drawWon: !!(mo && drawId !== undefined && mo.winners?.includes(drawId)),
      mo: mo && g1 && mo.winners?.length ? { before: [at(H.perMin, g1 - 1) || H.pre || 0, at(A.perMin, g1 - 1) || A.pre || 0], at2: [at(H.perMin, g1 + 2), at(A.perMin, g1 + 2)],
        at17: [at(H.perMin, g1 + 17), at(A.perMin, g1 + 17)], won: [mo.winners.includes(mo.runners[0].id), mo.winners.includes(mo.runners[1].id)] } : null,
    })
  }
  return out
}

function footballInPlay(matches: Match[], cut: string): { lines: string[]; found: Found[] } {
  const L: string[] = ['', '### Football in play: Over/Under 2.5 and the draw', '']
  if (matches.length < 500) { L.push('Not enough in-play history yet.'); return { lines: L, found: [] } }
  const goalsBy = (m: Match, k: number) => m.goals.filter(g => g <= k).length
  const settle = (side: 'back' | 'lay', price: number, won: boolean) => side === 'back' ? backActual(price, won) : layActual(price, won)
  const mk = (month: string, actual: number): Bet => ({ month, value: 0, actual })
  // a hedge after h minutes; if the market has gone (Over already won) settle on the result instead
  const hedgeOrSettle = (side: 'back' | 'lay', entry: number, exit: number, won: boolean) => exit ? hedge(side, entry, exit) : settle(side, side === 'back' ? tickDown(entry) : tickUp(entry), won)

  type R = { name: string; make: (m: Match) => Bet | null }
  const rules: R[] = []
  const idx = (k: number) => k / 5
  for (const k of [10, 20, 30, 40, 65, 75, 85]) for (const g of [0, 1, 2]) for (const sel of ['Over', 'Under'] as const) for (const side of ['back', 'lay'] as const) {
    const px = (m: Match, kk: number) => (sel === 'Over' ? m.over : m.under)[idx(kk)]
    const won = (m: Match) => sel === 'Over' ? m.overWon : !m.overWon
    const label = `${side === 'back' ? 'Back' : 'Lay'} ${sel} 2.5 at ${k} min with ${g} goal${g === 1 ? '' : 's'}`
    rules.push({ name: `${label}, let it run`, make: m => { const p = px(m, k); if (!p || goalsBy(m, k) !== g) return null; return mk(m.month, settle(side, side === 'back' ? tickDown(p) : tickUp(p), won(m))) } })
    for (const h of [10, 20]) rules.push({ name: `${label}, close after ${h} min`, make: m => { const p = px(m, k); if (!p || goalsBy(m, k) !== g || k + h > 150) return null; return mk(m.month, hedgeOrSettle(side, p, px(m, k + h), won(m))) } })
  }
  // after the first goal: back or lay the Over two minutes later
  for (const by of [20, 35, 60]) for (const side of ['back', 'lay'] as const) {
    const ok = (m: Match) => m.goals.length > 0 && m.goals[0] <= by && m.atGoal2.over
    rules.push({ name: `${side === 'back' ? 'Back' : 'Lay'} Over 2.5 two minutes after a first goal by ${by} min, let it run`, make: m => ok(m) ? mk(m.month, settle(side, side === 'back' ? tickDown(m.atGoal2.over) : tickUp(m.atGoal2.over), m.overWon)) : null })
    rules.push({ name: `${side === 'back' ? 'Back' : 'Lay'} Over 2.5 two minutes after a first goal by ${by} min, close 15 min later`, make: m => ok(m) ? mk(m.month, hedgeOrSettle(side, m.atGoal2.over, m.atGoal17.over, m.overWon)) : null })
  }
  // Match Odds after the first goal: the scorer is the side whose price fell. Back the scorer
  // (follow) or the side that conceded (fade: the market overreacting), let it run or close 15 min later.
  for (const by of [20, 45, 70]) for (const who of ['scorer', 'conceder'] as const) for (const exit of ['run', '15'] as const) rules.push({
    name: `Back the ${who === 'scorer' ? 'team that scored' : 'team that conceded'} first, 2 min after a goal by ${by} min, ${exit === 'run' ? 'let it run' : 'close 15 min later'}`,
    make: m => {
      const g = m.mo, g1 = m.goals[0]
      if (!g || !g1 || g1 > by || !g.before[0] || !g.at2[0] || !g.at2[1]) return null
      const homeScored = g.at2[0] < g.before[0]
      const i = (who === 'scorer') === homeScored ? 0 : 1
      return mk(m.month, exit === 'run' ? settle('back', tickDown(g.at2[i]), g.won[i]) : hedgeOrSettle('back', g.at2[i], g.at17[i], g.won[i]))
    } })
  // lay the draw before kick-off; get out two minutes after the first goal, or at a set time, or let it run
  for (const stop of [60, 70, 80, 0]) rules.push({ name: `Lay the draw at kick-off, close 2 min after the first goal${stop ? ` or at ${stop} min` : ', or let it run'}`, make: m => {
    if (!m.preDraw) return null
    const g1 = m.goals[0]
    if (g1 && (!stop || g1 < stop)) return m.atGoal2.draw ? mk(m.month, hedge('lay', m.preDraw, m.atGoal2.draw)) : null
    if (stop) { const x = m.draw[idx(stop)]; return x ? mk(m.month, hedge('lay', m.preDraw, x)) : null }
    return mk(m.month, settle('lay', tickUp(m.preDraw), m.drawWon))
  } })

  const filters: Filter<Match>[] = [{ name: 'all matches', group: 'all', test: () => true }]
  for (const cc of Array.from(new Set(matches.map(m => m.country)))) filters.push({ name: `country ${cc}`, group: 'country', test: m => m.country === cc })
  for (const [lo, hi] of [[1, 1.7], [1.7, 2.1], [2.1, 2.6], [2.6, 100]]) filters.push({ name: `Over priced ${lo} to ${hi === 100 ? 'any' : hi} at kick-off`, group: 'price', test: m => !!m.preOver && m.preOver >= lo && m.preOver < hi })
  for (const [lo, hi] of [[1, 3.2], [3.2, 3.8], [3.8, 100]]) filters.push({ name: `draw priced ${lo} to ${hi === 100 ? 'any' : hi} at kick-off`, group: 'dprice', test: m => !!m.preDraw && m.preDraw >= lo && m.preDraw < hi })
  const res = search(matches, rules, filters, cut, false)
  const goalRate = avg(matches.map(m => m.goals.length ? 1 : 0))
  L.push(`${matches.length.toLocaleString('en-GB')} matches with in-play prices. The score isn't in the free history, so goals are worked out from sudden jumps in the Over 2.5 price (a goal was spotted in ${Math.round(goalRate * 100)}% of matches). Minutes are clock minutes from kick-off, so half-time falls at about 47 to 62. Prices one tick worse than the last trade, after commission.`, '')
  L.push(...resultsBlock('in-play rules (Over/Under at each time and score, after the first goal, laying the draw; with country and kick-off price filters)', res.found, res.tested, false))
  return { lines: L, found: res.found }
}

// ------------------------------------------------------------------ Dixon-Coles: a score model learned from earlier results
// Each team has an attack and a defence strength, plus a home advantage; expected goals
//   home = attack(home) × defence(away) × home advantage,  away = attack(away) × defence(home)
// Goals follow a Poisson distribution, with Dixon and Coles' correction (rho) for 0-0, 1-0,
// 0-1 and 1-1, and older matches count less (time decay, xi per day). The model is refitted at
// the start of every month using only earlier matches, so every prediction is made the way it
// would have been at the time. Scores come from the Correct Score market's result.
type FSel = { key: 'H' | 'D' | 'A' | 'O' | 'U' | 'BY' | 'BN'; px60: number | null; close: number | null; won: boolean }
type FMatch = { t: number; month: string; country: string; home: string; away: string; hg: number | null; ag: number | null; sels: FSel[] }

function footballMatches(d: HistDay): FMatch[] {
  const { markets, snaps } = expandHistory(d, 'football')
  const by = new Map<string, FMatch>()
  for (const m of markets) {
    const [home, away] = m.event.split(/\s+v\s+/i)
    if (!home || !away || !m.winners?.length) continue
    const k = m.event + '|' + m.start_at
    let f = by.get(k)
    if (!f) { f = { t: Date.parse(m.start_at), month: m.start_at.slice(0, 7), country: m.country ?? '?', home: home.trim().toLowerCase(), away: away.trim().toLowerCase(), hg: null, ag: null, sels: [] }; by.set(k, f) }
    if (m.market_type === 'CORRECT_SCORE') {
      const w = m.runners.find(r => m.winners!.includes(r.id))?.name ?? ''
      const sc = w.match(/(\d+)\s*-\s*(\d+)/)
      if (sc) { f.hg = Number(sc[1]); f.ag = Number(sc[2]) }
      else if (/any other home/i.test(w)) { f.hg = 4; f.ag = 1 } else if (/any other away/i.test(w)) { f.hg = 1; f.ag = 4 } else if (/any other draw/i.test(w)) { f.hg = 4; f.ag = 4 }
      continue
    }
    const path = pickPath(m, snaps.get(m.market_id) ?? [], [3600], 300)
    const px = (o: string, id: number) => { const r = path[o]?.runners.find(x => x[0] === id); return r ? (r[1] ?? r[5]) : null }
    const add = (key: FSel['key'], id: number | undefined) => { if (id === undefined) return; f!.sels.push({ key, px60: px('3600', id), close: px(OFF, id), won: m.winners!.includes(id) }) }
    if (m.market_type === 'MATCH_ODDS') { add('H', m.runners[0]?.id); add('A', m.runners[1]?.id); add('D', m.runners.find(r => /draw/i.test(r.name))?.id) }
    if (m.market_type === 'OVER_UNDER_25') { add('O', m.runners.find(r => /over/i.test(r.name))?.id); add('U', m.runners.find(r => /under/i.test(r.name))?.id) }
    if (m.market_type === 'BOTH_TEAMS_TO_SCORE') { add('BY', m.runners.find(r => /yes/i.test(r.name))?.id); add('BN', m.runners.find(r => /no/i.test(r.name))?.id) }
  }
  return [...by.values()]
}

const pois = (k: number, l: number) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p }
const tau = (x: number, y: number, l: number, m: number, rho: number) =>
  x === 0 && y === 0 ? 1 - l * m * rho : x === 0 && y === 1 ? 1 + l * rho : x === 1 && y === 0 ? 1 + m * rho : x === 1 && y === 1 ? 1 - rho : 1

type DCVariant = { name: string; xi: number; perCountryHome: boolean }
const DC_VARIANTS: DCVariant[] = [
  { name: 'standard (results fade over about a year)', xi: 0.0019, perCountryHome: false },
  { name: 'home advantage by country', xi: 0.0019, perCountryHome: true },
  { name: 'no fading', xi: 0, perCountryHome: false },
  { name: 'fast fading (about 4 months)', xi: 0.0065, perCountryHome: false },
]

function fitDC(train: FMatch[], at: number, v: DCVariant) {
  const att = new Map<string, number>(), def = new Map<string, number>(), homeAdv = new Map<string, number>()
  const games = new Map<string, number>()
  const w = train.map(m => Math.exp(-v.xi * (at - m.t) / 86_400_000))
  for (const m of train) { for (const tm of [m.home, m.away]) { att.set(tm, 1); def.set(tm, 1); games.set(tm, (games.get(tm) ?? 0) + 1) } }
  const hk = (m: FMatch) => v.perCountryHome ? m.country : 'all'
  for (const m of train) homeAdv.set(hk(m), 1.3)
  for (let it = 0; it < 25; it++) {
    const aNum = new Map<string, number>(), aDen = new Map<string, number>(), dNum = new Map<string, number>(), dDen = new Map<string, number>()
    const add = (mp: Map<string, number>, k: string, x: number) => mp.set(k, (mp.get(k) ?? 0) + x)
    train.forEach((m, i) => {
      const h = homeAdv.get(hk(m))!, wi = w[i]
      add(aNum, m.home, wi * m.hg!); add(aDen, m.home, wi * h * def.get(m.away)!)
      add(aNum, m.away, wi * m.ag!); add(aDen, m.away, wi * def.get(m.home)!)
    })
    for (const [k, n] of aNum) att.set(k, Math.max(0.05, (n + 0.5) / ((aDen.get(k) ?? 0) + 0.5)))   // small pull towards average
    train.forEach((m, i) => {
      const h = homeAdv.get(hk(m))!, wi = w[i]
      add(dNum, m.away, wi * m.hg!); add(dDen, m.away, wi * h * att.get(m.home)!)
      add(dNum, m.home, wi * m.ag!); add(dDen, m.home, wi * att.get(m.away)!)
    })
    for (const [k, n] of dNum) def.set(k, Math.max(0.05, (n + 0.5) / ((dDen.get(k) ?? 0) + 0.5)))
    const hNum = new Map<string, number>(), hDen = new Map<string, number>()
    train.forEach((m, i) => { add(hNum, hk(m), w[i] * m.hg!); add(hDen, hk(m), w[i] * att.get(m.home)! * def.get(m.away)!) })
    for (const [k, n] of hNum) homeAdv.set(k, n / Math.max(1e-9, hDen.get(k)!))
    // keep attack centred on 1
    const meanA = [...att.values()].reduce((a, b) => a + b, 0) / att.size
    for (const [k, x] of att) att.set(k, x / meanA)
    for (const [k, x] of def) def.set(k, x * meanA)
  }
  // rho: the low-score correction, by a simple search
  let best = 0, bestLL = -Infinity
  for (let r = -0.2; r <= 0.1001; r += 0.02) {
    let ll = 0
    train.forEach((m, i) => { if (m.hg! <= 1 && m.ag! <= 1) { const h = homeAdv.get(hk(m))!; ll += w[i] * Math.log(Math.max(1e-9, tau(m.hg!, m.ag!, h * att.get(m.home)! * def.get(m.away)!, att.get(m.away)! * def.get(m.home)!, r))) } })
    if (ll > bestLL) { bestLL = ll; best = r }
  }
  return { att, def, homeAdv, rho: best, games, hk }
}

function predictDC(f: ReturnType<typeof fitDC>, m: FMatch) {
  const a1 = f.att.get(m.home), d1 = f.def.get(m.home), a2 = f.att.get(m.away), d2 = f.def.get(m.away), h = f.homeAdv.get(f.hk(m)) ?? f.homeAdv.get('all')
  if (!a1 || !a2 || !d1 || !d2 || !h || (f.games.get(m.home) ?? 0) < 8 || (f.games.get(m.away) ?? 0) < 8) return null
  const l = h * a1 * d2, mu = a2 * d1
  let H = 0, D = 0, A = 0, O = 0, BY = 0, tot = 0
  for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++) {
    const p = pois(x, l) * pois(y, mu) * tau(x, y, l, mu, f.rho)
    tot += p
    if (x > y) H += p; else if (x === y) D += p; else A += p
    if (x + y >= 3) O += p
    if (x > 0 && y > 0) BY += p
  }
  return { H: H / tot, D: D / tot, A: A / tot, O: O / tot, U: 1 - O / tot, BY: BY / tot, BN: 1 - BY / tot } as Record<FSel['key'], number>
}

type DCItem = { month: string; country: string; mkt: 'MO' | 'OU' | 'BTTS'; key: FSel['key']; px60: number | null; close: number | null; won: boolean; pm: Float32Array; pmk: number }

function dixonColes(matches: FMatch[], cut: string): { lines: string[]; found: Found[] } {
  const L: string[] = ['', '### Dixon-Coles score model (football, let it run)', '']
  const scored = matches.filter(m => m.hg !== null).sort((a, b) => a.t - b.t)
  if (scored.length < 2000) { L.push(`Needs the Correct Score results (${scored.length.toLocaleString('en-GB')} matches with a final score so far). Import them with: sudo bash /opt/flowstate/recorder/deploy/history.sh 2023-07-01 2026-06-30 football --only=CORRECT_SCORE`); return { lines: L, found: [] } }
  const months = Array.from(new Set(scored.map(m => m.month))).sort()
  const items: DCItem[] = []
  const ll = DC_VARIANTS.map(() => ({ model: 0, market: 0, n: 0 }))
  for (const mo of months.slice(6)) {                       // first six months only train the model
    const start = Date.parse(mo + '-01T00:00:00Z')
    const train = scored.filter(m => m.t < start && m.t > start - 2 * 365 * 86_400_000)
    const fits = DC_VARIANTS.map(v => fitDC(train, start, v))
    for (const m of matches.filter(x => x.month === mo)) {
      const preds = fits.map(f => predictDC(f, m))
      if (!preds[0]) continue
      const groups: [DCItem['mkt'], FSel['key'][]][] = [['MO', ['H', 'D', 'A']], ['OU', ['O', 'U']], ['BTTS', ['BY', 'BN']]]
      for (const [mkt, keys] of groups) {
        const ss = keys.map(k => m.sels.find(x => x.key === k)).filter((x): x is FSel => !!x && !!x.close)
        if (ss.length !== keys.length) continue
        const book = ss.reduce((a, x) => a + 1 / x.close!, 0)
        for (const x of ss) {
          const pmk = (1 / x.close!) / Math.max(1, book)
          items.push({ month: m.month, country: m.country, mkt, key: x.key, px60: x.px60, close: x.close, won: x.won, pm: Float32Array.from(preds, p => p ? p[x.key] : NaN), pmk })
          if (mkt === 'MO') preds.forEach((p, i) => { if (p) { ll[i].model -= Math.log(Math.max(1e-6, x.won ? p[x.key] : 1 - p[x.key])); ll[i].market -= Math.log(Math.max(1e-6, x.won ? pmk : 1 - pmk)); ll[i].n++ } })
        }
      }
    }
  }
  L.push(`${scored.length.toLocaleString('en-GB')} matches with a final score; refitted every month on the two years before it, predicting ${new Set(items.map(i => i.month)).size} months of matches (${items.length.toLocaleString('en-GB')} selections). Teams need 8+ earlier matches.`, '')
  L.push('How the model compares with the market at kick-off (Match Odds, lower is better; the market usually wins):', '')
  L.push(table(['Model version', 'Model log loss', 'Market log loss', 'Selections'], DC_VARIANTS.map((v, i) => [v.name, fx(ll[i].model / Math.max(1, ll[i].n), 4), fx(ll[i].market / Math.max(1, ll[i].n), 4), ll[i].n.toLocaleString('en-GB')])), '')

  const NAMES: Record<FSel['key'], string> = { H: 'home win', D: 'draw', A: 'away win', O: 'Over 2.5', U: 'Under 2.5', BY: 'BTTS yes', BN: 'BTTS no' }
  const rules: { name: string; make: (x: DCItem) => Bet | null }[] = []
  for (const mkt of ['MO', 'OU', 'BTTS'] as const) for (const side of ['back', 'lay'] as const) for (const at of ['60', 'close'] as const)
    DC_VARIANTS.forEach((v, vi) => { for (const wgt of [1, 0.5]) for (const thr of [0.02, 0.05, 0.1]) {
      rules.push({ name: `${side === 'back' ? 'Back' : 'Lay'} where the model ${wgt === 1 ? '' : '(50/50 with the market) '}gives ${thr * 100}%+ edge, ${mkt === 'MO' ? 'Match Odds' : mkt === 'OU' ? 'Over/Under 2.5' : 'BTTS'}, ${at === '60' ? 'an hour before' : 'at kick-off'}, ${v.name}`,
        make: x => {
          if (x.mkt !== mkt) return null
          const raw = at === '60' ? x.px60 : x.close
          const pmod = x.pm[vi]
          if (!raw || !Number.isFinite(pmod)) return null
          const p = wgt * pmod + (1 - wgt) * x.pmk
          if (side === 'back') { const P = tickDown(raw); return p * (P - 1) * (1 - C) - (1 - p) >= thr ? { month: x.month, value: 0, actual: backActual(P, x.won) } : null }
          const P = tickUp(raw); return (1 - p) * (1 - C) - p * (P - 1) >= thr ? { month: x.month, value: 0, actual: layActual(P, x.won) } : null
        } })
    } })
  const F: Filter<DCItem>[] = [{ name: 'all', group: 'all', test: () => true }]
  for (const k of Object.keys(NAMES) as FSel['key'][]) F.push({ name: NAMES[k], group: 'sel', test: x => x.key === k })
  for (const cc of Array.from(new Set(items.map(i => i.country)))) F.push({ name: `country ${cc}`, group: 'country', test: x => x.country === cc })
  for (const [lo, hi] of [[1, 2], [2, 3], [3, 5], [5, 1000]]) F.push({ name: `priced ${lo} to ${hi === 1000 ? 'any' : hi}`, group: 'price', test: x => !!x.close && x.close >= lo && x.close < hi })
  const res = search(items, rules, F, cut, false)
  L.push(...resultsBlock('model rules (back or lay where the model disagrees with the price by 2%, 5% or 10%, alone or blended 50/50 with the market; an hour before or at kick-off; four model versions; with selection, country and price filters)', res.found, res.tested, false))
  return { lines: L, found: res.found }
}

// ------------------------------------------------------------------ tennis in play: fading or following big swings
// The free history has the last traded price every 2 minutes in play. A "swing" is when a player's
// chance jumps by 15 or 25 points between two readings (usually a break of serve). Bet a reading
// later, only if the swing is still there; then close after 4, 10 or 20 minutes or let it run.
type TSwing = { month: string; dropFav: boolean; size: number; minute: number; entry: number; exits: (number | null)[]; won: boolean }
const T_HOLDS = [4, 10, 20, 0]
function tennisSwings(d: HistDay): TSwing[] {
  const { markets, snaps } = expandHistory(d, 'tennis')
  const out: TSwing[] = []
  for (const m of markets) {
    if (!m.off_at || !m.winners?.length || m.runners.length !== 2) continue
    const off = Date.parse(m.off_at)
    const pts = (snaps.get(m.market_id) ?? []).filter(s => s.inplay).map(s => ({ t: Math.round((Date.parse(s.at) - off) / 60_000), px: new Map(s.runners.map(r => [r[0], r[5] as number])) }))
    const pre = (snaps.get(m.market_id) ?? []).filter(s => !s.inplay).pop()
    if (pts.length < 10 || !pre) continue
    const favId = [...pre.runners].sort((a, b) => (a[5] ?? 99) - (b[5] ?? 99))[0]?.[0]
    const seen = new Set<string>()
    for (let i = 1; i < pts.length - 1; i++) for (const r of m.runners) {
      const a = pts[i - 1].px.get(r.id), b = pts[i].px.get(r.id), c = pts[i + 1].px.get(r.id)
      if (!a || !b || !c) continue
      const drop = 1 / a - 1 / b                       // how far this player's chance fell
      for (const size of [0.15, 0.25]) {
        if (drop < size || 1 / a - 1 / c < size || seen.has(r.id + ':' + size)) continue   // still down a reading later
        seen.add(r.id + ':' + size)
        const tEntry = pts[i + 1].t
        const exitAt = (h: number) => { if (!h) return null; const q = pts.find(p => p.t >= tEntry + h); return q?.px.get(r.id) ?? null }
        out.push({ month: m.start_at.slice(0, 7), dropFav: r.id === favId, size, minute: pts[i].t, entry: c, exits: T_HOLDS.map(exitAt), won: m.winners.includes(r.id) })
      }
    }
  }
  return out
}
function tennisInPlay(sw: TSwing[], cut: string): { lines: string[]; found: Found[] } {
  const L = ['', '### Tennis in play: big swings', '']
  if (sw.length < 500) { L.push('Not enough tennis in-play history yet.'); return { lines: L, found: [] } }
  const rules: { name: string; make: (x: TSwing) => Bet | null }[] = []
  for (const size of [0.15, 0.25]) for (const side of ['back', 'lay'] as const) T_HOLDS.forEach((h, hi) => rules.push({
    name: `${side === 'back' ? 'Back' : 'Lay'} the player whose chance just fell ${size * 100}+ points, ${h ? `close after ${h} min` : 'let it run'}`,
    make: x => {
      if (x.size !== size) return null
      if (!h) return { month: x.month, value: 0, actual: side === 'back' ? backActual(tickDown(x.entry), x.won) : layActual(tickUp(x.entry), x.won) }
      const ex = x.exits[hi]
      return ex ? { month: x.month, value: 0, actual: hedge(side, x.entry, ex) } : { month: x.month, value: 0, actual: side === 'back' ? backActual(tickDown(x.entry), x.won) : layActual(tickUp(x.entry), x.won) }
    } }))
  const F: Filter<TSwing>[] = [{ name: 'all matches', group: 'all', test: () => true },
    { name: 'the pre-match favourite fell', group: 'fav', test: x => x.dropFav }, { name: 'the underdog fell', group: 'fav', test: x => !x.dropFav },
    { name: 'first 40 min', group: 'time', test: x => x.minute < 40 }, { name: '40 to 90 min', group: 'time', test: x => x.minute >= 40 && x.minute < 90 }, { name: 'after 90 min', group: 'time', test: x => x.minute >= 90 },
    { name: 'priced under 2.0 after the swing', group: 'price', test: x => x.entry < 2 }, { name: 'priced 2.0 to 4.0', group: 'price', test: x => x.entry >= 2 && x.entry < 4 }, { name: 'priced 4.0+', group: 'price', test: x => x.entry >= 4 }]
  const res = search(sw, rules, F, cut, false)
  L.push(`${sw.length.toLocaleString('en-GB')} swings found in the tennis history (a player's chance falling 15+ points between two readings, still down at the next one). Bets go on at the reading after the swing, one tick worse than the last trade.`, '')
  L.push(...resultsBlock('swing rules (back or lay the player who fell, close after 4, 10 or 20 minutes or let it run; by favourite, time in the match and price)', res.found, res.tested, false))
  return { lines: L, found: res.found }
}

// ------------------------------------------------------------------ your own recordings: real back and lay prices
// The recorder saves the best back and lay prices (delayed on the free key) for every GB and IE race.
// Signals use the middle of the back and lay prices, always a real price on the ladder (the tick
// halfway between them; with a one-tick gap, the back price), so a trade bouncing between the back
// and lay side doesn't look like a move. Trades never use it: they're priced at what was on offer.
// Trades are priced at what was really on offer: back at the best back, hedge at the best lay.
type RecSnap = { market_id: string; at: string; inplay?: boolean; runners: [number, number | null, number, number | null, number, number | null][] }
async function recordingsStudy(db: SupabaseClient): Promise<string[]> {
  const L = ['', '## Your own recordings (real back and lay prices)', '']
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
  const markets: { market_id: string; start_at: string; off_at: string | null; runners: { id: number; name: string; jockey?: string | null }[] | null; winners: number[] | null; removed: number[] | null; bsp: Record<string, number> | null; archived_at: string | null }[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db.from('bf_markets').select('market_id, start_at, off_at, runners, winners, removed, bsp, archived_at').eq('sport', 'racing').not('status', 'is', null).not('off_at', 'is', null).gte('start_at', since).order('start_at').range(i, i + 999)
    if (error) throw new Error(error.message)
    markets.push(...((data ?? []) as typeof markets))
    if (!data || data.length < 1000) break
  }
  if (markets.length < 50) { L.push(`Only ${markets.length} settled races recorded so far; this section fills in as the recorder builds up.`); return L }
  // snapshots: from the database, or the day's archive file once moved there
  const byDay = new Map<string, typeof markets>()
  for (const m of markets) { const d = m.start_at.slice(0, 10); byDay.set(d, [...(byDay.get(d) ?? []), m]) }
  type Mid = { mid: number; back: number | null; lay: number | null }
  const fade: { month: string; ret: number }[] = [], support: { group: string; jockey: string; ret: number; won: boolean }[] = []
  for (const [day, ms] of byDay) {
    const snaps = new Map<string, RecSnap[]>()
    const archived = ms.filter(m => m.archived_at)
    if (archived.length) {
      const { data } = await db.storage.from('betfair-archive').download(`${day}.json.gz`)
      if (data) { const j = JSON.parse(zlib.gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as { snaps: RecSnap[] }; for (const sn of j.snaps) snaps.set(sn.market_id, [...(snaps.get(sn.market_id) ?? []), sn]) }
    }
    const live = ms.filter(m => !m.archived_at).map(m => m.market_id)
    for (let i = 0; i < live.length; i += 10) {
      for (let p = 0; ; p += 1000) {
        const { data } = await db.from('bf_snaps').select('market_id, at, inplay, runners').in('market_id', live.slice(i, i + 10)).order('market_id').order('at').range(p, p + 999)
        for (const sn of (data ?? []) as RecSnap[]) snaps.set(sn.market_id, [...(snaps.get(sn.market_id) ?? []), sn])
        if (!data || data.length < 1000) break
      }
    }
    for (const m of ms) {
      const off = Date.parse(m.off_at!)
      const byMin = new Map<number, Map<number, Mid>>()
      for (const sn of snaps.get(m.market_id) ?? []) {
        if (sn.inplay) continue
        const mins = Math.round((off - Date.parse(sn.at)) / 60_000)
        if (mins < 0 || mins > 75) continue
        byMin.set(mins, new Map(sn.runners.map(r => [r[0], { mid: r[1] && r[3] ? ladderMid(r[1], r[3]) : (r[5] ?? 0), back: r[1], lay: r[3] }] as const).filter(([, v]) => v.mid > 1)))
      }
      const atOff = byMin.get(0) ?? byMin.get(1)
      if (!atOff) continue
      // fade-drift on the midpoint: 15+ ticks in 5 min, still out a minute later; back at the best back, hedge 10 min later at the best lay
      const used = new Set<number>()
      for (let t = 60; t >= 4; t--) {
        const now = byMin.get(t), before = byMin.get(t + 5), next = byMin.get(t - 1)
        if (!now || !before || !next) continue
        for (const [id, v] of [...now.entries()].sort((a, b) => a[1].mid - b[1].mid).slice(0, 6)) {
          const was = before.get(id), nx = next.get(id)
          if (used.has(id) || !was || !nx?.back) continue
          if (ticksBetween(was.mid, v.mid) < 15 || ticksBetween(was.mid, nx.mid) < 15) continue
          used.add(id)
          const exit = (byMin.get(t - 11) ?? atOff).get(id)?.lay
          if (!exit) continue
          const g = nx.back / exit - 1
          fade.push({ month: m.start_at.slice(0, 7), ret: g > 0 ? g * (1 - C) : g })
        }
      }
      // jockey plus market support: did the horse shorten or drift (midpoint) in the last 5 minutes? Back at SP.
      const five = byMin.get(5)
      if (five && m.bsp && m.winners) for (const r of m.runners ?? []) {
        if (m.removed?.includes(r.id)) continue
        const a = five.get(r.id)?.mid, b = atOff.get(r.id)?.mid, sp = m.bsp[String(r.id)]
        if (!a || !b || !sp) continue
        const ch = (1 / b) / (1 / a) - 1
        const won = m.winners.includes(r.id)
        support.push({ group: ch >= 0.05 ? 'Shortened 5%+ in the last 5 min' : ch <= -0.05 ? 'Drifted 5%+ in the last 5 min' : 'Steady', jockey: r.jockey ?? '?', ret: backActual(sp, won), won })
      }
    }
  }
  L.push(`${markets.length.toLocaleString('en-GB')} settled races recorded since ${markets[0].start_at.slice(0, 10)}. Signals use the middle of the back and lay prices, always a real ladder price; trades use the real best back and lay on offer (delayed on the free key).`, '')
  const fr = fade.map(f => f.ret)
  L.push('**Fade-drift on your recordings** (the scout\'s best history system, checked on prices you could really take):', '',
    fr.length ? `${fr.length} trades, return per £1 ${pct(avg(fr), 2)}, won ${Math.round(fr.filter(x => x > 0).length / fr.length * 100)}%, p ${pfmt(pOf(tStat(fr)))}.${fr.length < 100 ? ' Too few trades to judge yet.' : ''}` : 'No signals yet.', '')
  const groups = ['Shortened 5%+ in the last 5 min', 'Steady', 'Drifted 5%+ in the last 5 min']
  L.push('**Market support in the last 5 minutes** (back at Betfair SP):', '', table(['Group', 'Runners', 'Won', 'Return at SP', 'p'], groups.map(g => {
    const xs = support.filter(x => x.group === g).map(x => x.ret)
    return [g, xs.length.toLocaleString('en-GB'), xs.length ? Math.round(support.filter(x => x.group === g && x.won).length / xs.length * 100) + '%' : '—', xs.length ? pct(avg(xs), 1) : '—', xs.length > 2 ? pfmt(pOf(tStat(xs))) : '—']
  })), '')
  // jockeys with enough rides, by support
  const jk = new Map<string, number[]>()
  for (const x of support) if (x.jockey !== '?' && x.group !== 'Steady') { const k = `${x.jockey} · ${x.group.startsWith('Short') ? 'shortened' : 'drifted'}`; jk.set(k, [...(jk.get(k) ?? []), x.ret]) }
  const jrows = [...jk.entries()].filter(([, v]) => v.length >= 20).map(([k, v]) => ({ k, n: v.length, roi: avg(v), p: pOf(tStat(v)) })).sort((a, b) => a.p - b.p).slice(0, 12)
  L.push('**Jockey plus market support** (jockeys with 20+ such rides; back at SP):', '',
    jrows.length ? table(['Jockey · last 5 min', 'Rides', 'Return at SP', 'p'], jrows.map(r => [r.k, r.n, pct(r.roi, 1), pfmt(r.p)])) : 'Not enough rides per jockey yet: this needs a few months of recordings.', '')
  L.push('These figures have no separate test period yet, so treat them as early readings. Once there are a few months of recordings, a promising result here gets the same checks as the history systems.', '')
  return L
}

function systemsSection(sport: string, found: Found[], tested: number): string[] {
  return ['', `### ${sport === 'racing' ? '4' : 'Systems'}. Systems the scout found (${sport}, back or lay and let it run)`, '',
    ...resultsBlock('rules (timing, back or lay, rank or price band, and up to two filters together)', found, tested, false)]
}

function resultsBlock(what: string, found: Found[], tested: number, trading: boolean): string[] {
  const passed = found.filter(f => f.passed)
  const tiny = found.filter(f => f.pAll < ALPHA).length
  const L = [`Tried ${tested.toLocaleString('en-GB')} ${what}. ${tiny} had p below ${ALPHA} on all the months; by luck alone you'd expect about ${Math.max(0, Math.round(tested * ALPHA))} from this many tries. **${passed.length} passed every check**: p below ${ALPHA} overall, p below 0.05 on the later months alone (data it wasn't found on), q below 0.10 (unlikely to be a lucky one out of all the tries), and at least 60% of months up.`, '']
  const show = found.slice(0, 20)
  if (show.length) L.push(table(['Rule', 'Bets', trading ? 'Return' : 'ROI', 'p (all)', 'Later: bets', trading ? 'Return' : 'ROI', 'p (later)', 'q', 'Months up', 'Passed'],
    show.map(f => [f.rule, f.all.n, pct(f.all.roi, 2), pfmt(f.pAll), f.test.n, pct(f.test.roi, 2), pfmt(f.pTest), fx(Math.min(1, f.q), 3), `${f.all.monthsUp}/${f.all.months}`, f.passed ? '✓' : '✗'])), '')
  else L.push('Nothing was profitable enough to list.', '')
  return L
}

if (process.env.SCOUT_NO_MAIN !== '1') main().then(() => process.exit(0), e => { log.error('Scout stopped:', errText(e)); process.exit(1) })

export { tennisSwings, tennisInPlay }
