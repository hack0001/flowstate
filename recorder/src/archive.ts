// Daily archive: moves price snapshots older than three days out of the database
// into one compressed file per day in Supabase Storage (bucket betfair-archive,
// path YYYY-MM-DD.json.gz). About a tenth of the size.
//
// Safe order: write the file, read it back and check it, mark the markets as
// archived, and only then delete their snapshots. If any step fails, nothing
// is deleted and it tries again the next night. Market rows (race details and
// results) stay in the database; they are small.

import zlib from 'zlib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ARCHIVE_AFTER_DAYS } from './config'
import { errText, log } from './log'

export const BUCKET = 'betfair-archive'
type Row = Record<string, unknown> & { market_id: string }
type ArchiveFile = { version: 1; day: string; markets: Row[]; snaps: (Row & { at: string })[] }

const dayStart = (d: string) => `${d}T00:00:00Z`
const nextDay = (d: string) => new Date(new Date(dayStart(d)).getTime() + 86_400_000).toISOString().slice(0, 10)

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

async function readFile(db: SupabaseClient, day: string): Promise<ArchiveFile | null> {
  const { data, error } = await db.storage.from(BUCKET).download(`${day}.json.gz`)
  if (error || !data) return null
  return JSON.parse(zlib.gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as ArchiveFile
}

async function archiveDay(db: SupabaseClient, day: string): Promise<number> {
  // Markets still running (a golf tournament, a match awaiting its result) wait for a later night,
  // unless they're over a week old.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const markets = await all<Row>((a, b) => db.from('bf_markets').select('*').is('archived_at', null)
    .gte('start_at', dayStart(day)).lt('start_at', dayStart(nextDay(day))).or(`status.not.is.null,start_at.lt.${weekAgo}`).order('market_id').range(a, b))
  if (!markets.length) return 0
  const ids = markets.map(m => m.market_id)
  const snaps: ArchiveFile['snaps'] = []
  for (let i = 0; i < ids.length; i += 100) {
    snaps.push(...await all<ArchiveFile['snaps'][number]>((a, b) => db.from('bf_snaps').select('market_id, at, inplay, matched, runners')
      .in('market_id', ids.slice(i, i + 100)).order('id').range(a, b)))
  }

  // Merge with a file from an earlier, partial run of the same day.
  const existing = await readFile(db, day)
  const byMarket = new Map((existing?.markets ?? []).map(m => [m.market_id, m]))
  for (const m of markets) byMarket.set(m.market_id, m)
  const snapKey = (s: { market_id: string; at: string }) => s.market_id + '|' + s.at
  const bySnap = new Map((existing?.snaps ?? []).map(s => [snapKey(s), s]))
  for (const s of snaps) bySnap.set(snapKey(s), s)
  const file: ArchiveFile = { version: 1, day, markets: [...byMarket.values()], snaps: [...bySnap.values()] }

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(file)), { level: 9 })
  const { error: upErr } = await db.storage.from(BUCKET).upload(`${day}.json.gz`, gz, { contentType: 'application/gzip', upsert: true })
  if (upErr) throw new Error('upload: ' + upErr.message)

  // Read it back and check before deleting anything.
  const check = await readFile(db, day)
  const have = new Set((check?.snaps ?? []).map(snapKey))
  if (!check || snaps.some(s => !have.has(snapKey(s)))) throw new Error('the uploaded file did not read back complete; nothing deleted')

  const stamp = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('bf_markets').update({ archived_at: stamp }).in('market_id', ids.slice(i, i + 100))
    if (error) throw new Error('mark archived: ' + error.message)
  }
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('bf_snaps').delete().in('market_id', ids.slice(i, i + 100))
    if (error) throw new Error('delete snapshots: ' + error.message)
  }
  log.info(`Archived ${day}: ${markets.length} markets, ${snaps.length} snapshots, ${(gz.length / 1024).toFixed(0)} KB`)
  return snaps.length
}

// Archive every un-archived day older than ARCHIVE_AFTER_DAYS, oldest first.
export async function runArchive(db: SupabaseClient): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10)
    const { data, error } = await db.from('bf_markets').select('start_at').is('archived_at', null).lt('start_at', dayStart(cutoff)).order('start_at').limit(1)
    if (error) throw new Error(error.message)
    let day = data?.[0] ? String(data[0].start_at).slice(0, 10) : null
    let n = 0
    while (day && day < cutoff && n++ < 60) {
      await archiveDay(db, day)
      day = nextDay(day)
    }
    // coverage rows are only needed for recent gaps
    const { error: pErr } = await db.from('bf_recorder_min').delete().lt('minute', new Date(Date.now() - 90 * 86_400_000).toISOString())
    if (pErr) log.warn('Could not prune old coverage rows:', pErr.message)
  } catch (e) {
    log.error('Archive stopped (will try again tomorrow):', errText(e))
  }
}

export { readFile as readArchive }
