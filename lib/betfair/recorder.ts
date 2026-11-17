// ============================================================
// Price recorder. SERVER-ONLY.
//
// Saves what the live bots see so it can be exported or replayed later:
//   bf_markets  one row per market: sport, type, event, start, runner names,
//               and (once Betfair settles it) the winners
//   bf_snaps    price snapshots: best back/lay, sizes and last traded price
//               for every runner, at a moment in time
//
// Live mode only (demo data is invented). Recording must never stop the bots,
// so every function here swallows its own errors and logs them instead.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export type Sport = 'racing' | 'football'
export type MarketRec = {
  market_id: string; sport: Sport; market_type: string; event_id: string | null; event: string
  venue: string | null; start_at: string; runners: { id: number; name: string }[]
}
// [selectionId, back, backSize, lay, laySize, lastTraded]
export type SnapRunner = [number, number | null, number, number | null, number, number | null]
export type SnapRec = { market_id: string; at: string; inplay: boolean; matched: number | null; runners: SnapRunner[] }
export type ResultRec = { market_id: string; status: string; winners: number[]; removed: number[] }

type RawBookLike = {
  marketId: string; status?: string; inplay?: boolean; totalMatched?: number
  runners: { selectionId: number; status?: string; lastPriceTraded?: number; ex?: { availableToBack?: { price: number; size: number }[]; availableToLay?: { price: number; size: number }[] } }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function toSnap(b: RawBookLike, at: string): SnapRec {
  return {
    market_id: b.marketId, at, inplay: !!b.inplay, matched: typeof b.totalMatched === 'number' ? r2(b.totalMatched) : null,
    runners: b.runners.filter(r => r.status === undefined || r.status === 'ACTIVE').map(r => {
      const bb = r.ex?.availableToBack?.[0], ll = r.ex?.availableToLay?.[0]
      return [r.selectionId, bb?.price ?? null, bb ? r2(bb.size) : 0, ll?.price ?? null, ll ? r2(ll.size) : 0, r.lastPriceTraded ?? null]
    }),
  }
}

export function toResult(b: RawBookLike): ResultRec | null {
  if (b.status !== 'CLOSED') return null
  return {
    market_id: b.marketId, status: 'CLOSED',
    winners: b.runners.filter(r => r.status === 'WINNER').map(r => r.selectionId),
    removed: b.runners.filter(r => r.status === 'REMOVED').map(r => r.selectionId),
  }
}

async function guard(what: string, fn: () => PromiseLike<{ error: { message: string } | null } | void> | void) {
  try {
    const r = await fn()
    if (r && 'error' in r && r.error) console.error(`[recorder] ${what}: ${r.error.message}`)
  } catch (e) {
    console.error(`[recorder] ${what}:`, e instanceof Error ? e.message : e)
  }
}

export async function saveMarkets(db: SupabaseClient, recs: MarketRec[]) {
  if (!recs.length) return
  const unique = Array.from(new Map(recs.map(r => [r.market_id, r])).values())
  // ignoreDuplicates: never overwrite a market's saved result with a fresh catalogue copy
  await guard('markets', () => db.from('bf_markets').upsert(unique, { onConflict: 'market_id', ignoreDuplicates: true }))
}

export async function saveSnaps(db: SupabaseClient, snaps: SnapRec[]) {
  if (snaps.length) await guard('snaps', () => db.from('bf_snaps').insert(snaps))
}

export async function saveResults(db: SupabaseClient, results: ResultRec[]) {
  for (const r of results) {
    await guard('result', () => db.from('bf_markets').update({ status: r.status, winners: r.winners, removed: r.removed, result_at: new Date().toISOString() })
      .eq('market_id', r.market_id).is('status', null))
  }
}

// Recorded markets that started a while ago and still have no result.
export async function unresolved(db: SupabaseClient, sport: Sport, startedBefore: string, limit: number): Promise<string[]> {
  if (limit <= 0) return []
  try {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString()   // give up after 3 days (abandoned markets)
    const { data, error } = await db.from('bf_markets').select('market_id').eq('sport', sport).is('status', null)
      .lt('start_at', startedBefore).gt('start_at', since).order('start_at', { ascending: true }).limit(limit)
    if (error) { console.error('[recorder] unresolved:', error.message); return [] }
    return (data ?? []).map(d => d.market_id as string)
  } catch {
    return []
  }
}
