// Reads one day's archive file (betfair-archive/YYYY-MM-DD.json.gz, written by
// the recorder server). SERVER-ONLY.
//
// Tries as the signed-in owner first (allowed by migration 057), then with the
// Supabase secret key if Vercel has one. Returns an error message rather than
// throwing, so a missing file can't stop a whole backtest.

import zlib from 'zlib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import type { BtSport } from './backtest'
import { HISTORY_BUCKET, historyPath, type HistDay, type HistIndex } from './history'

export type ArchiveSnap = { market_id: string; at: string; inplay?: boolean; matched: number | null; runners: [number, number | null, number, number | null, number, number | null][] }

export async function readArchiveDay(userDb: SupabaseClient, day: string): Promise<{ snaps: ArchiveSnap[] } | { error: string }> {
  const path = `${day}.json.gz`
  const tries: (() => SupabaseClient)[] = [() => userDb]
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) tries.push(() => createSupabaseServiceClient())
  let last = ''
  for (const client of tries) {
    try {
      const { data, error } = await client().storage.from('betfair-archive').download(path)
      if (error || !data) { last = error?.message ?? 'missing'; continue }
      const parsed = JSON.parse(zlib.gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as { snaps?: ArchiveSnap[] }
      return { snaps: parsed.snaps ?? [] }
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  return { error: /not found/i.test(last)
    ? `The archived prices for ${day} couldn't be opened (${last}). Run supabase/migrations/057_betfair_archive_read.sql in the Supabase SQL editor so FlowState can read the archive.`
    : `The archived prices for ${day} couldn't be read: ${last}` }
}

// One day of imported Betfair history (see lib/betfair/history.ts). null when that day hasn't been imported.
export async function readHistoryDay(userDb: SupabaseClient, sport: BtSport, day: string): Promise<HistDay | null | { error: string }> {
  return readHistoryJson<HistDay>(userDb, historyPath(sport, day), true)
}
export async function readHistoryIndex(userDb: SupabaseClient, sport: BtSport): Promise<HistIndex | null | { error: string }> {
  return readHistoryJson<HistIndex>(userDb, `${sport}/index.json`, false)
}
async function readHistoryJson<T>(userDb: SupabaseClient, path: string, gz: boolean): Promise<T | null | { error: string }> {
  const tries: (() => SupabaseClient)[] = [() => userDb]
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) tries.push(() => createSupabaseServiceClient())
  let last = ''
  for (const client of tries) {
    try {
      const { data, error } = await client().storage.from(HISTORY_BUCKET).download(path)
      if (error || !data) { last = error?.message ?? 'missing'; continue }
      const buf = Buffer.from(await data.arrayBuffer())
      return JSON.parse((gz ? zlib.gunzipSync(buf) : buf).toString('utf8')) as T
    } catch (e) { last = e instanceof Error ? e.message : String(e) }
  }
  if (/object not found|not_found|404/i.test(last)) return null
  if (/bucket not found/i.test(last)) return { error: 'Historical data isn\'t set up yet: run supabase/migrations/058_betfair_history.sql in the Supabase SQL editor, then import (see the Setup tab).' }
  return { error: `Historical prices couldn't be read: ${last}` }
}
