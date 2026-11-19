'use client'
import { useCallback, useEffect, useState } from 'react'

// "Today's recording" on the Data tab: what the recorder server is following
// for each sport, how many price snapshots each market has, and (click a row)
// every selection's prices with a chart of how they moved.

const C = { panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', blu: '#6f9bff' }
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const LINE_COLOURS = ['#2fd6b0', '#6f9bff', '#f6b93b', '#ff5470', '#9b8cff', '#e47cff']
const TZ = 'Europe/London'
const hm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—'
const hms = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ })
const ukDay = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ })
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
const when = (iso: string, now: number) => ukDay(new Date(iso).getTime()) === ukDay(now) ? hm(iso) : `${dayLabel(iso)} ${hm(iso)}`
const money = (n: number | null | undefined) => n == null ? '—' : '£' + (n >= 10_000 ? Math.round(n / 1000).toLocaleString('en-GB') + 'k' : Math.round(n).toLocaleString('en-GB'))
const ago = (iso: string | null, now: number) => {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 172_800 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86_400)}d ago`
}

type Sport = 'racing' | 'football' | 'tennis' | 'golf'
const SPORT_TABS: { id: Sport; label: string; note: string; leadMin: number }[] = [
  { id: 'racing', label: 'Horse racing', leadMin: 75, note: 'GB and IE races from the last 6 hours and the next 3. Prices every minute from 75 minutes out, every 30 seconds from 30 minutes and every 5 seconds in the last 10 minutes until the off.' },
  { id: 'football', label: 'Football', leadMin: 180, note: 'Big leagues and cups (and any match with £200k+ matched), from 4 hours ago to 4 hours ahead. Prices every 5 minutes from 3 hours out, every minute from an hour, every 15 seconds in the last 10 minutes, then every minute in-play for Match Odds, Over/Under 2.5 and Both Teams to Score.' },
  { id: 'tennis', label: 'Tennis', leadMin: 120, note: 'ATP, WTA, Grand Slam and team-event singles, from 10 hours ago to 3 hours ahead. Match Odds every 5 minutes from 2 hours out, every minute from an hour, every 30 seconds near the start and in-play.' },
  { id: 'golf', label: 'Golf', leadMin: 3 * 24 * 60, note: 'PGA Tour, DP World Tour, majors, LIV and team events: the Winner market every 2 hours from 3 days out, every 30 minutes on the last day, and every 10 minutes during the tournament.' },
]
const TYPE_LABEL: Record<string, string> = {
  MATCH_ODDS: 'Match Odds', OVER_UNDER_15: 'O/U 1.5', OVER_UNDER_25: 'O/U 2.5', OVER_UNDER_35: 'O/U 3.5', BOTH_TEAMS_TO_SCORE: 'Both to score',
  CORRECT_SCORE: 'Correct score', WINNER: 'Winner', WIN: 'Win',
}

type Row = { market_id: string; event: string; venue: string; name: string | null; market_type: string; race_type: string | null; start_at: string; off_at: string | null
  runners: number; status: string | null; winners: number[] | null; matched: number | null; snaps: number; last_snap: string | null }
type Group = { key: string; title: string; sub: string | null; start_at: string; rows: Row[] }
type Runner = { id: number; name: string; jockey?: string | null }
type Snap = { at: string; inplay: boolean; matched: number | null; runners: [number, number | null, number, number | null, number, number | null][] }
type Detail = { market: { market_id: string; sport: Sport; venue: string | null; event: string; market_name: string | null; market_type: string; race_type: string | null
  start_at: string; off_at: string | null; runners: Runner[]; status: string | null; winners: number[] | null; removed: number[] | null; total_matched: number | null
  bsp: Record<string, number> | null }; snaps: Snap[] }

function groupRows(sport: Sport, rows: Row[]): Group[] {
  if (sport !== 'football') return rows.map(r => ({ key: r.market_id, start_at: r.start_at, rows: [r],
    title: sport === 'racing' ? r.venue : r.event, sub: sport === 'racing' ? r.name : r.venue }))
  const order = ['MATCH_ODDS', 'OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE', 'OVER_UNDER_15', 'OVER_UNDER_35', 'CORRECT_SCORE']
  const by = new Map<string, Group>()
  for (const r of rows) {
    const k = r.event + '|' + r.start_at.slice(0, 10)
    const g = by.get(k) ?? { key: k, title: r.event, sub: r.venue !== r.event ? r.venue : null, start_at: r.start_at, rows: [] }
    g.rows.push(r)
    by.set(k, g)
  }
  for (const g of by.values()) g.rows.sort((a, b) => (order.indexOf(a.market_type) + 99) % 99 - (order.indexOf(b.market_type) + 99) % 99)
  return [...by.values()].sort((a, b) => a.start_at.localeCompare(b.start_at))
}

function status(sport: Sport, g: Group, now: number): { label: string; colour: string } {
  const main = g.rows[0]
  if (main.status) return { label: 'Result in', colour: C.teal }
  if (main.off_at) return sport === 'racing' ? { label: 'Off, awaiting result', colour: C.amb } : { label: 'In play', colour: C.red }
  const start = new Date(main.start_at).getTime(), mins = (start - now) / 60_000
  const lead = SPORT_TABS.find(t => t.id === sport)!.leadMin
  if (mins > lead) return { label: `Starts recording ${when(new Date(start - lead * 60_000).toISOString(), now)}`, colour: C.dim }
  if (mins > 0) return { label: 'Recording', colour: C.red }
  if (sport === 'racing') return mins > -15 ? { label: 'Recording', colour: C.red } : { label: 'Awaiting result', colour: C.amb }
  return { label: 'Waiting to start', colour: C.amb }
}

function Chart({ d }: { d: Detail }) {
  const racing = d.market.sport === 'racing'
  const start = new Date(d.market.start_at).getTime()
  const pts = racing ? d.snaps.filter(s => !s.inplay) : d.snaps
  if (pts.length < 2) return <p style={{ color: C.mut, fontSize: 13, margin: '6px 0' }}>The chart appears once there are a few snapshots.</p>
  const last = pts[pts.length - 1]
  const top = [...last.runners].filter(r => r[1] || r[5]).sort((a, b) => ((a[1] ?? a[5] ?? 999) - (b[1] ?? b[5] ?? 999))).slice(0, 6).map(r => r[0])
  const names = new Map(d.market.runners.map(r => [r.id, r.name]))
  const W = 760, Ht = 220, L = 44, R = 10, T = 10, B = 26
  const t0 = new Date(pts[0].at).getTime(), t1 = Math.max(new Date(last.at).getTime(), t0 + 60_000)
  const price = (r: Snap['runners'][number]) => r[1] ?? r[5]      // best back, or last traded when there's no back price
  const prices = pts.flatMap(s => s.runners.filter(r => top.includes(r[0]) && price(r)).map(r => price(r) as number))
  if (!prices.length) return null
  const lo = Math.log(Math.max(1.01, Math.min(...prices) * 0.95)), hi = Math.log(Math.max(...prices) * 1.05)
  const x = (t: number) => L + (t - t0) / (t1 - t0) * (W - L - R)
  const y = (p: number) => T + (hi - Math.log(p)) / (hi - lo || 1) * (Ht - T - B)
  const ticks = [1.1, 1.25, 1.5, 2, 3, 4, 6, 10, 15, 20, 30, 50, 100, 200, 500].filter(p => Math.log(p) > lo && Math.log(p) < hi)
  // time axis: minutes to the off for racing, clock times otherwise
  let xTicks: { t: number; label: string }[] = []
  if (racing) {
    for (let m = Math.ceil((t0 - start) / 600_000) * 10; start + m * 60_000 <= t1; m += 10) xTicks.push({ t: start + m * 60_000, label: m === 0 ? 'off' : `${m}m` })
  } else {
    const span = t1 - t0
    const step = [5, 10, 15, 30, 60, 120, 240, 360, 720, 1440].map(m => m * 60_000).find(s => span / s <= 7) ?? 2880 * 60_000
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) xTicks.push({ t, label: step >= 1440 * 60_000 ? dayLabel(new Date(t).toISOString()) : hm(new Date(t).toISOString()) })
    if (xTicks.length > 8) xTicks = xTicks.filter((_, i) => i % 2 === 0)
  }
  const firstInPlay = pts.find(s => s.inplay)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${Ht}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Prices of the leading selections over time">
        {firstInPlay && <rect x={x(new Date(firstInPlay.at).getTime())} y={T} width={W - R - x(new Date(firstInPlay.at).getTime())} height={Ht - T - B} fill="#ff547012" />}
        {ticks.map(p => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke={C.line} /><text x={L - 6} y={y(p) + 4} fill={C.dim} fontSize="11" textAnchor="end" fontFamily={MONO}>{p}</text></g>)}
        {xTicks.map(k => <text key={k.t} x={x(k.t)} y={Ht - 8} fill={C.dim} fontSize="11" textAnchor="middle" fontFamily={MONO}>{k.label}</text>)}
        {top.map((id, i) => {
          const path = pts.map(s => { const r = s.runners.find(q => q[0] === id); const p = r && price(r); return p ? [x(new Date(s.at).getTime()), y(p)] : null })
            .filter(Boolean).map((p, j) => `${j ? 'L' : 'M'}${p![0].toFixed(1)},${p![1].toFixed(1)}`).join('')
          return <path key={id} d={path} fill="none" stroke={LINE_COLOURS[i]} strokeWidth={2} strokeLinejoin="round" />
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: C.mut, marginTop: 4 }}>
        {top.map((id, i) => <span key={id}><span style={{ display: 'inline-block', width: 10, height: 3, background: LINE_COLOURS[i], marginRight: 6, verticalAlign: 'middle' }} />{names.get(id) ?? id}</span>)}
      </div>
      <p style={{ color: C.dim, fontSize: 12, margin: '4px 0 0' }}>
        Best back price{top.length > 1 ? 's' : ''} of the {top.length} shortest-priced selection{top.length > 1 ? 's' : ''}, log scale. {racing ? 'Minutes relative to the scheduled start.' : firstInPlay ? 'The shaded part is in-play.' : 'UK time.'}
      </p>
    </div>
  )
}

function MarketDetail({ id }: { id: string }) {
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
  if (!d) return <p style={{ color: C.mut, fontSize: 13 }}>Loading…</p>
  const m = d.market, last = d.snaps[d.snaps.length - 1]
  const winners = new Set(m.winners ?? []), removed = new Set(m.removed ?? [])
  const latest = new Map((last?.runners ?? []).map(r => [r[0], r]))
  const rows = [...m.runners].sort((a, b) => ((latest.get(a.id)?.[1] ?? 9999) - (latest.get(b.id)?.[1] ?? 9999)))
  const showSp = m.sport === 'racing'
  const th: React.CSSProperties = { textAlign: 'right', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
  return (
    <div>
      <p style={{ color: C.mut, fontSize: 12, margin: '2px 0 8px' }}>
        {d.snaps.length.toLocaleString('en-GB')} snapshots{last ? `, latest at ${hms(last.at)}${last.inplay ? ' (in-play)' : ''}` : ''} · matched {money(last?.matched ?? m.total_matched)}
        {m.off_at ? ` · ${m.sport === 'racing' ? 'off' : 'in-play from'} ${hms(m.off_at)}` : ''}. Refreshes every 15 seconds.
      </p>
      <Chart d={d} />
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Selection</th><th style={th}>Back</th><th style={th}>£ avail</th><th style={th}>Lay</th><th style={th}>£ avail</th><th style={th}>Last traded</th>{showSp && <th style={th}>SP</th>}</tr></thead>
          <tbody>{rows.map(r => {
            const p = latest.get(r.id)
            return (
              <tr key={r.id} style={{ opacity: removed.has(r.id) ? 0.4 : 1 }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{winners.has(r.id) ? '🏆 ' : ''}{r.name}{removed.has(r.id) ? ' (removed)' : ''}{r.jockey ? <span style={{ color: C.dim }}> · {r.jockey}</span> : null}</td>
                <td style={{ ...td, color: C.blu }}>{p?.[1] ?? '—'}</td><td style={{ ...td, color: C.dim }}>{p ? money(p[2]) : '—'}</td>
                <td style={{ ...td, color: '#ff8fa3' }}>{p?.[3] ?? '—'}</td><td style={{ ...td, color: C.dim }}>{p ? money(p[4]) : '—'}</td>
                <td style={td}>{p?.[5] ?? '—'}</td>{showSp && <td style={td}>{m.bsp?.[String(r.id)]?.toFixed(2) ?? '—'}</td>}
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

function GroupDetail({ g, onClose }: { g: Group; onClose: () => void }) {
  const [pick, setPick] = useState(g.rows[0].market_id)
  return (
    <div style={{ background: C.panel2, border: '1px solid ' + C.line, borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontWeight: 600 }}>{g.title} <span style={{ color: C.mut, fontWeight: 400 }}>{g.sub}{g.rows[0].race_type ? ` · ${g.rows[0].race_type}` : ''}</span></div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid ' + C.line, color: C.mut, borderRadius: 6, padding: '2px 10px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Close</button>
      </div>
      {g.rows.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 4px' }}>
          {g.rows.map(r => (
            <button key={r.market_id} onClick={() => setPick(r.market_id)} style={{ background: pick === r.market_id ? '#1b2b57' : 'none', color: pick === r.market_id ? '#fff' : C.mut,
              border: '1px solid ' + C.line, borderRadius: 999, padding: '2px 10px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>
              {TYPE_LABEL[r.market_type] ?? r.name ?? r.market_type} <span style={{ color: C.dim, fontFamily: MONO }}>{r.snaps}</span>
            </button>
          ))}
        </div>
      )}
      <MarketDetail key={pick} id={pick} />
    </div>
  )
}

export default function RecentMarkets() {
  const [sport, setSport] = useState<Sport>('racing')
  useEffect(() => { try { const s = localStorage.getItem('bf-recent-sport') as Sport | null; if (s && SPORT_TABS.some(t => t.id === s)) setSport(s) } catch { /* private window */ } }, [])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/betfair/data?view=recent&sport=' + sport, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok || j.error) setErr(j.error ?? 'HTTP ' + res.status); else { setRows(j.races); setErr(null); setNow(Date.now()) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [sport])
  useEffect(() => { setRows(null); setOpen(null); load(); const t = setInterval(load, 30_000); return () => clearInterval(t) }, [load])
  const choose = (s: Sport) => { setSport(s); try { localStorage.setItem('bf-recent-sport', s) } catch { /* private window */ } }

  const tab = SPORT_TABS.find(t => t.id === sport)!
  const groups = rows ? groupRows(sport, rows) : []
  const openGroup = groups.find(g => g.key === open)
  const th: React.CSSProperties = { textAlign: 'left', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '5px 6px', borderBottom: '1px solid ' + C.line, fontSize: 13, whiteSpace: 'nowrap' }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }} role="tablist">
        {SPORT_TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={sport === t.id} onClick={() => choose(t.id)} style={{ background: sport === t.id ? C.teal : 'none', color: sport === t.id ? '#06101a' : C.mut,
            border: '1px solid ' + (sport === t.id ? C.teal : C.line), borderRadius: 999, padding: '3px 12px', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }}>{t.label}</button>
        ))}
      </div>
      <p style={{ color: C.mut, fontSize: 12, margin: '0 0 8px' }}>{tab.note}</p>
      {err ? <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{err}</p>
        : !rows ? <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>Loading…</p>
        : !groups.length ? <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>Nothing in this window yet. The recorder adds markets as they come within a few hours of the start{sport === 'golf' ? ' (days for golf)' : ''}.</p>
        : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
                <thead><tr>
                  <th style={th}>{sport === 'golf' ? 'Starts' : 'Time'}</th><th style={th}>{sport === 'racing' ? 'Race' : sport === 'golf' ? 'Tournament' : 'Match'}</th>
                  <th style={th}>{sport === 'football' ? 'Markets' : sport === 'racing' ? 'Runners' : 'Selections'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>Snapshots</th><th style={th}>Last saved</th><th style={{ ...th, textAlign: 'right' }}>Matched</th><th style={th}>Status</th>
                </tr></thead>
                <tbody>{groups.map(g => {
                  const s = status(sport, g, now)
                  const snaps = g.rows.reduce((n, r) => n + r.snaps, 0)
                  const lastSnap = g.rows.map(r => r.last_snap).filter(Boolean).sort().pop() ?? null
                  return (
                    <tr key={g.key} onClick={() => setOpen(open === g.key ? null : g.key)} style={{ cursor: 'pointer', background: open === g.key ? '#132042' : undefined }}>
                      <td style={{ ...td, fontFamily: MONO }}>{when(g.start_at, now)}</td>
                      <td style={td}>{g.title} <span style={{ color: C.dim }}>{g.sub}</span></td>
                      <td style={{ ...td, fontFamily: MONO }}>{sport === 'football' ? g.rows.length : g.rows[0].runners}</td>
                      <td style={{ ...td, fontFamily: MONO, textAlign: 'right', color: snaps ? '#fff' : C.dim }}>{snaps.toLocaleString('en-GB')}</td>
                      <td style={{ ...td, color: C.mut }}>{ago(lastSnap, now)}</td>
                      <td style={{ ...td, fontFamily: MONO, textAlign: 'right', color: C.mut }}>{money(g.rows[0].matched)}</td>
                      <td style={{ ...td, color: s.colour }}>{s.label}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            {openGroup && <GroupDetail key={openGroup.key} g={openGroup} onClose={() => setOpen(null)} />}
            <p style={{ color: C.dim, fontSize: 12, margin: '8px 0 0' }}>Click a row for the latest prices and a chart{sport === 'football' ? '; switch between the match’s markets at the top' : ''}. Refreshes every 30 seconds.</p>
          </>
        )}
    </div>
  )
}
