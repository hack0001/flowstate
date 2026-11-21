// Reads one day's archive file (betfair-archive/YYYY-MM-DD.json.gz, written by
// the recorder server). SERVER-ONLY.
//
// Tries as the signed-in owner first (allowed by migration 057), then with the
// Supabase secret key if Vercel has one. Returns an error message rather than
// throwing, so a missing file can't stop a whole backtest.

import zlib from 'zlib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

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
