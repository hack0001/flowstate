'use client'
import { useEffect, useState } from 'react'

// The fade-drift paper bot's running results (Insights tab). The bot runs on the recorder
// server: when a horse drifts 15+ ticks in 5 minutes and stays out, it paper-backs it at
// the best back price, then hedges 10 minutes later at the best lay price. Paper only.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470' }
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const gbp = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const tone = (v: number) => v > 0.004 ? C.teal : v < -0.004 ? C.red : C.mut
type Trade = { market_id: string; selection_id: number; horse: string; race: string | null; entry_at: string; entry_price: number; exit_price: number | null; drift_ticks: number; ref_price: number; pnl: number | null; status: string }
type Totals = { trades: number; open: number; won: number; pnl: number; staked: number; roi: number; t: number; first: string | null }

export default function FadeBotCard() {
  const [d, setD] = useState<{ trades: Trade[]; totals: Totals } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const load = () => fetch('/api/betfair/fadebot', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.error) setErr(j.error); else { setD(j); setErr(null) } }).catch(e => setErr(String(e)))
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t)
  }, [])
  const th: React.CSSProperties = { textAlign: 'right', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
  const t = d?.totals
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: 'system-ui,sans-serif', fontSize: 14, lineHeight: 1.6, color: C.fg, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#fff' }}>Fade-drift paper bot</h3>
      <p style={{ margin: '0 0 10px', color: C.mut, fontSize: 13 }}>The scout&apos;s best racing system, tested live on prices you could actually take: when a top-six horse drifts 15+ ticks in 5 minutes and is still out a minute later, it paper-backs it, then hedges 10 minutes later. £2 stakes, 5% commission. Paper only.</p>
      {err ? <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>{err}</p> : !d ? <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>Loading…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
            {[['Trades', `${t!.trades}`, t!.open ? `${t!.open} open now` : 'none open'], ['Profit / loss', gbp(t!.pnl), `${(t!.roi * 100).toFixed(1)}% of £${t!.staked.toFixed(0)}`], ['Winning trades', t!.trades ? `${Math.round(t!.won / t!.trades * 100)}%` : '—', `${t!.won} of ${t!.trades}`], ['t-score', t!.trades > 1 ? t!.t.toFixed(2) : '—', t!.trades < 100 ? 'needs 100+ trades' : t!.t >= 2 ? 'beyond likely luck' : 'could still be luck']].map(([k, v, sub]) => (
              <div key={k} style={{ background: C.panel2, border: '1px solid ' + C.line, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: C.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO }}>{k}</div>
                <div style={{ fontFamily: MONO, fontSize: 18, color: k === 'Profit / loss' ? tone(t!.pnl) : '#fff' }}>{v}</div>
                <div style={{ color: C.dim, fontSize: 11 }}>{sub}</div>
              </div>
            ))}
          </div>
          {d.trades.length === 0 ? <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>No signals yet. Sharp drifts happen a couple of times a day across GB and IE racing; trades appear here as they happen.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
                <thead><tr><th style={{ ...th, textAlign: 'left' }}>Race</th><th style={{ ...th, textAlign: 'left' }}>Horse</th><th style={th}>Drift</th><th style={th}>Backed at</th><th style={th}>Hedged at</th><th style={th}>P&amp;L</th><th style={{ ...th, textAlign: 'left' }}>Status</th></tr></thead>
                <tbody>{d.trades.slice(0, 50).map(x => (
                  <tr key={x.market_id + ':' + x.selection_id}>
                    <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{new Date(x.entry_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })} {x.race}</td>
                    <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{x.horse}</td>
                    <td style={td}>{x.ref_price} → +{Math.round(x.drift_ticks)} ticks</td><td style={td}>{x.entry_price}</td><td style={td}>{x.exit_price ?? '—'}</td>
                    <td style={{ ...td, color: x.pnl === null ? C.dim : tone(x.pnl) }}>{x.pnl === null ? '—' : gbp(x.pnl)}</td><td style={{ ...td, textAlign: 'left', fontFamily: 'inherit', color: C.mut }}>{x.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
