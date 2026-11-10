'use client'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { Snapshot } from '@/lib/betfair/run'
import { RULES } from '@/lib/betfair/engine'
import ResearchTab from '@/components/betfair/ResearchTab'
import StrategiesTab, { type StratData } from '@/components/betfair/StrategiesTab'

// Betfair paper desk: six agents, hard handoffs, paper fills only.
// While running, this page drives the bot by calling /api/betfair every few
// seconds (demo every 2s, live every 5s). The server does the Betfair calls.
//
// Three tabs: Desk (the racing bot), Research (ideas from the Sports Hacker
// articles, lib/betfair/playbook.ts) and Strategies (football paper tests,
// polled through /api/betfair/strategies once a minute in live mode).

const C = {
  bg: '#060914', panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677',
  teal: '#2fd6b0', red: '#ff5470', vio: '#9b8cff', amb: '#f6b93b', blu: '#6f9bff', grn: '#3ee08f',
}
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const gbp = (v: number) => (v < 0 ? '−' : '') + '£' + Math.abs(v).toFixed(2)
const gbps = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const hhmm = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London' }) : '—'
const TYPE_COL: Record<string, string> = { KILL: C.red, STOP: C.red, LOSS: C.red, ERROR: C.red, WIN: C.teal, PASS: C.grn, ENTER: C.grn, SCORE: C.vio, VOID: C.amb }

type Data = Snapshot & { liveReady: boolean; tickError?: string; error?: string }

function Panel({ title, note, children, style }: { title: string; note?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 10, padding: 12, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 600 }}>
        <span>{title}</span>{note && <span style={{ color: C.mut, letterSpacing: '.04em', textTransform: 'none', fontWeight: 400 }}>{note}</span>}
      </div>
      {children}
    </div>
  )
}

function Agent({ name, icon, desc, rule, foot, badge, color }: { name: string; icon: string; desc: string; rule: string; foot: React.ReactNode; badge: string; color: string }) {
  return (
    <div style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.03em', color }}>{icon} {name}</div>
          <div style={{ color: C.mut, fontSize: 11, fontFamily: 'system-ui,sans-serif' }}>{desc}</div>
        </div>
        <span style={{ fontSize: 9, border: '1px solid ' + color, color, borderRadius: 4, padding: '1px 5px', height: 'fit-content', letterSpacing: '.08em' }}>{badge}</span>
      </div>
      <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 12, margin: '8px 0 6px', color }}>{rule}</div>
      <div style={{ color: C.mut, fontSize: 11 }}>{foot}</div>
    </div>
  )
}

function Gauge({ v }: { v: number | null }) {
  const s = 104, r = 40, c = s / 2, a0 = -Math.PI * 0.75, span = Math.PI * 1.5
  const pt = (a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)]
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from), [x2, y2] = pt(to)
    return `M${x1},${y1} A${r},${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2},${y2}`
  }
  return (
    <svg viewBox={`0 0 ${s} ${s}`} style={{ width: '100%', maxWidth: s }} aria-hidden="true">
      <path d={arc(a0, a0 + span)} stroke="#18213f" strokeWidth={6} fill="none" strokeLinecap="round" />
      {v !== null && v > 0 && <path d={arc(a0, a0 + span * Math.min(v, 100) / 100)} stroke={v >= 70 ? C.teal : C.vio} strokeWidth={6} fill="none" strokeLinecap="round" />}
      <text x={c} y={c + 10} textAnchor="middle" fontSize={30} fontWeight={700} fill="#fff">{v ?? '—'}</text>
      <text x={c} y={c + 26} textAnchor="middle" fontSize={9} fill={C.mut}>{v === null ? 'waiting' : v >= 70 ? 'traded' : 'dropped'}</text>
    </svg>
  )
}

function Equity({ points }: { points: { n: number; cum: number; label: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 180, ml = 52, mr = 8, mt = 10, mb = 20
  if (points.length < 2) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 11 }}>Equity curve appears after two closed trades.</div>
  const vals = [0, ...points.map(p => p.cum)]
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5 }
  const x = (n: number) => ml + (n - 1) / (points.length - 1) * (W - ml - mr)
  const y = (v: number) => mt + (hi - v) / (hi - lo) * (H - mt - mb)
  const col = points[points.length - 1].cum < 0 ? C.red : C.teal
  const line = points.map((p, i) => (i ? 'L' : 'M') + x(p.n).toFixed(1) + ',' + y(p.cum).toFixed(1)).join('')
  const ticks = [lo, (lo + hi) / 2, hi]
  const hp = hover !== null ? points[hover] : null
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}
        onMouseMove={e => { const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = (e.clientX - b.left) / b.width * W; setHover(Math.max(0, Math.min(points.length - 1, Math.round((px - ml) / (W - ml - mr) * (points.length - 1))))) }}
        onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="bfEq" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={col} stopOpacity={0.3} /><stop offset="1" stopColor={col} stopOpacity={0} /></linearGradient></defs>
        {ticks.map(t => <g key={t}><line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#141d3b" /><text x={ml - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={C.dim}>{gbps(t)}</text></g>)}
        <line x1={ml} x2={W - mr} y1={y(0)} y2={y(0)} stroke={C.amb} strokeDasharray="3 4" opacity={0.7} />
        <text x={W - mr} y={y(0) - 4} textAnchor="end" fontSize={9} fill={C.amb}>break-even</text>
        <path d={line + `L${x(points.length)},${y(0)}L${x(1)},${y(0)}Z`} fill="url(#bfEq)" />
        <path d={line} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hp && <circle cx={x(hp.n)} cy={y(hp.cum)} r={4} fill={col} />}
      </svg>
      {hp && <div style={{ position: 'absolute', top: 0, left: `${Math.min(70, x(hp.n) / W * 100)}%`, background: '#121a35', border: '1px solid ' + C.line, borderRadius: 6, padding: '4px 8px', fontSize: 10, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{hp.label} → {gbps(hp.cum)}</div>}
    </div>
  )
}

function GreenUp() {
  const [side, setSide] = useState<'BACK' | 'LAY'>('BACK')
  const [open, setOpen] = useState('4.0'), [stake, setStake] = useState('20'), [now, setNow] = useState('3.5'), [comm, setComm] = useState('5')
  const o = Number(open), s = Number(stake), n = Number(now), c = Number(comm) / 100
  const ok = o > 1 && n > 1 && s > 0 && c >= 0
  const hedge = ok ? s * o / n : 0
  const gross = side === 'BACK' ? hedge - s : s - hedge
  const net = gross > 0 ? gross * (1 - c) : gross
  const inp: React.CSSProperties = { background: C.panel2, color: C.fg, border: '1px solid ' + C.line, borderRadius: 6, padding: '6px 8px', font: 'inherit', fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, color: C.mut, fontSize: 10 }
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        <label style={lab}>You opened with<select style={inp} value={side} onChange={e => setSide(e.target.value as 'BACK' | 'LAY')}><option value="BACK">a back</option><option value="LAY">a lay</option></select></label>
        <label style={lab}>Opening price<input style={inp} type="number" step="0.01" value={open} onChange={e => setOpen(e.target.value)} /></label>
        <label style={lab}>Stake (£)<input style={inp} type="number" value={stake} onChange={e => setStake(e.target.value)} /></label>
        <label style={lab}>Price now<input style={inp} type="number" step="0.01" value={now} onChange={e => setNow(e.target.value)} /></label>
        <label style={lab}>Commission %<input style={inp} type="number" step="0.5" value={comm} onChange={e => setComm(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>
        {ok ? <>
          <div>{side === 'BACK' ? 'Lay now: ' : 'Back now: '}<b>£{hedge.toFixed(2)} at {n}</b></div>
          <div>Locked on every outcome: <b style={{ color: gross >= 0 ? C.teal : C.red }}>{gbps(gross)} gross</b></div>
          <div>After commission: <b style={{ color: net >= 0 ? C.teal : C.red }}>{gbps(net)}</b></div>
        </> : 'Enter prices above 1.01 and a stake.'}
      </div>
    </>
  )
}

export default function BetfairPage() {
  const router = useRouter()
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const call = useCallback(async (body?: object) => {
    if (inFlight.current && body && (body as { action?: string }).action === 'tick') return
    inFlight.current = true
    try {
      const res = await fetch('/api/betfair', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
      const j = await res.json() as Data
      if (!res.ok || j.error) setErr(j.error ?? 'HTTP ' + res.status)
      else { setD(j); setErr(j.tickError ?? null) }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { inFlight.current = false }
  }, [])

  useEffect(() => { call() }, [call])

  // --- tabs + the football strategy tests (polled whichever tab is showing)
  type Tab = 'desk' | 'research' | 'strategies'
  const [tab, setTab] = useState<Tab>('desk')
  const [focus, setFocus] = useState<string | null>(null)
  const [sd, setSd] = useState<StratData | null>(null)
  const [sErr, setSErr] = useState<string | null>(null)
  const [sBusy, setSBusy] = useState(false)
  const sFlight = useRef(false)
  const sCall = useCallback(async (body?: { action: string; mode?: string }) => {
    if (sFlight.current && body?.action === 'tick') return
    sFlight.current = true
    try {
      const res = await fetch('/api/betfair/strategies', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
      const j = await res.json() as StratData
      if (!res.ok || j.error) setSErr(j.error ?? 'HTTP ' + res.status)
      else { setSd(j); setSErr(j.tickError ?? null) }
    } catch (e) { setSErr(e instanceof Error ? e.message : String(e)) }
    finally { sFlight.current = false }
  }, [])
  useEffect(() => { sCall() }, [sCall])
  useEffect(() => {
    if (!sd?.running) return
    const id = setInterval(() => sCall({ action: 'tick' }), sd.mode === 'demo' ? 2500 : 60_000)
    return () => clearInterval(id)
  }, [sd?.running, sd?.mode, sCall])
  const sAct = async (action: string, mode?: string) => {
    if (action === 'reset' && !confirm(`Delete all ${mode ?? sd?.mode} strategy paper bets and start the tests again?`)) return
    setSBusy(true); await sCall({ action, mode }); setSBusy(false)
  }
  const openConcept = (id: string) => { setFocus(id); setTab('research') }
  const openStrategy = (id: string) => { setTab('strategies'); setTimeout(() => document.getElementById('strategy-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }
  useEffect(() => {
    if (!d) return
    const ms = d.running ? (d.mode === 'demo' ? 2000 : 5000) : 15000
    const id = setInterval(() => call(d.running ? { action: 'tick' } : undefined), ms)
    return () => clearInterval(id)
  }, [d?.running, d?.mode, call]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: string, mode?: string) => {
    if (action === 'reset' && !confirm(`Clear all ${mode ?? d?.mode} paper trades and the log, and reset the bank to £500?`)) return
    setBusy(true); await call({ action, mode }); setBusy(false)
  }

  const stats = useMemo(() => {
    const t = d?.trades ?? []
    const net = t.reduce((s, x) => s + x.net_pl, 0)
    let cum = 0, peak = 0, dd = 0
    const points = t.map((x, i) => { cum += x.net_pl; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); return { n: i + 1, cum, label: `${x.market} · ${gbps(x.net_pl)}` } })
    const wins = t.filter(x => x.net_pl > 0).length
    const bestT = t.length ? t.reduce((a, b) => (b.net_pl > a.net_pl ? b : a)) : null
    return { net, points, wins, losses: t.length - wins, strike: t.length ? wins / t.length : 0, exp: t.length ? net / t.length : 0, dd,
      comm: t.reduce((s, x) => s + x.commission, 0), best: bestT, worst: t.length ? Math.min(...t.map(x => x.net_pl)) : 0 }
  }, [d?.trades])

  const c = d?.counts
  const ls = d?.lastScore ?? null
  const lastEv = d?.events[d.events.length - 1]
  const btn = (bg: string, fg = '#06101a'): React.CSSProperties => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 })
  const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 10 }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '16px', boxSizing: 'border-box' }}>
      <style>{`@keyframes bfPulse{50%{box-shadow:0 0 60px #7b5cffcc}} .bf-main{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:10px} .bf-head{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center} .bf-flow{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;text-align:center} @media(max-width:860px){.bf-main{grid-template-columns:1fr}.bf-head{grid-template-columns:auto 1fr}.bf-bank{grid-column:1/-1;text-align:left!important}.bf-flow{grid-template-columns:repeat(3,1fr);row-gap:14px}}`}</style>
      <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 0, color: C.mut, cursor: 'pointer', fontSize: 13, marginBottom: 10, padding: 0 }}><ChevronLeft size={16} />FlowState</button>

      <div style={{ maxWidth: 1400, margin: '0 auto', color: C.fg, fontFamily: MONO, fontSize: 12, padding: 14, borderRadius: 14, border: '1px solid ' + C.line, background: `radial-gradient(1200px 500px at 10% -10%, #1b1450 0%, transparent 60%), ${C.bg}` }}>
        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.mut, fontSize: 11, gap: 8, flexWrap: 'wrap' }}>
          <span>{[C.red, C.amb, C.teal].map(col => <i key={col} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: col, marginRight: 6 }} />)}</span>
          <span>betfair-bot — paper-desk — six agents — hard handoffs</span>
          <span style={{ border: '1px solid #5a4718', color: C.amb, borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>paper ✓ · real bets ✗</span>
        </div>

        {/* tabs */}
        <div role="tablist" style={{ display: 'flex', gap: 4, margin: '12px 0 0', borderBottom: '1px solid ' + C.line, flexWrap: 'wrap' }}>
          {([['desk', 'Desk', d?.running], ['research', 'Research', false], ['strategies', 'Strategies', sd?.running]] as const).map(([id, label, on]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ background: 'none', border: 0, borderBottom: '2px solid ' + (tab === id ? C.vio : 'transparent'), color: tab === id ? '#fff' : C.mut, padding: '8px 14px', cursor: 'pointer', fontFamily: MONO, fontSize: 13, fontWeight: 600, marginBottom: -1 }}>
              {label}{on && <i style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: C.teal, marginLeft: 6, verticalAlign: 'middle' }} />}
            </button>
          ))}
        </div>

        {tab === 'research' && <ResearchTab focus={focus} onStrategy={openStrategy} />}
        {tab === 'strategies' && <StrategiesTab d={sd} err={sErr} busy={sBusy} act={sAct} onConcept={openConcept} />}

        {tab === 'desk' && <>
        {/* header */}
        <div className="bf-head" style={{ margin: '14px 0 12px' }}>
          <div aria-hidden="true" style={{ width: 76, height: 76, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#fff 0%,#c9bdff 18%,#8b6cff 55%,#4a2ad1 100%)', boxShadow: '0 0 40px #7b5cff88', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, animation: d?.running ? 'bfPulse 3s ease-out infinite' : 'none' }}>
            {d?.running ? <><i style={{ width: 9, height: 26, background: '#140c3a', borderRadius: 3 }} /><i style={{ width: 9, height: 26, background: '#140c3a', borderRadius: 3 }} /></> : <i style={{ width: 0, height: 0, borderLeft: '22px solid #140c3a', borderTop: '14px solid transparent', borderBottom: '14px solid transparent', marginLeft: 6 }} />}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>
              <span style={{ background: 'linear-gradient(90deg,#6fa0ff,#9b8cff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Betfair Bot</span> Terminal{' '}
              <span style={{ fontSize: 10, verticalAlign: 'middle', background: 'linear-gradient(90deg,#3b2f8f,#1f6f70)', color: '#dfe', borderRadius: 6, padding: '2px 7px' }}>{d?.mode === 'live' ? 'live prices' : 'demo prices'}</span>
            </h1>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 4px' }}>
              <span><i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: d?.running ? C.teal : C.dim, marginRight: 6 }} />{d?.running ? 'running' : 'stopped'} · {d?.mode === 'demo' ? 'sim clock ' + hhmm(d?.clock) : 'updated ' + hhmm(d?.updatedAt)}</span>
              {lastEv && <span style={{ border: '1px solid #5c2032', color: TYPE_COL[lastEv.type] ?? C.fg, borderRadius: 6, padding: '2px 7px', fontSize: 10, letterSpacing: '.08em' }}>{lastEv.type} · {lastEv.market ?? ''}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {d?.running
                ? <button style={btn(C.amb)} disabled={busy} onClick={() => act('stop')}>■ Stop</button>
                : <button style={btn(C.teal)} disabled={busy || !d} onClick={() => act('start')}>▶ Start {d?.mode === 'live' ? 'live paper' : 'demo'}</button>}
              <button style={btn(C.panel2, d?.mode === 'demo' ? C.fg : C.mut)} disabled={busy} onClick={() => act('mode', 'demo')}>Demo</button>
              <button style={btn(C.panel2, d?.mode === 'live' ? C.fg : C.mut)} disabled={busy} onClick={() => act('mode', 'live')} title={d?.liveReady ? '' : 'Needs Betfair keys in Vercel'}>Live prices{d && !d.liveReady ? ' 🔒' : ''}</button>
              <button style={btn('transparent', C.red)} disabled={busy} onClick={() => act('reset')}>Reset</button>
            </div>
          </div>
          <div className="bf-bank" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{d ? '£' + d.bank.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</div>
            <div style={{ color: C.mut, fontSize: 10, marginTop: 6 }}>paper bank · started at £500.00 · net of commission</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>{d?.trades.length ?? 0} trades · <span style={{ color: C.teal }}>{stats.wins} W</span> · <span style={{ color: C.red }}>{stats.losses} L</span> · {d?.positions.length ?? 0} open</div>
          </div>
        </div>

        {(err || d?.lastError) && <div style={{ border: '1px solid #5c2032', background: '#2a0f1a', color: '#ffb3c0', borderRadius: 8, padding: '8px 12px', margin: '0 0 10px', fontFamily: 'system-ui,sans-serif', fontSize: 12 }}>{err ?? d?.lastError}</div>}
        {d?.mode === 'live' && !d.liveReady && <div style={{ border: '1px solid #5a4718', background: '#221a08', color: '#ffe2a8', borderRadius: 8, padding: '8px 12px', margin: '0 0 10px', fontFamily: 'system-ui,sans-serif', fontSize: 12 }}>Live prices need your Betfair login: add <b>BF_USERNAME</b>, <b>BF_PASSWORD</b> and <b>BF_APP_KEY</b> in Vercel → Settings → Environment Variables, then redeploy. Demo works now.</div>}

        <div className="bf-main">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Agent name="SCOUT" icon="⌕" color={C.teal} badge="SCAN" desc="finds GB/IE racing markets" rule="WIN markets · off within 60 min" foot={<>watching {d?.watching ?? 0} · judged {c?.scanned ?? 0}</>} />
            <Agent name="FILTER" icon="▼" color={C.red} badge="CHECK" desc="kills what fails the rules" rule="8 hard rules · one fail = killed" foot={<>killed {c?.killed ?? 0} · said no to {c?.scanned ? Math.round(c.killed / c.scanned * 100) : 0}%</>} />
            <Agent name="ANALYST" icon="▮" color={C.vio} badge="SCORING" desc="scores what's left, 0–100" rule="only 70+ gets through, signals must agree" foot={<>last {ls ? `${ls.market} · ${ls.score}` : '—'}</>} />
            <Agent name="EXECUTOR" icon="ϟ" color={C.grn} badge="PAPER" desc="places the paper trades" rule={`max ${Math.round((d?.config.stakePct ?? 0.05) * 100)}% of bank per trade · never a real order`} foot={<>{c?.traded ?? 0} paper entries</>} />
            <Agent name="RISK" icon="⬢" color={C.amb} badge="TRAIL" desc="guards every entry" rule={`stop −${d?.config.stopTicks ?? 3} ticks before entry · trails after +${d?.config.trailAfterTicks ?? 2} · flat before the off`} foot={<>{c?.stops ?? 0} stops hit · {d?.positions.length ?? 0} open</>} />
            <Agent name="LOGGER" icon="≡" color={C.blu} badge="WRITE" desc="writes everything down" rule="every kill and every trade" foot={<>line #{c?.logged ?? 0}</>} />
            <Agent name="YOU" icon="▮▮" color={C.fg} badge={d?.running ? 'WATCHING' : 'IDLE'} desc="pressed start" rule="keep this tab open while it runs" foot="real money at risk: £0" />
          </div>

          <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
            <Panel title="Live flow · hard handoffs · one job each" note={d?.running ? 'polling' : 'stopped'}>
              <div className="bf-flow">
                {[['⌕', 'SCOUT', C.teal, `${d?.watching ?? 0} watching`], ['▼', 'FILTER', C.red, `${c?.killed ?? 0} killed`], ['▮', 'ANALYST', C.vio, `${c?.scored ?? 0} scored`],
                  ['ϟ', 'EXECUTOR', C.grn, `${c?.traded ?? 0} trades`], ['⬢', 'RISK', C.amb, `${c?.stops ?? 0} stops`], ['≡', 'LOGGER', C.blu, `#${c?.logged ?? 0}`]].map(([ic, nm, col, ct]) => (
                  <div key={nm} style={{ color: col }}>
                    <div style={{ width: 48, height: 48, margin: '0 auto', borderRadius: '50%', border: '2px solid ' + col, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: `0 0 18px -4px ${col}` }}>{ic}</div>
                    <div style={{ fontSize: 9, letterSpacing: '.1em', marginTop: 6 }}>{nm}</div>
                    <div style={{ color: C.mut, fontSize: 11, marginTop: 2 }}>{ct}</div>
                  </div>
                ))}
              </div>
              {!!d?.positions.length && <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {d.positions.map(p => <span key={p.marketId} style={{ border: '1px solid ' + C.line, borderRadius: 6, padding: '3px 8px', fontSize: 11 }}><b style={{ color: '#fff' }}>{p.market}</b> <span style={{ color: C.mut }}>{p.side} @ {p.entry} · £{p.stake.toFixed(2)}</span></span>)}
              </div>}
            </Panel>

            <div style={two}>
              <Panel title="Filter · 8 hard rules" note="markets killed by each">
                {RULES.map((r, i) => (
                  <div key={r} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 8, alignItems: 'center', padding: '4px 0', fontFamily: 'system-ui,sans-serif', fontSize: 12 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: C.teal }} />{r}
                    <span style={{ color: C.red, fontFamily: MONO, fontSize: 11 }}>×{d?.ruleKills[i] ?? 0}</span>
                  </div>
                ))}
                <div style={{ border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'center', padding: 7, marginTop: 10 }}>first rule failed = killed · no second chances</div>
              </Panel>
              <Panel title="Analyst · score 0–100" note="last market scored">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10, alignItems: 'center' }}>
                  <div>
                    {([['weight of money', 'weight_of_money'], ['momentum', 'momentum'], ['spread', 'spread'], ['volume matched', 'volume'], ['depth at best', 'depth']] as const).map(([label, k]) => (
                      <div key={k} style={{ marginBottom: 8, fontFamily: 'system-ui,sans-serif', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{label}<b style={{ fontFamily: MONO, color: C.mut, fontWeight: 400 }}>{ls ? ls[k] : '—'}</b></div>
                        <div style={{ height: 4, background: '#18213f', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: (ls ? ls[k] : 0) + '%', background: 'linear-gradient(90deg,#6f9bff,#9b8cff)' }} /></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', color: C.mut, fontSize: 10 }}><Gauge v={ls?.score ?? null} />70+ trades · below 70 is dropped</div>
                </div>
                <div style={{ border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'center', padding: 7, marginTop: 10 }}>scored {ls?.market ?? '—'} on 5 signals</div>
              </Panel>
            </div>

            <Panel title="Executor + risk · equity" note="net P&L, trade by trade">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 12 }}>
                <div style={{ gridColumn: 'span 2', minWidth: 0 }}><Equity points={stats.points} /></div>
                <div>
                  <div style={{ color: C.mut, fontSize: 10 }}>best trade</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '2px 0 6px' }}>{stats.best?.market ?? '—'}</div>
                  {stats.best && <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 11 }}>
                    <span style={{ color: C.mut }}>side</span><span style={{ textAlign: 'right' }}>{stats.best.side}</span>
                    <span style={{ color: C.mut }}>entry → exit</span><span style={{ textAlign: 'right' }}>{stats.best.entry} → {stats.best.exit}</span>
                    <span style={{ color: C.mut }}>stake</span><span style={{ textAlign: 'right' }}>{gbp(stats.best.stake)}</span>
                    <span style={{ color: C.mut }}>closed by</span><span style={{ textAlign: 'right' }}>{stats.best.reason}</span>
                  </div>}
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10, color: C.teal }}>{stats.best ? gbps(stats.best.net_pl) : ''}</div>
                </div>
              </div>
            </Panel>

            <div style={two}>
              <Panel title="Stats from the session" note={d?.mode === 'live' ? 'live prices · paper fills' : 'demo · simulated prices'}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '7px 10px', fontFamily: 'system-ui,sans-serif', fontSize: 12 }}>
                  {([['markets judged', String(c?.scanned ?? 0)], ['killed by filter', String(c?.killed ?? 0)], ['scored by analyst', String(c?.scored ?? 0)], ['trades closed', String(d?.trades.length ?? 0)],
                    ['strike rate', (stats.strike * 100).toFixed(1) + '%'], ['expectancy / trade', gbps(stats.exp)], ['max drawdown', gbp(stats.dd)], ['commission paid', gbp(stats.comm)],
                    ['worst trade', gbps(stats.worst)], ['best trade', stats.best ? gbps(stats.best.net_pl) : '£0.00']] as const).map(([k, v]) => (
                    <Fragment key={k}><span>{k}</span><span style={{ fontFamily: MONO, textAlign: 'right' }}>{v}</span></Fragment>
                  ))}
                </div>
                <div style={{ color: C.dim, fontFamily: 'system-ui,sans-serif', fontSize: 10, marginTop: 10 }}>Paper fills assume you get the price shown; real fills are usually worse, especially on a delayed key. A short run proves little. Most exchange traders lose money.</div>
              </Panel>
              <Panel title="$ tail -f session.log" note="newest at the bottom">
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {(d?.events ?? []).slice(-18).map(e => (
                        <tr key={e.id}>
                          <td style={{ color: C.dim, padding: '2px 6px 2px 0', whiteSpace: 'nowrap' }}>{hhmm(e.at)}</td>
                          <td style={{ color: TYPE_COL[e.type] ?? C.fg, fontWeight: 700, padding: '2px 6px 2px 0' }}>{e.type}</td>
                          <td style={{ padding: '2px 6px 2px 0', whiteSpace: 'nowrap' }}>{e.market}</td>
                          <td style={{ color: C.mut }}>{e.detail}</td>
                        </tr>
                      ))}
                      {!d?.events.length && <tr><td style={{ color: C.dim }}>Press Start: the log fills as the agents work.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <Panel title="Green-up calculator" note="lock the same profit on every outcome"><GreenUp /></Panel>
          </div>
        </div>
        </>}
      </div>
    </div>
  )
}
