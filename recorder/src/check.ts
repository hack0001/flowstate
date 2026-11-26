// Setup check: `npm run check`. Confirms every connection works before the
// recorder is switched on. Reads only; changes nothing except one heartbeat field.

import { createClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { Betfair } from './betfair'
import { BUCKET } from './archive'
import { errText } from './log'
import { installGuard } from './guard'
import os from 'os'

const ok = (m: string) => console.log('  ✓ ' + m)
const bad = (m: string) => { console.log('  ✗ ' + m); failed = true }
let failed = false

;(async () => {
  console.log('FlowState recorder: setup check\n')
  let cfg
  try { cfg = loadConfig(); ok('Settings file has all five values') } catch (e) { bad(errText(e)); process.exit(1) }
  installGuard(cfg.supabase.url)

  // Betfair: log in and list today's races
  try {
    const bf = new Betfair(cfg.betfair, os.tmpdir())
    const now = Date.now()
    const races = await bf.read<{ marketId: string; totalMatched?: number }[]>('listMarketCatalogue', {
      filter: { eventTypeIds: ['7'], marketCountries: ['GB', 'IE'], marketTypeCodes: ['WIN'],
        marketStartTime: { from: new Date(now).toISOString(), to: new Date(now + 24 * 3600_000).toISOString() } },
      maxResults: 100,
    })
    ok(`Betfair login works; ${races.length} GB/IE races in the next 24 hours`)
    if (races.length && !races.some(r => (r.totalMatched ?? 0) > 0)) console.log('    (no total matched figures yet; normal well before racing)')
  } catch (e) { bad('Betfair: ' + errText(e)) }

  // Supabase: tables, a harmless write, and the archive bucket
  const db = createClient(cfg.supabase.url, cfg.supabase.key, { auth: { persistSession: false } })
  for (const t of ['bf_markets', 'bf_snaps', 'bf_recorder', 'bf_recorder_min', 'bf_bot', 'bf_strat']) {
    const { error } = await db.from(t).select('*', { count: 'exact', head: true })
    if (error) bad(`Supabase table ${t}: ${error.message} (run the migrations 050 to 053 in the SQL editor)`)
  }
  if (!failed) ok('Supabase tables are there')
  const { error: cErr } = await db.from('bf_markets').select('competition').limit(1)
  if (cErr) bad('Football, tennis and golf need migration 054: run supabase/migrations/054_betfair_more_sports.sql in the SQL editor')
  else ok('Ready for football, tennis and golf (migration 054)')
  const { error: wErr } = await db.from('bf_recorder').update({ version: 'check' }).eq('id', 1)
  if (wErr) bad('Supabase write: ' + wErr.message + ' (is SUPABASE_SERVICE_ROLE_KEY the secret/service key, not the anon key?)')
  else ok('Supabase accepts writes')
  const { error: bErr } = await db.storage.from(BUCKET).list('', { limit: 1 })
  if (bErr) bad('Archive storage: ' + bErr.message + ' (run migration 053, which creates the betfair-archive bucket)')
  else ok('Archive storage bucket is there')

  console.log(failed ? '\nSomething needs fixing before starting the recorder.' : '\nAll good. Start it with: sudo systemctl enable --now flowstate-recorder')
  process.exit(failed ? 1 : 0)
})()
