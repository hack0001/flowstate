'use client'
import { useEffect, useState } from 'react'

// "Prices from" choice for the Backtest and Insights tabs: your own recordings,
// or the Betfair history imported by the recorder server.

export type Source = 'recorded' | 'history'
type Info = { days: number; races: number; from?: string | null; to?: string | null; error?: string }

const NOTE: Record<string, string> = {
  racing: 'Last traded prices every minute in the last 75 minutes (every 5 before that), with results and SP.',
  football: 'Last traded prices every minute in the last hour and every minute in play (90 minutes plus), with results.',
  tennis: 'Last traded prices every minute in the last 30 minutes and every 2 minutes in play, with results.',
  golf: 'Last traded prices every hour from 3 days out and through the tournament, with results.',
}
const C = { panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', amb: '#f6b93b', blu: '#6f9bff' }
const cached = new Map<string, Info>()

export function useHistoryInfo(sport: string) {
  const [info, setInfo] = useState<Info | null>(cached.get(sport) ?? null)
  useEffect(() => {
    const c = cached.get(sport)
    if (c) { setInfo(c); return }
    setInfo(null)
    fetch('/api/betfair/history?sport=' + sport, { cache: 'no-store' }).then(r => r.json()).then((j: Info) => { cached.set(sport, j); setInfo(j) }).catch(() => setInfo({ days: 0, races: 0 }))
  }, [sport])
  return info
}

export function PriceSourceField({ sport, value, onChange, inputStyle }: { sport: string; value: Source; onChange: (s: Source) => void; inputStyle: React.CSSProperties }) {
  const info = useHistoryInfo(sport)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: C.mut, minWidth: 0 }}>Prices from
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value as Source)}>
        <option value="recorded">My recordings</option>
        <option value="history">Betfair history{info?.days ? ` (${info.days} days)` : ''}</option>
      </select>
    </label>
  )
}

export function PriceSourceNote({ sport, source, from, to, onUseAll }: { sport: string; source: Source; from: string; to: string; onUseAll: (from: string, to: string) => void }) {
  const info = useHistoryInfo(sport)
  if (source !== 'history' || !info) return null
  if (!info.days) return <p style={{ color: C.amb, fontSize: 13, margin: '0 0 10px' }}>{info.error ?? 'No Betfair history imported yet. The Setup tab explains how (it\'s free).'}</p>
  const outside = info.from && info.to && (to < info.from || from > info.to)
  return (
    <p style={{ color: C.mut, fontSize: 13, margin: '0 0 10px' }}>
      Betfair history: {info.days} days, {info.races.toLocaleString('en-GB')} {sport === 'racing' ? 'races' : 'markets'}, {info.from} to {info.to}. {NOTE[sport] ?? ''} No back/lay prices or money matched, so trades assume a one-tick spread.{' '}
      {info.from && info.to && (from !== info.from || to !== info.to) && <button onClick={() => onUseAll(info.from!, info.to!)} style={{ background: 'none', border: '1px solid ' + C.line, color: C.blu, borderRadius: 6, padding: '1px 8px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Use all {info.days} days</button>}
      {outside && <span style={{ color: C.amb }}> The dates chosen are outside the imported range.</span>}
    </p>
  )
}
