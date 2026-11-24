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
import { createClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { installGuard } from './guard'
import { errText, log } from './log'
import { HISTORY_BUCKET, expandHistory, historyPath, type HistDay, type HistIndex } from '../../lib/betfair/history'
import { pickPath, OFF } from '../../lib/betfair/insights'
import { tickDown, tickUp, ticksBetween } from '../../lib/betfair/ticks'

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
}
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
async function forEachDay(store: ReturnType<ReturnType<typeof createClient>['storage']['from']>, sport: 'racing' | 'football', fn: (d: HistDay) => void): Promise<number> {
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
      for (const r of sps) {
        const px = R_OFFSETS.map(o => priceAt(o, r.id)), rank = R_OFFSETS.map(o => ranks[o].get(r.id) ?? 99)
        rows.push({ race: m.market_id, month: m.start_at.slice(0, 7), day: '', venue: '', rt: m.race_type ?? 'Unknown', hcap: /hcap|handicap/i.test(m.market_name ?? ''),
          furlongs: furlongs(m.market_name), n: sps.length, hour: start.getUTCHours(), px, rank, sp: r.sp, p: (1 / r.sp) / book, won: m.winners.includes(r.id) })
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
// knownAt: seconds before the start when the filter's information is available; a rule
// that bets earlier than that can't use it (that would be using the future).
type Cond = { name: string; test: (x: Runner) => boolean; knownAt?: number }
type Found = { rule: string; train: Summary; test: Summary; all: Summary; passed: boolean }

function search<T extends { month: string }>(items: T[], rules: { name: string; at?: number; make: (x: T) => Bet | null }[], conds: { name: string; test: (x: T) => boolean; knownAt?: number }[], cut: string) {
  const found: Found[] = []
  let tested = 0
  for (const r of rules) {
    for (const c of conds) {
      if (r.at !== undefined && c.knownAt !== undefined && r.at > c.knownAt) continue
      tested++
      const bets: Bet[] = []
      for (const x of items) { if (!c.test(x)) continue; const b = r.make(x); if (b) bets.push(b) }
      const train = bets.filter(b => b.month < cut), test = bets.filter(b => b.month >= cut)
      if (train.length < 150 || test.length < 50) continue
      const s = summarise(train)
      if (s.roi <= 0 || s.t < 2 || s.value <= 0) continue
      const t = summarise(test), a = summarise(bets)
      // passes: profitable on the later months too, the price also beats the efficient price there,
      // and most months were winners
      // and, over everything, the price beat the efficient one clearly (value over 1%, and steady enough to
      // be more than noise: t of the value at least 2)
      const passed = s.t >= 2.5 && t.roi > 0 && t.t > 1.5 && t.value > 0 && a.value > 0.01 && a.vt >= 2 && a.monthsUp / Math.max(1, a.months) >= 0.6
      found.push({ rule: `${r.name} · ${c.name}`, train: s, test: t, all: a, passed })
    }
  }
  found.sort((a, b) => b.train.t - a.train.t)
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
  L.push(`Commission ${C * 100}% on winnings. "Value" = what each bet is worth if the efficient price (Betfair SP for racing, the last price before kick-off for football) is the true chance. "Actual" = the real result. "Cautious" assumes you got one tick worse than the last traded price (the free history has no back/lay prices).`, '')

  // ================================================================ racing
  log.info('Scout: loading racing history')
  const runners: Runner[] = []
  const signals = new Map<string, Ev[]>()
  const rdayCount = await forEachDay(store, 'racing', d => { for (const r of racingRunners([d])) runners.push(r); collectSignals([d], signals) })
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
  const conds: Cond[] = [{ name: 'all races', test: () => true }]
  for (const rt of Array.from(new Set(runners.map(r => r.rt)))) conds.push({ name: rt, test: x => x.rt === rt })
  conds.push({ name: 'handicaps', test: x => x.hcap }, { name: 'non-handicaps', test: x => !x.hcap })
  for (const [lo, hi] of [[2, 7], [8, 11], [12, 16], [17, 99]]) conds.push({ name: `${lo}${hi === 99 ? '+' : ` to ${hi}`} runners`, test: x => x.n >= lo && x.n <= hi })
  for (const g of mg) conds.push({ name: g.toLowerCase(), test: x => move(x) === g, knownAt: 1200 })
  for (const h of [[0, 14], [14, 17], [17, 24]]) conds.push({ name: h[0] === 0 ? 'before 2pm' : h[0] === 14 ? '2pm to 5pm' : 'after 5pm', test: x => x.hour >= h[0] && x.hour < h[1] })
  const rules: { name: string; at?: number; make: (x: Runner) => Bet | null }[] = []
  for (const o of R_OFFSETS) for (const side of ['Back', 'Lay'] as const) {
    for (const g of ['Favourite', '2nd fav', '3rd fav', '4th to 6th']) rules.push({ name: `${side} ${g.toLowerCase()} ${o / 60} min out (cautious price)`, at: o, make: x => rankName(x.rank[ri(o)]) === g ? (side === 'Back' ? backAt(o, true) : layAt(o, true))(x) : null })
    for (const pb of ['under 2.0', '2.0 to 3.0', '3.0 to 4.0', '4.0 to 6.0', '6.0 to 10', '10 to 20']) rules.push({ name: `${side} any runner priced ${pb} ${o / 60} min out (cautious price)`, at: o, make: x => pband(x.px[ri(o)]) === pb ? (side === 'Back' ? backAt(o, true) : layAt(o, true))(x) : null })
  }
  const rs = search(runners, rules, conds, cut)
  L.push(...systemsSection('racing', rs.found, rs.tested))
  const pd = priceDiscovery(signals, cut)
  L.push(...pd.lines)

  // ================================================================ football
  log.info('Scout: loading football history')
  const sels: Sel[] = []
  const fdayCount = await forEachDay(store, 'football', d => { for (const x of footballSelections([d])) sels.push(x) })
  const fdays = { length: fdayCount }
  let footballFound: Found[] = []
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
    const fconds: { name: string; test: (s: Sel) => boolean; knownAt?: number }[] = [{ name: 'all matches', test: () => true }]
    for (const cc of Array.from(new Set(sels.map(s => s.country)))) fconds.push({ name: `country ${cc}`, test: s => s.country === cc })
    const fmove = (s: Sel) => { const a = s.px[fi(10800)] ?? s.px[fi(7200)], b = s.px[fi(3600)]; if (!a || !b) return null; const ch = (1 / b) / (1 / a) - 1; return ch >= 0.05 ? 'shortened' : ch <= -0.05 ? 'drifted' : 'steady' }
    for (const g of ['shortened', 'drifted', 'steady']) fconds.push({ name: `${g} from 3h to 1h out`, test: s => fmove(s) === g, knownAt: 3600 })
    for (const [lo, hi] of [[1, 1.7], [1.7, 2.2], [2.2, 3], [3, 5], [5, 1000]]) fconds.push({ name: `priced ${lo} to ${hi === 1000 ? 'any' : hi} an hour out`, test: s => !!s.px[fi(3600)] && s.px[fi(3600)]! >= lo && s.px[fi(3600)]! < hi, knownAt: 3600 })
    const frules: { name: string; at?: number; make: (s: Sel) => Bet | null }[] = []
    for (const type of ['OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE', 'MATCH_ODDS']) for (const sd of Array.from(new Set(sels.filter(s => s.type === type).map(s => s.side)))) for (const o of F_OFFSETS) for (const side of ['Back', 'Lay'] as const)
      frules.push({ name: `${side} ${sd} (${type === 'OVER_UNDER_25' ? 'O/U 2.5' : type === 'BOTH_TEAMS_TO_SCORE' ? 'BTTS' : 'Match Odds'}) ${o / 60} min out (cautious price)`, at: o, make: s => s.type === type && s.side === sd ? (side === 'Back' ? fBack(o, true) : fLay(o, true))(s) : null })
    const fs = search(sels, frules, fconds, fcut)
    footballFound = fs.found
    L.push(...systemsSection('football', fs.found, fs.tested))
  }

  // ================================================================ ledger: systems that passed, re-checked every run
  const { data: ledgerFile } = await store.download(`${REPORT_DIR}/ledger.json`)
  const ledger: Record<string, { first: string; runs: { date: string; passed: boolean; roi: number; n: number }[] }> = ledgerFile ? JSON.parse(await ledgerFile.text()) : {}
  const passedNow = new Map<string, Found>()
  for (const f of rs.found) if (f.passed) passedNow.set('racing: ' + f.rule, f)
  for (const f of pd.found) if (f.passed) passedNow.set('racing trading: ' + f.rule, f)
  for (const f of footballFound) if (f.passed) passedNow.set('football: ' + f.rule, f)
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

// ------------------------------------------------------------------ price discovery: trading the moves
// Minute-by-minute last traded prices in the last hour. A "signal" fires the first time
// in a race that a runner (top six) moves by at least `th` ticks over `k` minutes. Then:
//   follow  back a steamer / lay a drifter, and close (hedge) h minutes later or at the off
//   fade    the opposite: bet on the move overshooting and coming back
//   other   when the favourite drifts (or steams), back (or lay) the 2nd favourite:
//           the money leaving one horse has to go somewhere
// Prices: get in at the last traded price (back) or one tick above (lay), and get out one
// tick worse, so every trade pays a spread. Per £1 hedged stake, after commission.
type Ev = { month: string; rt: string; n: number; kind: 'steam' | 'drift' | 'favDrift' | 'favSteam'; ticks: number; entry: number; exits: (number | null)[] }   // exits: one per HOLDS
const HOLDS = [2, 5, 10, 0]                    // minutes; 0 = at the off
const holdName = (h: number) => h ? `close after ${h} min` : 'close at the off'

function hedge(side: 'back' | 'lay', entry: number, exit: number) {
  const g = side === 'back' ? entry / tickUp(exit) - 1 : 1 - tickUp(entry) / exit
  return g > 0 ? g * (1 - C) : g
}

// Adds one or more days' signals to groups (key: k|th|kind).
function collectSignals(days: HistDay[], groups: Map<string, Ev[]>) {
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
            groups.get(key)!.push({ month, rt, n, kind, ticks: mv, entry, exits: exitsFor(id, t - 1) })
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
                if (e2) groups.get(key2)!.push({ month, rt, n, kind: k2, ticks: mv, entry: e2, exits: exitsFor(order[1][0], t - 1) })
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
  const L: string[] = ['', '### 5. Trading the price discovery (hedged, minute by minute)', '',
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
  const found: Found[] = []
  let tested = 0
  for (const [key, evs] of groups) {
    const [k, th, kind] = key.split('|')
    for (const a of actions.filter(x => x.kind === kind)) for (const h of HOLDS) for (const f of filters) {
      tested++
      const bets = evs.filter(f.test).map(e => { const x = e.exits[HOLDS.indexOf(h)]; return x ? { month: e.month, value: 0, actual: hedge(a.side, e.entry, x) } : null }).filter((b): b is Bet => !!b)
      const train = bets.filter(b => b.month < cut), test = bets.filter(b => b.month >= cut)
      if (train.length < 150 || test.length < 50) continue
      const s = summarise(train)
      if (s.roi <= 0 || s.t < 2) continue
      const t = summarise(test), all = summarise(bets)
      const passed = s.t >= 2.5 && t.roi > 0 && t.t > 1.5 && all.roi > 0.005 && all.monthsUp / Math.max(1, all.months) >= 0.6
      found.push({ rule: `${a.name} after ${th}+ ticks in ${k} min, ${holdName(h)} · ${f.name}`, train: s, test: t, all, passed })
    }
  }
  found.sort((x, y) => (Number(y.passed) - Number(x.passed)) || y.train.t - x.train.t)
  const passed = found.filter(f => f.passed)
  L.push(`Searched ${tested.toLocaleString('en-GB')} trading rules (move speed, size, follow or fade, the other-horse trades, exit time, race filters). ${found.length} were profitable on the earlier months with t ≥ 2 (about ${Math.round(tested * 0.023)} would be by luck). **${passed.length} passed every check** (t ≥ 2.5 earlier, profitable later with t over 1.5, at least 60% of months up).`, '')
  if (found.length) L.push(table(['Rule', 'Earlier: trades', 'Return', 't', 'Later: trades', 'Return', 't', 'Months up', 'Passed'],
    found.slice(0, 15).map(f => [f.rule, f.train.n, pct(f.train.roi, 2), fx(f.train.t, 1), f.test.n, pct(f.test.roi, 2), fx(f.test.t, 1), `${f.all.monthsUp}/${f.all.months}`, f.passed ? '✓' : '✗'])), '')
  L.push('Not tested yet, because the data doesn\'t have it: weight of money across the full ladder, and the money traded on each runner. Betfair\'s free history has only the last traded price, and the free live key gives no traded volume. See the Setup tab for what would add them.', '')
  return { lines: L, found }
}

function systemsSection(sport: string, found: Found[], tested: number): string[] {
  const passed = found.filter(f => f.passed)
  const L = ['', `### ${sport === 'racing' ? '4' : 'Systems'}. Systems the scout found (${sport})`, '']
  L.push(`Tried ${tested.toLocaleString('en-GB')} rules. ${found.length} were profitable on the earlier months with t ≥ 2 and a price better than the efficient one (about ${Math.round(tested * 0.023)} would do that by luck alone). **${passed.length} passed every check**: t ≥ 2.5 on the earlier months, still profitable on the later months (t over 1.5), the price beating the efficient one by over 1% (and steadily, t ≥ 2), and at least 60% of months up.`, '')
  const show = [...passed, ...found.filter(f => !f.passed)].slice(0, 15)
  if (show.length) L.push(table(['Rule', 'Earlier: bets', 'ROI', 't', 'Later: bets', 'ROI', 'Value', 'Months up', 'Passed'],
    show.map(f => [f.rule, f.train.n, pct(f.train.roi), fx(f.train.t, 1), f.test.n, pct(f.test.roi), pct(f.test.value), `${f.all.monthsUp}/${f.all.months}`, f.passed ? '✓' : '✗'])))
  else L.push('Nothing cleared the first hurdle.')
  return L
}

main().then(() => process.exit(0), e => { log.error('Scout stopped:', errText(e)); process.exit(1) })
