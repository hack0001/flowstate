// Settings for the recorder. Secrets come from the environment file the
// setup script writes (/etc/flowstate-recorder.env); never from the code.

function need(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing setting ${name}. Add it to /etc/flowstate-recorder.env and restart.`)
  return v
}

export const VERSION = '1.1.0'

export function loadConfig() {
  return {
    betfair: { username: need('BF_USERNAME'), password: need('BF_PASSWORD'), appKey: need('BF_APP_KEY') },
    supabase: { url: need('SUPABASE_URL'), key: need('SUPABASE_SERVICE_ROLE_KEY') },
    spoolDir: process.env.SPOOL_DIR?.trim() || process.env.STATE_DIRECTORY?.trim() || './data',
    runBots: process.env.RUN_BOTS !== '0',            // also keep the Desk and Strategies bots running
  }
}
export type Config = ReturnType<typeof loadConfig>

// How often to record a race's prices, by minutes before the scheduled off.
export const CADENCE = [
  { beforeMin: 10, everyMs: 5_000 },     // last 10 minutes: every 5 seconds
  { beforeMin: 30, everyMs: 30_000 },    // 30 to 10 minutes: every 30 seconds
  { beforeMin: 75, everyMs: 60_000 },    // 75 to 30 minutes: every minute
] as const
export const LATE_OFF_MAX_MIN = 45       // keep watching up to 45 min after the scheduled time
export const SAVE_UNCHANGED_EVERY_MS = 60_000   // save a snapshot at least this often even if nothing moved

export const CATALOGUE_EVERY_MS = 5 * 60_000    // refresh the race list
export const MATCHED_EVERY_MS = 60_000          // refresh total matched for races in the window
export const RESULTS_EVERY_MS = 2 * 60_000      // look for results
export const ARCHIVE_AFTER_DAYS = 3             // move days older than this to compressed files (keeps the database small)
export const ARCHIVE_HOUR_UK = 4                // run the archive at about 4am UK time

export const REQUEST_TIMEOUT_MS = 15_000        // never wait on Betfair or Supabase longer than this
export const MAX_PENDING_ROWS = 300_000         // cap on writes held while Supabase is unreachable
