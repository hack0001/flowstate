// Imports Betfair's free historical prices (the "Basic" plan) into FlowState,
// so the Backtest and Insights tabs can test on years of markets.
//
//   sudo bash /opt/flowstate/recorder/deploy/history.sh 2025-11-01 2026-11-17 racing,football,tennis,golf
//
// First add the data to your Betfair account (free): historicdata.betfair.com →
// each sport, Basic plan, the dates you want → "Buy now" (£0).
//
// For each sport and month it lists only the market files FlowState uses (see
// SPORTS below), downloads them 4 at a time within the request limits, keeps a
// compact sample of the last traded prices (lib/betfair/history.ts), and saves
// one small gzipped file per sport per day to the private storage bucket
// betfair-history. Betfair's own files are never stored. Days already imported
// are skipped, so it can be stopped and run again at any time.
//
// Read only: it never places a bet.

import zlib from 'zlib'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// seek-bzip has no type definitions
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bzip = require('seek-bzip') as { decode: (b: Buffer) => Buffer }
import { loadConfig } from './config'
import { Betfair } from './betfair'
import { installGuard, LIMITS } from './guard'
import { errText, log } from './log'
import { HISTORY_BUCKET, SAMPLE, historyPath, parseMarketFile, type HistDay, type HistIndex, type HistMarket } from '../../lib/betfair/history'
import type { BtSport } from '../../lib/betfair/backtest'

// What to download for each sport. Betfair's file filter works by market type and
// country (there's no league filter), so football is limited to the countries of
// the big leagues; cup and European ties are included when the home side is from one.
const SPORTS: Record<BtSport, { name: string; types: string[]; countries: string[]; keep?: (m: HistMarket) => boolean }> = {
  racing: { name: 'Horse Racing', types: ['WIN'], countries: ['GB', 'IE'] },
  football: { name: 'Soccer', types: ['MATCH_ODDS', 'OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE'], countries: ['GB', 'ES', 'IT', 'DE', 'FR', 'NL', 'PT'] },
  tennis: { name: 'Tennis', types: ['MATCH_ODDS'], countries: [], keep: m => m.runners.length === 2 && !m.runners.some(([, n]) => n.includes('/')) },   // singles only
  golf: { name: 'Golf', types: ['WINNER'], countries: [] },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const iso = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const [fromArg, toArg, sportsArg] = args.filter(a => a !== '--force')
  const from = isDay(fromArg) ? fromArg : iso(new Date(Date.now() - 365 * 86_400_000))
  const to = isDay(toArg) ? toArg : iso(new Date(Date.now() - 4 * 86_400_000))
  const sports = (sportsArg ?? 'racing').split(',').map(x => x.trim()).filter((x): x is BtSport => x in SPORTS)
  if (!sports.length) throw new Error('No sports given. Use any of: racing,football,tennis,golf')
  const cfg = loadConfig()
  // A one-off bulk download: the same 8 requests a second as the recorder, but a bigger daily allowance.
  LIMITS.betfair.perDay = 400_000
  installGuard(cfg.supabase.url)
  const bf = new Betfair(cfg.betfair, cfg.spoolDir)
  const db = createClient(cfg.supabase.url, cfg.supabase.key, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const sport of sports) await importSport(sport, from, to, force, bf, db)
}

async function importSport(sport: BtSport, from: string, to: string, force: boolean, bf: Betfair, db: SupabaseClient) {
  const spec = SPORTS[sport]
  const store = db.storage.from(HISTORY_BUCKET)
  log.info(`Historical import: ${spec.name}${spec.countries.length ? ` (${spec.countries.join(', ')})` : ''}, ${spec.types.join(', ')}, ${from} to ${to}${force ? ' (re-importing days already done)' : ''}`)

  // what's already imported
  const { data: idxFile } = await store.download(`${sport}/index.json`)
  const index: HistIndex = idxFile ? JSON.parse(await idxFile.text()) : { updated: '', days: {} }
  const { error: bucketErr } = await store.list(sport, { limit: 1 })
  if (bucketErr) throw new Error(`Storage bucket ${HISTORY_BUCKET} isn't there (${bucketErr.message}). Run supabase/migrations/058_betfair_history.sql in the Supabase SQL editor first.`)
  const saveIndex = async () => {
    index.updated = new Date().toISOString()
    const { error } = await store.upload(`${sport}/index.json`, Buffer.from(JSON.stringify(index)), { contentType: 'application/json', upsert: true })
    if (error) log.warn('Index not saved:', error.message)
  }

  let totalDays = 0, totalRaces = 0, totalBytes = 0, failedFiles = 0
  for (let m = new Date(from.slice(0, 7) + '-01T00:00:00Z'); iso(m) <= to; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    const monthEnd = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0))
    const a = new Date(Math.max(m.getTime(), new Date(from).getTime())), b = new Date(Math.min(monthEnd.getTime(), new Date(to).getTime()))
    const filter = { sport: spec.name, plan: 'Basic Plan',
      fromDay: a.getUTCDate(), fromMonth: a.getUTCMonth() + 1, fromYear: a.getUTCFullYear(), toDay: b.getUTCDate(), toMonth: b.getUTCMonth() + 1, toYear: b.getUTCFullYear(),
      marketTypesCollection: spec.types, countriesCollection: spec.countries, fileTypeCollection: ['M'] }
    let paths: string[] = []
    try { paths = await bf.historic<string[]>('DownloadListOfFiles', filter) } catch (e) { log.error(`${iso(a)} to ${iso(b)}: couldn't list files: ${errText(e)}`); continue }
    if (!paths.length) {
      log.warn(`${spec.name} ${iso(a)} to ${iso(b)}: no files. Add this period to your account first: historicdata.betfair.com → ${spec.name} → Basic plan → choose the dates → Buy now (free).`)
      continue
    }
    // group the files by day (from the path: .../BASIC/2025/Mar/4/<event>/<market>.bz2)
    const byDay = new Map<string, string[]>()
    for (const p of paths) {
      const x = p.match(/\/(\d{4})\/([A-Za-z]{3})\/(\d{1,2})\//)
      if (!x) continue
      const day = `${x[1]}-${String(MONTHS.indexOf(x[2]) + 1).padStart(2, '0')}-${x[3].padStart(2, '0')}`
      byDay.set(day, [...(byDay.get(day) ?? []), p])
    }
    log.info(`${spec.name}, ${MONTHS[m.getUTCMonth()]} ${m.getUTCFullYear()}: ${paths.length} markets on ${byDay.size} days`)

    for (const [day, files] of [...byDay.entries()].sort()) {
      if (!force && index.days[day]) continue
      const markets: HistMarket[] = []
      let dayFailed = 0
      const queue = [...files]
      const worker = async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          try {
            const raw = await bf.historic<Buffer>('DownloadFile', null, f)
            const text = (f.endsWith('.bz2') ? bzip.decode(raw) : raw).toString('utf8')
            const mk = parseMarketFile(text, SAMPLE[sport])
            if (mk && mk.s.length && (!spec.keep || spec.keep(mk))) markets.push(mk)
          } catch (e) { failedFiles++; dayFailed++; log.warn(`${day}: skipped ${f.split('/').pop()}: ${errText(e)}`) }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (!markets.length) { log.warn(`${day}: nothing usable`); continue }
      markets.sort((x, y) => x.start.localeCompare(y.start))
      // file by the races' own (UTC) date, which is what the Backtest and Insights tabs ask for
      const groups = new Map<string, HistMarket[]>()
      for (const mk of markets) { const d = mk.start.slice(0, 10); groups.set(d, [...(groups.get(d) ?? []), mk]) }
      for (const [d, ms] of groups) {
        const file: HistDay = { v: 1, day: d, source: 'betfair-basic', markets: ms }
        const gz = zlib.gzipSync(Buffer.from(JSON.stringify(file)), { level: 9 })
        let saved = false
        for (let t = 0; t < 3 && !saved; t++) {
          const { error } = await store.upload(historyPath(sport, d), gz, { contentType: 'application/gzip', upsert: true })
          if (!error) saved = true
          else { log.warn(`${d}: save failed (${error.message}), retrying`); await new Promise(r => setTimeout(r, 5000 * (t + 1))) }
        }
        if (!saved) { log.error(`${d}: not saved; it will be retried next run`); continue }
        if (!dayFailed) index.days[d] = ms.length           // a day with failed downloads is tried again next run
        totalDays++; totalRaces += ms.length; totalBytes += gz.length
        log.info(`${spec.name} ${d}: ${ms.length} markets saved (${(gz.length / 1024).toFixed(0)} KB)`)
      }
      if (totalDays % 7 === 0) await saveIndex()
    }
    await saveIndex()
  }
  await saveIndex()
  log.info(`${spec.name} done: ${totalDays} days, ${totalRaces} markets, ${(totalBytes / 1024 / 1024).toFixed(1)} MB${failedFiles ? `, ${failedFiles} files couldn't be downloaded (run the same command again to retry those days)` : ''}.`)
}

main().then(() => process.exit(0), e => { log.error('Historical import stopped:', errText(e)); process.exit(1) })
