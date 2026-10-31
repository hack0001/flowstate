// ============================================================
// Browser-side reads + pure number-crunching for the SEO dashboard
// (app/seo/page.tsx). Reads go straight to Supabase as the signed-in owner
// (Row Level Security enforces that); writes to Google never happen here --
// syncing goes through /api/gsc/sync.
// ============================================================

import { supabase } from './supabase'

export type GscSite = {
  site_url: string
  label: string | null
  permission_level: string | null
  tracked: boolean
  last_synced_at: string | null
  last_sync_error: string | null
}

export type GscDay = { site_url: string; date: string; clicks: number; impressions: number; ctr: number; position: number }

export type GscMover = {
  key: string // the query text or page URL
  clicks_now: number; clicks_prev: number
  impressions_now: number; impressions_prev: number
  position_now: number | null; position_prev: number | null
}

const PAGE = 1000 // PostgREST's default per-request row cap

export async function getGscSites(): Promise<{ sites: GscSite[]; error: string | null }> {
  const { data, error } = await supabase.from('gsc_sites').select('*').order('site_url', { ascending: true })
  if (error) return { sites: [], error: explainGscError(error.message) }
  return { sites: (data as GscSite[]) ?? [], error: null }
}

// Daily rows for every given site since `sinceIso`, paged past the 1000-row cap.
export async function getGscDaily(siteUrls: string[], sinceIso: string): Promise<{ rows: GscDay[]; error: string | null }> {
  if (siteUrls.length === 0) return { rows: [], error: null }
  const rows: GscDay[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('gsc_daily').select('site_url,date,clicks,impressions,ctr,position')
      .in('site_url', siteUrls).gte('date', sinceIso)
      .order('site_url', { ascending: true }).order('date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { rows: [], error: explainGscError(error.message) }
    rows.push(...((data as GscDay[]) ?? []))
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

async function getMovers(fn: 'gsc_query_movers' | 'gsc_page_movers', siteUrl: string, days: number): Promise<{ rows: GscMover[]; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, { p_site: siteUrl, p_days: days })
  if (error) return { rows: [], error: explainGscError(error.message) }
  const rows = ((data as Record<string, unknown>[]) ?? []).map(r => ({
    key: String(r.query ?? r.page ?? ''),
    clicks_now: Number(r.clicks_now), clicks_prev: Number(r.clicks_prev),
    impressions_now: Number(r.impressions_now), impressions_prev: Number(r.impressions_prev),
    position_now: r.position_now == null ? null : Number(r.position_now),
    position_prev: r.position_prev == null ? null : Number(r.position_prev),
  }))
  return { rows, error: null }
}
export const getQueryMovers = (siteUrl: string, days: number) => getMovers('gsc_query_movers', siteUrl, days)
export const getPageMovers = (siteUrl: string, days: number) => getMovers('gsc_page_movers', siteUrl, days)

export async function setSiteTracked(siteUrl: string, tracked: boolean): Promise<string | null> {
  const { error } = await supabase.from('gsc_sites').update({ tracked }).eq('site_url', siteUrl)
  return error ? explainGscError(error.message) : null
}

function explainGscError(message: string): string {
  if (/gsc_|relation .* does not exist|function .* does not exist/i.test(message)) {
    return 'Setup needed: run supabase/migrations/049_search_console.sql against your database first.'
  }
  return message
}

// ---------- pure helpers ----------

export function siteLabel(siteUrl: string): string {
  if (siteUrl.startsWith('sc-domain:')) return siteUrl.slice('sc-domain:'.length)
  return siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function pagePath(pageUrl: string): string {
  try {
    const u = new URL(pageUrl)
    return (u.pathname + u.search) || '/'
  } catch {
    return pageUrl
  }
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type Totals = { clicks: number; impressions: number; ctr: number; position: number }

function totalsOf(rows: GscDay[]): Totals {
  let clicks = 0, impressions = 0, posWeighted = 0
  for (const r of rows) {
    clicks += r.clicks
    impressions += r.impressions
    posWeighted += r.position * r.impressions
  }
  return {
    clicks, impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? posWeighted / impressions : 0,
  }
}

export type SiteSummary = {
  now: Totals
  prev: Totals
  hasPrev: boolean
  series: GscDay[]      // the current window, oldest -> newest
  lastDate: string | null
}

// "The latest N days we have" vs "the N days before that". Anchored on the
// site's own newest row (not today's date) because Search Console data lags.
export function summarise(rows: GscDay[], windowDays: number): SiteSummary {
  if (rows.length === 0) {
    const zero = { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    return { now: zero, prev: zero, hasPrev: false, series: [], lastDate: null }
  }
  const lastDate = rows[rows.length - 1].date
  const nowStart = addDays(lastDate, -windowDays) // exclusive
  const prevStart = addDays(lastDate, -2 * windowDays)
  const nowRows = rows.filter(r => r.date > nowStart)
  const prevRows = rows.filter(r => r.date > prevStart && r.date <= nowStart)
  return { now: totalsOf(nowRows), prev: totalsOf(prevRows), hasPrev: prevRows.length > 0, series: nowRows, lastDate }
}

// Percent change; null when there's no meaningful base to compare against.
export function pctChange(now: number, prev: number): number | null {
  if (prev <= 0) return null
  return ((now - prev) / prev) * 100
}

export type SiteAlert = { level: 'red' | 'amber'; reasons: string[] }

// Fixed 7-day comparison (independent of the window picker) so an alert means
// the same thing every time you look. Ignores tiny sites where a few clicks
// either way is just noise.
export function alertFor(rows: GscDay[]): SiteAlert | null {
  const s = summarise(rows, 7)
  if (!s.hasPrev || s.prev.clicks < 30) return null
  const reasons: string[] = []
  let level: 'red' | 'amber' | null = null
  const clickChange = pctChange(s.now.clicks, s.prev.clicks)
  if (clickChange !== null && clickChange <= -30) { level = 'red'; reasons.push('Clicks down ' + Math.round(-clickChange) + '% vs previous 7 days') }
  else if (clickChange !== null && clickChange <= -15) { level = 'amber'; reasons.push('Clicks down ' + Math.round(-clickChange) + '% vs previous 7 days') }
  const imprChange = pctChange(s.now.impressions, s.prev.impressions)
  if (imprChange !== null && imprChange <= -40) { level = level ?? 'amber'; reasons.push('Impressions down ' + Math.round(-imprChange) + '%') }
  if (s.prev.position > 0 && s.now.position - s.prev.position >= 3 && s.now.impressions >= 500) {
    level = level ?? 'amber'
    reasons.push('Average position slipped ' + (s.now.position - s.prev.position).toFixed(1) + ' places')
  }
  return level ? { level, reasons } : null
}
