'use client'
import { useCallback, useEffect, useState } from 'react'
import { replayFootball, replayRacing, toCsv, type FootballReplay, type MarketRow, type RacingReplay, type SnapRow } from '@/lib/betfair/replay'
import { STRATEGIES } from '@/lib/betfair/playbook'
import type { RecorderStatus } from '@/lib/betfair/recorderStatus'
import RecorderStatusCard from './RecorderStatusCard'
import RecentRaces from './RecentRaces'

// Data tab of /betfair: what the price recorder has saved, CSV downloads,
// and replays of the bots over the recorded prices.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', blu: '#6f9bff', vio: '#9b8cff' }
const SANS = 'system-ui,sans-serif', MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const gbps = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const pct = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v * 100).toFixed(1) + '%'
const day = (d: Date) => d.toISOString().slice(0, 10)
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '—'

type Summary = { racing: { markets: number; results: number }; football: { markets: number; results: number }; snaps: number; archivedMarkets?: number; first: string | null; last: string | null; server?: RecorderStatus | null; failedMinutes24h?: number; error?: string }
type Sport = 'racing' | 'football'

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#fff' }}>{title}</h3>
      {note && <p style={{ margin: '0 0 10px', color: C.mut, fontSize: 13 }}>{note}</p>}
      {children}
    </section>
  )
}
const Stat = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div style={{ background: C.panel2, border: '1px solid ' + C.line, borderRadius: 8, padding: '8px 12px' }}>
    <div style={{ color: C.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO }}>{k}</div>
    <div style={{ fontFamily: MONO, fontSize: 18, color: '#fff', marginTop: 2 }}>{v}</div>
    {sub && <div style={{ color: C.dim, fontSize: 11 }}>{sub}</div>}
  </div>
)

export default function DataTab() {
  const [sum, setSum] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sport, setSport] = useState<Sport>('racing')
  const [from, setFrom] = useState(() => day(new Date(Date.now() - 7 * 86_400_000)))
  const [to, setTo] = useState(() => day(new Date()))
  const [busy, setBusy] = useState<string | null>(null)
  const [racing, setRacing] = useState<RacingReplay | null>(null)
  const [football, setFootball] = useState<FootballReplay | null>(null)

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/betfair/data?view=summary', { cache: 'no-store' })
      const j = await res.json() as Summary
      if (!res.ok || j.error) setErr(j.error ?? 'HTTP ' + res.status); else { setSum(j); setErr(null) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { loadSummary(); const id = setInterval(loadSummary, 60_000); return () => clearInterval(id) }, [loadSummary])

  // Pull every page of markets + snapshots for the chosen sport and dates.
  const fetchAll = async (): Promise<{ markets: MarketRow[]; snaps: SnapRow[] } | null> => {
    const markets: MarketRow[] = [], snaps: SnapRow[] = []
    const fromIso = new Date(from + 'T00:00:00Z').toISOString(), toIso = new Date(new Date(to + 'T00:00:00Z').getTime() + 86_400_000).toISOString()
    for (let page = 0; page < 500; page++) {
      setBusy(`Loading ${sport} data… ${markets.length} markets so far`)
      const res = await fetch(`/api/betfair/data?view=export&sport=${sport}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&page=${page}`, { cache: 'no-store' })
      const j = await res.json() as { markets: MarketRow[]; snaps: SnapRow[]; more: boolean; error?: string }
      if (!res.ok || j.error) { setErr(j.error ?? 'HTTP ' + res.status); return null }
      markets.push(...j.markets); snaps.push(...j.snaps)
      if (!j.more) break
    }
    return { markets, snaps }
  }

  const download = async () => {
    setErr(null)
    try {
      const d = await fetchAll(); if (!d) return
      if (!d.snaps.length) { setErr(`No recorded ${sport} prices between ${from} and ${to}.`); return }
      setBusy('Building the CSV…')
      const url = URL.createObjectURL(new Blob([toCsv(d.markets, d.snaps)], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `betfair-${sport}-${from}-to-${to}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally { setBusy(null) }
  }

  const replay = async () => {
    setErr(null)
    try {
      const d = await fetchAll(); if (!d) return
      if (!d.markets.length) { setErr(`No recorded ${sport} markets between ${from} and ${to}.`); return }
      setBusy('Replaying…')
      await new Promise(r => setTimeout(r, 30))   // let the message paint before the work starts
      if (sport === 'racing') setRacing(await replayRacing(d.markets, d.snaps))
      else setFootball(replayFootball(d.markets, d.snaps))
    } finally { setBusy(null) }
  }

  const inp: React.CSSProperties = { background: C.panel2, color: C.fg, border: '1px solid ' + C.line, borderRadius: 6, padding: '6px 8px', font: 'inherit', fontSize: 13 }
  const btn = (bg: string, fg = '#06101a'): React.CSSProperties => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 })
  const size = sum ? (sum.snaps * 0.6 / 1024).toFixed(sum.snaps > 17_000 ? 0 : 1) : '0'   // ~600 bytes a snapshot, in MB

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '6px 0 10px', display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: '#fff', margin: '10px 0 6px' }}>Recorded prices</h2>
        <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.mut, margin: 0 }}>
          The recorder server saves GB and IE horse racing prices all day, and the football tests save each match they look at: every market, its prices over time, race and runner details, and the result once Betfair settles it. Download it as a spreadsheet or replay the bots over it.
        </p>
      </div>
      {err && <div style={{ border: '1px solid #5c2032', background: '#2a0f1a', color: '#ffb3c0', borderRadius: 8, padding: '8px 12px', fontFamily: SANS, fontSize: 13 }}>{err}</div>}

      <Section title="Recorder">
        <RecorderStatusCard s={sum ? sum.server ?? null : undefined} />
        {!!sum?.failedMinutes24h && <p style={{ margin: '8px 0 0', color: C.amb, fontSize: 13 }}>In the last 24 hours there were {sum.failedMinutes24h} minutes where every Betfair check failed. Prices from those minutes are missing.</p>}
      </Section>

      <Section title="Today's recording" note="Races from the last 6 hours and the next 3. Prices are saved from 75 minutes before each race until the off.">
        <RecentRaces />
      </Section>

      <Section title="What's been saved" note={sum?.first ? `From ${when(sum.first)} to ${when(sum.last)}. Updates every minute.` : 'Nothing yet. Start a bot on Live prices and this fills up.'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          <Stat k="Races" v={String(sum?.racing.markets ?? 0)} sub={`${sum?.racing.results ?? 0} with results`} />
          <Stat k="Football markets" v={String(sum?.football.markets ?? 0)} sub={`${sum?.football.results ?? 0} with results`} />
          <Stat k="Price snapshots" v={(sum?.snaps ?? 0).toLocaleString('en-GB')} sub={`about ${size} MB in the database`} />
          <Stat k="Archived" v={String(sum?.archivedMarkets ?? 0)} sub="markets moved to daily files" />
        </div>
        <p style={{ margin: '10px 0 0', color: C.dim, fontSize: 12 }}>
          Racing (recorder server): every runner&apos;s best back and lay, money available and last traded price, every minute from 75 minutes out, every 30 seconds from 30 minutes, and every 5 seconds in the last 10 minutes until the off; a snapshot is skipped when nothing moved. Plus race type, class and distance, jockeys, trainers, ratings, the time of the off, the result and Starting Prices. Football: all five markets of each match the tests pick up, once, a few minutes before kick-off. After a week each day is moved into a compressed file (about a tenth of the size); downloads and replays read those automatically.
        </p>
      </Section>

      <Section title="Download or replay" note="Pick a sport and a date range (by race or kick-off date).">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={inp} value={sport} onChange={e => setSport(e.target.value as Sport)} aria-label="Sport"><option value="racing">Horse racing</option><option value="football">Football</option></select>
          <label style={{ color: C.mut, fontSize: 13 }}>From <input style={inp} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ color: C.mut, fontSize: 13 }}>To <input style={inp} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <button style={btn(C.blu)} disabled={!!busy} onClick={download}>⬇ Download CSV</button>
          <button style={btn(C.teal)} disabled={!!busy} onClick={replay}>▶ Replay</button>
        </div>
        {busy && <p style={{ margin: '10px 0 0', color: C.amb, fontFamily: MONO, fontSize: 12 }}>{busy}</p>}
        <p style={{ margin: '10px 0 0', color: C.dim, fontSize: 12 }}>
          The CSV has one row per runner per snapshot: start time, time to the off, best back and lay with the money available, last traded price, total matched and the result. It opens in Excel or Google Sheets.
        </p>
      </Section>

      {racing && sport === 'racing' && (
        <Section title="Racing replay" note={`The six agents run over ${racing.races} recorded races (${racing.moments.toLocaleString('en-GB')} moments) with today's settings.`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
            <Stat k="Paper trades" v={String(racing.trades.length)} />
            <Stat k="Net P&L" v={gbps(racing.net)} sub="after commission" />
            <Stat k="Strike rate" v={racing.trades.length ? (racing.strike * 100).toFixed(1) + '%' : '—'} />
            <Stat k="Per trade" v={racing.trades.length ? gbps(racing.avg) : '—'} />
            <Stat k="Worst run" v={gbps(racing.maxDrawdown)} sub="max drawdown" />
          </div>
          {racing.trades.length > 0 && (
            <div style={{ maxHeight: 260, overflow: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
                <tbody>{racing.trades.slice(-40).reverse().map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid ' + C.line }}>
                    <td style={{ padding: '3px 8px 3px 0', color: C.dim }}>{when(t.closed_at)}</td><td style={{ padding: '3px 8px 3px 0', fontFamily: SANS, fontSize: 12 }}>{t.market}</td>
                    <td style={{ padding: '3px 8px 3px 0' }}>{t.side} {t.entry}→{t.exit}</td><td style={{ color: C.mut, padding: '3px 8px 3px 0' }}>{t.reason}</td>
                    <td style={{ textAlign: 'right', color: t.net_pl > 0 ? C.teal : C.red }}>{gbps(t.net_pl)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
          <p style={{ margin: '10px 0 0', color: C.dim, fontSize: 12 }}>The replay sees prices every 30 seconds where the live desk polls every 5, so results will differ a little from the live run. A few days of racing proves nothing either way.</p>
        </Section>
      )}

      {football && sport === 'football' && (
        <Section title="Football replay" note={`The three strategies run over ${football.usable} of ${football.matches} recorded matches (the rest have no result yet) with today's settings.`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: C.mut, fontSize: 11, textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 400 }}>Strategy</th><th style={{ fontWeight: 400 }}>Settled</th><th style={{ fontWeight: 400 }}>Return</th><th style={{ fontWeight: 400 }}>± error</th><th style={{ fontWeight: 400 }}>Verdict</th></tr></thead>
            <tbody>{STRATEGIES.map(s => { const st = football.stats[s.id]; return (
              <tr key={s.id} style={{ borderTop: '1px solid ' + C.line, textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>
                <td style={{ textAlign: 'left', fontFamily: SANS, fontSize: 13, padding: '6px 0' }}>{s.name}</td><td>{st.total.n}</td>
                <td style={{ color: st.total.roi > 0 ? C.teal : st.total.roi < 0 ? C.red : C.fg }}>{st.total.n ? pct(st.total.roi) : '—'}</td>
                <td style={{ color: C.mut }}>{st.total.n > 1 ? '±' + (st.total.se * 200).toFixed(0) + '%' : '—'}</td>
                <td style={{ color: st.verdict === 'pass' ? C.teal : st.verdict === 'fail' ? C.red : st.verdict === 'inconclusive' ? C.amb : C.blu }}>{st.verdict}</td>
              </tr>) })}</tbody>
          </table>
          <p style={{ margin: '10px 0 0', color: C.dim, fontSize: 12 }}>Same rules and pass marks as the Strategies tab. Bounce-back needs six recorded games per team before it bets, so it stays quiet on short ranges.</p>
        </Section>
      )}

      <Section title="Testing a change">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Change a setting: <span style={{ fontFamily: MONO, fontSize: 12 }}>CONFIG</span> in <span style={{ fontFamily: MONO, fontSize: 12 }}>lib/betfair/engine.ts</span> for racing, <span style={{ fontFamily: MONO, fontSize: 12 }}>STRAT</span> in <span style={{ fontFamily: MONO, fontSize: 12 }}>lib/betfair/strategies.ts</span> for football.</li>
          <li>Push and let Vercel redeploy.</li>
          <li>Replay the same date range and compare. Keep a few weeks back that you never tune on, and check the final settings against those once, at the end. Settings tuned and judged on the same days always look better than they are.</li>
        </ol>
      </Section>
    </div>
  )
}
