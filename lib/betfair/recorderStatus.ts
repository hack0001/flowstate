// The recorder server's heartbeat (bf_recorder), as FlowState shows it.
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecorderStatus = {
  alive: boolean; lastBeat: string | null; lastOk: string | null; lastError: string | null; lastErrorAt: string | null
  marketsTracked: number; pendingWrites: number; version: string | null; startedAt: string | null
}

const ALIVE_MS = 90_000   // no heartbeat for 90 seconds = offline

// null if the recorder has never been set up (table missing).
export async function recorderStatus(db: SupabaseClient): Promise<RecorderStatus | null> {
  const { data, error } = await db.from('bf_recorder').select('version, started_at, last_beat, last_ok, last_error, last_error_at, markets_tracked, pending_writes').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return {
    alive: !!data.last_beat && Date.now() - new Date(data.last_beat).getTime() < ALIVE_MS,
    lastBeat: data.last_beat, lastOk: data.last_ok, lastError: data.last_error, lastErrorAt: data.last_error_at,
    marketsTracked: data.markets_tracked ?? 0, pendingWrites: data.pending_writes ?? 0, version: data.version, startedAt: data.started_at,
  }
}
