'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_RULE, DIMS, randomBaseline, runBacktest, tradesCsv, type BtMarket, type BtSport, type Pick, type Result, type Rule } from '@/lib/betfair/backtest'

// Backtest tab of /betfair: test a trading rule on the recorded prices.
// "Back the favourite 20 minutes before the off, close at the off": price
// move in % and ticks, ticks won, hedge stake and P&L from a flat stake,
// broken down by race type, venue, runners, money matched and more, with a
// random-selection baseline on exactly the same markets.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', blu: '#6f9bff', vio: '#9b8cff' }
const SANS = 'system-ui,sans-serif', MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const TZ = 'Europe/London'
const gbp = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const sgn = (v: number, dp = 1) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(dp)
const pct = (v: number) => sgn(v * 100) + '%'
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)
const tone = (v: number) => v > 0.0001 ? C.teal : v < -0.0001 ? C.red : C.mut
const hold = (s: number) => s < 120 ? `${Math.round(s)}s` : s < 7200 ? `${Math.round(s / 60)} min` : s < 172_800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86_400).toFixed(1)} days`

type Exit = 'off' | 'before' | 'inplay' | 'bsp'
type Form = Rule & { from: string; to: string; entryMin: number; exitMin: number; marketType: string }

const SPORT_LABEL: Record<BtSport, string> = { racing: 'Horse racing', football: 'Football', tennis: 'Tennis', golf: 'Golf' }
const RECORDED_FROM_MIN: Record<BtSport, number> = { racing: 75, football: 180, tennis: 120, golf: 3 * 24 * 60 }
const FOOTBALL_MARKETS: [string, string][] = [['MATCH_ODDS', 'Match Odds'], ['OVER_UNDER_25', 'Over/Under 2.5'], ['BOTH_TEAMS_TO_SCORE', 'Both Teams to Score'],
  ['OVER_UNDER_15', 'Over/Under 1.5'], ['OVER_UNDER_35', 'Over/Under 3.5'], ['CORRECT_SCORE', 'Correct Score']]
const PICKS: [Pick, string][] = [['fav', 'Favourite'], ['fav2', '2nd favourite'], ['fav3', '3rd favourite'], ['outsider', 'Longest price'], ['random', 'Random selection'],
  ['all', 'Every selection'], ['name', 'Name contains…'], ['home', 'Home team'], ['away', 'Away team']]

const today = () => isoDay(Date.now())
const PRESETS: { label: string; form: Partial<Form> }[] = [
  { label: 'Racing: back the favourite 20 min out, close at the off', form: { sport: 'racing', side: 'back', pick: 'fav', entryMin: 20, exit: 'off' } },
  { label: 'Racing: lay the favourite 20 min out, close at the off', form: { sport: 'racing', side: 'lay', pick: 'fav', entryMin: 20, exit: 'off' } },
  { label: 'Racing: back a random runner 20 min out, close at the off', form: { sport: 'racing', side: 'back', pick: 'random', entryMin: 20, exit: 'off' } },
  { label: 'Racing: back the favourite 20 min out, close at Betfair SP', form: { sport: 'racing', side: 'back', pick: 'fav', entryMin: 20, exit: 'bsp' } },
  { label: 'Racing: back the 2nd favourite 60 min out, close 5 min before', form: { sport: 'racing', side: 'back', pick: 'fav2', entryMin: 60, exit: 'before', exitMin: 5 } },
  { label: 'Football: back the favourite 60 min before kick-off, close at kick-off', form: { sport: 'football', marketType: 'MATCH_ODDS', side: 'back', pick: 'fav', entryMin: 60, exit: 'off' } },
  { label: 'Football: back the draw 30 min before kick-off, close 15 min in', form: { sport: 'football', marketType: 'MATCH_ODDS', side: 'back', pick: 'name', name: 'Draw', entryMin: 30, exit: 'inplay', exitMin: 15 } },
  { label: 'Football: lay Over 2.5 at kick-off, close 20 min in', form: { sport: 'football', marketType: 'OVER_UNDER_25', side: 'lay', pick: 'name', name: 'Over', entryMin: 2, exit: 'inplay', exitMin: 20 } },
  { label: 'Tennis: back the favourite 60 min out, close at the start', form: { sport: 'tennis', side: 'back', pick: 'fav', entryMin: 60, exit: 'off' } },
  { label: 'Golf: back the favourite 2 days out, close at the start', form: { sport: 'golf', side: 'back', pick: 'fav', entryMin: 2 * 24 * 60, exit: 'off' } },
]

const DEFAULT_FORM: Form = { ...DEFAULT_RULE, from: isoDay(Date.now() - 6 * 86_400_000), to: today(), entryMin: 20, exitMin: 5, marketType: 'MATCH_ODDS' }

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#fff' }}>{title}</h3>
      {note && <p style={{ margin: '0 0 10px', color: C.mut, fontSize: 13 }}>{note}</p>}
      {children}
    </section>
  )
}
const Stat = ({ k, v, sub, colour }: { k: string; v: string; sub?: string; colour?: string }) => (
  <div style={{ background: C.panel2, border: '1px solid ' + C.line, borderRadius: 8, padding: '8px 12px', minWidth: 0 }}>
    <div style={{ color: C.mut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: MONO }}>{k}</div>
    <div style={{ fontFamily: MONO, fontSize: 18, color: colour ?? '#fff', marginTop: 2 }}>{v}</div>
    {sub && <div style={{ color: C.dim, fontSize: 11 }}>{sub}</div>}
  </div>
)
const Field = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.mut, gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>{label}{children}</label>
)
const input: React.CSSProperties = { background: C.panel2, color: C.fg, border: '1px solid ' + C.line, borderRadius: 6, padding: '6px 8px', font: 'inherit', fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' }

function verdict(n: number, t: number): { text: string; colour: string } {
  if (n < 30) return { text: `Only ${n} trades: far too few to judge. Keep collecting.`, colour: C.mut }
  if (t >= 2) return { text: 'Profitable so far and unlikely to be luck alone (t ≥ 2). Worth testing on fresh days before trusting it.', colour: C.teal }
  if (t <= -2) return { text: 'Losing, and unlikely to be bad luck (t ≤ −2). As it stands this loses money.', colour: C.red }
  return { text: 'Not distinguishable from zero yet (t between −2 and 2): the result could be luck either way.', colour: C.amb }
}

function Equity({ r }: { r: Result }) {
  const pts = r.equity
  if (pts.length < 2) return null
  const W = 760, H = 200, L = 52, R = 10, T = 10, B = 24
  const vals = pts.flatMap(p => [p.pnl, p.run]).concat(0)
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const x = (i: number) => L + i / (pts.length - 1) * (W - L - R)
  const y = (v: number) => T + (hi - v) / span * (H - T - B)
  const line = (f: (p: (typeof pts)[number]) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f(p)).toFixed(1)}`).join('')
  const step = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => span / s <= 6) ?? 2000
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Cumulative profit and loss over the trades">
        {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? C.mut : C.line} strokeDasharray={v === 0 ? '4 3' : undefined} />
          <text x={L - 6} y={y(v) + 4} fill={C.dim} fontSize="11" textAnchor="end" fontFamily={MONO}>{v < 0 ? '−' : ''}£{Math.abs(v)}</text></g>)}
        <text x={L} y={H - 6} fill={C.dim} fontSize="11" fontFamily={MONO}>{new Date(pts[0].at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ })}</text>
        <text x={W - R} y={H - 6} fill={C.dim} fontSize="11" textAnchor="end" fontFamily={MONO}>{new Date(pts[pts.length - 1].at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ })}</text>
        {r.stats.runN > 0 && <path d={line(p => p.run)} fill="none" stroke={C.blu} strokeWidth={1.5} strokeOpacity={0.7} />}
        <path d={line(p => p.pnl)} fill="none" stroke={C.teal} strokeWidth={2} />
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.mut, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: C.teal, marginRight: 6, verticalAlign: 'middle' }} />Hedged (closed out), after commission</span>
        {r.stats.runN > 0 && <span><span style={{ display: 'inline-block', width: 12, height: 3, background: C.blu, marginRight: 6, verticalAlign: 'middle' }} />Left to run to the result instead</span>}
      </div>
    </div>
  )
}

export default function BacktestTab() {
  const [f, setF] = useState<Form>(DEFAULT_FORM)
  const [markets, setMarkets] = useState<BtMarket[] | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dim, setDim] = useState('')
  const [showTrades, setShowTrades] = useState(100)
  const cache = useRef(new Map<string, BtMarket[]>())

  // remember the last test (this browser only)
  useEffect(() => { try { const s = localStorage.getItem('bf-backtest'); if (s) { const saved = JSON.parse(s); setF(v => ({ ...v, ...saved, to: saved.to && saved.to < today() ? saved.to : today() })) } } catch { /* private window */ } }, [])
  useEffect(() => { try { localStorage.setItem('bf-backtest', JSON.stringify(f)) } catch { /* private window */ } }, [f])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }))
  const num = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never)

  // What has to be fetched from the server (changing these needs new prices; the rest re-runs instantly)
  const exitMode: 'off' | 'before' | 'inplay' = f.exit === 'bsp' ? 'off' : f.exit
  const entrySec = Math.round(f.entryMin * 60)
  const tolSec = Math.round(Math.min(3 * 3600, Math.max(120, entrySec * 0.15)))
  const exitSec = Math.round(f.exitMin * 60)
  const types = f.sport === 'football' ? f.marketType : ''
  const fetchKey = [f.sport, f.from, f.to, entrySec, tolSec, exitMode, exitSec, types].join('|')

  const run = async () => {
    setErr(null)
    if (f.from > f.to) { setErr('The start date is after the end date.'); return }
    const days: string[] = []
    for (let t = new Date(f.from + 'T00:00:00Z').getTime(); isoDay(t) <= f.to && days.length < 120; t += 86_400_000) days.push(isoDay(t))
    const all: BtMarket[] = []
    try {
      let done = 0
      const queue = [...days]
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          const key = [f.sport, d, entrySec, tolSec, exitMode, exitSec, types].join('|')
          let ms = d < today() ? cache.current.get(key) : undefined        // today keeps changing, so it's always fetched
          if (!ms) {
            const qs = new URLSearchParams({ sport: f.sport, day: d, entry: String(entrySec), tol: String(tolSec), exit: exitMode, exitSec: String(exitSec), types })
            const res = await fetch('/api/betfair/backtest?' + qs, { cache: 'no-store' })
            const j = await res.json()
            if (!res.ok || j.error) throw new Error(j.error ?? 'HTTP ' + res.status)
            ms = j.markets as BtMarket[]
            cache.current.set(key, ms)
          }
          all.push(...ms)
          setBusy(`Loading prices: ${++done} of ${days.length} days`)
        }
      }
      setBusy(`Loading prices: 0 of ${days.length} days`)
      await Promise.all([worker(), worker(), worker()])
      setMarkets(all)
      setLoadedKey(fetchKey)
      setShowTrades(100)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(null) }
  }

  const rule: Rule = { ...f }
  const result = useMemo(() => markets ? runBacktest(markets, rule) : null, [markets, JSON.stringify(rule)]) // eslint-disable-line react-hooks/exhaustive-deps
  const baseline = useMemo(() => markets && result && f.pick !== 'random' && f.pick !== 'all' && result.stats.n >= 5 ? randomBaseline(markets, rule, 40) : null,
    [markets, result, JSON.stringify(rule)]) // eslint-disable-line react-hooks/exhaustive-deps
  const raceTypes = useMemo(() => Array.from(new Set((markets ?? []).map(m => m.race_type ?? 'unknown'))).sort(), [markets])
  const stale = markets && loadedKey !== fetchKey
  const bd = result?.breakdowns.find(b => b.dim === dim) ?? result?.breakdowns[0]

  const download = () => {
    if (!result) return
    const blob = new Blob([tradesCsv(result.trades, f.sport)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `backtest-${f.sport}-${f.from}-to-${f.to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const s = result?.stats
  const v = s ? verdict(s.n, s.t) : null
  const btn = (bg: string, fg = '#06101a'): React.CSSProperties => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 })
  const th: React.CSSProperties = { textAlign: 'right', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }
  const entryNote = f.entryMin > RECORDED_FROM_MIN[f.sport]
    ? `Prices are only recorded from ${RECORDED_FROM_MIN[f.sport] >= 1440 ? RECORDED_FROM_MIN[f.sport] / 1440 + ' days' : RECORDED_FROM_MIN[f.sport] + ' minutes'} before the start for ${SPORT_LABEL[f.sport].toLowerCase()}, so an earlier entry finds nothing.` : null

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      <Section title="Test a rule on the recorded prices" note="Pick when to get in, which selection, and when to close out. Changing the selection, side, prices, stake or filters re-runs instantly; changing the sport, dates or times loads prices again.">
        <div style={{ ...grid, marginBottom: 12 }}>
          <Field label="Start from an example" wide>
            <select style={input} value="" onChange={e => { const p = PRESETS[Number(e.target.value)]; if (p) setF(x => ({ ...x, ...DEFAULT_RULE, stake: x.stake, commission: x.commission, from: x.from, to: x.to, exitMin: 5, ...p.form })) }}>
              <option value="">Choose an example test…</option>
              {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Sport">
            <select style={input} value={f.sport} onChange={e => { const sp = e.target.value as BtSport; setF(x => ({ ...x, sport: sp, raceTypes: [], exit: sp !== 'racing' && x.exit === 'bsp' ? 'off' : sp === 'racing' && x.exit === 'inplay' ? 'off' : x.exit,
              pick: sp !== 'football' && (x.pick === 'home' || x.pick === 'away') ? 'fav' : x.pick })) }}>
              {(Object.keys(SPORT_LABEL) as BtSport[]).map(k => <option key={k} value={k}>{SPORT_LABEL[k]}</option>)}
            </select>
          </Field>
          {f.sport === 'football' && <Field label="Market"><select style={input} value={f.marketType} onChange={e => set('marketType', e.target.value)}>{FOOTBALL_MARKETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
          <Field label="From (start date)"><input style={input} type="date" value={f.from} onChange={e => set('from', e.target.value)} /></Field>
          <Field label="To"><input style={input} type="date" value={f.to} onChange={e => set('to', e.target.value)} /></Field>
        </div>
        <div style={{ ...grid, marginBottom: 12 }}>
          <Field label="Get in: minutes before the start"><input style={input} type="number" min={0} step={1} value={f.entryMin} onChange={num('entryMin')} /></Field>
          <Field label="Selection">
            <select style={input} value={f.pick} onChange={e => set('pick', e.target.value as Pick)}>
              {PICKS.filter(([k]) => f.sport === 'football' && f.marketType === 'MATCH_ODDS' || (k !== 'home' && k !== 'away')).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          {f.pick === 'name' && <Field label="Name contains"><input style={input} value={f.name} placeholder="e.g. Draw, Over" onChange={e => set('name', e.target.value)} /></Field>}
          <Field label="Back or lay"><select style={input} value={f.side} onChange={e => set('side', e.target.value as 'back' | 'lay')}><option value="back">Back</option><option value="lay">Lay</option></select></Field>
          <Field label="Close out">
            <select style={input} value={f.exit} onChange={e => set('exit', e.target.value as Exit)}>
              <option value="off">{f.sport === 'racing' ? 'At the off' : f.sport === 'football' ? 'At kick-off' : 'At the start'} (last price before in-play)</option>
              <option value="before">Minutes before the start…</option>
              {f.sport !== 'racing' && <option value="inplay">Minutes into play…</option>}
              {f.sport === 'racing' && <option value="bsp">At Betfair Starting Price</option>}
            </select>
          </Field>
          {(f.exit === 'before' || f.exit === 'inplay') && <Field label={f.exit === 'before' ? 'Minutes before the start' : 'Minutes after it goes in-play'}><input style={input} type="number" min={0} value={f.exitMin} onChange={num('exitMin')} /></Field>}
          <Field label="Prices traded at">
            <select style={input} value={f.basis} onChange={e => set('basis', e.target.value as Rule['basis'])}>
              <option value="cross">Realistic: take the best price on offer</option>
              <option value="back">Best back price both ways (no spread)</option>
              <option value="ltp">Last traded price both ways</option>
            </select>
          </Field>
          <Field label="Flat stake £"><input style={input} type="number" min={0.1} step={0.5} value={f.stake} onChange={num('stake')} /></Field>
          <Field label="Commission %"><input style={input} type="number" min={0} max={20} step={0.5} value={Math.round(f.commission * 1000) / 10} onChange={e => set('commission', Number(e.target.value) / 100)} /></Field>
        </div>
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', color: C.mut, fontSize: 13 }}>Filters (price, runners, money matched{f.sport === 'racing' ? ', race type' : ''}, name)</summary>
          <div style={{ ...grid, marginTop: 10 }}>
            <Field label="Price at entry from"><input style={input} type="number" min={1.01} step={0.1} value={f.oddsMin} onChange={num('oddsMin')} /></Field>
            <Field label="to"><input style={input} type="number" min={1.01} step={0.1} value={f.oddsMax} onChange={num('oddsMax')} /></Field>
            <Field label={f.sport === 'racing' ? 'Runners from' : 'Selections from'}><input style={input} type="number" min={0} value={f.runnersMin} onChange={num('runnersMin')} /></Field>
            <Field label="to"><input style={input} type="number" min={0} value={f.runnersMax} onChange={num('runnersMax')} /></Field>
            <Field label="Matched at entry at least £"><input style={input} type="number" min={0} step={1000} value={f.matchedMin} onChange={num('matchedMin')} /></Field>
            <Field label={f.sport === 'racing' ? 'Venue or race name contains' : 'Competition or event contains'}><input style={input} value={f.contains} onChange={e => set('contains', e.target.value)} /></Field>
            {f.sport === 'racing' && raceTypes.length > 0 && (
              <Field label="Race types (none ticked = all)" wide>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: C.fg }}>
                  {raceTypes.map(t => <label key={t} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13 }}>
                    <input type="checkbox" checked={f.raceTypes.includes(t)} onChange={e => set('raceTypes', e.target.checked ? [...f.raceTypes, t] : f.raceTypes.filter(x => x !== t))} />{t}</label>)}
                </div>
              </Field>
            )}
          </div>
        </details>
        {entryNote && <p style={{ color: C.amb, fontSize: 13, margin: '0 0 10px' }}>{entryNote}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btn(C.teal)} disabled={!!busy} onClick={run}>{markets && !stale ? '↻ Reload prices' : '▶ Run test'}</button>
          {result && result.trades.length > 0 && <button style={btn(C.panel2, C.fg)} disabled={!!busy} onClick={download}>⬇ Trades as CSV</button>}
          {busy && <span style={{ color: C.mut, fontSize: 13 }}>{busy}</span>}
          {stale && !busy && <span style={{ color: C.amb, fontSize: 13 }}>Sport, dates or times changed: press Run test to load the matching prices.</span>}
        </div>
        {err && <p style={{ color: C.red, fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
      </Section>

      {result && s && !stale && (
        <>
          <Section title="Results" note={<>
            {(markets?.length ?? 0).toLocaleString('en-GB')} markets loaded; {s.n.toLocaleString('en-GB')} trades.{' '}
            {Object.entries(result.skipped).length > 0 && <>Skipped: {Object.entries(result.skipped).map(([k, n]) => `${n} ${k}`).join(', ')}.</>}
          </>}>
            {s.n === 0 ? <p style={{ color: C.mut, margin: 0 }}>No trades. Try a wider date range, an entry time within the recorded window, or looser filters.</p> : (
              <>
                <div style={{ ...grid, marginBottom: 10 }}>
                  <Stat k="Profit / loss" v={gbp(s.pnl)} colour={tone(s.pnl)} sub={`${pct(s.roi)} of £${(s.n * f.stake).toFixed(0)} staked, after ${(f.commission * 100).toFixed(1)}% commission`} />
                  <Stat k="Per trade" v={gbp(s.avgPnl)} colour={tone(s.avgPnl)} sub={`t-score ${sgn(s.t, 2)}`} />
                  <Stat k="Net ticks won" v={sgn(s.netTicksWon, 0)} colour={tone(s.netTicksWon)} sub={`${sgn(s.avgTicksWon, 2)} a trade`} />
                  <Stat k="Winning trades" v={`${Math.round(s.wins / s.n * 100)}%`} sub={`${s.wins} won · ${s.scratches} level · ${s.losses} lost`} />
                  <Stat k="Price move" v={`${sgn(s.avgMovePct, 2)}%`} sub={`${sgn(s.avgMoveTicks, 2)} ticks on average (minus = shortened)`} />
                  <Stat k="Spread at entry" v={s.avgSpreadTicks === null ? '—' : `${s.avgSpreadTicks.toFixed(2)} ticks`} sub="gap between back and lay: the cost of getting in and out" />
                  <Stat k="Worst run" v={gbp(s.maxDrawdown)} colour={s.maxDrawdown < 0 ? C.red : C.mut} sub={`held ${hold(s.avgHoldSec)} on average`} />
                  {s.runN > 0 && <Stat k="If left to run" v={gbp(s.runPnl)} colour={tone(s.runPnl)} sub={`${s.runWins} of ${s.runN} won (${Math.round(s.runWins / s.runN * 100)}%), ${pct(s.runRoi)} return`} />}
                </div>
                {v && <p style={{ margin: '0 0 6px', color: v.colour, fontSize: 13 }}>{v.text}</p>}
                {baseline && (
                  <p style={{ margin: '0 0 12px', color: C.mut, fontSize: 13 }}>
                    <b style={{ color: C.fg }}>Random baseline:</b> picking a random selection in the same markets, with the same timing and prices, {baseline.runs} times over, made {gbp(baseline.meanPnl)} on average
                    (90% of runs between {gbp(baseline.p5)} and {gbp(baseline.p95)}), {sgn(baseline.meanTicks, 2)} ticks a trade{s.runN > 0 ? `, or ${gbp(baseline.meanRunPnl)} left to run` : ''}.{' '}
                    {s.pnl > baseline.p95 ? 'This rule did better than 95% of random runs.' : s.pnl < baseline.p5 ? 'This rule did worse than 95% of random runs.' : 'This rule is within the random range so far.'}
                  </p>
                )}
                <Equity r={result} />
              </>
            )}
          </Section>

          {s.n > 0 && bd && (
            <Section title="Breakdown" note="The same trades split up. Groups with fewer than 30 trades are greyed: too few to mean much on their own.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {result.breakdowns.map(b => (
                  <button key={b.dim} onClick={() => setDim(b.dim)} style={{ background: bd.dim === b.dim ? C.teal : 'none', color: bd.dim === b.dim ? '#06101a' : C.mut, border: '1px solid ' + (bd.dim === b.dim ? C.teal : C.line),
                    borderRadius: 999, padding: '3px 12px', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }}>{b.dim}</button>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
                  <thead><tr><th style={{ ...th, textAlign: 'left' }}>{bd.dim}</th><th style={th}>Trades</th><th style={th}>Won</th><th style={th}>Avg move</th><th style={th}>Avg ticks won</th><th style={th}>Net ticks</th><th style={th}>P&amp;L</th><th style={th}>Return</th><th style={th}>t</th>{s.runN > 0 && <th style={th}>Left to run</th>}</tr></thead>
                  <tbody>{bd.rows.map(r => (
                    <tr key={r.key} style={{ opacity: r.n < 30 ? 0.55 : 1 }}>
                      <td style={{ ...td, textAlign: 'left', fontFamily: SANS }}>{r.key}</td><td style={td}>{r.n}</td><td style={td}>{Math.round(r.wins / r.n * 100)}%</td>
                      <td style={td}>{sgn(r.avgMovePct, 1)}%</td><td style={{ ...td, color: tone(r.avgTicksWon) }}>{sgn(r.avgTicksWon, 2)}</td><td style={{ ...td, color: tone(r.netTicksWon) }}>{sgn(r.netTicksWon, 0)}</td>
                      <td style={{ ...td, color: tone(r.pnl) }}>{gbp(r.pnl)}</td><td style={td}>{pct(r.roi)}</td><td style={td}>{sgn(r.t, 1)}</td>
                      {s.runN > 0 && <td style={{ ...td, color: tone(r.runPnl) }}>{r.runN ? gbp(r.runPnl) : '—'}</td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Section>
          )}

          {s.n > 0 && (
            <Section title="Trades" note={`Price = best back price. Traded = the prices the test got in and out at. Ticks won counts in your favour; hedge stake is the ${f.side === 'back' ? 'lay' : 'back'} stake that closes the trade for an equal profit or loss.`}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>Market</th><th style={{ ...th, textAlign: 'left' }}>Selection</th><th style={th}>Price in → out</th><th style={th}>Move</th><th style={th}>Ticks</th>
                    <th style={th}>Traded in → out</th><th style={th}>Ticks won</th><th style={th}>Hedge stake</th><th style={th}>P&amp;L</th>{s.runN > 0 && <th style={th}>Left to run</th>}
                  </tr></thead>
                  <tbody>{result.trades.slice(-showTrades).reverse().map(t => (
                    <tr key={t.market_id + ':' + t.selectionId}>
                      <td style={{ ...td, textAlign: 'left', fontFamily: SANS }}>{new Date(t.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ })} {t.label}</td>
                      <td style={{ ...td, textAlign: 'left', fontFamily: SANS }}>{t.won ? '🏆 ' : ''}{t.selection} <span style={{ color: C.dim }}>#{t.rank}</span></td>
                      <td style={td}>{t.entryQuote} → {t.exitQuote}</td><td style={td}>{sgn(t.movePct, 1)}%</td><td style={td}>{sgn(t.moveTicks, 0)}</td>
                      <td style={td}>{t.entryFill} → {t.exitFill}</td><td style={{ ...td, color: tone(t.ticksWon) }}>{sgn(t.ticksWon, 0)}</td><td style={td}>£{t.hedgeStake.toFixed(2)}</td>
                      <td style={{ ...td, color: tone(t.pnl) }}>{gbp(t.pnl)}</td>{s.runN > 0 && <td style={{ ...td, color: t.runPnl === null ? C.dim : tone(t.runPnl) }}>{t.runPnl === null ? '—' : gbp(t.runPnl)}</td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {result.trades.length > showTrades && <button style={{ ...btn(C.panel2, C.fg), marginTop: 10 }} onClick={() => setShowTrades(n => n + 200)}>Show more ({result.trades.length - showTrades} older)</button>}
            </Section>
          )}

          <Section title="How to read this">
            <ul style={{ margin: 0, paddingLeft: 18, color: C.mut, fontSize: 13 }}>
              <li><b style={{ color: C.fg }}>Random betting isn&apos;t free.</b> Closing out at random costs the spread (you get in at one side of the book and out at the other) plus commission on winning trades. Left to run, it costs the overround (the prices add up to more than 100%) plus commission. The random baseline shows that cost on these exact markets, so a rule has to beat it, not zero.</li>
              <li><b style={{ color: C.fg }}>Delayed prices.</b> Your free Betfair key sees prices 1 to 180 seconds late, so &quot;at the off&quot; means the last recorded price before the off, and real fills could differ. For racing, the Betfair SP close is the cleanest benchmark.</li>
              <li><b style={{ color: C.fg }}>Entry time</b> is measured from the scheduled start; races often go off a minute or two late, which the off price reflects.</li>
              <li><b style={{ color: C.fg }}>Don&apos;t trust the best group.</b> Split enough ways and some group always looks great by chance. Decide on a rule, then check it on days that weren&apos;t used to find it.</li>
              <li><b style={{ color: C.fg }}>Paper only.</b> Nothing here places a bet.</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}
