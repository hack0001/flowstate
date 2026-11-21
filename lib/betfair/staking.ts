// ============================================================
// Staking plans for a backtest's trades (the Staking section of the
// Backtest tab). Replays the same trades, in order, from a starting bank:
//
//   Flat            the same £ stake every time (the backtest itself)
//   Fixed %         a set percentage of the current bank
//   Kelly           the stake the Kelly criterion gives for the edge seen so far;
//                   half and quarter Kelly stake that fraction of it
//
// Kelly needs to know the edge, and the honest way to know it is from the
// past: each stake uses ONLY the trades before it (no peeking at later
// results). Until there are enough earlier trades it stakes flat, and the
// estimate is nudged towards "no edge" so a lucky start doesn't overbet.
//
//   Left to run (a win/lose bet):  f = (b·p − (1 − p)) / b of the bank at risk,
//       b = what £1 risked wins after commission, p = estimated chance of winning
//       (the price's chance × how much more often these selections have won
//       than their prices said so far).
//   Closed out (a trade with a spread of outcomes):  f = average return ÷ its
//       variance, per £1 staked, from the earlier trades.
// ============================================================

import type { Trade } from './backtest'

export type Outcome = 'hedged' | 'run'
export type StakeOpts = { bank: number; flatStake: number; pct: number; commission: number; warmup: number; liquidity: boolean; outcome: Outcome }
export type Plan = { name: string; note: string; points: number[]; final: number; profit: number; roi: number; maxDd: number; bets: number; biggest: number; low: number; bust: boolean; staked: number }

const PLANS: { name: string; kelly: number | null; note: string }[] = [
  { name: 'Flat', kelly: null, note: 'Same stake every time' },
  { name: 'Fixed %', kelly: null, note: 'A set share of the current bank' },
  { name: 'Full Kelly', kelly: 1, note: 'Fastest growth if the edge is right; very bumpy' },
  { name: 'Half Kelly', kelly: 0.5, note: 'About ¾ of the growth, much smoother' },
  { name: 'Quarter Kelly', kelly: 0.25, note: 'Cautious; forgives an overestimated edge' },
]

export function simulateStaking(all: Trade[], o: StakeOpts): Plan[] {
  const trades = [...all].filter(t => o.outcome === 'hedged' || t.runPnl !== null).sort((a, b) => a.entryAt.localeCompare(b.entryAt))
  const c = o.commission
  // what £1 of stake returns on each trade (after commission), and what £1 of stake risks
  const unit = (t: Trade) => {
    if (o.outcome === 'hedged') return t.pnl / t.stake
    const p = t.entryFill
    if (t.side === 'back') return t.won ? (p - 1) * (1 - c) : -1
    return t.won ? -(p - 1) : 1 - c
  }
  const riskPerUnit = (t: Trade) => o.outcome === 'run' && t.side === 'lay' ? t.entryFill - 1 : 1   // a lay risks its liability

  return PLANS.map(plan => {
    let bank = o.bank, peak = o.bank, maxDd = 0, bets = 0, biggest = 0, low = o.bank, staked = 0
    const points = [bank]
    // running totals of the earlier trades, for the Kelly estimate
    let n = 0, sum = 0, sumSq = 0, wins = 0, expected = 0
    for (const t of trades) {
      let stake = 0
      if (bank > 0.01) {
        if (plan.name === 'Flat') stake = o.flatStake
        else if (plan.name === 'Fixed %') stake = bank * o.pct / riskPerUnit(t)
        else if (n < o.warmup) stake = o.flatStake                                  // not enough history yet
        else {
          let f = 0                                                                 // share of the bank to put at risk
          if (o.outcome === 'run') {
            const ae = (wins + 10) / (expected + 10)                                // won vs expected so far, nudged towards 1
            const pHorse = Math.min(0.99, Math.max(0.001, ae / t.entryFill))
            const [w, b] = t.side === 'back' ? [pHorse, (t.entryFill - 1) * (1 - c)] : [1 - pHorse, (1 - c) / (t.entryFill - 1)]
            f = (b * w - (1 - w)) / b
          } else {
            const mean = sum / n, varr = Math.max(1e-6, sumSq / n - mean * mean)
            f = (mean * n / (n + 30)) / varr                                        // per £1 staked; nudged towards 0
          }
          stake = Math.max(0, f) * (plan.kelly ?? 1) * bank / riskPerUnit(t)
        }
        stake = Math.min(stake, bank / riskPerUnit(t))                              // never risk more than the bank
        if (o.liquidity && t.entrySize) stake = Math.min(stake, t.entrySize)        // only what was on offer at the price
      }
      if (stake >= 0.01) {
        bets++; staked += stake; biggest = Math.max(biggest, stake)
        bank += stake * unit(t)
      }
      // update the history with this trade's result (used from the next trade on)
      n++; const u = unit(t); sum += u; sumSq += u * u
      if (o.outcome === 'run') { if (t.won) wins++; expected += 1 / t.entryFill }
      peak = Math.max(peak, bank); low = Math.min(low, bank); maxDd = Math.max(maxDd, peak > 0 ? (peak - bank) / peak : 0)
      points.push(Math.round(bank * 100) / 100)
    }
    return { name: plan.name === 'Fixed %' ? `Fixed ${+(o.pct * 100).toFixed(1)}%` : plan.name, note: plan.note, points, final: bank, profit: bank - o.bank,
      roi: (bank - o.bank) / o.bank, maxDd, bets, biggest, low, bust: bank < o.bank * 0.05, staked }
  })
}
