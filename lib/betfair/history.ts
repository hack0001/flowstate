// ============================================================
// Betfair historical data (the free "Basic" plan): parsing and the compact
// day files FlowState keeps.
//
// Betfair supplies one compressed file per market: a stream of price updates
// with only the last traded price (no back/lay prices, no money matched) and
// the market's details, result and starting prices.
//
// The recorder's importer (recorder/src/history.ts) turns each market into a
// small summary and saves one gzipped file per sport per day in the private
// storage bucket betfair-history, at <sport>/YYYY-MM-DD.json.gz:
//   - each selection's last traded price on a grid (see SAMPLE below): e.g. for
//     racing every 5 minutes from 3 hours to 75 minutes before the off, then
//     every minute; football and tennis also in play
//   - prices are stored per selection in the runners' order, so a day of GB/IE
//     racing is typically under 100 KB
// expandHistory turns a day file back into markets and snapshots the
// Backtest and Insights tabs already understand.
// ============================================================

import type { BtPoint, BtSport } from './backtest'

export type HistMarket = {
  id: string; ev: string; venue: string | null; cc: string | null; name: string | null; rt: string | null; type: string
  start: string; off: string | null
  runners: [number, string][]            // [selectionId, name]
  win: number[]; rem: number[]
  bsp: (number | null)[]                 // aligned with runners
  s: [number, (number | null)[], 1?][]   // [unix seconds, last traded price per runner, 1 if in play]
}
export type HistDay = { v: 1; day: string; source: 'betfair-basic'; markets: HistMarket[] }
export type HistIndex = { updated: string; days: Record<string, number>; folders?: Record<string, number> }   // folders: Betfair's daily folders fully imported

export const HISTORY_BUCKET = 'betfair-history'
export const historyPath = (sport: BtSport, day: string) => `${sport}/${day}.json.gz`

// Race type from the race name when Betfair doesn't give one ("2m4f Hcap Chs" → Chase).
export function raceTypeFromName(name?: string | null): string | null {
  if (!name) return null
  if (/\bChs\b|Chase/i.test(name)) return 'Chase'
  if (/\bHrd\b|Hurdle/i.test(name)) return 'Hurdle'
  if (/\bI?NHF\b|Bumper|NH Flat/i.test(name)) return 'NH Flat'
  return 'Flat'
}

type Def = {
  eventName?: string; venue?: string; countryCode?: string; name?: string; raceType?: string; marketType?: string
  marketTime?: string; inPlay?: boolean; status?: string
  runners?: { id: number; name?: string; status?: string; sortPriority?: number; bsp?: number | string }[]
}

// How each sport is sampled from Betfair's file. Pre-start: every `early` minutes from
// `fromMin` before the off, then every minute from `fineMin`. In play: every `inPlayEvery`
// minutes for up to `inPlayMax` minutes (0 = not kept). Golf runs for days, so it's hourly.
export type SamplePlan = { fromMin: number; early: number; fineMin: number; fine: number; inPlayEvery: number; inPlayMax: number }
export const SAMPLE: Record<BtSport, SamplePlan> = {
  racing: { fromMin: 180, early: 5, fineMin: 75, fine: 1, inPlayEvery: 0, inPlayMax: 0 },
  football: { fromMin: 180, early: 5, fineMin: 60, fine: 1, inPlayEvery: 1, inPlayMax: 150 },
  tennis: { fromMin: 120, early: 5, fineMin: 30, fine: 1, inPlayEvery: 2, inPlayMax: 300 },
  golf: { fromMin: 72 * 60, early: 60, fineMin: 0, fine: 60, inPlayEvery: 60, inPlayMax: 5 * 24 * 60 },
}

// Correct Score has ~19 selections and is kept mainly for its result (the exact final score,
// which the Dixon-Coles model learns from), so only a few prices before kick-off are kept.
export const SAMPLE_CORRECT_SCORE: SamplePlan = { fromMin: 60, early: 30, fineMin: 0, fine: 60, inPlayEvery: 0, inPlayMax: 0 }

// One Betfair Basic market file (already decompressed) → a compact summary, or null if unusable.
export function parseMarketFile(text: string, planIn: SamplePlan = SAMPLE.racing): HistMarket | null {
  let plan = planIn
  let id = ''
  let def: Def | null = null
  let offAt: number | null = null
  let lastPt = 0
  const ticks: [number, number, number][] = []          // [time ms, selectionId, ltp]
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let msg: { pt?: number; mc?: { id: string; marketDefinition?: Def; rc?: { id: number; ltp?: number }[] }[] }
    try { msg = JSON.parse(line) } catch { continue }
    const pt = msg.pt ?? 0
    lastPt = Math.max(lastPt, pt)
    for (const mc of msg.mc ?? []) {
      id ||= mc.id
      if (mc.marketDefinition) {
        def = Object.assign({}, def ?? {}, mc.marketDefinition) as Def
        if (mc.marketDefinition.inPlay && offAt === null) offAt = pt
        if (mc.marketDefinition.status === 'CLOSED') lastPt = Math.min(lastPt, pt)
      }
      for (const rc of mc.rc ?? []) if (typeof rc.ltp === 'number' && (offAt === null || plan.inPlayEvery > 0)) ticks.push([pt, rc.id, rc.ltp])
    }
  }
  if (!id || !def?.runners?.length || !def.marketTime) return null
  if (def.marketType === 'CORRECT_SCORE') plan = SAMPLE_CORRECT_SCORE
  const runners = [...def.runners].sort((a, b) => (a.sortPriority ?? 99) - (b.sortPriority ?? 99))
  const idx = new Map(runners.map((r, i) => [r.id, i]))
  const start = new Date(def.marketTime).getTime()
  const off = offAt ?? start
  const end = off - 1000                                 // the last moment before the off

  // the sampling grid: [time, in play?]
  const grid: [number, boolean][] = []
  for (let m = plan.fromMin; m > plan.fineMin; m -= plan.early) grid.push([off - m * 60_000, false])
  for (let m = plan.fineMin; m >= plan.fine; m -= plan.fine) grid.push([off - m * 60_000, false])
  grid.push([end, false])
  if (offAt && plan.inPlayEvery) for (let m = plan.inPlayEvery; m <= plan.inPlayMax && off + m * 60_000 <= lastPt; m += plan.inPlayEvery) grid.push([off + m * 60_000, true])
  ticks.sort((a, b) => a[0] - b[0])
  const state: (number | null)[] = runners.map(() => null)
  const s: HistMarket['s'] = []
  let k = 0
  for (const [g, inplay] of grid) {
    while (k < ticks.length && ticks[k][0] <= g) { const i = idx.get(ticks[k][1]); if (i !== undefined) state[i] = ticks[k][2]; k++ }
    if (state.some(v => v !== null)) s.push(inplay ? [Math.round(g / 1000), [...state], 1] : [Math.round(g / 1000), [...state]])
  }
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 1 ? Math.round(n * 100) / 100 : null }
  return {
    id, ev: def.eventName ?? def.venue ?? '', venue: def.venue ?? null, cc: def.countryCode ?? null, name: def.name ?? null,
    rt: def.marketType === 'WIN' || def.marketType === 'PLACE' ? def.raceType ?? raceTypeFromName(def.name) : null, type: def.marketType ?? 'WIN',
    start: new Date(start).toISOString(), off: offAt ? new Date(offAt).toISOString() : null,
    runners: runners.map(r => [r.id, r.name ?? String(r.id)]),
    win: runners.filter(r => r.status === 'WINNER').map(r => r.id), rem: runners.filter(r => r.status === 'REMOVED').map(r => r.id),
    bsp: runners.map(r => num(r.bsp)), s,
  }
}

// A day file → markets (in the shape the Backtest and Insights routes use) and each market's snapshots.
export function expandHistory(d: HistDay, sport: BtSport) {
  const markets = d.markets.map(m => ({
    market_id: m.id, sport, market_type: m.type, event: m.ev, venue: m.venue, competition: null, country: m.cc, market_name: m.name, race_type: m.rt,
    start_at: m.start, off_at: m.off, runners: m.runners.map(([id, name]) => ({ id, name })), winners: m.win, removed: m.rem,
    bsp: Object.fromEntries(m.runners.map(([id], i) => [String(id), m.bsp[i]]).filter(([, v]) => v != null)) as Record<string, number>,
    total_matched: null, status: 'CLOSED',
  }))
  const snaps = new Map<string, BtPoint[]>()
  for (const m of d.markets) {
    snaps.set(m.id, m.s.map(([t, ltps, ip]) => ({
      at: new Date(t * 1000).toISOString(), matched: null, inplay: ip === 1,
      runners: m.runners.map(([id], i) => [id, null, 0, null, 0, ltps[i]] as BtPoint['runners'][number]).filter(r => r[5] !== null),
    })))
  }
  return { markets, snaps }
}
