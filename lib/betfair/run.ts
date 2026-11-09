// ============================================================
// Betfair paper desk -- load state, run one poll, save. SERVER-ONLY.
//
// Used by the page's own polling (app/api/betfair, signed-in client) and by
// the optional cron (app/api/betfair/cron, service-role client).
// Optimistic locking on bf_bot.version stops two overlapping polls (two
// tabs, or a tab plus the cron) from double-counting a trade.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIG, DemoFeed, freshState, tick, type BotState } from './engine'
import { LiveFeed, login } from './live'

export type Mode = 'demo' | 'live'
type BotRow = { mode: Mode; running: boolean; state: BotState; version: number; session_token: string | null; session_at: string | null; last_error: string | null; updated_at: string | null }

const SESSION_MAX_MS = 6 * 60 * 60_000   // Betfair sessions last ~8h in the UK; refresh before that

export async function loadBot(db: SupabaseClient): Promise<BotRow> {
  const { data, error } = await db.from('bf_bot').select('mode, running, state, version, session_token, session_at, last_error, updated_at').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message.includes('does not exist')
    ? 'The Betfair tables are missing: run supabase/migrations/050_betfair_paper.sql in the Supabase SQL editor.'
    : error.message)
  if (!data) throw new Error('bf_bot row missing: re-run supabase/migrations/050_betfair_paper.sql.')
  const row = data as BotRow
  if (!row.state || !('counts' in row.state)) row.state = freshState()
  return row
}

export async function runOnce(db: SupabaseClient): Promise<{ ran: boolean; error?: string }> {
  const bot = await loadBot(db)
  if (!bot.running) return { ran: false }

  const state = bot.state
  let token = bot.session_token, tokenAt = bot.session_at
  let now: Date
  let feed
  if (bot.mode === 'demo') {
    now = new Date(state.clock ? new Date(state.clock).getTime() + CONFIG.demoStepMs : Date.now())
    state.clock = now.toISOString()
    feed = new DemoFeed(state)
  } else {
    now = new Date()
    feed = new LiveFeed(async (forceNew) => {
      if (!forceNew && token && tokenAt && Date.now() - new Date(tokenAt).getTime() < SESSION_MAX_MS) return token
      token = await login(); tokenAt = new Date().toISOString()
      return token
    })
  }

  let trades, events
  try {
    ({ trades, events } = await tick(state, feed, now))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // Stop on errors that won't fix themselves, so it doesn't hammer Betfair's login.
    const fatal = /login failed|isn't set up/i.test(message)
    await db.from('bf_bot').update({ last_error: message, running: fatal ? false : bot.running, updated_at: new Date().toISOString() }).eq('id', 1)
    await db.from('bf_events').insert({ mode: bot.mode, type: 'ERROR', market: null, detail: message })
    return { ran: false, error: message }
  }

  const { data: saved, error } = await db.from('bf_bot')
    .update({ state, version: bot.version + 1, session_token: token, session_at: tokenAt, last_error: null, updated_at: new Date().toISOString() })
    .eq('id', 1).eq('version', bot.version).select('id')
  if (error) return { ran: false, error: error.message }
  if (!saved?.length) return { ran: false }   // another poll got there first; its result stands

  if (trades.length) await db.from('bf_trades').insert(trades.map(t => ({ ...t, mode: bot.mode })))
  if (events.length) await db.from('bf_events').insert(events.map(e => ({ ...e, mode: bot.mode })))
  return { ran: true }
}

export async function setBot(db: SupabaseClient, patch: { running?: boolean; mode?: Mode; reset?: boolean }) {
  const bot = await loadBot(db)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), last_error: null }
  if (patch.running !== undefined) update.running = patch.running
  if (patch.mode && patch.mode !== bot.mode) { update.mode = patch.mode; update.state = freshState(); update.running = false }
  if (patch.reset) {
    update.state = freshState(); update.running = false
    const mode = patch.mode ?? bot.mode
    await db.from('bf_trades').delete().eq('mode', mode)
    await db.from('bf_events').delete().eq('mode', mode)
  }
  update.version = bot.version + 1
  const { error } = await db.from('bf_bot').update(update).eq('id', 1)
  if (error) throw new Error(error.message)
}

// Everything the page needs. Never includes the session token.
export async function snapshot(db: SupabaseClient) {
  const bot = await loadBot(db)
  const [{ data: trades }, { data: events }] = await Promise.all([
    db.from('bf_trades').select('id, closed_at, market, side, entry, exit, stake, gross_pl, commission, net_pl, score, reason')
      .eq('mode', bot.mode).order('closed_at', { ascending: true }).limit(2000),
    db.from('bf_events').select('id, at, type, market, detail').eq('mode', bot.mode).order('id', { ascending: false }).limit(40),
  ])
  const s = bot.state
  return {
    mode: bot.mode, running: bot.running, lastError: bot.last_error, updatedAt: bot.updated_at,
    clock: s.clock ?? null, bank: s.bank, startBank: CONFIG.startBank, counts: s.counts, ruleKills: s.ruleKills,
    lastScore: s.lastScore, positions: Object.values(s.positions), watching: Object.keys(s.watch).length,
    trades: trades ?? [], events: (events ?? []).reverse(),
    config: { stakePct: CONFIG.stakePct, stopTicks: CONFIG.stopTicks, targetTicks: CONFIG.targetTicks, trailAfterTicks: CONFIG.trailAfterTicks, commission: CONFIG.commission, minScore: CONFIG.minScore },
  }
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>
