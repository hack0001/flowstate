'use client'
import { useState } from 'react'
import { CONCEPTS, STRATEGIES, type StrategyInfo } from '@/lib/betfair/playbook'
import type { StrategiesSnapshot } from '@/lib/betfair/stratRun'
import type { Line, StratStats, Verdict } from '@/lib/betfair/strategies'

// Strategies tab of /betfair: three paper tests with rules fixed up front,
// a live scoreboard and a pass/fail verdict.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', vio: '#9b8cff', amb: '#f6b93b', blu: '#6f9bff' }
const SANS = 'system-ui,sans-serif', MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const CONCEPT_TITLE = Object.fromEntries(CONCEPTS.map(c => [c.id, c.title]))
const gbps = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const pct = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v * 100).toFixed(1) + '%'
const VERDICT: Record<Verdict, { label: string; color: string }> = {
  collecting: { label: 'Collecting', color: C.blu }, pass: { label: 'Pass', color: C.teal }, fail: { label: 'Fail', color: C.red }, inconclusive: { label: 'Inconclusive', color: C.amb },
}
const UNIT: Record<string, string> = { dc: 'bets', bands: 'bets per band', form: 'matches' }

export type StratData = StrategiesSnapshot & { liveReady: boolean; tickError?: string; error?: string }
type Recent = { id: number; placed_at: string; event: string; market_type: string; selection: string; side: string; price: number; stake: number; model_prob: number | null; edge: number | null; band: string | null; status: string; pl: number | null }

function Figures({ l, unit, gross }: { l: Line; unit: string; gross?: boolean }) {
  const cell = (k: string, v: string, color?: string) => (
    <div><div style={{ color: C.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k}</div><div style={{ fontFamily: MONO, fontSize: 16, color: color ?? C.fg, marginTop: 2 }}>{v}</div></div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 10 }}>
      {cell('Settled ' + unit, String(l.n))}
      {cell(gross ? 'P&L before comm.' : 'Net P&L', gbps(l.net), l.net > 0 ? C.teal : l.net < 0 ? C.red : undefined)}
      {cell('Return', l.n ? pct(l.roi) : '—', l.roi > 0 ? C.teal : l.roi < 0 ? C.red : undefined)}
      {cell('Margin of error', l.n > 1 ? '±' + (l.se * 200).toFixed(0) + '%' : '—')}
      {cell('t-score', l.n > 1 ? l.t.toFixed(1) : '—')}
    </div>
  )
}

function StrategyCard({ info, st, recent, onConcept, extra }: { info: StrategyInfo; st: StratStats | undefined; recent: Recent[]; onConcept: (id: string) => void; extra?: string }) {
  const [showBets, setShowBets] = useState(false)
  const v = VERDICT[st?.verdict ?? 'collecting']
  const h: React.CSSProperties = { color: C.blu, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', margin: '14px 0 4px', fontFamily: MONO }
  const groups = Object.entries(st?.groups ?? {})
  return (
    <section id={'strategy-' + info.id} style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: SANS, scrollMarginTop: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>{info.name}</h3>
          <div style={{ color: C.mut, fontSize: 13, marginTop: 2 }}>{info.oneLine}</div>
        </div>
        <span style={{ border: '1px solid ' + v.color, color: v.color, borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{v.label}</span>
      </div>

      {/* progress toward the sample the verdict needs */}
      <div style={{ margin: '12px 0 4px', height: 6, background: '#18213f', borderRadius: 3, overflow: 'hidden' }} role="progressbar" aria-valuenow={Math.round((st?.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ height: '100%', width: (st?.progress ?? 0) * 100 + '%', background: v.color }} />
      </div>
      <div style={{ color: C.mut, fontSize: 12, marginBottom: 12 }}>{st?.why ?? 'No data yet.'}{st && st.open > 0 ? ` ${st.open} bets waiting for a result.` : ''}{extra ? ' ' + extra : ''}</div>

      {st && <Figures l={st.total} unit={info.id === 'form' ? 'matches' : 'bets'} gross={info.id === 'bands'} />}
      {groups.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
          <thead><tr style={{ color: C.mut, fontSize: 11, textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 400, padding: '4px 0' }}>{info.id === 'bands' ? 'Price band' : 'Market'}</th><th style={{ fontWeight: 400 }}>Settled</th><th style={{ fontWeight: 400 }}>Won</th><th style={{ fontWeight: 400 }}>Return</th><th style={{ fontWeight: 400 }}>± error</th></tr></thead>
          <tbody>
            {groups.map(([k, l]) => (
              <tr key={k} style={{ borderTop: '1px solid ' + C.line, textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>
                <td style={{ textAlign: 'left', fontFamily: SANS, fontSize: 13, padding: '5px 0' }}>{k}</td><td>{l.n}</td><td>{l.n ? Math.round(l.wins / l.n * 100) + '%' : '—'}</td>
                <td style={{ color: l.roi > 0 ? C.teal : l.roi < 0 ? C.red : C.fg }}>{l.n ? pct(l.roi) : '—'}</td><td style={{ color: C.mut }}>{l.n > 1 ? '±' + (l.se * 200).toFixed(0) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={h}>The idea being tested</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{info.hypothesis}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {info.concepts.map(id => <button key={id} onClick={() => onConcept(id)} style={{ background: C.panel2, border: '1px solid ' + C.line, color: C.vio, borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontFamily: SANS }}>{CONCEPT_TITLE[id]} →</button>)}
      </div>

      <div style={h}>The rules (fixed before any bet)</div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55 }}>{info.rules.map(r => <li key={r} style={{ marginBottom: 3 }}>{r}</li>)}</ol>

      <div style={h}>How to read the result</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 14, lineHeight: 1.5 }}>
        <span style={{ color: C.mut }}>Measured</span><span>{info.measure}</span>
        <span style={{ color: C.teal }}>Pass</span><span>{info.pass}</span>
        <span style={{ color: C.red }}>Fail</span><span>{info.fail}</span>
        <span style={{ color: C.amb }}>Expect</span><span>{info.honest}</span>
      </div>

      <button onClick={() => setShowBets(s => !s)} aria-expanded={showBets} style={{ marginTop: 14, background: 'none', border: '1px solid ' + C.line, color: C.mut, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>{showBets ? 'Hide' : 'Show'} latest paper bets</button>
      {showBets && (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
            <tbody>
              {recent.map(b => (
                <tr key={b.id} style={{ borderTop: '1px solid ' + C.line }}>
                  <td style={{ padding: '4px 8px 4px 0', color: C.dim, whiteSpace: 'nowrap' }}>{new Date(b.placed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '4px 8px 4px 0', fontFamily: SANS, fontSize: 12 }}>{b.event}</td>
                  <td style={{ padding: '4px 8px 4px 0', whiteSpace: 'nowrap' }}>{b.side} {b.selection} @ {b.price}</td>
                  <td style={{ padding: '4px 8px 4px 0', color: C.mut, whiteSpace: 'nowrap' }}>{b.model_prob !== null ? `model ${(b.model_prob * 100).toFixed(1)}%` : b.band ?? ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: b.status === 'open' ? C.blu : (b.pl ?? 0) > 0 ? C.teal : (b.pl ?? 0) < 0 ? C.red : C.mut }}>{b.status === 'open' ? 'open' : b.status === 'void' ? 'void' : gbps(b.pl ?? 0)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td style={{ color: C.dim, padding: '4px 0' }}>No bets yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function StrategiesTab({ d, err, busy, act, onConcept }: { d: StratData | null; err: string | null; busy: boolean; act: (action: string, mode?: string) => void; onConcept: (id: string) => void }) {
  const btn = (bg: string, fg = '#06101a'): React.CSSProperties => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 })
  const live = d?.mode === 'live'
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '6px 0 10px' }}>
      <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: '#fff', margin: '10px 0 6px' }}>Three strategies on paper</h2>
      <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.mut, margin: '0 0 12px' }}>
        Each test has its rules, sample size and pass mark fixed in advance, so the result can&apos;t be argued into a win afterwards. Paper bets use real Betfair prices in live mode; no money is ever placed.
      </p>

      <div style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {d?.running
            ? <button style={btn(C.amb)} disabled={busy} onClick={() => act('stop')}>■ Stop tests</button>
            : <button style={btn(C.teal)} disabled={busy || !d} onClick={() => act('start')}>▶ Start {live ? 'live paper tests' : 'demo'}</button>}
          <button style={btn(C.panel2, !live ? C.fg : C.mut)} disabled={busy} onClick={() => act('mode', 'demo')}>Demo</button>
          <button style={btn(C.panel2, live ? C.fg : C.mut)} disabled={busy} onClick={() => act('mode', 'live')}>Live prices{d && !d.liveReady ? ' 🔒' : ''}</button>
          <button style={btn('transparent', C.red)} disabled={busy} onClick={() => act('reset')}>Reset</button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.mut, marginLeft: 'auto' }}>
            <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: d?.running ? C.teal : C.dim, marginRight: 6 }} />
            {d?.running ? 'running' : 'stopped'} · {live ? 'live prices' : 'demo'} · {d?.matches ?? 0} matches seen · {d?.awaitingResult ?? 0} awaiting result
          </span>
        </div>
        {(err || d?.lastError) && <div style={{ border: '1px solid #5c2032', background: '#2a0f1a', color: '#ffb3c0', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontFamily: SANS, fontSize: 13 }}>{err ?? d?.lastError}</div>}
        {live && d && !d.liveReady && <div style={{ border: '1px solid #5a4718', background: '#221a08', color: '#ffe2a8', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontFamily: SANS, fontSize: 13 }}>Live prices need <b>BF_USERNAME</b>, <b>BF_PASSWORD</b> and <b>BF_APP_KEY</b> in Vercel → Settings → Environment Variables, then a redeploy.</div>}
        {!live && <div style={{ color: C.mut, fontFamily: SANS, fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>Demo plays invented matches in a market with <b style={{ color: C.fg }}>no edge built in</b>, about two a second, and stops itself after 3,000. Every test should end in “Fail” (or “Inconclusive” after a lucky run) within about ten minutes. That is the correct answer, and shows the scoring works before you trust it on real prices. A “Pass” in demo is pure luck; it turns up in a small minority of runs.</div>}

        <details style={{ marginTop: 12, fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg }}>
          <summary style={{ cursor: 'pointer', color: C.blu, fontSize: 13 }}>How to run the test, step by step</summary>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li>Press <b>Start demo</b> and give it about ten minutes. Check the verdicts settle on “Fail” or “Inconclusive”. Then press <b>Reset</b>.</li>
            <li>Switch to <b>Live prices</b> and press <b>Start</b>. Leave this page open in a tab around kick-off times (weekend afternoons and midweek evenings give the most matches).</li>
            <li>The desk looks once a minute. It takes each match 1–12 minutes before kick-off, and collects results about two hours later. If the tab is closed at kick-off, that match is simply missed; open bets still settle next time you open the page.</li>
            <li>Don&apos;t change the rules mid-test. If you want different settings, edit <code style={{ fontFamily: MONO, fontSize: 12 }}>STRAT</code> in <code style={{ fontFamily: MONO, fontSize: 12 }}>lib/betfair/strategies.ts</code>, press <b>Reset</b> and start again.</li>
            <li>Read the verdict only when a card stops saying “Collecting”. “Margin of error” is how far the return could be from the truth by luck alone; while it is wider than the return itself, the number means nothing yet.</li>
            <li>A “Pass” earns a second run on fresh matches, not real money. Paper fills are kinder than real ones.</li>
          </ol>
        </details>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
        {STRATEGIES.map(info => (
          <StrategyCard key={info.id} info={info} st={d?.stats[info.id]} recent={(d?.recent[info.id] ?? []) as Recent[]} onConcept={onConcept}
            extra={info.id === 'form' && d ? `${d.teamsReady} of ${d.teamsTracked} tracked teams have 6 games on record.` : undefined} />
        ))}
      </div>
      <p style={{ color: C.dim, fontFamily: SANS, fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
        Results are after {Math.round((d?.config.commission ?? 0.05) * 100)}% commission on winning bets, except Favourite vs longshot, which compares bands before commission. Paper bets assume you get the displayed price for £{d?.config.stake ?? 10}; with a delayed key the real price may have moved. Most people who trade on betting exchanges lose money. Target sample sizes: {STRATEGIES.map(s => `${s.name} ${d?.stats[s.id].target ?? '—'} ${UNIT[s.id]}`).join(', ')}.
      </p>
    </div>
  )
}
