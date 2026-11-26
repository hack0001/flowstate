// Writes to Supabase without ever losing data to a dropped connection.
//
// Every write goes into a queue. The queue is sent in order; if Supabase is
// unreachable the writes wait (and are copied to disk, so a restart doesn't
// lose them) and are retried every few seconds until they go through.
// Snapshot inserts ignore duplicates, so a retry after a half-finished write
// is harmless.

import fs from 'fs'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_PENDING_ROWS, REQUEST_TIMEOUT_MS } from './config'
import { errText, log } from './log'

type Row = Record<string, unknown>
export type Write =
  | { kind: 'upsert'; table: string; rows: Row[]; onConflict: string; ignoreDuplicates?: boolean }
  | { kind: 'update'; table: string; match: Record<string, string>; values: Row }

// A database error that retrying can't fix (a missing column, a value the table
// refuses). Network trouble and timeouts have no code, so they are retried.
class WriteError extends Error { constructor(message: string, public code: string) { super(message) } }
const permanent = (e: unknown) => e instanceof WriteError && /^(22|23|42|PGRST)/.test(e.code)

export class Store {
  private queue: Write[] = []
  private flushing = false
  private spoolFile: string
  private dirty = false
  private lastPersist = 0
  lastError: string | null = null

  constructor(public db: SupabaseClient, spoolDir: string) {
    fs.mkdirSync(spoolDir, { recursive: true })
    this.spoolFile = path.join(spoolDir, 'pending-writes.json')
    try {
      if (fs.existsSync(this.spoolFile)) {
        this.queue = JSON.parse(fs.readFileSync(this.spoolFile, 'utf8')) as Write[]
        if (this.queue.length) log.info(`Picked up ${this.pendingRows} writes saved on disk before the last restart`)
      }
    } catch (e) {
      log.error('Could not read saved writes, starting fresh:', errText(e))
      this.queue = []
    }
  }

  get pendingRows() { return this.queue.reduce((n, w) => n + (w.kind === 'upsert' ? w.rows.length : 1), 0) }

  add(w: Write) {
    if (w.kind === 'upsert' && !w.rows.length) return
    this.queue.push(w)
    this.dirty = true
    // If Supabase has been away a long time, drop the oldest price snapshots first.
    while (this.pendingRows > MAX_PENDING_ROWS) {
      const i = this.queue.findIndex(q => q.kind === 'upsert' && q.table === 'bf_snaps')
      if (i < 0) break
      log.warn(`Too many writes waiting; dropping ${(this.queue[i] as { rows: Row[] }).rows.length} old snapshots`)
      this.queue.splice(i, 1)
    }
  }

  private async send(w: Write): Promise<void> {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const { error } = w.kind === 'upsert'
      ? await this.db.from(w.table).upsert(w.rows, { onConflict: w.onConflict, ignoreDuplicates: !!w.ignoreDuplicates }).abortSignal(signal)
      : await Object.entries(w.match).reduce((q, [k, v]) => q.eq(k, v), this.db.from(w.table).update(w.values)).abortSignal(signal)
    if (error) throw new WriteError(error.message, (error as { code?: string }).code ?? '')
  }

  // Send everything waiting, in order. Stops at the first failure and tries again next time.
  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    try {
      while (this.queue.length) {
        const w = this.queue[0]
        // Big snapshot batches go in pieces so one request never gets too large.
        if (w.kind === 'upsert' && w.rows.length > 500) {
          await this.send({ ...w, rows: w.rows.slice(0, 500) })
          w.rows = w.rows.slice(500)
        } else {
          await this.send(w)
          this.queue.shift()
        }
        this.dirty = true
        if (this.lastError) { log.info('Supabase writes working again'); this.lastError = null }
      }
    } catch (e) {
      const msg = errText(e)
      if (permanent(e)) {
        // Set it aside so one bad write can't hold up everything behind it.
        const w = this.queue.shift()!
        this.reject(w, msg)
        this.dirty = true
        this.lastError = `A write to ${w.table} was refused and set aside: ${msg}`
        log.error(this.lastError)
        return
      }
      if (msg !== this.lastError) log.warn(`Supabase write failed, will retry (${this.pendingRows} rows waiting): ${msg}`)
      this.lastError = msg
    } finally {
      this.flushing = false
      this.persist()
    }
  }

  // Refused writes go to rejected-writes.jsonl next to the spool (capped at 20 MB) so nothing is silently lost.
  private reject(w: Write, reason: string) {
    try {
      const file = path.join(path.dirname(this.spoolFile), 'rejected-writes.jsonl')
      const size = fs.existsSync(file) ? fs.statSync(file).size : 0
      if (size < 20 * 1024 * 1024) fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), reason, write: w }) + '\n')
    } catch (e) {
      log.error('Could not keep the refused write:', errText(e))
    }
  }

  // Copy the queue to disk (atomically) when it has changed: straight away once it's
  // empty again, otherwise at most every 30 seconds so a long outage isn't rewriting
  // a big file every few seconds.
  persist(force = false) {
    if (!this.dirty) return
    if (!force && this.queue.length && Date.now() - this.lastPersist < 30_000) return
    try {
      const tmp = this.spoolFile + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.queue))
      fs.renameSync(tmp, this.spoolFile)
      this.dirty = false
      this.lastPersist = Date.now()
    } catch (e) {
      log.error('Could not save pending writes to disk:', errText(e))
    }
  }
}
