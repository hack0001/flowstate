// ============================================================
// Google Search Console client + sync into Supabase.
//
// SERVER-ONLY. Authenticates with the same Workspace domain-wide delegation
// the Script Editor uses (impersonating GOOGLE_WORKSPACE_IMPERSONATE_EMAIL),
// but requests ONLY the read-only Search Console scope -- this code cannot
// change anything in Search Console, it can only read.
//
// So it sees every property that Google account can see (domain properties
// "sc-domain:example.com" and URL-prefix ones "https://www.example.com/").
//
// ONE-TIME SETUP (you, as Workspace Super Admin):
//   1. Cloud Console -> APIs & Services -> Library -> enable
//      "Google Search Console API" (same project as the service account).
//   2. admin.google.com -> Security -> Access and data control -> API controls
//      -> Domain-wide delegation -> edit the existing flowstate client ->
//      ADD this scope alongside the existing ones (comma-separated):
//        https://www.googleapis.com/auth/webmasters.readonly
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { getImpersonatedAccessToken } from './googleDrive'

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const API = 'https://www.googleapis.com/webmasters/v3'

// Search Console data is only "final" about 2 days behind; asking for newer
// days returns partial numbers that later get revised.
const DATA_LAG_DAYS = 2
// First sync of a site pulls this much history; later syncs only top up.
const BACKFILL_DAILY_DAYS = 90
const BACKFILL_DETAIL_DAYS = 28
// Detail rows kept per site per day (Google can return thousands).
const KEEP_QUERIES_PER_DAY = 150
const KEEP_PAGES_PER_DAY = 75
// Detail rows older than this get pruned so the database stays small.
const DETAIL_RETENTION_DAYS = 400

export type GscSiteEntry = { siteUrl: string; permissionLevel: string }

type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }

async function gscFetch(path: string, init: RequestInit = {}): Promise<any> {
  const attempt = async (forceRefresh: boolean) => {
    const token = await getImpersonatedAccessToken(forceRefresh, GSC_SCOPE)
    return fetch(API + path, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    })
  }
  let res = await attempt(false)
  if (res.status === 401 || res.status === 403) res = await attempt(true)
  if (!res.ok) {
    const body = await res.text()
    if (/insufficient authentication scopes|unauthorized_client|access_denied/i.test(body)) {
      throw new Error('Google refused the Search Console scope. Add https://www.googleapis.com/auth/webmasters.readonly to the service account\'s domain-wide delegation in the Admin Console (see the header of lib/searchConsole.ts). Raw: ' + body)
    }
    if (/has not been used in project|accessNotConfigured|SERVICE_DISABLED/i.test(body)) {
      throw new Error('The Google Search Console API isn\'t enabled for this Cloud project yet. Enable it under APIs & Services -> Library. Raw: ' + body)
    }
    throw new Error('Search Console API error ' + res.status + ': ' + body)
  }
  return res.json()
}

export async function listGscSites(): Promise<GscSiteEntry[]> {
  const data = await gscFetch('/sites')
  const entries: GscSiteEntry[] = data.siteEntry ?? []
  // An unverified user can't query data, so there's nothing to track.
  return entries.filter(e => e.permissionLevel !== 'siteUnverifiedUser')
}

async function searchAnalytics(
  siteUrl: string,
  body: { startDate: string; endDate: string; dimensions: string[]; rowLimit: number; startRow?: number },
): Promise<GscRow[]> {
  const data = await gscFetch('/sites/' + encodeURIComponent(siteUrl) + '/searchAnalytics/query', {
    method: 'POST',
    body: JSON.stringify({ ...body, type: 'web' }),
  })
  return data.rows ?? []
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// Upsert in chunks -- PostgREST rejects very large payloads.
async function upsertChunked(db: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 1000), { onConflict })
    if (error) throw new Error(table + ': ' + error.message)
  }
}

// Keeps only the top N rows (by clicks, then impressions) for each date.
function topPerDate(rows: GscRow[], keep: number): GscRow[] {
  const byDate = new Map<string, GscRow[]>()
  for (const r of rows) {
    const d = r.keys?.[0] ?? ''
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(r)
  }
  const out: GscRow[] = []
  byDate.forEach(list => {
    list.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    out.push(...list.slice(0, keep))
  })
  return out
}

export type SyncSiteResult = { siteUrl: string; days: number; queries: number; pages: number; from: string; to: string }

// Pulls new data for ONE site and stores it. Idempotent -- re-running over the
// same dates just overwrites the same rows. Deliberately one site per call so
// a serverless time limit can never be hit by a long list of sites.
export async function syncSite(db: SupabaseClient, siteUrl: string): Promise<SyncSiteResult> {
  const end = isoDate(daysAgo(DATA_LAG_DAYS))

  // Where did we get to last time? Re-pull a few trailing days to fill gaps.
  const { data: last } = await db
    .from('gsc_daily').select('date').eq('site_url', siteUrl).order('date', { ascending: false }).limit(1).maybeSingle()
  const dailyStart = last?.date
    ? isoDate(new Date(new Date(last.date + 'T00:00:00Z').getTime() - 3 * 86400000))
    : isoDate(daysAgo(BACKFILL_DAILY_DAYS))
  const detailStart = last?.date
    ? dailyStart
    : isoDate(daysAgo(BACKFILL_DETAIL_DAYS))

  if (dailyStart > end) {
    await db.from('gsc_sites').update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq('site_url', siteUrl)
    return { siteUrl, days: 0, queries: 0, pages: 0, from: dailyStart, to: end }
  }

  // 1) Site-level daily totals.
  const dailyRows = await searchAnalytics(siteUrl, { startDate: dailyStart, endDate: end, dimensions: ['date'], rowLimit: 1000 })
  await upsertChunked(db, 'gsc_daily', dailyRows.map(r => ({
    site_url: siteUrl, date: r.keys![0], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), ctr: r.ctr, position: r.position,
  })), 'site_url,date')

  // 2) Top queries per day.
  const queryRows = topPerDate(
    await searchAnalytics(siteUrl, { startDate: detailStart, endDate: end, dimensions: ['date', 'query'], rowLimit: 25000 }),
    KEEP_QUERIES_PER_DAY,
  )
  await upsertChunked(db, 'gsc_queries', queryRows.map(r => ({
    site_url: siteUrl, date: r.keys![0], query: r.keys![1], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: r.position,
  })), 'site_url,date,query')

  // 3) Top pages per day.
  const pageRows = topPerDate(
    await searchAnalytics(siteUrl, { startDate: detailStart, endDate: end, dimensions: ['date', 'page'], rowLimit: 25000 }),
    KEEP_PAGES_PER_DAY,
  )
  await upsertChunked(db, 'gsc_pages', pageRows.map(r => ({
    site_url: siteUrl, date: r.keys![0], page: r.keys![1], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: r.position,
  })), 'site_url,date,page')

  // Housekeeping: drop detail rows past retention.
  const cutoff = isoDate(daysAgo(DETAIL_RETENTION_DAYS))
  await db.from('gsc_queries').delete().eq('site_url', siteUrl).lt('date', cutoff)
  await db.from('gsc_pages').delete().eq('site_url', siteUrl).lt('date', cutoff)

  await db.from('gsc_sites').update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq('site_url', siteUrl)
  return { siteUrl, days: dailyRows.length, queries: queryRows.length, pages: pageRows.length, from: dailyStart, to: end }
}

// Finds every property the account can see and records any new ones. Existing
// rows keep their label / tracked flag -- only permission level is refreshed.
export async function discoverSites(db: SupabaseClient): Promise<GscSiteEntry[]> {
  const sites = await listGscSites()
  if (sites.length === 0) return sites
  const { data: existing } = await db.from('gsc_sites').select('site_url')
  const known = new Set((existing ?? []).map((r: { site_url: string }) => r.site_url))
  const fresh = sites.filter(s => !known.has(s.siteUrl))
  if (fresh.length > 0) {
    const { error } = await db.from('gsc_sites').insert(fresh.map(s => ({ site_url: s.siteUrl, permission_level: s.permissionLevel })))
    if (error) throw new Error('gsc_sites: ' + error.message)
  }
  for (const s of sites.filter(s => known.has(s.siteUrl))) {
    await db.from('gsc_sites').update({ permission_level: s.permissionLevel }).eq('site_url', s.siteUrl)
  }
  return sites
}

// Records a failure against the site so the dashboard can show it.
export async function recordSyncError(db: SupabaseClient, siteUrl: string, message: string) {
  await db.from('gsc_sites').update({ last_sync_error: message.slice(0, 500) }).eq('site_url', siteUrl)
}
