// Safety limits on every network request the recorder makes, whatever code
// makes it (the recorder itself, the paper bots, the Supabase library).
//
//   - Only Betfair and your Supabase project can be contacted. Anything else
//     is refused, so a bug can't send traffic anywhere unexpected.
//   - A per-second limit for each: extra requests wait their turn rather than
//     going out in a burst.
//   - A daily limit for each (UK day). If a bug ever loops, the recorder stops
//     contacting that service until midnight and FlowState shows why, instead
//     of hammering it. The limits are about three times the busiest normal day.
//
// Heartbeat writes are allowed past the Supabase daily limit (about 3,000 a day)
// so FlowState can still show that the limit was hit.

import { log } from './log'

type Rule = { name: string; host: (h: string) => boolean; perSecond: number; perDay: number; exempt?: (url: string) => boolean }
type Usage = { day: string; today: number; recent: number[]; tripped: boolean }

export const LIMITS = {
  betfair: { perSecond: 8, perDay: 150_000 },     // a busy day with every sport is roughly 30,000 to 60,000
  supabase: { perSecond: 15, perDay: 250_000 },   // a busy day with every sport is roughly 50,000 to 100,000
}

const ukDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export class GuardError extends Error {}

const usage = new Map<string, Usage>()
let rules: Rule[] = []
let realFetch: typeof fetch | null = null   // the original, captured once so installing twice can't double-count

export function guardStatus(): { name: string; today: number; limit: number; tripped: boolean }[] {
  return rules.map(r => { const u = usage.get(r.name); return { name: r.name, today: u?.day === ukDay() ? u.today : 0, limit: r.perDay, tripped: !!(u?.tripped && u.day === ukDay()) } })
}

export function guardMessage(): string | null {
  const t = guardStatus().find(s => s.tripped)
  return t ? `Safety limit: ${t.limit.toLocaleString('en-GB')} requests to ${t.name} today. Paused until midnight UK time. This points to a bug; check the server log.` : null
}

export function installGuard(supabaseUrl: string) {
  const supabaseHost = new URL(supabaseUrl).host
  rules = [
    { name: 'Betfair', host: h => h === 'api.betfair.com' || h === 'identitysso.betfair.com' || h === 'historicdata.betfair.com', ...LIMITS.betfair },
    { name: 'Supabase', host: h => h === supabaseHost, ...LIMITS.supabase, exempt: u => u.includes('/rest/v1/bf_recorder?') },
  ]
  if (realFetch) return                      // already installed
  realFetch = globalThis.fetch
  const send = realFetch
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const host = new URL(url).host
    const rule = rules.find(r => r.host(host))
    if (!rule) throw new GuardError(`Blocked a request to ${host}: the recorder only talks to Betfair and Supabase`)

    const day = ukDay()
    let u = usage.get(rule.name)
    if (!u || u.day !== day) { if (u?.tripped) log.info(`New day: ${rule.name} requests allowed again`); u = { day, today: 0, recent: [], tripped: false }; usage.set(rule.name, u) }
    const exempt = rule.exempt?.(url) ?? false
    if (!exempt && u.today >= rule.perDay) {
      if (!u.tripped) { u.tripped = true; log.error(guardMessage()) }
      throw new GuardError(guardMessage() ?? 'Safety limit reached')
    }
    // per-second limit: wait for a free slot
    for (;;) {
      const now = Date.now()
      u.recent = u.recent.filter(t => now - t < 1000)
      if (u.recent.length < rule.perSecond) { u.recent.push(now); break }
      await sleep(1000 - (now - u.recent[0]) + 5)
    }
    if (!exempt) u.today++
    return send(input, init)
  }
}
