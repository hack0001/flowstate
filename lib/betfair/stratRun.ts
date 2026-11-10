// ============================================================
// Football strategy tests -- load state, run one poll, save. SERVER-ONLY.
//
// Demo: a handful of invented matches per poll, settled on the spot.
// Live: (1) settle open paper bets whose markets have closed, then
//       (2) snapshot real matches kicking off in the next few minutes and
//           let each strategy decide its paper bets.
// Reads Betfair prices only (listMarketCatalogue / listMarketBook).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { BetfairReader, login } from './live'
import {
  MARKET_TYPES, STRAT, evaluateMatch, newSim, scoreStrategies, settleBet, simulateMatch, updateForm,
  type Form, type MarketResult, type MarketSnap, type MarketType, type MatchSnap, type PaperBet, type Pending, type Row, type Sel, type Sim, type StrategyId,
} from './strategies'

export type Mode = 'demo' | 'live'
type State = { sim?: Sim; form: Form; pending: Record<string, Pending>; seen: Record<string, string>; counts: { matches: number; skipped: number } }
type StratRow = { mode: Mode; running: boolean; state: State; version: number; last_error: string | null; updated_at: string | null }

const freshState = (): State => ({ form: {}, pending: {}, seen: {}, counts: { matches: 0, skipped: 0 } })
const SESSION_MAX_MS = 6 * 60 * 60_000
const WINDOW_MIN = [1, 12]        // snapshot matches kicking off this many minutes from now
const MAX_NEW_PER_POLL = 6
const SETTLE_AFTER_MIN = 95       // don't ask Betfair for a result until a match could have finished
const DEMO_MATCHES_PER_POLL = 5
const DEMO_MAX_MATCHES = 3000

async function load(db: SupabaseClient): Promise<StratRow> {
  const { data, error } = await db.from('bf_strat').select('mode, running, state, version, last_error, updated_at').eq('id', 1).maybeSingle()
  const missing = 'The strategy tables are missing: run supabase/migrations/051_betfair_strategies.sql in the Supabase SQL editor.'
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? missing : error.message)
  if (!data) throw new Error(missing)
  const row = data as StratRow
  if (!row.state || !row.state.counts) row.state = freshState()
  return row
}

// Shares the Betfair session cached on bf_bot with the racing desk.
function reader(db: SupabaseClient): BetfairReader {
  return new BetfairReader(async forceNew => {
    if (!forceNew) {
      const { data } = await db.from('bf_bot').select('session_token, session_at').eq('id', 1).maybeSingle()
      if (data?.session_token && data.session_at && Date.now() - new Date(data.session_at).getTime() < SESSION_MAX_MS) return data.session_token
    }
    const token = await login()
    await db.from('bf_bot').update({ session_token: token, session_at: new Date().toISOString() }).eq('id', 1)
    return token
  })
}

// ---------------------------------------------------------------- live: Betfair -> snapshots
type RawRunner = { selectionId: number; runnerName: string; sortPriority: number }
type RawCat = { marketId: string; marketName: string; marketStartTime: string; totalMatched?: number; event: { id: string; name: string }; runners: RawRunner[]; description?: { marketType?: string } }
type RawBook = { marketId: string; status: string; inplay: boolean; totalMatched: number
  runners: { selectionId: number; status: string; ex?: { availableToBack?: { price: number; size: number }[]; availableToLay?: { price: number; size: number }[] } }[] }

const typeOf = (c: RawCat): MarketType | null => {
  const t = c.description?.marketType
  if (t && (MARKET_TYPES as string[]).includes(t)) return t as MarketType
  const m = /over\/under (\d)\.5/i.exec(c.marketName)
  return m && ['1', '2', '3'].includes(m[1]) ? (`OVER_UNDER_${m[1]}5` as MarketType) : /^correct score$/i.test(c.marketName) ? 'CORRECT_SCORE' : null
}

async function books(bf: BetfairReader, ids: string[], prices: boolean, chunk: number): Promise<Record<string, RawBook>> {
  const out: Record<string, RawBook> = {}
  for (let i = 0; i < ids.length; i += chunk) {
    const got = await bf.read<RawBook[]>('listMarketBook', { marketIds: ids.slice(i, i + chunk),
      ...(prices ? { priceProjection: { priceData: ['EX_BEST_OFFERS'], exBestOffersOverrides: { bestPricesDepth: 1 } } } : {}) })
    for (const b of got) out[b.marketId] = b
  }
  return out
}

async function liveSnapshots(bf: BetfairReader, state: State, now: Date): Promise<MatchSnap[]> {
  const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString()
  const cats = await bf.read<RawCat[]>('listMarketCatalogue', {
    filter: { eventTypeIds: ['1'], marketTypeCodes: ['MATCH_ODDS'], inPlayOnly: false, marketStartTime: { from: at(WINDOW_MIN[0]), to: at(WINDOW_MIN[1]) } },
    marketProjection: ['EVENT', 'MARKET_START_TIME', 'RUNNER_DESCRIPTION'], sort: 'FIRST_TO_START', maxResults: 200,
  })
  // A normal match: "Home v Away" with exactly home, away and The Draw. Biggest markets first.
  const picks = cats
    .filter(c => !state.seen[c.event.id] && c.event.name.includes(' v ') && c.runners.length === 3 && (c.totalMatched ?? 0) >= STRAT.minMatched)
    .sort((a, b) => (b.totalMatched ?? 0) - (a.totalMatched ?? 0)).slice(0, MAX_NEW_PER_POLL)
  if (!picks.length) return []

  const others = await bf.read<RawCat[]>('listMarketCatalogue', {
    filter: { eventIds: picks.map(c => c.event.id), marketTypeCodes: MARKET_TYPES.filter(t => t !== 'MATCH_ODDS') },
    marketProjection: ['EVENT', 'RUNNER_DESCRIPTION', 'MARKET_DESCRIPTION'], maxResults: 100,
  })
  const all = [...picks, ...others]
  const bk = await books(bf, all.map(c => c.marketId), true, 10)

  const snapOf = (c: RawCat, type: MarketType): MarketSnap | null => {
    const b = bk[c.marketId]
    if (!b || b.status !== 'OPEN' || b.inplay) return null
    const runners: Sel[] = c.runners.map(r => {
      const q = b.runners.find(x => x.selectionId === r.selectionId)
      const bb = q?.status === 'ACTIVE' ? q.ex?.availableToBack?.[0] : undefined, ll = q?.status === 'ACTIVE' ? q.ex?.availableToLay?.[0] : undefined
      return { id: r.selectionId, name: r.runnerName, back: bb?.price ?? null, backSize: bb?.size ?? 0, lay: ll?.price ?? null, laySize: ll?.size ?? 0 }
    })
    return { marketId: c.marketId, type, matched: b.totalMatched ?? 0, runners }
  }

  const snaps: MatchSnap[] = []
  for (const c of picks) {
    const [homeName, awayName] = c.event.name.split(' v ').map(s => s.trim())
    const sorted = [...c.runners].sort((a, b) => a.sortPriority - b.sortPriority)
    const home = c.runners.find(r => r.runnerName === homeName) ?? sorted[0]
    const away = c.runners.find(r => r.runnerName === awayName) ?? sorted[1]
    const markets: MatchSnap['markets'] = {}
    const mo = snapOf(c, 'MATCH_ODDS')
    if (mo) markets.MATCH_ODDS = mo
    for (const o of others.filter(x => x.event.id === c.event.id)) {
      const t = typeOf(o); const s = t ? snapOf(o, t) : null
      if (t && s) markets[t] = s
    }
    snaps.push({ eventId: c.event.id, name: c.event.name, kickoff: c.marketStartTime, home: { id: home.selectionId, name: home.runnerName }, away: { id: away.selectionId, name: away.runnerName }, markets })
  }
  return snaps
}

// ---------------------------------------------------------------- one poll
export async function runStrategiesOnce(db: SupabaseClient): Promise<{ ran: boolean; error?: string }> {
  const row = await load(db)
  if (!row.running) return { ran: false }
  const state = row.state, mode = row.mode
  const now = new Date()
  const inserts: (PaperBet & { mode: Mode; status: string; pl: number | null; settled_at: string | null })[] = []
  const settles: { id: number; status: string; pl: number; settled_at: string }[] = []

  try {
    if (mode === 'demo') {
      if (state.counts.matches >= DEMO_MAX_MATCHES) {      // long enough for every test to reach a verdict
        await db.from('bf_strat').update({ running: false, updated_at: new Date().toISOString() }).eq('id', 1)
        return { ran: false }
      }
      const sim = (state.sim ??= newSim())
      for (let i = 0; i < DEMO_MATCHES_PER_POLL; i++) {
        const { snap, results } = simulateMatch(sim)
        const { bets, pending, skipped } = evaluateMatch(snap, state.form, sim.clock)
        state.counts.matches++; if (skipped) state.counts.skipped++
        for (const b of bets) { const s = settleBet(b, results[b.market_id]); inserts.push({ ...s, mode, settled_at: sim.clock }) }
        if (pending) updateForm(state.form, pending, results[pending.marketId])
      }
    } else {
      const bf = reader(db)

      // 1) settle: ask Betfair how closed markets finished
      const cutoff = new Date(now.getTime() - SETTLE_AFTER_MIN * 60_000).toISOString()
      const { data: open } = await db.from('bf_strat_bets').select('id, strategy, event_id, event, market_id, market_type, selection_id, selection, side, price, stake, risk, model_prob, edge, band, placed_at')
        .eq('mode', mode).eq('status', 'open').lt('placed_at', cutoff).order('placed_at', { ascending: true }).limit(400)
      const openBets = (open ?? []) as (PaperBet & { id: number })[]
      const pendingIds = Object.values(state.pending).filter(p => p.kickoff < cutoff).map(p => p.marketId)
      const marketIds = Array.from(new Set([...openBets.map(b => b.market_id), ...pendingIds])).slice(0, 50)
      if (marketIds.length) {
        const bk = await books(bf, marketIds, false, 25)
        const results: Record<string, MarketResult> = {}
        for (const id of marketIds) {
          const b = bk[id]
          if (b?.status === 'CLOSED') results[id] = { winners: b.runners.filter(r => r.status === 'WINNER').map(r => r.selectionId), removed: b.runners.filter(r => r.status === 'REMOVED').map(r => r.selectionId) }
        }
        for (const b of openBets) if (results[b.market_id]) { const s = settleBet(b, results[b.market_id]); settles.push({ id: b.id, status: s.status, pl: s.pl, settled_at: now.toISOString() }) }
        for (const [ev, p] of Object.entries(state.pending)) if (results[p.marketId]) { updateForm(state.form, p, results[p.marketId]); delete state.pending[ev] }
      }

      // 2) new matches about to kick off
      for (const snap of await liveSnapshots(bf, state, now)) {
        const { bets, pending, skipped } = evaluateMatch(snap, state.form, now.toISOString())
        state.seen[snap.eventId] = snap.kickoff
        state.counts.matches++; if (skipped) state.counts.skipped++
        for (const b of bets) inserts.push({ ...b, mode, status: 'open', pl: null, settled_at: null })
        if (pending) state.pending[snap.eventId] = pending
      }

      // housekeeping: forget old events, abandoned results and teams not seen for months
      const dayAgo = new Date(now.getTime() - 86_400_000).toISOString(), weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
      const stale = new Date(now.getTime() - 120 * 86_400_000).toISOString()
      for (const [k, v] of Object.entries(state.seen)) if (v < dayAgo) delete state.seen[k]
      for (const [k, v] of Object.entries(state.pending)) if (v.kickoff < weekAgo) delete state.pending[k]
      for (const [k, v] of Object.entries(state.form)) if (v.last < stale) delete state.form[k]
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const fatal = /login failed|isn't set up/i.test(message)
    await db.from('bf_strat').update({ last_error: message, running: fatal ? false : row.running, updated_at: new Date().toISOString() }).eq('id', 1)
    return { ran: false, error: message }
  }

  // Optimistic lock: if another tab or the cron saved first, drop this poll's work.
  const { data: saved, error } = await db.from('bf_strat').update({ state, version: row.version + 1, last_error: null, updated_at: new Date().toISOString() })
    .eq('id', 1).eq('version', row.version).select('id')
  if (error) return { ran: false, error: error.message }
  if (!saved?.length) return { ran: false }
  if (inserts.length) {
    const { error: insErr } = await db.from('bf_strat_bets').insert(inserts)
    if (insErr) return { ran: true, error: 'Could not save paper bets: ' + insErr.message }
  }
  for (const s of settles) await db.from('bf_strat_bets').update({ status: s.status, pl: s.pl, settled_at: s.settled_at }).eq('id', s.id).eq('status', 'open')
  return { ran: true }
}

export async function setStrategies(db: SupabaseClient, patch: { running?: boolean; mode?: Mode; reset?: boolean }) {
  const row = await load(db)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), last_error: null, version: row.version + 1 }
  if (patch.running !== undefined) update.running = patch.running
  if (patch.mode && patch.mode !== row.mode) {
    // Each mode keeps its own bets; team form only makes sense within one mode, so it starts again.
    update.mode = patch.mode; update.running = false; update.state = freshState()
  }
  if (patch.reset) {
    update.state = freshState(); update.running = false
    await db.from('bf_strat_bets').delete().eq('mode', patch.mode ?? row.mode)
  }
  const { error } = await db.from('bf_strat').update(update).eq('id', 1)
  if (error) throw new Error(error.message)
}

// Everything the Strategies tab needs.
export async function strategiesSnapshot(db: SupabaseClient) {
  const row = await load(db)
  const rows: Row[] = []
  for (let from = 0; from < 40_000; from += 1000) {      // Supabase returns at most 1000 rows per request
    const { data } = await db.from('bf_strat_bets').select('strategy, market_id, market_type, side, band, risk, price, pl, status').eq('mode', row.mode).order('id').range(from, from + 999)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  const recent = {} as Record<StrategyId, unknown[]>
  for (const id of ['dc', 'bands', 'form'] as StrategyId[]) {
    const { data } = await db.from('bf_strat_bets').select('id, placed_at, event, market_type, selection, side, price, stake, model_prob, edge, band, status, pl')
      .eq('mode', row.mode).eq('strategy', id).order('id', { ascending: false }).limit(8)
    recent[id] = data ?? []
  }
  const s = row.state
  return {
    mode: row.mode, running: row.running, lastError: row.last_error, updatedAt: row.updated_at,
    stats: scoreStrategies(rows), recent,
    matches: s.counts.matches, skipped: s.counts.skipped, awaitingResult: Object.keys(s.pending).length,
    teamsTracked: Object.keys(s.form).length, teamsReady: Object.values(s.form).filter(f => f.diffs.length >= STRAT.formGames).length,
    config: { stake: STRAT.stake, commission: STRAT.commission, minMatched: STRAT.minMatched, dcMinEdge: STRAT.dcMinEdge, dcMaxPrice: STRAT.dcMaxPrice, formGames: STRAT.formGames, formMinGap: STRAT.formMinGap },
  }
}
export type StrategiesSnapshot = Awaited<ReturnType<typeof strategiesSnapshot>>
