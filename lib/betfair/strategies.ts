// ============================================================
// Paper-test strategies for football, built from the Sports Hacker ideas.
//
//   dc     Cross-market value. Fit a Dixon-Coles score grid to match odds +
//          over/under 2.5, then look for other goals / correct-score prices
//          that disagree with the grid by more than costs.
//   bands  Favourite vs longshot. Back every match-odds selection for a flat
//          stake and compare returns by price band.
//   form   "Bouncebackability". Back the team that has recently under-
//          performed the market's expectations, with the draw covered.
//
// Pure functions: no database, no network. PAPER ONLY: nothing here (or
// anywhere in lib/betfair) can place a real bet.
// ============================================================

import { calibrate, pAway, pDraw, pHome, pOver, pScore, pUnder, scoreGrid } from './football'

export const STRAT = {
  stake: 10,            // flat paper stake per bet (£)
  commission: 0.05,     // set to your Betfair market base rate
  minSize: 10,          // £ that must be available at the price we take
  minMatched: 20_000,   // match odds must have this much matched before we trust the prices
  maxSpread: 0.08,      // max (lay/back - 1) on a price used for calibration
  dcMinEdge: 0.03,      // dc: expected value needed after commission, per £1 risked
  dcMaxPrice: 10,       // dc: ignore prices above this (long prices need thousands of bets to judge)
  dcMaxFitErr: 1e-5,    // dc: skip the match if the grid can't reproduce the market
  formGames: 6,         // form: games in the moving average
  formMinGap: 0.5,      // form: min gap between the two teams' averages (points per game)
  targets: { dc: 500, bands: 400, form: 200 },   // settled bets (dc), bets per band (bands), matches (form)
} as const

export type StrategyId = 'dc' | 'bands' | 'form'
export type MarketType = 'MATCH_ODDS' | 'OVER_UNDER_15' | 'OVER_UNDER_25' | 'OVER_UNDER_35' | 'CORRECT_SCORE'
export const MARKET_TYPES: MarketType[] = ['MATCH_ODDS', 'OVER_UNDER_15', 'OVER_UNDER_25', 'OVER_UNDER_35', 'CORRECT_SCORE']

export type Sel = { id: number; name: string; back: number | null; backSize: number; lay: number | null; laySize: number }
export type MarketSnap = { marketId: string; type: MarketType; matched: number; runners: Sel[] }
export type MatchSnap = {
  eventId: string; name: string; kickoff: string
  home: { id: number; name: string }; away: { id: number; name: string }
  markets: Partial<Record<MarketType, MarketSnap>>
}

export type PaperBet = {
  strategy: StrategyId; event_id: string; event: string; market_id: string; market_type: MarketType
  selection_id: number; selection: string; side: 'BACK' | 'LAY'; price: number; stake: number; risk: number
  model_prob: number | null; edge: number | null; band: string | null; placed_at: string
}
export type SettledBet = PaperBet & { status: 'won' | 'lost' | 'void'; pl: number }

export type Pending = { marketId: string; homeId: number; awayId: number; drawId: number; home: string; away: string; exHome: number; exAway: number; kickoff: string }
export type Form = Record<string, { name: string; diffs: number[]; last: string }>
export type MarketResult = { winners: number[]; removed: number[] }

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 1e4) / 1e4

// ---------------------------------------------------------------- reading prices
// Mid probability of one runner, or null if the quote is missing or too wide to trust.
function mid(s: Sel | undefined): number | null {
  if (!s || !s.back || !s.lay || s.lay / s.back - 1 > STRAT.maxSpread) return null
  return (1 / s.back + 1 / s.lay) / 2
}
// Remove the margin: scale a market's mids so they sum to 1.
function fair(ps: (number | null)[]): number[] | null {
  if (ps.some(p => p === null)) return null
  const sum = (ps as number[]).reduce((a, b) => a + b, 0)
  return sum > 0.9 && sum < 1.1 ? (ps as number[]).map(p => p / sum) : null
}
const byName = (m: MarketSnap | undefined, re: RegExp) => m?.runners.find(r => re.test(r.name))

export function matchOddsProbs(snap: MatchSnap): { home: number; draw: number; away: number; drawSel: Sel; homeSel: Sel; awaySel: Sel } | null {
  const mo = snap.markets.MATCH_ODDS
  if (!mo || mo.runners.length !== 3) return null
  const homeSel = mo.runners.find(r => r.id === snap.home.id), awaySel = mo.runners.find(r => r.id === snap.away.id)
  const drawSel = mo.runners.find(r => r.id !== snap.home.id && r.id !== snap.away.id)
  if (!homeSel || !awaySel || !drawSel) return null
  const p = fair([mid(homeSel), mid(drawSel), mid(awaySel)])
  return p ? { home: p[0], draw: p[1], away: p[2], homeSel, awaySel, drawSel } : null
}

export const bandOf = (price: number) => (price < 2 ? 'odds-on' : price <= 5 ? 'middle' : 'longshot')

// ---------------------------------------------------------------- deciding bets for one match
export function evaluateMatch(snap: MatchSnap, form: Form, at: string): { bets: PaperBet[]; pending: Pending | null; skipped?: string } {
  const mo = snap.markets.MATCH_ODDS
  if (!mo) return { bets: [], pending: null, skipped: 'no match odds market' }
  if (mo.matched < STRAT.minMatched) return { bets: [], pending: null, skipped: 'match odds too thin' }
  const p = matchOddsProbs(snap)
  if (!p) return { bets: [], pending: null, skipped: 'match odds prices missing or too wide' }

  const bets: PaperBet[] = []
  const base = { event_id: snap.eventId, event: snap.name, placed_at: at }
  const back = (strategy: StrategyId, m: MarketSnap, s: Sel, stake: number, extra: Partial<PaperBet> = {}) =>
    bets.push({ ...base, strategy, market_id: m.marketId, market_type: m.type, selection_id: s.id, selection: s.name, side: 'BACK',
      price: s.back as number, stake: r2(stake), risk: r2(stake), model_prob: null, edge: null, band: null, ...extra })
  const canBack = (s: Sel | undefined): s is Sel => !!s && !!s.back && s.backSize >= STRAT.minSize
  const canLay = (s: Sel | undefined): s is Sel => !!s && !!s.lay && s.laySize >= STRAT.minSize && s.lay <= STRAT.dcMaxPrice

  // --- bands: back everything in match odds, tagged by price band
  for (const s of [p.homeSel, p.drawSel, p.awaySel]) if (canBack(s)) back('bands', mo, s, STRAT.stake, { band: bandOf(s.back as number) })

  // --- dc: fit the grid to match odds + over/under 2.5, then price the rest
  const ou25 = snap.markets.OVER_UNDER_25
  const g25 = fair([mid(byName(ou25, /^over/i)), mid(byName(ou25, /^under/i))])
  if (g25) {
    const fit = calibrate({ home: p.home, draw: p.draw, away: p.away, over25: g25[0], under25: g25[1] })
    if (fit.err <= STRAT.dcMaxFitErr) {
      const grid = scoreGrid(fit.lx, fit.ly, fit.rho)
      const c = STRAT.commission
      const consider = (m: MarketSnap | undefined, probOf: (s: Sel) => number | null) => {
        if (!m) return
        let best: PaperBet | null = null
        for (const s of m.runners) {
          const q = probOf(s)
          if (q === null || q <= 0.005 || q >= 0.995) continue
          if (canBack(s) && (s.back as number) <= STRAT.dcMaxPrice) {
            const ev = q * ((s.back as number) - 1) * (1 - c) - (1 - q)          // per £1 staked
            if (ev >= STRAT.dcMinEdge && (!best || ev > (best.edge as number)))
              best = { ...base, strategy: 'dc', market_id: m.marketId, market_type: m.type, selection_id: s.id, selection: s.name, side: 'BACK',
                price: s.back as number, stake: STRAT.stake, risk: STRAT.stake, model_prob: r4(q), edge: r4(ev), band: null }
          }
          if (canLay(s)) {
            const liab = (s.lay as number) - 1
            const ev = ((1 - q) * (1 - c) - q * liab) / liab                      // per £1 of liability
            if (ev >= STRAT.dcMinEdge && (!best || ev > (best.edge as number)))
              best = { ...base, strategy: 'dc', market_id: m.marketId, market_type: m.type, selection_id: s.id, selection: s.name, side: 'LAY',
                price: s.lay as number, stake: STRAT.stake, risk: r2(STRAT.stake * liab), model_prob: r4(q), edge: r4(ev), band: null }
          }
        }
        if (best) bets.push(best)   // at most one bet per market, the biggest edge
      }
      const goals = (line: number) => (s: Sel) => (/^over/i.test(s.name) ? pOver(grid, line) : /^under/i.test(s.name) ? pUnder(grid, line) : null)
      consider(snap.markets.OVER_UNDER_15, goals(1.5))
      consider(snap.markets.OVER_UNDER_35, goals(3.5))
      consider(snap.markets.CORRECT_SCORE, s => { const m = /^(\d)\s*-\s*(\d)$/.exec(s.name); return m ? pScore(grid, +m[1], +m[2]) : null })
    }
  }

  // --- form: back the recent under-performer, draw covered
  const fh = form[snap.home.id], fa = form[snap.away.id]
  if (fh && fa && fh.diffs.length >= STRAT.formGames && fa.diffs.length >= STRAT.formGames) {
    const avg = (d: number[]) => d.slice(-STRAT.formGames).reduce((a, b) => a + b, 0) / STRAT.formGames
    const gap = avg(fh.diffs) - avg(fa.diffs)
    if (Math.abs(gap) >= STRAT.formMinGap) {
      const pick = gap < 0 ? p.homeSel : p.awaySel            // the lower average = the under-performer
      if (canBack(pick) && canBack(p.drawSel)) {
        back('form', mo, pick, STRAT.stake, { edge: r4(Math.abs(gap)) })
        back('form', mo, p.drawSel, STRAT.stake / ((p.drawSel.back as number) - 1), { band: 'draw cover' })
      }
    }
  }

  const pending: Pending = { marketId: mo.marketId, homeId: snap.home.id, awayId: snap.away.id, drawId: p.drawSel.id, home: snap.home.name, away: snap.away.name,
    exHome: 3 * p.home + p.draw, exAway: 3 * p.away + p.draw, kickoff: snap.kickoff }
  return { bets, pending }
}

// ---------------------------------------------------------------- settling
export function settleBet(b: PaperBet, res: MarketResult): SettledBet {
  if (!res.winners.length || res.removed.includes(b.selection_id)) return { ...b, status: 'void', pl: 0 }
  const won = res.winners.includes(b.selection_id)
  if (b.side === 'BACK') return { ...b, status: won ? 'won' : 'lost', pl: r2(won ? b.stake * (b.price - 1) : -b.stake) }
  return { ...b, status: won ? 'lost' : 'won', pl: r2(won ? -b.stake * (b.price - 1) : b.stake) }
}

// Record how each team did against what the market expected (3/1/0 points minus expected points).
export function updateForm(form: Form, pend: Pending, res: MarketResult) {
  if (!res.winners.length) return
  const w = res.winners[0]
  const pts = w === pend.homeId ? [3, 0] : w === pend.awayId ? [0, 3] : [1, 1]
  const push = (id: number, name: string, diff: number) => {
    const f = (form[id] ??= { name, diffs: [], last: pend.kickoff })
    f.diffs = [...f.diffs, r4(diff)].slice(-STRAT.formGames); f.last = pend.kickoff; f.name = name
  }
  push(pend.homeId, pend.home, pts[0] - pend.exHome)
  push(pend.awayId, pend.away, pts[1] - pend.exAway)
}

// ---------------------------------------------------------------- scoring the test
export type Line = { n: number; risked: number; net: number; roi: number; t: number; se: number; wins: number }
export type Verdict = 'collecting' | 'pass' | 'fail' | 'inconclusive'
export type StratStats = { open: number; total: Line; target: number; progress: number; verdict: Verdict; why: string; groups: Record<string, Line> }

export type Row = Pick<PaperBet, 'strategy' | 'market_id' | 'market_type' | 'side' | 'band' | 'risk' | 'price'> & { pl: number | null; status: string }

function line(units: { risk: number; net: number }[]): Line {
  const n = units.length
  if (!n) return { n: 0, risked: 0, net: 0, roi: 0, t: 0, se: 0, wins: 0 }
  const risked = units.reduce((s, u) => s + u.risk, 0), net = units.reduce((s, u) => s + u.net, 0)
  const rets = units.map(u => u.net / u.risk), mean = rets.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)) : 0
  const se = sd / Math.sqrt(n)
  return { n, risked: r2(risked), net: r2(net), roi: risked ? net / risked : 0, t: se > 0 ? mean / se : 0, se, wins: units.filter(u => u.net > 0).length }
}
const netOf = (pl: number) => (pl > 0 ? pl * (1 - STRAT.commission) : pl)   // Betfair charges commission on winnings only

export function scoreStrategies(rows: Row[]): Record<StrategyId, StratStats> {
  const done = rows.filter(r => r.status === 'won' || r.status === 'lost')
  const open = (id: StrategyId) => rows.filter(r => r.strategy === id && r.status === 'open').length
  const pct = (x: number) => (x * 100).toFixed(1) + '%'

  // dc: each bet is its own unit
  const dcRows = done.filter(r => r.strategy === 'dc')
  const dcUnits = (rs: Row[]) => rs.map(r => ({ risk: r.risk, net: netOf(r.pl ?? 0) }))
  const dcTotal = line(dcUnits(dcRows))
  const dcGroups: Record<string, Line> = {}
  for (const [k, label] of [['OVER_UNDER_15', 'Over/under 1.5'], ['OVER_UNDER_35', 'Over/under 3.5'], ['CORRECT_SCORE', 'Correct score']] as const)
    dcGroups[label] = line(dcUnits(dcRows.filter(r => r.market_type === k)))

  // bands: each selection is its own unit, compared across price bands. The comparison is made
  // BEFORE commission: commission is a share of winnings, which costs more per pound staked at
  // long prices, so after-commission returns would show a favourite-longshot gap even in a
  // perfectly fair market.
  const bRows = done.filter(r => r.strategy === 'bands')
  // The margin of error here comes from the prices, not from the sample: a back bet at price o
  // on a fairly priced selection has return variance (o - 1). Sample variance misleads for
  // longshots, because a run with few winners looks both worse and (falsely) more certain.
  const gross = (rs: Row[]): Line => {
    const l = line(rs.map(r => ({ risk: r.risk, net: r.pl ?? 0 })))
    if (!l.n) return l
    const se = Math.sqrt(rs.reduce((a, r) => a + Math.max(r.price - 1, 0), 0)) / l.n
    return { ...l, se, t: se > 0 ? l.roi / se : 0 }
  }
  const bGroups: Record<string, Line> = {}
  for (const band of ['odds-on', 'middle', 'longshot']) bGroups[band] = gross(bRows.filter(r => r.band === band))
  const fav = bGroups['odds-on'], dog = bGroups['longshot']
  const favNet = line(dcUnits(bRows.filter(r => r.band === 'odds-on')))

  // form: the win bet and its draw cover settle together, so the unit is the match
  const byMarket = new Map<string, Row[]>()
  for (const r of done.filter(x => x.strategy === 'form')) byMarket.set(r.market_id, [...(byMarket.get(r.market_id) ?? []), r])
  const fTotal = line(Array.from(byMarket.values()).map(rs => ({ risk: rs.reduce((s, r) => s + r.risk, 0), net: netOf(rs.reduce((s, r) => s + (r.pl ?? 0), 0)) })))

  const judge = (l: Line, target: number): { verdict: Verdict; why: string } => {
    if (l.n < target) return { verdict: 'collecting', why: `${l.n} of ${target} settled. Too early to read anything into the result.` }
    if (l.roi > 0 && l.t >= 2) return { verdict: 'pass', why: `Return ${pct(l.roi)} after commission with a t-score of ${l.t.toFixed(1)}. Worth a second, independent run before believing it.` }
    if (l.roi <= 0) return { verdict: 'fail', why: `Return ${pct(l.roi)} after commission over ${l.n}. No edge here: drop it or change the idea, not the threshold.` }
    return l.n >= target * 2
      ? { verdict: 'fail', why: `Still not distinguishable from luck after ${l.n} (t-score ${l.t.toFixed(1)}). Treat as no edge.` }
      : { verdict: 'inconclusive', why: `Return ${pct(l.roi)} but t-score only ${l.t.toFixed(1)}: could easily be luck. Keep collecting to ${target * 2}.` }
  }

  // bands verdict: is the favourite band really better than the longshot band?
  const T = STRAT.targets
  let bands: { verdict: Verdict; why: string }
  const bn = Math.min(fav.n, dog.n)
  if (bn < T.bands) bands = { verdict: 'collecting', why: `${fav.n} odds-on and ${dog.n} longshot bets settled; needs ${T.bands} of each.` }
  else {
    const gap = fav.roi - dog.roi
    const se = Math.sqrt(fav.se ** 2 + dog.se ** 2)
    const t = se > 0 ? gap / se : 0
    bands = gap > 0 && t >= 2
      ? { verdict: 'pass', why: `Before commission, odds-on returned ${pct(fav.roi)} vs ${pct(dog.roi)} for longshots (t-score ${t.toFixed(1)}): the bias shows up.${favNet.roi > 0 && favNet.t >= 2 ? ` Odds-on is also ahead after commission (${pct(favNet.roi)}).` : ` After commission odds-on returns ${pct(favNet.roi)}, so this tells you which prices to avoid, not what to back.`}` }
      : bn >= T.bands * 2 || gap <= 0
        ? { verdict: 'fail', why: `Before commission, odds-on ${pct(fav.roi)} vs longshots ${pct(dog.roi)}: no reliable favourite-longshot gap on these markets.` }
        : { verdict: 'inconclusive', why: `Gap of ${pct(gap)} in favour of odds-on, but t-score only ${t.toFixed(1)}. Keep collecting to ${T.bands * 2} of each.` }
  }

  return {
    dc: { open: open('dc'), total: dcTotal, target: T.dc, progress: Math.min(1, dcTotal.n / T.dc), groups: dcGroups, ...judge(dcTotal, T.dc) },
    bands: { open: open('bands'), total: gross(bRows), target: T.bands, progress: Math.min(1, bn / T.bands), groups: bGroups, ...bands },
    form: { open: open('form'), total: fTotal, target: T.form, progress: Math.min(1, fTotal.n / T.form), groups: {}, ...judge(fTotal, T.form) },
  }
}

// ---------------------------------------------------------------- DEMO simulator
// Invented teams and prices so the three tests can be watched end to end
// without a Betfair account. The simulated market is FAIR: quoted prices are
// the true probabilities plus a spread, so no strategy has a built-in edge and
// the honest expectation in demo is a small loss to spread and commission.
export type Sim = { seed: number; teams: { id: number; name: string; s: number }[]; queue: [number, number][]; n: number; clock: string }

const TEAM_NAMES = ['Ashby', 'Brackwell', 'Calder', 'Dunmore', 'Eastfield', 'Farrow', 'Glenholt', 'Harcastle', 'Inver', 'Juniper Vale',
  'Kestrel', 'Lowmoor', 'Marrow', 'Northfield', 'Oakhurst', 'Penhallow', 'Quarry Bank', 'Redmere', 'Stonebridge', 'Thornaby']

function rand(sim: Sim): number {
  let t = (sim.seed = (sim.seed + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const gauss = (sim: Sim) => Math.sqrt(-2 * Math.log(rand(sim) + 1e-12)) * Math.cos(2 * Math.PI * rand(sim))

export function newSim(seed = 20131114): Sim {
  const sim: Sim = { seed, teams: [], queue: [], n: 0, clock: new Date().toISOString() }
  sim.teams = TEAM_NAMES.map((name, i) => ({ id: 9000 + i, name, s: gauss(sim) * 0.3 }))
  return sim
}

function quote(sim: Sim, id: number, name: string, p: number): Sel {
  // The same proportional spread at every price, so no price band is favoured.
  const fairPrice = 1 / Math.max(p, 1e-4)
  const back = Math.max(1.01, r2(fairPrice * 0.994)), lay = Math.max(back + 0.01, r2(fairPrice * 1.006))
  return { id, name, back, backSize: 150 + rand(sim) * 400, lay: r2(lay), laySize: 150 + rand(sim) * 400 }
}

export function simulateMatch(sim: Sim): { snap: MatchSnap; results: Record<string, MarketResult> } {
  if (!sim.queue.length) {                                   // new round: every team plays once
    const ids = sim.teams.map((_, i) => i)
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand(sim) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]] }
    for (let i = 0; i < ids.length; i += 2) sim.queue.push([ids[i], ids[i + 1]])
  }
  const [hi, ai] = sim.queue.shift() as [number, number]
  const H = sim.teams[hi], A = sim.teams[ai]
  sim.n++
  sim.clock = new Date(new Date(sim.clock).getTime() + 3 * 3600_000).toISOString()
  const ev = 'D' + sim.n

  // The "true" scoreline distribution: a Dixon-Coles grid with every cell nudged at random,
  // so the real world is close to, but not exactly, what the model assumes.
  const lx = 1.45 * Math.exp(H.s - A.s), ly = 1.12 * Math.exp(A.s - H.s)
  let g = scoreGrid(lx, ly, -0.1, 8).map(row => row.map(v => v * Math.max(0.5, 1 + 0.15 * gauss(sim))))
  const tot = g.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0)
  g = g.map(row => row.map(v => v / tot))

  const mk = (type: MarketType, k: number, runners: Sel[], matched: number): MarketSnap => ({ marketId: `${ev}.${k}`, type, matched, runners })
  const ou = (type: MarketType, k: number, lineAt: number) => mk(type, k, [
    quote(sim, 1, `Under ${lineAt} Goals`, pUnder(g, lineAt)), quote(sim, 2, `Over ${lineAt} Goals`, pOver(g, lineAt))], 30_000)
  const cs: Sel[] = []
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) cs.push(quote(sim, 100 + i * 10 + j, `${i} - ${j}`, g[i][j]))
  const listed = (i: number, j: number) => i <= 3 && j <= 3
  const other = (keep: (i: number, j: number) => boolean) => { let s = 0; g.forEach((row, i) => row.forEach((v, j) => { if (!listed(i, j) && keep(i, j)) s += v })); return s }
  cs.push(quote(sim, 201, 'Any Other Home Win', other((i, j) => i > j)), quote(sim, 202, 'Any Other Away Win', other((i, j) => i < j)), quote(sim, 203, 'Any Other Draw', other((i, j) => i === j)))

  const DRAW = 58805
  const snap: MatchSnap = {
    eventId: ev, name: `${H.name} v ${A.name}`, kickoff: sim.clock, home: { id: H.id, name: H.name }, away: { id: A.id, name: A.name },
    markets: {
      MATCH_ODDS: mk('MATCH_ODDS', 1, [quote(sim, H.id, H.name, pHome(g)), quote(sim, A.id, A.name, pAway(g)), quote(sim, DRAW, 'The Draw', pDraw(g))], 40_000 + rand(sim) * 200_000),
      OVER_UNDER_15: ou('OVER_UNDER_15', 2, 1.5), OVER_UNDER_25: ou('OVER_UNDER_25', 3, 2.5), OVER_UNDER_35: ou('OVER_UNDER_35', 4, 3.5),
      CORRECT_SCORE: mk('CORRECT_SCORE', 5, cs, 15_000),
    },
  }

  // play the match: draw one scoreline from the true distribution
  let u = rand(sim), hs = 0, as = 0
  outer: for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) { u -= g[i][j]; if (u <= 0) { hs = i; as = j; break outer } }
  const goals = hs + as
  const csWinner = listed(hs, as) ? 100 + hs * 10 + as : hs > as ? 201 : hs < as ? 202 : 203
  const res = (w: number): MarketResult => ({ winners: [w], removed: [] })
  return { snap, results: {
    [`${ev}.1`]: res(hs > as ? H.id : hs < as ? A.id : DRAW),
    [`${ev}.2`]: res(goals > 1.5 ? 2 : 1), [`${ev}.3`]: res(goals > 2.5 ? 2 : 1), [`${ev}.4`]: res(goals > 3.5 ? 2 : 1),
    [`${ev}.5`]: res(csWinner),
  } }
}
