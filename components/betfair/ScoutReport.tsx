'use client'
import { useEffect, useState } from 'react'

// The scout's latest report (run on the recorder server: deploy/study.sh), shown
// on the Insights tab. The report is plain Markdown: headings, paragraphs, bold and tables.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', red: '#ff5470', vio: '#9b8cff' }
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
  return parts.map((p, i) => p.startsWith('**') ? <b key={i} style={{ color: '#fff' }}>{p.slice(2, -2)}</b> : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p)
}
const tone = (cell: string) => /^\+\d/.test(cell) ? C.teal : /^−\d/.test(cell) ? C.red : cell === '✓' ? C.teal : cell === '✗' ? C.dim : undefined

function render(md: string) {
  const out: React.ReactNode[] = []
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim())); i++ }
      i--
      const [head, , ...body] = rows
      out.push(
        <div key={i} style={{ overflowX: 'auto', margin: '6px 0 12px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', color: C.fg }}>
            <thead><tr>{head.map((h, j) => <th key={j} style={{ textAlign: j ? 'right' : 'left', color: C.mut, fontWeight: 500, fontSize: 11, padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: MONO, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} style={{ textAlign: j ? 'right' : 'left', padding: '4px 6px', borderBottom: '1px solid ' + C.line, fontFamily: j ? MONO : 'inherit', fontSize: 12, whiteSpace: j ? 'nowrap' : 'normal', color: tone(c) }}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>)
    } else if (l.startsWith('# ')) out.push(<h3 key={i} style={{ margin: '0 0 6px', fontSize: 16, color: '#fff' }}>{l.slice(2)}</h3>)
    else if (l.startsWith('## ')) out.push(<h4 key={i} style={{ margin: '16px 0 4px', fontSize: 15, color: '#fff' }}>{l.slice(3)}</h4>)
    else if (l.startsWith('### ')) out.push(<h5 key={i} style={{ margin: '12px 0 4px', fontSize: 14, color: C.fg }}>{l.slice(4)}</h5>)
    else if (l.trim()) out.push(<p key={i} style={{ margin: '0 0 8px', color: C.mut, fontSize: 13 }}>{inline(l)}</p>)
  }
  return out
}

export default function ScoutReport() {
  const [md, setMd] = useState<string | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/betfair/history?report=latest', { cache: 'no-store' }).then(r => r.json()).then(j => { setMd(j.report ?? null); setErr(j.error ?? null) }).catch(e => setErr(String(e)))
  }, [])
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: 'system-ui,sans-serif', fontSize: 14, lineHeight: 1.6, color: C.fg, minWidth: 0 }}>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#fff' }}>Scout report <span style={{ color: C.mut, fontWeight: 400, fontSize: 13 }}>(tested on the Betfair history by the server{md ? `: ${md.split('\n')[0].replace('# Scout report, ', '')}` : ''})</span></summary>
        <div style={{ marginTop: 10 }}>
          {err ? <p style={{ color: C.red, fontSize: 13 }}>{err}</p>
            : md === undefined ? <p style={{ color: C.mut, fontSize: 13 }}>Loading…</p>
            : md === null ? <p style={{ color: C.mut, fontSize: 13 }}>The scout hasn&apos;t run yet. On the server: <code style={{ fontFamily: MONO, background: C.panel2, padding: '1px 5px', borderRadius: 4 }}>sudo bash /opt/flowstate/recorder/deploy/study.sh</code></p>
            : render(md)}
        </div>
      </details>
    </section>
  )
}
