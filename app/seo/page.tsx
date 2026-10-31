'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw, TrendingUp, AlertTriangle, Search, EyeOff, Eye, FileText, Globe } from 'lucide-react'
import {
  getGscSites, getGscDaily, getQueryMovers, getPageMovers, setSiteTracked,
  summarise, alertFor, pctChange, siteLabel, pagePath, addDays,
  type GscSite, type GscDay, type GscMover, type SiteSummary,
} from '@/lib/gscData'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#3ecf7e', amber:'#ffb800', purple:'#8b5cf6', teal:'#2fb8ac',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const WINDOWS = [7, 28, 90] as const
type Mode = 'top' | 'gaining' | 'losing' | 'rankUp' | 'rankDown'
const MODES: { id: Mode; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'gaining', label: 'Gaining clicks' },
  { id: 'losing', label: 'Losing clicks' },
  { id: 'rankUp', label: 'Rank improved' },
  { id: 'rankDown', label: 'Rank dropped' },
]

const nf = (n: number) => Math.round(n).toLocaleString('en-GB')

function Delta({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null || !isFinite(pct)) return <span style={{ color: C.muted, fontSize: '0.7rem' }}>–</span>
  const good = invert ? pct < 0 : pct > 0
  const flat = Math.abs(pct) < 0.5
  const color = flat ? C.sec : good ? C.green : C.red
  return <span style={{ color, fontSize: '0.7rem', fontWeight: 700 }}>{pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct).toFixed(1)}%</span>
}

function Sparkline({ values, color, height = 36, width = 120 }: { values: number[]; color: string; height?: number; width?: number }) {
  if (values.length < 2) return <div style={{ height }} />
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => (i * step).toFixed(1) + ',' + (height - 2 - (v / max) * (height - 4)).toFixed(1)).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Two series on independent scales: clicks (solid, cyan) over impressions (faint, purple).
function TrendChart({ series }: { series: GscDay[] }) {
  const W = 760, H = 180, PAD = 28
  if (series.length < 2) return <p style={{ color: C.muted, fontSize: '0.8rem' }}>Not enough data yet.</p>
  const line = (vals: number[]) => {
    const max = Math.max(...vals, 1)
    const step = (W - PAD * 2) / (vals.length - 1)
    return vals.map((v, i) => (PAD + i * step).toFixed(1) + ',' + (H - PAD - (v / max) * (H - PAD * 2)).toFixed(1)).join(' ')
  }
  const clicks = series.map(d => d.clicks)
  const impr = series.map(d => d.impressions)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Clicks and impressions over time" style={{ display: 'block' }}>
      {[0, 0.5, 1].map(t => <line key={t} x1={PAD} x2={W - PAD} y1={H - PAD - t * (H - PAD * 2)} y2={H - PAD - t * (H - PAD * 2)} stroke={C.border} strokeWidth={1} />)}
      <polyline points={line(impr)} fill="none" stroke={C.purple} strokeWidth={1.5} opacity={0.55} />
      <polyline points={line(clicks)} fill="none" stroke={C.cyan} strokeWidth={2.2} strokeLinejoin="round" />
      <text x={PAD} y={H - 8} fill={C.muted} fontSize={11}>{series[0].date}</text>
      <text x={W - PAD} y={H - 8} fill={C.muted} fontSize={11} textAnchor="end">{series[series.length - 1].date}</text>
      <text x={PAD} y={14} fill={C.cyan} fontSize={11}>● clicks (peak {nf(Math.max(...clicks))})</text>
      <text x={PAD + 170} y={14} fill={C.purple} fontSize={11}>● impressions (peak {nf(Math.max(...impr))})</text>
    </svg>
  )
}

export default function SeoDashboardPage() {
  const router = useRouter()
  const [sites, setSites] = useState<GscSite[]>([])
  const [daily, setDaily] = useState<GscDay[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<number>(28)

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const [selected, setSelected] = useState<string | null>(null)
  const [dim, setDim] = useState<'query' | 'page'>('query')
  const [mode, setMode] = useState<Mode>('top')
  const [movers, setMovers] = useState<GscMover[]>([])
  const [moversLoading, setMoversLoading] = useState(false)
  const [moversErr, setMoversErr] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const load = useCallback(async () => {
    const { sites: s, error } = await getGscSites()
    if (error) { setErr(error); setLoading(false); return }
    setSites(s)
    const tracked = s.filter(x => x.tracked).map(x => x.site_url)
    // 2 x the largest window + a few spare days of history.
    const since = addDays(new Date().toISOString().slice(0, 10), -(2 * 90 + 5))
    const { rows, error: dErr } = await getGscDaily(tracked, since)
    if (dErr) setErr(dErr)
    else { setErr(null); setDaily(rows) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const byIdSite = useMemo(() => {
    const m = new Map<string, GscDay[]>()
    for (const r of daily) {
      if (!m.has(r.site_url)) m.set(r.site_url, [])
      m.get(r.site_url)!.push(r)
    }
    return m
  }, [daily])

  const trackedSites = sites.filter(s => s.tracked)
  const hiddenSites = sites.filter(s => !s.tracked)

  const summaries = useMemo(() => {
    const m = new Map<string, SiteSummary>()
    for (const s of trackedSites) m.set(s.site_url, summarise(byIdSite.get(s.site_url) ?? [], windowDays))
    return m
  }, [trackedSites, byIdSite, windowDays])

  const alerts = useMemo(() => {
    return trackedSites
      .map(s => ({ site: s, alert: alertFor(byIdSite.get(s.site_url) ?? []) }))
      .filter((a): a is { site: GscSite; alert: NonNullable<ReturnType<typeof alertFor>> } => a.alert !== null)
  }, [trackedSites, byIdSite])

  // Query/page detail for whichever site is open.
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setMoversLoading(true); setMoversErr(null)
    const days = Math.min(windowDays, 28)
    ;(dim === 'query' ? getQueryMovers : getPageMovers)(selected, days).then(({ rows, error }) => {
      if (cancelled) return
      setMovers(rows); setMoversErr(error); setMoversLoading(false)
    })
    return () => { cancelled = true }
  }, [selected, dim, windowDays])

  const shownMovers = useMemo(() => {
    const delta = (m: GscMover) => m.clicks_now - m.clicks_prev
    const posChange = (m: GscMover) => (m.position_prev ?? 0) - (m.position_now ?? 0) // + = moved up
    const rankable = movers.filter(m => m.position_now !== null && m.position_prev !== null && m.impressions_now >= 10 && m.impressions_prev >= 10)
    let list: GscMover[]
    if (mode === 'top') list = [...movers].sort((a, b) => b.clicks_now - a.clicks_now || b.impressions_now - a.impressions_now)
    else if (mode === 'gaining') list = movers.filter(m => delta(m) > 0).sort((a, b) => delta(b) - delta(a))
    else if (mode === 'losing') list = movers.filter(m => delta(m) < 0).sort((a, b) => delta(a) - delta(b))
    else if (mode === 'rankUp') list = rankable.filter(m => posChange(m) > 0).sort((a, b) => posChange(b) - posChange(a))
    else list = rankable.filter(m => posChange(m) < 0).sort((a, b) => posChange(a) - posChange(b))
    return list.slice(0, 50)
  }, [movers, mode])

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/gsc/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) throw new Error(data?.error ?? 'Request failed (' + res.status + ')')
    return data
  }

  async function findSites() {
    setSyncing(true); setSyncMsg('Looking for Search Console properties…')
    try {
      const d = await post({ action: 'discover' })
      setSyncMsg('Found ' + d.found + ' properties.')
      await load()
    } catch (e) {
      setSyncMsg('Failed: ' + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  async function syncAll() {
    setSyncing(true); setSyncMsg('Looking for Search Console properties…')
    const failures: string[] = []
    try {
      await post({ action: 'discover' })
      const { sites: fresh } = await getGscSites()
      const todo = fresh.filter(s => s.tracked)
      for (let i = 0; i < todo.length; i++) {
        setSyncMsg('Syncing ' + (i + 1) + ' of ' + todo.length + ': ' + siteLabel(todo[i].site_url) + '…')
        try { await post({ action: 'site', siteUrl: todo[i].site_url }) }
        catch (e) { failures.push(siteLabel(todo[i].site_url) + ' — ' + (e instanceof Error ? e.message : String(e))) }
      }
      setSyncMsg(failures.length === 0 ? 'Synced ' + todo.length + ' sites.' : 'Synced with ' + failures.length + ' failure(s):\n' + failures.join('\n'))
    } catch (e) {
      setSyncMsg('Failed: ' + (e instanceof Error ? e.message : String(e)))
    }
    await load()
    setSyncing(false)
  }

  async function toggleTracked(siteUrl: string, tracked: boolean) {
    const e = await setSiteTracked(siteUrl, tracked)
    if (e) setErr(e)
    else await load()
    if (!tracked && selected === siteUrl) setSelected(null)
  }

  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.625rem', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }
  const sel = selected ? sites.find(s => s.site_url === selected) ?? null : null
  const selSummary = selected ? summaries.get(selected) : undefined

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ padding: '1.75rem 2rem 1.25rem', borderBottom: '1px solid ' + C.border, background: 'linear-gradient(160deg,rgba(47,184,172,0.10) 0%,transparent 100%)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontFamily: 'inherit', marginBottom: '0.6rem' }}>
            <ChevronLeft size={14} /> Home
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 900, margin: '0 0 0.2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={22} color={C.teal} /> SEO Dashboard
              </h1>
              <p style={{ fontSize: '0.82rem', color: C.sec, margin: 0 }}>Rankings and traffic across every Search Console property you manage. Data runs about 2 days behind.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={findSites} disabled={syncing} style={{ ...btn, background: 'transparent', border: '1px solid ' + C.border, color: C.sec, opacity: syncing ? 0.6 : 1 }}>
                <Globe size={14} /> Find sites
              </button>
              <button onClick={syncAll} disabled={syncing} style={{ ...btn, background: 'rgba(47,184,172,0.12)', border: '1px solid rgba(47,184,172,0.4)', color: C.teal, opacity: syncing ? 0.6 : 1 }}>
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 2rem 3rem' }}>
        {syncMsg && <p style={{ fontSize: '0.78rem', color: syncMsg.startsWith('Failed') || syncMsg.includes('failure') ? C.amber : C.sec, margin: '0 0 1rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{syncMsg}</p>}
        {err && <p style={{ display: 'flex', gap: '0.4rem', fontSize: '0.8rem', color: C.red, margin: '0 0 1rem', lineHeight: 1.5 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> {err}</p>}

        {loading ? (
          <p style={{ color: C.muted, fontSize: '0.85rem' }}>Loading…</p>
        ) : sites.length === 0 && !err ? (
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem' }}>No sites yet</p>
            <p style={{ fontSize: '0.8rem', color: C.sec, margin: 0, lineHeight: 1.6 }}>
              Hit <strong>Find sites</strong> to pull in every Search Console property your Google account can see, then <strong>Sync now</strong> to fetch the data. If that fails with a scope or API error, the one-time Google setup in the header of <code>lib/searchConsole.ts</code> hasn't been done yet.
            </p>
          </div>
        ) : (
          <>
            {/* Window picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.sec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compare last</span>
              {WINDOWS.map(w => (
                <button key={w} onClick={() => setWindowDays(w)} style={{ padding: '0.3rem 0.75rem', borderRadius: '9999px', border: '1px solid ' + (windowDays === w ? C.teal : C.border), background: windowDays === w ? 'rgba(47,184,172,0.12)' : 'transparent', color: windowDays === w ? C.teal : C.sec, fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                  {w} days
                </button>
              ))}
              <span style={{ fontSize: '0.72rem', color: C.muted }}>vs the {windowDays} days before</span>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ background: 'rgba(255,68,102,0.07)', border: '1px solid rgba(255,68,102,0.3)', borderRadius: '1rem', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 800, color: C.red, margin: '0 0 0.5rem' }}><AlertTriangle size={14} /> {alerts.length} site{alerts.length === 1 ? '' : 's'} need a look (last 7 days vs the 7 before)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {alerts.map(({ site, alert }) => (
                    <button key={site.site_url} onClick={() => setSelected(site.site_url)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', color: C.text }}>
                      <span style={{ color: alert.level === 'red' ? C.red : C.amber, fontWeight: 800 }}>{siteLabel(site.site_url)}</span>
                      <span style={{ color: C.sec }}> — {alert.reasons.join('; ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Site cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {trackedSites.map(site => {
                const s = summaries.get(site.site_url)!
                const a = alerts.find(x => x.site.site_url === site.site_url)?.alert
                const active = selected === site.site_url
                return (
                  <div key={site.site_url} onClick={() => setSelected(active ? null : site.site_url)} style={{ background: C.card, border: '1px solid ' + (active ? C.teal : a ? (a.level === 'red' ? 'rgba(255,68,102,0.5)' : 'rgba(255,184,0,0.45)') : C.border), borderRadius: '1rem', padding: '0.9rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={site.site_url}>{siteLabel(site.site_url)}</span>
                      <button title="Hide this site" onClick={e => { e.stopPropagation(); toggleTracked(site.site_url, false) }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', padding: 2 }}><EyeOff size={13} /></button>
                    </div>
                    {s.series.length === 0 ? (
                      <p style={{ fontSize: '0.75rem', color: site.last_sync_error ? C.amber : C.muted, margin: 0, lineHeight: 1.5 }}>{site.last_sync_error ? 'Last sync failed: ' + site.last_sync_error : 'No data yet — hit Sync now.'}</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>{nf(s.now.clicks)}</div>
                            <div style={{ fontSize: '0.66rem', color: C.muted, margin: '0.15rem 0' }}>clicks</div>
                            {s.hasPrev && <Delta pct={pctChange(s.now.clicks, s.prev.clicks)} />}
                          </div>
                          <Sparkline values={s.series.map(d => d.clicks)} color={C.cyan} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid ' + C.border }}>
                          <div><div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{nf(s.now.impressions)}</div><div style={{ fontSize: '0.62rem', color: C.muted }}>impr.</div>{s.hasPrev && <Delta pct={pctChange(s.now.impressions, s.prev.impressions)} />}</div>
                          <div><div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{(s.now.ctr * 100).toFixed(1)}%</div><div style={{ fontSize: '0.62rem', color: C.muted }}>CTR</div></div>
                          <div><div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{s.now.position.toFixed(1)}</div><div style={{ fontSize: '0.62rem', color: C.muted }}>avg pos.</div>{s.hasPrev && s.prev.position > 0 && <Delta pct={pctChange(s.now.position, s.prev.position)} invert />}</div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {hiddenSites.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <button onClick={() => setShowHidden(v => !v)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, padding: 0 }}>
                  {showHidden ? '▾' : '▸'} {hiddenSites.length} hidden site{hiddenSites.length === 1 ? '' : 's'}
                </button>
                {showHidden && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                    {hiddenSites.map(s => (
                      <button key={s.site_url} onClick={() => toggleTracked(s.site_url, true)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', background: C.surface, border: '1px solid ' + C.border, borderRadius: '9999px', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem' }}>
                        <Eye size={12} /> {siteLabel(s.site_url)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Detail panel */}
            {sel && selSummary && (
              <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0 }}>{siteLabel(sel.site_url)}</h2>
                  <span style={{ fontSize: '0.7rem', color: C.muted }}>
                    {sel.last_synced_at ? 'Last synced ' + new Date(sel.last_synced_at).toLocaleString('en-GB') : 'Never synced'}
                    {selSummary.lastDate ? ' · data to ' + selSummary.lastDate : ''}
                  </span>
                </div>
                {sel.last_sync_error && <p style={{ fontSize: '0.74rem', color: C.amber, margin: '0 0 0.75rem', lineHeight: 1.5 }}>Last sync failed: {sel.last_sync_error}</p>}
                <TrendChart series={selSummary.series} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', margin: '1.1rem 0 0.7rem' }}>
                  {([['query', 'Queries', Search], ['page', 'Pages', FileText]] as const).map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setDim(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', borderRadius: '0.625rem', border: '1px solid ' + (dim === id ? C.teal : C.border), background: dim === id ? 'rgba(47,184,172,0.12)' : 'transparent', color: dim === id ? C.teal : C.sec, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                  <span style={{ width: 1, height: 20, background: C.border, margin: '0 0.25rem' }} />
                  {MODES.map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: '0.3rem 0.7rem', borderRadius: '9999px', border: '1px solid ' + (mode === m.id ? C.cyan : C.border), background: mode === m.id ? 'rgba(0,212,255,0.1)' : 'transparent', color: mode === m.id ? C.cyan : C.sec, fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {windowDays > 28 && <p style={{ fontSize: '0.7rem', color: C.muted, margin: '0 0 0.6rem' }}>Query and page detail compares up to 28 days (the top rows per day are stored; history builds up with each sync).</p>}
                {moversErr && <p style={{ fontSize: '0.78rem', color: C.red, margin: '0 0 0.6rem' }}>{moversErr}</p>}
                {moversLoading ? (
                  <p style={{ color: C.muted, fontSize: '0.8rem' }}>Loading…</p>
                ) : shownMovers.length === 0 ? (
                  <p style={{ color: C.muted, fontSize: '0.8rem' }}>Nothing to show for this view yet — comparisons need data for both periods.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                      <thead>
                        <tr style={{ color: C.muted, textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th style={{ padding: '0.4rem 0.5rem' }}>{dim === 'query' ? 'Query' : 'Page'}</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Clicks</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>vs prev</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Impr.</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Position</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Moved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownMovers.map(m => {
                          const moved = m.position_now !== null && m.position_prev !== null ? m.position_prev - m.position_now : null
                          const dClicks = m.clicks_now - m.clicks_prev
                          return (
                            <tr key={m.key} style={{ borderTop: '1px solid ' + C.border }}>
                              <td style={{ padding: '0.45rem 0.5rem', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.key}>{dim === 'page' ? pagePath(m.key) : m.key}</td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{nf(m.clicks_now)}</td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: dClicks > 0 ? C.green : dClicks < 0 ? C.red : C.sec }}>{dClicks > 0 ? '+' : ''}{nf(dClicks)}</td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: C.sec }}>{nf(m.impressions_now)}</td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>{m.position_now !== null ? m.position_now.toFixed(1) : '–'}</td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, color: moved === null ? C.muted : moved > 0.05 ? C.green : moved < -0.05 ? C.red : C.sec }}>
                                {moved === null ? '–' : (moved > 0 ? '▲ ' : moved < 0 ? '▼ ' : '') + Math.abs(moved).toFixed(1)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        button:hover { opacity:0.88; }
      `}</style>
    </main>
  )
}
