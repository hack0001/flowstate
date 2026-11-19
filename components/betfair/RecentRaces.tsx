'use client'
import { useCallback, useEffect, useState } from 'react'

// "Today's recording" on the Data tab: the races the recorder server is
// tracking, how many price snapshots each has, and (click a race) every
// runner's prices with a chart of how the favourites moved up to the off.

const C = { panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', blu: '#6f9bff' }
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const LINE_COLOURS = ['#2fd6b0', '#6f9bff', '#f6b93b', '#ff5470', '#9b8cff', '#e47cff']
const hm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '—'
const hms = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' })
const money = (n: number | null | undefined) => n == null ? '—' : '£' + (n >= 10_000 ? Math.round(n / 1000) + 'k' : Math.round(n).toLocaleString('en-GB'))
const ago = (iso: string | null, now: number) => {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
}

type Race = { market_id: string; venue: string; name: string | null; race_type: string | null; start_at: string; off_at: string | null; runners: number
  status: string | null; winners: number[] | null; matched: number | null; snaps: number; last_snap: string | null }
type Runner = { id: number; name: string; jockey?: string | null }
type Snap = { at: string; inplay: boolean; matched: number | null; runners: [number, number | null, number, number | null, number, number | null][] }
type Detail = { market: { market_id: string; venue: string | null; event: string; market_name: string | null; race_type: string | null; start_at: string; off_at: string | null
  runners: Runner[]; status: string | null; winners: number[] | null; removed: number[] | null; total_matched: number | null; bsp: Record<string, number> | null }; snaps: Snap[] }

function state(r: Race, now: number): { label: string; colour: string } {
  if (r.status) return { label: 'Result in', colour: C.teal }
  if (r.off_at) return { label: 'Off, awaiting result', colour: C.amb }
  const mins = (new Date(r.start_at).getTime() - now) / 60_000
  if (mins > 75) return { label: `Starts recording ${hm(new Date(new Date(r.start_at).getTime() - 75 * 60_000).toISOString())}`, colour: C.dim }
  if (mins > -15) return { label: 'Recording now', colour: C.red }
  return { label: 'Awaiting result', colour: C.amb }
}

function Chart({ d }: { d: Detail }) {
  const start = new Date(d.market.start_at).getTime()
  const pts = d.snaps.filter(s => !s.inplay)
  if (pts.length < 2) return <p style={{ color: C.mut, fontSize: 13, margin: '6px 0' }}>The chart appears once there are a few snapshots.</p>
  // the six shortest-priced runners at the latest snapshot
  const last = pts[pts.length - 1]
  const top = [...last.runners].filter(r => r[1]).sort((a, b) => (a[1] ?? 999) - (b[1] ?? 999)).slice(0, 6).map(r => r[0])
  const names = new Map(d.market.runners.map(r => [r.id, r.name]))
  const W = 760, H = 220, L = 44, R = 10, T = 10, B = 26
  const t0 = new Date(pts[0].at).getTime(), t1 = Math.max(new Date(last.at).getTime(), t0 + 60_000)
  const prices = pts.flatMap(s => s.runners.filter(r => top.includes(r[0]) && r[1]).map(r => r[1] as number))
  const lo = Math.log(Math.max(1.01, Math.min(...prices) * 0.95)), hi = Math.log(Math.max(...prices) * 1.05)
  const x = (t: number) => L + (t - t0) / (t1 - t0) * (W - L - R)
  const y = (p: number) => T + (hi - Math.log(p)) / (hi - lo || 1) * (H - T - B)
  const ticks = [1.5, 2, 3, 4, 6, 10, 15, 20, 30, 50, 100].filter(p => Math.log(p) > lo && Math.log(p) < hi)
  const minsTicks: number[] = []
  for (let m = Math.ceil((t0 - start) / 600_000) * 10; start + m * 60_000 <= t1; m += 10) minsTicks.push(m)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Back prices of the leading runners over time">
        {ticks.map(p => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke={C.line} /><text x={L - 6} y={y(p) + 4} fill={C.dim} fontSize="11" textAnchor="end" fontFamily={MONO}>{p}</text></g>)}
        {minsTicks.map(m => <text key={m} x={x(start + m * 60_000)} y={H - 8} fill={C.dim} fontSize="11" textAnchor="middle" fontFamily={MONO}>{m === 0 ? 'off' : `${m}m`}</text>)}
        {top.map((id, i) => {
          const path = pts.map(s => { const r = s.runners.find(q => q[0] === id); return r?.[1] ? [x(new Date(s.at).getTime()), y(r[1])] : null })
            .filter(Boolean).map((p, j) => `${j ? 'L' : 'M'}${p![0].toFixed(1)},${p![1].toFixed(1)}`).join('')
          return <path key={id} d={path} fill="none" stroke={LINE_COLOURS[i]} strokeWidth={2} strokeLinejoin="round" />
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: C.mut, marginTop: 4 }}>
        {top.map((id, i) => <span key={id}><span style={{ display: 'inline-block', width: 10, height: 3, background: LINE_COLOURS[i], marginRight: 6, verticalAlign: 'middle' }} />{names.get(id) ?? id}</span>)}
      </div>
      <p style={{ color: C.dim, fontSize: 12, margin: '4px 0 0' }}>Best back price of the six favourites, minutes relative to the scheduled start (log scale).</p>
    </div>
  )
}

function RaceDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/betfair/data?view=race&id=' + encodeURIComponent(id), { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok || j.error) setErr(j.error ?? 'HTTP ' + res.status); else { setD(j); setErr(null) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [id])
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t) }, [load])
  if (err) return <p style={{ color: C.red, fontSize: 13 }}>{err}</p>
  if (!d) return <p style={{ color: C.mut, fontSize: 13 }}>Loading the race…</p>
  const m = d.market, last = d.snaps[d.snaps.length - 1]
  const winners = new Set(m.winners ?? []), removed = new Set(m.removed ?? [])
  const latest = new Map((last?.runners ?? []).map(r => [r[0], r]))
  const rows = [...m.runners].sort((a, b) => ((latest.get(a.id)?.[1] ?? 999) - (latest.get(b.id)?.[1] ?? 999)))
  const th: React.CSSProperties = { textAlign: 'right', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
  return (
    <div style={{ background: C.panel2, border: '1px solid ' + C.line, borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontWeight: 600 }}>{hm(m.start_at)} {m.venue ?? m.event} <span style={{ color: C.mut, fontWeight: 400 }}>{m.market_name}{m.race_type ? ` · ${m.race_type}` : ''}</span></div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid ' + C.line, color: C.mut, borderRadius: 6, padding: '2px 10px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Close</button>
      </div>
      <p style={{ color: C.mut, fontSize: 12, margin: '2px 0 8px' }}>
        {d.snaps.length.toLocaleString('en-GB')} snapshots{last ? `, latest at ${hms(last.at)}` : ''} · matched {money(last?.matched ?? m.total_matched)}{m.off_at ? ` · off at ${hms(m.off_at)}` : ''}. Refreshes every 15 seconds.
      </p>
      <Chart d={d} />
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Runner</th><th style={th}>Back</th><th style={th}>£ avail</th><th style={th}>Lay</th><th style={th}>£ avail</th><th style={th}>Last traded</th><th style={th}>SP</th></tr></thead>
          <tbody>{rows.map(r => {
            const p = latest.get(r.id)
            return (
              <tr key={r.id} style={{ opacity: removed.has(r.id) ? 0.4 : 1 }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{winners.has(r.id) ? '🏆 ' : ''}{r.name}{removed.has(r.id) ? ' (non-runner)' : ''}{r.jockey ? <span style={{ color: C.dim }}> · {r.jockey}</span> : null}</td>
                <td style={{ ...td, color: C.blu }}>{p?.[1] ?? '—'}</td><td style={{ ...td, color: C.dim }}>{p ? money(p[2]) : '—'}</td>
                <td style={{ ...td, color: '#ff8fa3' }}>{p?.[3] ?? '—'}</td><td style={{ ...td, color: C.dim }}>{p ? money(p[4]) : '—'}</td>
                <td style={td}>{p?.[5] ?? '—'}</td><td style={td}>{m.bsp?.[String(r.id)]?.toFixed(2) ?? '—'}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

export default function RecentRaces() {
  const [races, setRaces] = useState<Race[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/betfair/data?view=recent', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok || j.error) setErr(j.error ?? 'HTTP ' + res.status); else { setRaces(j.races); setErr(null); setNow(Date.now()) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t) }, [load])

  if (err) return <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{err}</p>
  if (!races) return <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>Loading…</p>
  if (!races.length) return <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>No GB or IE races between 6 hours ago and 3 hours ahead. The recorder adds races as they come within a few hours of the start.</p>
  const th: React.CSSProperties = { textAlign: 'left', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '5px 6px', borderBottom: '1px solid ' + C.line, fontSize: 13, whiteSpace: 'nowrap' }
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
          <thead><tr><th style={th}>Time</th><th style={th}>Race</th><th style={th}>Runners</th><th style={{ ...th, textAlign: 'right' }}>Snapshots</th><th style={th}>Last saved</th><th style={{ ...th, textAlign: 'right' }}>Matched</th><th style={th}>Status</th></tr></thead>
          <tbody>{races.map(r => {
            const s = state(r, now)
            return (
              <tr key={r.market_id} onClick={() => setOpen(open === r.market_id ? null : r.market_id)} style={{ cursor: 'pointer', background: open === r.market_id ? '#132042' : undefined }}>
                <td style={{ ...td, fontFamily: MONO }}>{hm(r.start_at)}</td>
                <td style={td}>{r.venue} <span style={{ color: C.dim }}>{r.name}</span></td>
                <td style={{ ...td, fontFamily: MONO }}>{r.runners}</td>
                <td style={{ ...td, fontFamily: MONO, textAlign: 'right', color: r.snaps ? '#fff' : C.dim }}>{r.snaps.toLocaleString('en-GB')}</td>
                <td style={{ ...td, color: C.mut }}>{ago(r.last_snap, now)}</td>
                <td style={{ ...td, fontFamily: MONO, textAlign: 'right', color: C.mut }}>{money(r.matched)}</td>
                <td style={{ ...td, color: s.colour }}>{s.label}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
      {open && <RaceDetail key={open} id={open} onClose={() => setOpen(null)} />}
      <p style={{ color: C.dim, fontSize: 12, margin: '8px 0 0' }}>Click a race to see every runner&apos;s latest prices and a chart of the favourites. Refreshes every 30 seconds.</p>
    </div>
  )
}
