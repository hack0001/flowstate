// ============================================================
// Replay recorded prices through the live bots. Pure: safe in the browser.
//
// Racing: rebuilds the market at each recorded moment and runs the six
//         agents (engine.tick) over it exactly as they ran live.
// Football: rebuilds each match as it looked when it was picked up and runs
//         the three strategies (evaluateMatch), settling with the recorded
//         results.
//
// Uses the current CONFIG (engine.ts) and STRAT (strategies.ts), so you can
// change a setting, redeploy and replay the same data to compare.
// ============================================================

import { freshState, tick, type Book, type Feed, type Market, type TradeOut } from './engine'
import { evaluateMatch, scoreStrategies, settleBet, updateForm, MARKET_TYPES, type Form, type MarketSnap, type MarketType, type MatchSnap, type Row, type SettledBet } from './strategies'

export type MarketRow = {
  market_id: string; sport: 'racing' | 'football'; market_type: string; event_id: string | null; event: string; venue: string | null
  start_at: string; runners: { id: number; name: string }[]; status: string | null; winners: number[] | null; removed: number[] | null
}
export type SnapRow = { market_id: string; at: string; inplay: boolean; matched: number | null; runners: [number, number | null, number, number | null, number, number | null][] }

const STALE_MS = 90_000   // a snapshot older than this no longer counts as the current price

function toBook(m: MarketRow, s: SnapRow): Book {
  return {
    marketId: m.market_id, status: 'OPEN', inplay: s.inplay, totalMatched: s.matched ?? 0,
    runners: s.runners.map(([id, b, bs, l, ls, ltp]) => ({
      selectionId: id, status: 'ACTIVE', lastPriceTraded: ltp ?? undefined,
      ex: { availableToBack: b ? [{ price: b, size: bs }] : [], availableToLay: l ? [{ price: l, size: ls }] : [] },
    })),
  }
}

// ---------------------------------------------------------------- racing
class ReplayFeed implements Feed {
  private byMarket = new Map<string, SnapRow[]>()
  private idx = new Map<string, number>()
  constructor(private markets: MarketRow[], snaps: SnapRow[]) {
    for (const s of snaps) this.byMarket.set(s.market_id, [...(this.byMarket.get(s.market_id) ?? []), s])
    this.byMarket.forEach(list => list.sort((a, b) => a.at.localeCompare(b.at)))
  }
  async catalogue(now: Date): Promise<Market[]> {
    const t = now.getTime()
    return this.markets.filter(m => { const s = new Date(m.start_at).getTime(); return s > t && s <= t + 60 * 60_000 })
      .map(m => ({ id: m.market_id, name: m.event, start: m.start_at }))
  }
  async books(ids: string[], now: Date): Promise<Record<string, Book>> {
    const out: Record<string, Book> = {}
    const t = now.getTime()
    for (const id of ids) {
      const list = this.byMarket.get(id), m = this.markets.find(x => x.market_id === id)
      if (!list || !m) continue
      let i = this.idx.get(id) ?? -1                          // walk forward: replay time only moves on
      while (i + 1 < list.length && new Date(list[i + 1].at).getTime() <= t) i++
      this.idx.set(id, i)
      if (i >= 0 && t - new Date(list[i].at).getTime() <= STALE_MS) out[id] = toBook(m, list[i])
    }
    return out
  }
}

export type RacingReplay = {
  trades: TradeOut[]; races: number; moments: number
  net: number; wins: number; strike: number; avg: number; maxDrawdown: number; endBank: number; startBank: number
}

export async function replayRacing(markets: MarketRow[], snaps: SnapRow[]): Promise<RacingReplay> {
  const racing = markets.filter(m => m.sport === 'racing')
  const ids = new Set(racing.map(m => m.market_id))
  const rs = snaps.filter(s => ids.has(s.market_id))
  const state = freshState()
  const startBank = state.bank
  const feed = new ReplayFeed(racing, rs)
  // Step through the moments that were actually recorded, in order.
  const moments = Array.from(new Set(rs.map(s => s.at))).sort()
  const trades: TradeOut[] = []
  for (const at of moments) trades.push(...(await tick(state, feed, new Date(at))).trades)
  let cum = 0, peak = 0, dd = 0
  for (const t of trades) { cum += t.net_pl; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak) }
  const wins = trades.filter(t => t.net_pl > 0).length
  return { trades, races: racing.length, moments: moments.length, net: cum, wins, strike: trades.length ? wins / trades.length : 0,
    avg: trades.length ? cum / trades.length : 0, maxDrawdown: dd, endBank: state.bank, startBank }
}

// ---------------------------------------------------------------- football
export type FootballReplay = { matches: number; usable: number; bets: SettledBet[]; stats: ReturnType<typeof scoreStrategies> }

export function replayFootball(markets: MarketRow[], snaps: SnapRow[]): FootballReplay {
  const football = markets.filter(m => m.sport === 'football' && m.event_id)
  const firstSnap = new Map<string, SnapRow>()
  for (const s of [...snaps].sort((a, b) => a.at.localeCompare(b.at))) if (!firstSnap.has(s.market_id)) firstSnap.set(s.market_id, s)

  const events = new Map<string, MarketRow[]>()
  for (const m of football) events.set(m.event_id as string, [...(events.get(m.event_id as string) ?? []), m])
  const ordered = Array.from(events.values()).sort((a, b) => a[0].start_at.localeCompare(b[0].start_at))

  const form: Form = {}
  const bets: SettledBet[] = []
  let usable = 0
  for (const ms of ordered) {
    const mo = ms.find(m => m.market_type === 'MATCH_ODDS')
    const moSnap = mo && firstSnap.get(mo.market_id)
    if (!mo || !moSnap || !mo.winners?.length) continue          // need the match odds prices and result
    const [homeName, awayName] = mo.event.split(' v ').map(s => s.trim())
    const home = mo.runners.find(r => r.name === homeName) ?? mo.runners[0]
    const away = mo.runners.find(r => r.name === awayName) ?? mo.runners[1]
    if (!home || !away) continue
    const snapMarkets: MatchSnap['markets'] = {}
    for (const m of ms) {
      const s = firstSnap.get(m.market_id)
      if (!s || !(MARKET_TYPES as string[]).includes(m.market_type)) continue
      const ms_: MarketSnap = { marketId: m.market_id, type: m.market_type as MarketType, matched: s.matched ?? 0,
        runners: m.runners.map(r => { const q = s.runners.find(x => x[0] === r.id); return { id: r.id, name: r.name, back: q?.[1] ?? null, backSize: q?.[2] ?? 0, lay: q?.[3] ?? null, laySize: q?.[4] ?? 0 } }) }
      snapMarkets[m.market_type as MarketType] = ms_
    }
    const snap: MatchSnap = { eventId: mo.event_id as string, name: mo.event, kickoff: mo.start_at, home, away, markets: snapMarkets }
    const { bets: placed, pending } = evaluateMatch(snap, form, moSnap.at)
    usable++
    for (const b of placed) {
      const m = ms.find(x => x.market_id === b.market_id)
      if (m?.winners) bets.push(settleBet(b, { winners: m.winners, removed: m.removed ?? [] }))
    }
    if (pending) updateForm(form, pending, { winners: mo.winners, removed: mo.removed ?? [] })
  }
  const rows: Row[] = bets.map(b => ({ strategy: b.strategy, market_id: b.market_id, market_type: b.market_type, side: b.side, band: b.band, risk: b.risk, price: b.price, pl: b.pl, status: b.status }))
  return { matches: events.size, usable, bets, stats: scoreStrategies(rows) }
}

// ---------------------------------------------------------------- CSV export
const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// One row per runner per snapshot, with the market's details and result.
export function toCsv(markets: MarketRow[], snaps: SnapRow[]): string {
  const byId = new Map(markets.map(m => [m.market_id, m]))
  const head = ['sport', 'market_id', 'market_type', 'event', 'venue', 'start_at', 'captured_at', 'secs_to_off', 'inplay', 'total_matched',
    'selection_id', 'selection', 'back', 'back_size', 'lay', 'lay_size', 'last_traded', 'result']
  const lines = [head.join(',')]
  for (const s of [...snaps].sort((a, b) => a.market_id.localeCompare(b.market_id) || a.at.localeCompare(b.at))) {
    const m = byId.get(s.market_id)
    if (!m) continue
    const secs = Math.round((new Date(m.start_at).getTime() - new Date(s.at).getTime()) / 1000)
    for (const [id, b, bs, l, ls, ltp] of s.runners) {
      const result = !m.status ? '' : m.removed?.includes(id) ? 'REMOVED' : m.winners?.includes(id) ? 'WINNER' : 'LOSER'
      lines.push([m.sport, m.market_id, m.market_type, m.event, m.venue, m.start_at, s.at, secs, s.inplay, s.matched,
        id, m.runners.find(r => r.id === id)?.name ?? '', b, bs, l, ls, ltp, result].map(csvCell).join(','))
    }
  }
  return lines.join('\n') + '\n'
}
