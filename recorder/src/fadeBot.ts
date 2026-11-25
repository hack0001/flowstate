// Paper bot for the scout's best racing system: "fade a sharp drift".
//
// When a top-six horse's last traded price drifts 15+ ticks within 5 minutes, and the
// drift is still there a minute later, it paper-backs the horse at the best back price
// on offer, then paper-hedges 10 minutes later at the best lay price (or at the last
// price before the off if the race goes first). Flat £2 stake, 5% commission on wins.
//
// It uses the recorder's live prices, so the test uses prices you could actually have
// taken (delayed like everything on the free key). Results go to bf_paper_fade and show
// on FlowState's Insights tab. PAPER ONLY: it never places a bet.

import { Store } from './store'
import { ticksBetween } from '../../lib/betfair/ticks'

const STAKE = 2, COMMISSION = 0.05
const LOOKBACK_MS = 5 * 60_000, CONFIRM_MS = 60_000, HOLD_MS = 10 * 60_000, MIN_TICKS = 15
const LATEST_ENTRY_MS = 11 * 60_000            // get in no later than 11 minutes before the start, so the hedge comes before the off

type Px = [number, number | null, number, number | null, number, number | null]   // id, back, £, lay, £, last traded
type Pending = { at: number; ref: number }
type Trade = { selectionId: number; signalAt: number; ref: number; drift: number; entryAt: number; entry: number; lastLay: number | null; done: boolean }
type RaceState = { name: string; start: number; hist: Map<number, [number, number][]>; pending: Map<number, Pending>; trades: Map<number, Trade>; used: Set<number> }

export class FadeBot {
  private races = new Map<string, RaceState>()
  constructor(private store: Store) {}

  // Called with every price update for a race before the off.
  onPrices(marketId: string, name: string, start: number, now: number, runners: Px[]) {
    let r = this.races.get(marketId)
    if (!r) { r = { name, start, hist: new Map(), pending: new Map(), trades: new Map(), used: new Set() }; this.races.set(marketId, r) }
    for (const x of runners) {
      const ltp = x[5]
      if (!ltp) continue
      const h = r.hist.get(x[0]) ?? []
      h.push([now, ltp])
      while (h.length && now - h[0][0] > 8 * 60_000) h.shift()
      r.hist.set(x[0], h)
    }
    // open trades: keep the latest lay price, and hedge once the 10 minutes are up
    for (const t of r.trades.values()) {
      if (t.done) continue
      const x = runners.find(q => q[0] === t.selectionId)
      if (x?.[3]) t.lastLay = x[3]
      if (now - t.entryAt >= HOLD_MS && t.lastLay) this.close(marketId, r, t, now, 'closed')
    }
    if (r.start - now < LATEST_ENTRY_MS) return
    // signals among the top six by price
    const top = runners.filter(x => x[1] ?? x[5]).sort((a, b) => (a[1] ?? a[5]!) - (b[1] ?? b[5]!)).slice(0, 6)
    for (const x of top) {
      const id = x[0], ltp = x[5]
      if (!ltp || r.used.has(id)) continue
      const h = r.hist.get(id) ?? []
      const refPoint = [...h].reverse().find(([t]) => now - t >= LOOKBACK_MS - 15_000)
      const p = r.pending.get(id)
      if (p) {
        if (now - p.at < CONFIRM_MS) continue
        const drift = ticksBetween(p.ref, ltp)
        r.pending.delete(id)
        if (drift < MIN_TICKS || !x[1]) continue                     // the drift didn't hold (or nothing to back at)
        r.used.add(id)
        const t: Trade = { selectionId: id, signalAt: p.at, ref: p.ref, drift, entryAt: now, entry: x[1], lastLay: x[3], done: false }
        r.trades.set(id, t)
        this.save(marketId, r, t, 'open', null, null)
        continue
      }
      if (refPoint && ticksBetween(refPoint[1], ltp) >= MIN_TICKS) r.pending.set(id, { at: now, ref: refPoint[1] })
    }
  }

  // The race has gone off (or closed): settle any open trade at the last lay price seen.
  onOff(marketId: string, now: number) {
    const r = this.races.get(marketId)
    if (!r) return
    for (const t of r.trades.values()) if (!t.done) this.close(marketId, r, t, now, t.lastLay ? 'closed at the off' : 'no exit price')
    this.races.delete(marketId)
  }

  private close(marketId: string, r: RaceState, t: Trade, now: number, status: string) {
    t.done = true
    let pnl: number | null = null
    if (t.lastLay) { const g = STAKE * (t.entry / t.lastLay - 1); pnl = Math.round((g > 0 ? g * (1 - COMMISSION) : g) * 100) / 100 }
    this.save(marketId, r, t, status, t.lastLay, pnl, now)
  }

  private save(marketId: string, r: RaceState, t: Trade, status: string, exit: number | null, pnl: number | null, exitAt?: number) {
    this.store.add({ kind: 'upsert', table: 'bf_paper_fade', onConflict: 'market_id,selection_id', rows: [{
      market_id: marketId, selection_id: t.selectionId, race: r.name, start_at: new Date(r.start).toISOString(),
      signal_at: new Date(t.signalAt).toISOString(), ref_price: t.ref, drift_ticks: t.drift, entry_at: new Date(t.entryAt).toISOString(), entry_price: t.entry,
      exit_at: exitAt ? new Date(exitAt).toISOString() : null, exit_price: exit, stake: STAKE, pnl, status, updated_at: new Date().toISOString(),
    }] })
  }

  // forget races long past their start (if the off was never seen)
  tidy(now: number) { for (const [id, r] of this.races) if (now - r.start > 2 * 3600_000) this.onOff(id, now) }
}
