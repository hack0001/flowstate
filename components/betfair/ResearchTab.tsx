'use client'
import { useEffect, useState } from 'react'
import { CONCEPTS, COVERAGE, GROUPS, STRATEGIES, type Concept } from '@/lib/betfair/playbook'

// Research tab of /betfair: the betting ideas from the Sports Hacker articles,
// in plain English, each with the article(s) and script(s) it comes from.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', vio: '#9b8cff', amb: '#f6b93b', blu: '#6f9bff' }
const SANS = 'system-ui,sans-serif'
const STRAT_NAME = Object.fromEntries(STRATEGIES.map(s => [s.id, s.name]))

function Card({ c, open, onToggle, onStrategy }: { c: Concept; open: boolean; onToggle: () => void; onStrategy: (id: string) => void }) {
  const label: React.CSSProperties = { color: C.blu, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', margin: '12px 0 4px' }
  return (
    <div id={'concept-' + c.id} style={{ background: C.panel, border: '1px solid ' + (open ? '#33407a' : C.line), borderRadius: 10, scrollMarginTop: 12 }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: C.fg, cursor: 'pointer', padding: '12px 14px', fontFamily: SANS, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{c.title}</span>
          {!open && <span style={{ display: 'block', color: C.mut, fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{c.plain.split('. ')[0]}.</span>}
        </span>
        <span style={{ color: C.dim, fontSize: 12, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg }}>
          <p style={{ margin: 0 }}>{c.plain}</p>
          {c.example && <><div style={label}>Worked example</div><p style={{ margin: 0, color: '#c8d2ee' }}>{c.example}</p></>}
          <div style={label}>On Betfair</div><p style={{ margin: 0, color: '#c8d2ee' }}>{c.onBetfair}</p>
          {c.caution && <><div style={{ ...label, color: C.amb }}>Caution</div><p style={{ margin: 0, color: '#e9d8b0' }}>{c.caution}</p></>}
          <div style={label}>Where it comes from</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.mut, fontSize: 13 }}>
            {c.sources.map(s => <li key={s.article}>“{s.article}”, Sports Hacker, {s.date}</li>)}
            {c.scripts && <li>Scripts: <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 }}>{c.scripts.join(', ')}</span></li>}
          </ul>
          {c.usedBy && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: C.mut }}>
              Tested by
              {c.usedBy.map(id => <button key={id} onClick={() => onStrategy(id)} style={{ background: C.panel2, border: '1px solid ' + C.line, color: C.teal, borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontFamily: SANS }}>{STRAT_NAME[id]} →</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResearchTab({ focus, onStrategy }: { focus: string | null; onStrategy: (id: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set(focus ? [focus] : []))
  useEffect(() => {
    if (!focus) return
    setOpen(prev => new Set(prev).add(focus))
    const t = setTimeout(() => document.getElementById('concept-' + focus)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [focus])
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '6px 0 10px' }}>
      <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: '#fff', margin: '10px 0 6px' }}>What the Sports Hacker articles teach</h2>
      <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.mut, margin: '0 0 6px' }}>
        {CONCEPTS.length} ideas from the archived blog (Oct 2013 – Aug 2014), each explained in plain English with the article and script it comes from. The articles show how to build models and where value might be. None of them proves a strategy makes money: that is what the Strategies tab is for.
      </p>
      <p style={{ fontFamily: SANS, fontSize: 12, lineHeight: 1.5, color: C.dim, margin: '0 0 6px' }}>{COVERAGE.note}</p>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 4px' }}>
        <button onClick={() => setOpen(new Set(CONCEPTS.map(c => c.id)))} style={{ background: 'none', border: '1px solid ' + C.line, color: C.mut, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Open all</button>
        <button onClick={() => setOpen(new Set())} style={{ background: 'none', border: '1px solid ' + C.line, color: C.mut, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Close all</button>
      </div>
      {GROUPS.map(g => (
        <section key={g}>
          <h3 style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.vio, margin: '22px 0 8px', fontWeight: 600 }}>{g}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {CONCEPTS.filter(c => c.group === g).map(c => <Card key={c.id} c={c} open={open.has(c.id)} onToggle={() => toggle(c.id)} onStrategy={onStrategy} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
