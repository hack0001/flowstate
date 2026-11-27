'use client'
import type { CSSProperties, ReactNode } from 'react'
import { DESK, MONO } from '@/lib/theme'

// Reusable building blocks. Pages compose these instead of re-writing the
// same inline-styled <div> every time. Desk look = navy panels, mono type.

/** Small stat tile: label, big value, sub-line. */
export function Tile({ label, value, sub, color, onClick }: {
  label: string; value: string; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{ background: DESK.panel, border: '1px solid ' + DESK.line, borderRadius: 10, padding: '10px 12px', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: DESK.mut }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: DESK.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

/** Titled box. Clicking the header calls onTitleClick (usually "go to that page"). */
export function Panel({ title, color, note, onTitleClick, children, style }: {
  title: string; color: string; note?: string; onTitleClick?: () => void; children: ReactNode; style?: CSSProperties
}) {
  return (
    <div style={{ background: DESK.panel, border: '1px solid ' + DESK.line, borderRadius: 10, padding: 12, minWidth: 0, ...style }}>
      <button onClick={onTitleClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: onTitleClick ? 'pointer' : 'default', fontFamily: MONO }}>
        <span style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 600, color }}>{title}</span>
        {note && <span style={{ fontSize: 10, color: DESK.mut }}>{note}{onTitleClick ? ' ›' : ''}</span>}
      </button>
      {children}
    </div>
  )
}

/** One row in a Panel: index, title, optional badge. */
export function ListRow({ index, title, badge, color, onClick }: {
  index?: number | string; title: string; badge?: string; color: string; onClick?: () => void
}) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderTop: '1px solid ' + DESK.line, padding: '6px 0', cursor: onClick ? 'pointer' : 'default', fontFamily: MONO, textAlign: 'left', width: '100%' }}>
      {index !== undefined && <span style={{ fontSize: 10, color, width: 24, flexShrink: 0 }}>{index}</span>}
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: DESK.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      {badge && <span style={{ fontSize: 9, color: DESK.mut, border: '1px solid ' + DESK.line, borderRadius: 4, padding: '0 4px', flexShrink: 0 }}>{badge}</span>}
    </button>
  )
}

/** Responsive grid: as many columns as fit at `min` px. */
export function Grid({ min = 250, gap = 10, children, style }: { min?: number; gap?: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))`, gap, ...style }}>{children}</div>
}

/** Full-screen dark overlay with a centred card. Clicking the dark area or X closes it. */
export function Modal({ onClose, maxWidth = '30rem', children }: { onClose: () => void; maxWidth?: string; children: ReactNode }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#1a1a26', border: '1px solid #2a2a3a', borderRadius: '1rem', padding: '1.5rem', width: '94%', maxWidth, maxHeight: '88vh', overflow: 'auto', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>&times;</button>
        {children}
      </div>
    </div>
  )
}
