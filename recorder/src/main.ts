// FlowState Betfair recorder: an always-on program that
//   1. records GB/IE horse racing prices (racing.ts) and the big football,
//      tennis and golf markets (sports.ts),
//   2. keeps the Desk and Strategies paper bots running when they've been
//      started in FlowState (so the tab can be closed),
//   3. archives old snapshots to compressed daily files (archive.ts),
//   4. writes a heartbeat FlowState shows on the Data and Setup tabs.
//
// PAPER ONLY. Nothing here, or in the shared bot code it runs, can place a bet.
//
// Each job runs on its own timer and catches its own errors, so a failure in
// one (a dropped connection, a Betfair hiccup, Supabase down for a minute) only
// costs that one check. If the program itself crashes, systemd restarts it.

import { createClient } from '@supabase/supabase-js'
import { loadConfig, VERSION, CATALOGUE_EVERY_MS, MATCHED_EVERY_MS, RESULTS_EVERY_MS, ARCHIVE_HOUR_UK } from './config'
import { Betfair } from './betfair'
import { Store } from './store'
import { RacingRecorder, type Counters } from './racing'
import { runArchive } from './archive'
import { SportsRecorder } from './sports'
import { errText, log } from './log'
import { installGuard, guardMessage } from './guard'
import { runOnce } from '../../lib/betfair/run'
import { runStrategiesOnce } from '../../lib/betfair/stratRun'
import { unresolved } from '../../lib/betfair/recorder'

const cfg = loadConfig()
installGuard(cfg.supabase.url)      // safety limits on every request, before anything else runs
const db = createClient(cfg.supabase.url, cfg.supabase.key, { auth: { persistSession: false, autoRefreshToken: false } })
const bf = new Betfair(cfg.betfair, cfg.spoolDir)
const store = new Store(db, cfg.spoolDir)
const count: Counters = { checksOk: 0, checksFailed: 0, snaps: 0 }
const racing = new RacingRecorder(bf, store, count)
const sports = new SportsRecorder(bf, store, count)
const startedAt = new Date().toISOString()
let stopping = false

// Runs fn every `ms`, never overlapping itself, never throwing out.
function every(name: string, ms: number, fn: () => Promise<void>, firstDelay = 0) {
  let running = false
  const run = async () => {
    if (stopping) return
    if (!running) {
      running = true
      const t0 = Date.now()
      try { await fn() } catch (e) { log.error(`${name}:`, errText(e)) }
      finally { running = false }
      const took = Date.now() - t0
      if (took > ms * 3 && took > 20_000) log.warn(`${name} took ${(took / 1000).toFixed(0)}s`)
    }
    setTimeout(run, ms)
  }
  setTimeout(run, firstDelay)
}

// Wraps a call so it can't hang: gives up after `ms`.
function limit<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} took longer than ${ms / 1000}s`)), ms))])
}

// ---------------------------------------------------------------- racing recorder
every('race list', CATALOGUE_EVERY_MS, () => racing.refreshCatalogue())
every('total matched', MATCHED_EVERY_MS, () => racing.refreshMatched(), 20_000)
every('prices', 5_000, () => racing.pollPrices(), 10_000)
let lastDbCheck = 0
every('results', RESULTS_EVERY_MS, async () => {
  let extra: string[] = []
  if (Date.now() - lastDbCheck > 10 * 60_000) {         // also settle races from before a restart
    lastDbCheck = Date.now()
    extra = await unresolved(db, 'racing', new Date(Date.now() - 15 * 60_000).toISOString(), 40)
  }
  await racing.collectResults(Date.now(), extra)
}, 60_000)

// ---------------------------------------------------------------- football, tennis, golf
// Needs migration 054 (tennis/golf allowed, competition column). Until it's run,
// these sports are paused and FlowState says so; racing carries on regardless.
let sportsReadyError: string | null = null
every('database check', 10 * 60_000, async () => {
  const { error } = await db.from('bf_markets').select('competition').limit(1).abortSignal(AbortSignal.timeout(10_000))
  if (!error) { if (!sports.enabled || sportsReadyError) log.info('Football, tennis and golf recording on'); sports.enabled = true; sportsReadyError = null; return }
  if (/competition|does not exist|schema cache/i.test(error.message)) {
    if (!sportsReadyError) log.warn('Football, tennis and golf paused: run supabase/migrations/054_betfair_more_sports.sql in the Supabase SQL editor')
    sports.enabled = false
    sportsReadyError = 'Football, tennis and golf paused: run migration 054 in Supabase'
  }
})
every('sports list', 60_000, () => sports.refreshCatalogue(), 30_000)
every('sports prices', 5_000, () => sports.pollPrices(), 40_000)
let lastSportsDbCheck = 0
every('sports results', RESULTS_EVERY_MS, async () => {
  let extra: string[] = []
  if (sports.enabled && Date.now() - lastSportsDbCheck > 10 * 60_000) {
    lastSportsDbCheck = Date.now()
    const before = new Date(Date.now() - 3 * 3600_000).toISOString()
    for (const sp of ['football', 'tennis', 'golf'] as const) extra.push(...await unresolved(db, sp, before, 40))
    extra = extra.filter(id => !sports.markets.has(id))
  }
  await sports.collectResults(Date.now(), extra)
}, 90_000)

// ---------------------------------------------------------------- writes
every('save', 3_000, () => store.flush())

// ---------------------------------------------------------------- paper bots
if (cfg.runBots) {
  // A tiny check first, so a stopped bot costs one small read, not a full state load.
  const isRunning = async (table: string) => {
    const { data } = await db.from(table).select('running').eq('id', 1).abortSignal(AbortSignal.timeout(10_000)).maybeSingle()
    return !!data?.running
  }
  every('desk bot', 5_000, async () => {
    if (!(await isRunning('bf_bot'))) return
    const r = await limit(runOnce(db), 25_000, 'Desk bot')
    if (r.error) log.warn('Desk bot:', r.error)
  }, 15_000)
  every('strategy bot', 60_000, async () => {
    if (!(await isRunning('bf_strat'))) return
    const r = await limit(runStrategiesOnce(db), 50_000, 'Strategy bot')
    if (r.error) log.warn('Strategy bot:', r.error)
  }, 30_000)
}

// ---------------------------------------------------------------- archive, once a night
let lastArchiveDay = ''
every('archive', 10 * 60_000, async () => {
  const uk = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' })
  const [date, hour] = [uk.slice(0, 10), Number(uk.slice(-2))]
  if (hour !== ARCHIVE_HOUR_UK || lastArchiveDay === date) return
  lastArchiveDay = date
  await runArchive(db)
}, 120_000)

// ---------------------------------------------------------------- heartbeat + coverage
let minute = Math.floor(Date.now() / 60_000)
every('coverage', 2_000, async () => {
  const nowMin = Math.floor(Date.now() / 60_000)
  if (nowMin === minute) return
  // one row per minute: how many checks worked or failed, snapshots saved (skipped when idle)
  if (count.checksOk || count.checksFailed || count.snaps) store.add({ kind: 'upsert', table: 'bf_recorder_min', onConflict: 'minute',
    rows: [{ minute: new Date(minute * 60_000).toISOString(), checks_ok: count.checksOk, checks_failed: count.checksFailed, snaps: count.snaps }] })
  count.checksOk = count.checksFailed = count.snaps = 0
  minute = nowMin
})
every('heartbeat', 30_000, async () => {
  const lastError = guardMessage() ?? racing.lastError ?? store.lastError ?? (bf.paused ? 'Betfair logins paused after a login problem' : null)
    ?? sportsReadyError ?? sports.lastError
  const { error } = await db.from('bf_recorder').update({
    version: VERSION, started_at: startedAt, last_beat: new Date().toISOString(),
    last_ok: racing.lastOkAt ? new Date(racing.lastOkAt).toISOString() : null,
    last_error: lastError, ...(lastError ? { last_error_at: new Date().toISOString() } : {}),
    markets_tracked: racing.races.size + sports.markets.size, pending_writes: store.pendingRows,
  }).eq('id', 1).abortSignal(AbortSignal.timeout(10_000))
  if (error) log.warn('Heartbeat not saved:', error.message)
}, 5_000)

// ---------------------------------------------------------------- shutdown and crashes
function shutdown(code: number) {
  stopping = true
  store.persist(true)                                   // pending writes are kept on disk for next time
  log.info('Stopped')
  setTimeout(() => process.exit(code), 200)
}
process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))
process.on('unhandledRejection', e => log.error('Unhandled:', errText(e)))
process.on('uncaughtException', e => { log.error('Crashed:', errText(e)); shutdown(1) })   // systemd restarts it

log.info(`FlowState recorder ${VERSION} started. Records racing, football, tennis and golf prices. Paper only: reads Betfair prices, never places bets.${cfg.runBots ? ' Also running the Desk and Strategies bots.' : ''}`)
