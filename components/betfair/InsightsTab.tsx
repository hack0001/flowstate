'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BtSport } from '@/lib/betfair/backtest'
import { PriceSourceField, PriceSourceNote, type Source } from './PriceSource'
import { DEFAULT_FILTER, OFFSETS, PLAN, PRICE_BANDS, applyFilter, compensation, coverage, findSystems, label, moneyTimeline, momentum, moveVsResult, ruleName, volumeEffects, weightOfMoney,
  type Filter, type Found, type PathMarket } from '@/lib/betfair/insights'

// Insights tab of /betfair: one button that studies the recorded prices for
// clues: when money is matched, whether moves carry on, where the money goes
// when the favourite drifts, whether steamers and drifters win more or less
// than their price says, and a scan of simple systems checked on later days.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', blu: '#6f9bff', vio: '#9b8cff' }
const SANS = 'system-ui,sans-serif', MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)
const today = () => isoDay(Date.now())
const gbp = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + '£' + Math.abs(v).toFixed(2)
const sgn = (v: number, dp = 1) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(dp)
const pc = (v: number, dp = 0) => (v * 100).toFixed(dp) + '%'
const tone = (v: number) => v > 0.0001 ? C.teal : v < -0.0001 ? C.red : C.mut
const SPORT_LABEL: Record<BtSport, string> = { racing: 'Horse racing', football: 'Football (Match Odds)', tennis: 'Tennis', golf: 'Golf' }

export type BacktestPreset = Record<string, unknown>
const MAX_DAYS = 180

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#fff' }}>{title}</h3>
      {note && <p style={{ margin: '0 0 10px', color: C.mut, fontSize: 13 }}>{note}</p>}
      {children}
    </section>
  )
}
const Finding = ({ children }: { children: React.ReactNode }) => <p style={{ margin: '10px 0 0', padding: '8px 12px', background: C.panel2, borderLeft: '3px solid ' + C.vio, borderRadius: 6, fontSize: 13 }}>{children}</p>
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.mut, minWidth: 0 }}>{label}{children}</label>
const input: React.CSSProperties = { background: C.panel2, color: C.fg, border: '1px solid ' + C.line, borderRadius: 6, padding: '6px 8px', font: 'inherit', fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' }
const th: React.CSSProperties = { textAlign: 'right', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }
const tdl: React.CSSProperties = { ...td, textAlign: 'left', fontFamily: SANS }
const Table = ({ children }: { children: React.ReactNode }) => <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>{children}</table></div>
const small = (n: number) => n < 30 ? { opacity: 0.5 } : undefined

export default function InsightsTab({ onOpenBacktest }: { onOpenBacktest: (preset: BacktestPreset) => void }) {
  const [sport, setSport] = useState<BtSport>('racing')
  const [srcPick, setSrcPick] = useState<Source>('recorded')
  const source: Source = srcPick
  const [from, setFrom] = useState(() => isoDay(Date.now() - 13 * 86_400_000))
  const [to, setTo] = useState(today)
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER)
  const [stake, setStake] = useState(2)
  const [commission, setCommission] = useState(0.05)
  const [pair, setPair] = useState(0)
  const [all, setAll] = useState<PathMarket[] | null>(null)
  const [loaded, setLoaded] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const cache = useRef(new Map<string, PathMarket[]>())

  useEffect(() => { try { const s = localStorage.getItem('bf-insights'); if (s) { const v = JSON.parse(s); if (v.sport) setSport(v.sport); if (v.from) setFrom(v.from); if (v.filter) setFilter({ ...DEFAULT_FILTER, ...v.filter }); if (v.source) setSrcPick(v.source) } } catch { /* private window */ } }, [])
  useEffect(() => { try { localStorage.setItem('bf-insights', JSON.stringify({ sport, from, filter, source: srcPick })) } catch { /* private window */ } }, [sport, from, filter, srcPick])

  const key = [source, sport, from, to].join('|')
  const analyse = async () => {
    setErr(null)
    if (from > to) { setErr('The start date is after the end date.'); return }
    const days: string[] = []
    for (let t = new Date(from + 'T00:00:00Z').getTime(); isoDay(t) <= to; t += 86_400_000) days.push(isoDay(t))
    // Insights hold every market's price path in the browser, so cap the range (the latest days are kept)
    if (days.length > MAX_DAYS) { days.splice(0, days.length - MAX_DAYS); setErr(`That's more than ${MAX_DAYS} days, which is too much to analyse in the browser at once: using the last ${MAX_DAYS} (from ${days[0]}). Run earlier periods separately to compare.`) }
    const out: PathMarket[] = []
    try {
      let done = 0
      const warns: string[] = []
      const queue = [...days]
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          const k = source + '|' + sport + '|' + d
          let ms = d < today() ? cache.current.get(k) : undefined
          if (!ms) {
            const qs = new URLSearchParams({ sport, day: d, offsets: OFFSETS[sport].join(','), types: sport === 'football' ? 'MATCH_ODDS' : '', source })
            const res = await fetch('/api/betfair/insights?' + qs, { cache: 'no-store' })
            const j = await res.json()
            if (!res.ok || j.error) throw new Error(j.error ?? 'HTTP ' + res.status)
            ms = j.markets as PathMarket[]
            if (j.warnings?.length) warns.push(...j.warnings)        // a day with missing archive prices isn't kept, so it's retried next time
            else cache.current.set(k, ms)
          }
          out.push(...ms)
          setBusy(`Loading prices: ${++done} of ${days.length} days`)
        }
      }
      setBusy(`Loading prices: 0 of ${days.length} days`)
      await Promise.all([worker(), worker(), worker(), worker()])
      setWarn(Array.from(new Set(warns)))
      out.sort((a, b) => a.start_at.localeCompare(b.start_at))
      setAll(out); setLoaded(key); setPair(0)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  const ms = useMemo(() => all ? applyFilter(all, filter) : null, [all, filter])
  const plan = PLAN[sport]
  const a = useMemo(() => {
    if (!ms || loaded !== key) return null
    const [p1, p2] = plan.pairs[Math.min(pair, plan.pairs.length - 1)]
    return {
      cov: coverage(ms), money: moneyTimeline(ms, sport), mom: momentum(ms, p1, p2, { maxRank: 6, stake, commission }), p1, p2,
      comp: compensation(ms, plan.mid), wom: weightOfMoney(ms, plan.mid, 6), res: moveVsResult(ms, plan.early, stake, commission),
      vol: volumeEffects(ms, sport, stake, commission), sys: findSystems(ms, sport, stake, commission),
    }
  }, [ms, loaded, key, plan, pair, sport, stake, commission])
  const raceTypes = useMemo(() => Array.from(new Set((all ?? []).map(m => m.race_type ?? 'unknown'))).sort(), [all])

  const open = (f: Found) => onOpenBacktest({ sport, from, to, side: f.side, pick: f.pick, entryMin: f.entry / 60, exit: f.exit, basis: 'cross', stake, commission, name: '', seed: 1, marketType: 'MATCH_ODDS', ...f.rule })

  const copy = async () => {
    if (!a) return
    const L: string[] = []
    L.push(`FlowState Betfair insights: ${SPORT_LABEL[sport]}, ${from} to ${to}. ${a.cov.markets} markets on ${a.cov.days} days; ${a.cov.withResult} with results, ${a.cov.withBsp} with SP. Stake £${stake}, commission ${commission * 100}%.`)
    L.push(`\nMoney matched (share of the final amount): ${a.money.rows.map(r => `${r.label} ${pc(r.share)}`).join(', ')}. Median matched at the off £${Math.round(a.money.medianAtOff ?? 0)}.`)
    L.push(`\nMoves ${label(a.p1)}→${label(a.p2)} vs ${label(a.p2)}→off (top 6 by price; correlation ${a.mom.correlation.toFixed(2)}, ${a.mom.n} runners):`)
    for (const r of a.mom.rows) L.push(`  ${r.name}: n ${r.n}, avg early ${sgn(r.avgEarly)} ticks, avg late ${sgn(r.avgLate, 2)} ticks${r.carriedOn !== null ? `, carried on ${pc(r.carriedOn)}` : ''}${r.followPnl !== null ? `, follow-the-move P&L ${gbp(r.followPnl)} over ${r.followN} (t ${r.followT.toFixed(1)})` : ''}`)
    L.push(`\nChange in chance (percentage points), ${label(plan.mid)} → off, by rank at ${label(plan.mid)}: ${a.comp.ranks.join(' / ')}`)
    for (const r of a.comp.rows) L.push(`  ${r.name} (n ${r.n}): ${r.change.map(v => sgn(v, 2)).join(' / ')}; favourite changed in ${pc(r.favChanged)}`)
    L.push(`\nWeight of money at ${label(plan.mid)} → move to off:`)
    for (const r of a.wom) L.push(`  ${r.name}: n ${r.n}, avg ${sgn(r.avgLate, 2)} ticks, shortened ${pc(r.shortened)}, drifted ${pc(r.drifted)}`)
    L.push(`\nMove ${label(plan.early)} → off vs results (priced at ${a.res.priceBy}):`)
    for (const r of a.res.rows) L.push(`  ${r.name}: n ${r.n}, won ${r.wins} (${pc(r.winRate, 1)}), actual/expected ${r.ae.toFixed(2)}, back ${gbp(r.backPnl)} (t ${r.backT.toFixed(1)}), lay ${gbp(r.layPnl)} (t ${r.layT.toFixed(1)})`)
    L.push(`\nFavourite at the off by money matched at ${label(a.vol.mid)}:`)
    for (const r of a.vol.byMatched) L.push(`  ${r.name}: n ${r.n}, fav won ${pc(r.favWinRate)}, A/E ${r.ae.toFixed(2)}, back fav ${gbp(r.backFavPnl)}, avg fav move ${r.avgFavMove.toFixed(1)} ticks`)
    L.push(`By money matched in the last ${label(a.vol.lateWindow)}:`)
    for (const r of a.vol.byLateMoney) L.push(`  ${r.name}: n ${r.n}, fav won ${pc(r.favWinRate)}, A/E ${r.ae.toFixed(2)}, back fav ${gbp(r.backFavPnl)}`)
    L.push(`\nSystem scan: ${a.sys.tested} rules tested on ${a.sys.discoveryDays} days, checked on the last ${a.sys.checkDays}. ${a.sys.strong} had t ≥ 2 (about ${a.sys.expectedByChance} expected by chance). Top:`)
    for (const f of a.sys.top.slice(0, 15)) L.push(`  ${ruleName(f.pick, f.side)} ${label(f.entry)} out, close ${f.exit === 'bsp' ? 'at SP' : 'at the off'}, ${f.filter}: n ${f.n}, ${gbp(f.pnl)}, t ${f.t.toFixed(1)}; check n ${f.checkN}, ${gbp(f.checkPnl)}`)
    try { await navigator.clipboard.writeText(L.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { setErr('Could not copy to the clipboard in this browser.') }
  }

  const btn = (bg: string, fg = '#06101a'): React.CSSProperties => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '7px 14px', fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 })
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }
  const best = a?.res.rows.filter(r => r.n >= 30).sort((x, y) => Math.abs(y.ae - 1) - Math.abs(x.ae - 1))[0]

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      <Section title="Look for clues in the prices and the money" note="Studies every recorded market in the date range: how prices and matched money move in the run-up to the off, and whether any of it says something about results. Then scans hundreds of simple rules and checks the best ones on days it didn't use to find them.">
        <div style={{ ...grid, marginBottom: 12 }}>
          <Field label="Sport"><select style={input} value={sport} onChange={e => { setSport(e.target.value as BtSport); setFilter(DEFAULT_FILTER) }}>
            {(['racing', 'football', 'tennis'] as BtSport[]).map(s => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select></Field>
          <PriceSourceField sport={sport} value={source} onChange={setSrcPick} inputStyle={input} />
          <Field label="From"><input style={input} type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To"><input style={input} type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="Flat stake £"><input style={input} type="number" min={0.1} step={0.5} value={stake} onChange={e => setStake(Number(e.target.value) || 2)} /></Field>
          <Field label="Commission %"><input style={input} type="number" min={0} max={20} step={0.5} value={commission * 100} onChange={e => setCommission(Number(e.target.value) / 100)} /></Field>
        </div>
        <PriceSourceNote sport={sport} source={source} from={from} to={to} onUseAll={(a, b) => { setFrom(a); setTo(b) }} />
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', color: C.mut, fontSize: 13 }}>Only include some markets (applies instantly)</summary>
          <div style={{ ...grid, marginTop: 10 }}>
            <Field label={sport === 'racing' ? 'Runners from' : 'Selections from'}><input style={input} type="number" min={0} value={filter.runnersMin} onChange={e => setFilter({ ...filter, runnersMin: Number(e.target.value) })} /></Field>
            <Field label="to"><input style={input} type="number" min={0} value={filter.runnersMax} onChange={e => setFilter({ ...filter, runnersMax: Number(e.target.value) })} /></Field>
            <Field label="Matched at the off at least £"><input style={input} type="number" min={0} step={1000} value={filter.matchedMin} onChange={e => setFilter({ ...filter, matchedMin: Number(e.target.value) })} /></Field>
            <Field label={sport === 'racing' ? 'Venue or race name contains' : 'Competition or event contains'}><input style={input} value={filter.contains} onChange={e => setFilter({ ...filter, contains: e.target.value })} /></Field>
            {sport === 'racing' && raceTypes.length > 0 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13 }}>
                <span style={{ color: C.mut, fontSize: 12, width: '100%' }}>Race types (none ticked = all)</span>
                {raceTypes.map(t => <label key={t} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={filter.raceTypes.includes(t)}
                  onChange={e => setFilter({ ...filter, raceTypes: e.target.checked ? [...filter.raceTypes, t] : filter.raceTypes.filter(x => x !== t) })} />{t}</label>)}
              </div>
            )}
          </div>
        </details>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btn(C.vio)} disabled={!!busy} onClick={analyse}>✦ Analyse</button>
          {a && <button style={btn(C.panel2, C.fg)} disabled={!!busy} onClick={copy}>{copied ? '✓ Copied' : '⧉ Copy summary (to paste to Claude)'}</button>}
          {busy && <span style={{ color: C.mut, fontSize: 13 }}>{busy}</span>}
          {all && loaded !== key && !busy && <span style={{ color: C.amb, fontSize: 13 }}>Sport or dates changed: press Analyse.</span>}
        </div>
        {err && <p style={{ color: C.red, fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
        {warn.length > 0 && <p style={{ color: C.amb, fontSize: 13, margin: '10px 0 0' }}>Some days were left out: {warn.length > 1 ? `${warn.length} archived days couldn't be read. ` : ''}{warn[0]}</p>}
      </Section>

      {a && (
        <>
          <Section title="What's in this sample" note={<>{a.cov.markets.toLocaleString('en-GB')} markets on {a.cov.days} days: {a.cov.withOff} with a price at the off, {a.cov.withResult} with results, {a.cov.withBsp} with Betfair SP. Rows with fewer than 30 cases are greyed out: too few to read anything into.</>}>
            {a.cov.days < 14 && <p style={{ margin: 0, color: C.amb, fontSize: 13 }}>Only {a.cov.days} day{a.cov.days === 1 ? '' : 's'} of data. Patterns here are a first look, not evidence: a few weeks (several thousand runners) are needed before anything is worth betting on.</p>}
          </Section>

          <Section title="1. When the money is matched" note="Average share of the final matched amount already matched at each point. Your free key gives the market total, not per-selection volumes.">
            <div style={{ display: 'grid', gap: 4 }}>
              {a.money.rows.filter(r => r.n).map(r => (
                <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.mut, fontFamily: MONO }}>{r.label}</span>
                  <div style={{ background: C.panel2, borderRadius: 4, height: 12 }}><div style={{ width: pc(r.share), background: C.blu, height: 12, borderRadius: 4 }} /></div>
                  <span style={{ fontFamily: MONO, textAlign: 'right' }}>{pc(r.share)}</span>
                </div>
              ))}
            </div>
            {(() => { const r = a.money.rows.find(x => x.key === String(plan.lateWindow)); return r?.n ? <Finding>Typically {pc(1 - r.share)} of the money is matched in the last {label(plan.lateWindow)}{a.money.medianAtOff ? `; the median market has £${Math.round(a.money.medianAtOff).toLocaleString('en-GB')} matched at the off` : ''}. Prices earlier on rest on much less money, which is why they move more.</Finding> : null })()}
          </Section>

          <Section title="2. Do price moves carry on?" note={<>Selections in the top six by price. The early move ({label(a.p1)} → {label(a.p2)} before) against what happened next ({label(a.p2)} → the off). &ldquo;Follow&rdquo; backs a shortener (or lays a drifter) at {label(a.p2)} and closes at the off at realistic prices.</>}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {plan.pairs.map(([x, y], i) => <button key={i} onClick={() => setPair(i)} style={{ background: pair === i ? C.teal : 'none', color: pair === i ? '#06101a' : C.mut, border: '1px solid ' + (pair === i ? C.teal : C.line), borderRadius: 999, padding: '3px 12px', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }}>{label(x)} → {label(y)} → off</button>)}
            </div>
            <Table>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Early move</th><th style={th}>Cases</th><th style={th}>Avg early</th><th style={th}>Avg next move</th><th style={th}>Carried on</th><th style={th}>Follow P&amp;L</th><th style={th}>t</th></tr></thead>
              <tbody>{a.mom.rows.map(r => (
                <tr key={r.name} style={small(r.n)}><td style={tdl}>{r.name}</td><td style={td}>{r.n}</td><td style={td}>{sgn(r.avgEarly)}</td><td style={td}>{sgn(r.avgLate, 2)}</td>
                  <td style={td}>{r.carriedOn === null ? '—' : pc(r.carriedOn)}</td><td style={{ ...td, color: r.followPnl === null ? C.dim : tone(r.followPnl) }}>{r.followPnl === null ? '—' : gbp(r.followPnl)}</td><td style={td}>{r.followPnl === null ? '—' : sgn(r.followT)}</td></tr>
              ))}</tbody>
            </Table>
            <Finding>Correlation between the early and the later move: <b>{a.mom.correlation.toFixed(2)}</b> over {a.mom.n.toLocaleString('en-GB')} cases. {Math.abs(a.mom.correlation) < 0.05 ? 'That is close to zero: so far, earlier moves say little about later ones.' : a.mom.correlation > 0 ? 'Positive: moves have tended to carry on (momentum). Check whether following them beats the spread in the P&L column.' : 'Negative: moves have tended to partly reverse. Check whether fading them pays after the spread.'}</Finding>
          </Section>

          <Section title="3. When the favourite drifts, who shortens?" note={<>Markets grouped by what the {label(plan.mid)} favourite did by the off. Figures are the average change in each selection&apos;s chance (from its price, with the overround taken out), in percentage points, by its rank at {label(plan.mid)}. The row adds up to roughly zero: the market is a fixed 100%.</>}>
            <Table>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Group</th><th style={th}>Markets</th>{a.comp.ranks.map(r => <th key={r} style={th}>{r}</th>)}<th style={th}>New fav at off</th></tr></thead>
              <tbody>{a.comp.rows.map(r => (
                <tr key={r.name} style={small(r.n)}><td style={tdl}>{r.name}</td><td style={td}>{r.n}</td>{r.change.map((v, i) => <td key={i} style={{ ...td, color: tone(v) }}>{sgn(v, 2)}</td>)}<td style={td}>{pc(r.favChanged)}</td></tr>
              ))}</tbody>
            </Table>
            {(() => { const d = a.comp.rows[0]; if (d.n < 10) return null; const gain = d.change.slice(1).map((v, i) => [v, a.comp.ranks[i + 1]] as const).sort((x, y) => y[0] - x[0])[0]; return <Finding>When the favourite drifted ({d.n} markets), the biggest gainer on average was the <b>{gain[1]}</b> ({sgn(gain[0], 2)} points), and the favourite lost its place by the off {pc(d.favChanged)} of the time. This shows where money moves, not yet whether that is predictable early enough to trade: test it in Backtest (e.g. back the 2nd favourite) with a filter.</Finding> })()}
          </Section>

          <Section title="4. Money waiting at the best prices" note={<>For the top six at {label(plan.mid)}: of the money sitting at the best back and lay prices, the share waiting to be backed into (offered by layers). Then the average move to the off. Only the best price level is recorded, and money can be pulled at any moment, so this is a weak signal at best.</>}>
            <Table>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Money waiting</th><th style={th}>Cases</th><th style={th}>Avg move to off (ticks)</th><th style={th}>Shortened</th><th style={th}>Drifted</th></tr></thead>
              <tbody>{a.wom.map(r => <tr key={r.name} style={small(r.n)}><td style={tdl}>{r.name}</td><td style={td}>{r.n}</td><td style={td}>{sgn(r.avgLate, 2)}</td><td style={td}>{pc(r.shortened)}</td><td style={td}>{pc(r.drifted)}</td></tr>)}</tbody>
            </Table>
          </Section>

          <Section title="5. Steamers, drifters and results" note={<>Every selection, grouped by how much its chance changed from {label(plan.early)} before to the off. &ldquo;Expected&rdquo; is how many should have won going by the off price; A/E above 1 means they won more often than their price said. P&amp;L is £{stake} level stakes at {a.res.priceBy}, after commission.</>}>
            <Table>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Move</th><th style={th}>Selections</th><th style={th}>Won</th><th style={th}>Win rate</th><th style={th}>Expected</th><th style={th}>A/E</th><th style={th}>Back all</th><th style={th}>t</th><th style={th}>Lay all</th><th style={th}>t</th></tr></thead>
              <tbody>{a.res.rows.map(r => (
                <tr key={r.name} style={small(r.n)}><td style={tdl}>{r.name}</td><td style={td}>{r.n}</td><td style={td}>{r.wins}</td><td style={td}>{pc(r.winRate, 1)}</td><td style={td}>{r.expected.toFixed(1)}</td>
                  <td style={{ ...td, color: r.ae > 1.05 ? C.teal : r.ae < 0.95 ? C.red : C.fg }}>{r.ae.toFixed(2)}</td>
                  <td style={{ ...td, color: tone(r.backPnl) }}>{gbp(r.backPnl)}</td><td style={td}>{sgn(r.backT)}</td><td style={{ ...td, color: tone(r.layPnl) }}>{gbp(r.layPnl)}</td><td style={td}>{sgn(r.layT)}</td></tr>
              ))}</tbody>
            </Table>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', color: C.mut, fontSize: 13 }}>Split by price at the off (back-all P&amp;L and A/E)</summary>
              <Table>
                <thead><tr><th style={{ ...th, textAlign: 'left' }}>Move</th>{PRICE_BANDS.map(([n]) => <th key={n} style={th}>{n}</th>)}</tr></thead>
                <tbody>{a.res.grid.map(r => (
                  <tr key={r.name}><td style={tdl}>{r.name}</td>{r.cells.map((c, i) => <td key={i} style={{ ...td, ...(c.n < 30 ? { opacity: 0.5 } : {}) }}><span style={{ color: tone(c.backPnl) }}>{c.n ? gbp(c.backPnl) : '—'}</span><br /><span style={{ color: C.dim }}>{c.n ? `n ${c.n} · A/E ${c.ae.toFixed(2)}` : ''}</span></td>)}</tr>
                ))}</tbody>
              </Table>
            </details>
            {best && <Finding>Biggest gap between results and prices so far: <b>{best.name.toLowerCase()}</b> won {best.wins} times against {best.expected.toFixed(1)} expected (A/E {best.ae.toFixed(2)}, {best.n} selections). {Math.abs(best.backT) < 2 && Math.abs(best.layT) < 2 ? 'Neither backing nor laying them is clear of luck yet (|t| under 2).' : best.backT >= 2 ? 'Backing them at SP has been profitable beyond likely luck: worth watching on new days.' : best.layT >= 2 ? 'Laying them at SP has been profitable beyond likely luck: worth watching on new days.' : 'Losing beyond likely luck.'}</Finding>}
          </Section>

          <Section title="6. Busy markets and late money" note={<>Races grouped into thirds by money matched at {label(a.vol.mid)} before, and by the share of money matched in the last {label(a.vol.lateWindow)}. How the favourite at the off did: win rate against its price (A/E), backing it at SP, and how far its price moved from {label(a.vol.mid)}.</>}>
            {[['By money matched', a.vol.byMatched], ['By late money', a.vol.byLateMoney]].map(([title, rows]) => (rows as typeof a.vol.byMatched).length > 0 && (
              <div key={title as string} style={{ marginBottom: 10 }}>
                <Table>
                  <thead><tr><th style={{ ...th, textAlign: 'left' }}>{title as string}</th><th style={th}>Races</th><th style={th}>Fav won</th><th style={th}>A/E</th><th style={th}>Back fav at SP</th><th style={th}>t</th><th style={th}>Avg fav move</th></tr></thead>
                  <tbody>{(rows as typeof a.vol.byMatched).map(r => <tr key={r.name} style={small(r.n)}><td style={tdl}>{r.name}</td><td style={td}>{r.n}</td><td style={td}>{pc(r.favWinRate)}</td><td style={td}>{r.ae.toFixed(2)}</td><td style={{ ...td, color: tone(r.backFavPnl) }}>{gbp(r.backFavPnl)}</td><td style={td}>{sgn(r.backFavT)}</td><td style={td}>{r.avgFavMove.toFixed(1)} ticks</td></tr>)}</tbody>
                </Table>
              </div>
            ))}
            <Finding>Busier markets are usually priced more accurately (A/E nearer 1, smaller moves), so any edge is likelier in quieter races, where it&apos;s also harder to get a decent stake matched.</Finding>
          </Section>

          <Section title="7. System finder" note={<>Tested {a.sys.tested.toLocaleString('en-GB')} simple rules (when to get in, which selection, back or lay, close at the off{sport === 'racing' ? ' or at SP' : ''}, with one filter) on the first {a.sys.discoveryDays} day{a.sys.discoveryDays === 1 ? '' : 's'}, then checked each on the last {a.sys.checkDays} (from {a.sys.cut}), which weren&apos;t used to find them. Ranked by t-score; at least 30 trades.</>}>
            <Finding>
              {a.sys.strong} rule{a.sys.strong === 1 ? '' : 's'} reached t ≥ 2, where about {a.sys.expectedByChance} would by pure chance from this many tries. {a.sys.strong <= a.sys.expectedByChance * 1.5 ? 'That is roughly what luck alone produces, so treat the list as ideas to watch, not systems.' : 'More than luck alone would explain, which is encouraging: the ones that also held up on the check days are the ones to keep testing.'}
            </Finding>
            {a.sys.top.length === 0 ? <p style={{ color: C.mut, fontSize: 13, margin: '10px 0 0' }}>No profitable rule with 30+ trades yet. More days will help.</p> : (
              <div style={{ marginTop: 10 }}>
                <Table>
                  <thead><tr><th style={{ ...th, textAlign: 'left' }}>Rule</th><th style={{ ...th, textAlign: 'left' }}>Filter</th><th style={th}>Trades</th><th style={th}>P&amp;L</th><th style={th}>Return</th><th style={th}>t</th><th style={th}>Check days</th><th style={th}></th></tr></thead>
                  <tbody>{a.sys.top.map((f, i) => (
                    <tr key={i}>
                      <td style={tdl}>{ruleName(f.pick, f.side)} {label(f.entry)} out, close {f.exit === 'bsp' ? 'at SP' : 'at the off'}</td><td style={tdl}>{f.filter}</td>
                      <td style={td}>{f.n}</td><td style={{ ...td, color: tone(f.pnl) }}>{gbp(f.pnl)}</td><td style={td}>{sgn(f.roi * 100)}%</td><td style={td}>{f.t.toFixed(1)}</td>
                      <td style={{ ...td, color: f.heldUp === null ? C.dim : f.heldUp ? C.teal : C.red }}>{f.checkN ? `${gbp(f.checkPnl)} (${f.checkN})` : '—'}{f.heldUp === true ? ' ✓' : f.heldUp === false ? ' ✗' : ''}</td>
                      <td style={td}><button onClick={() => open(f)} style={{ background: 'none', border: '1px solid ' + C.line, color: C.blu, borderRadius: 6, padding: '1px 8px', cursor: 'pointer', font: 'inherit', fontSize: 11 }}>Open in Backtest</button></td>
                    </tr>
                  ))}</tbody>
                </Table>
              </div>
            )}
          </Section>

          <Section title="Reading this honestly">
            <ul style={{ margin: 0, paddingLeft: 18, color: C.mut, fontSize: 13 }}>
              <li><b style={{ color: C.fg }}>Look at hundreds of things and some will look good by chance.</b> That&apos;s why the finder says how many it tried and checks the best on later days. Only rules that keep working on new data deserve a real stake.</li>
              <li><b style={{ color: C.fg }}>Costs decide most systems.</b> Getting in and out costs at least the spread, plus commission on winners. A real pattern smaller than that can&apos;t be traded.</li>
              <li><b style={{ color: C.fg }}>Delayed prices.</b> The free key&apos;s prices are 1 to 180 seconds late, so very short-term patterns (the last couple of minutes) can&apos;t be traded on it even if they&apos;re real.</li>
              <li><b style={{ color: C.fg }}>Volume.</b> Only the market&apos;s total matched and the money at the best prices are recorded. Per-selection traded volume needs Betfair&apos;s live key.</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}
