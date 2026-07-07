'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Edit3, RotateCcw, ArrowLeft, BookOpen, Save, X } from 'lucide-react'
import { SECTIONS, SectionKey, KBPage } from './data'

const C = {
  bg: '#0a0a0f', surface: '#12121a', card: '#1a1a26', border: '#2a2a3a',
  orange: '#f97316', green: '#00ff88', amber: '#ffb800', purple: '#8b5cf6',
  red: '#ff4466', text: '#f0f0ff', sec: '#8888aa', muted: '#4a4a6a',
  teal: '#14b8a6', pink: '#ec4899', blue: '#60a5fa',
}

const STORAGE_PREFIX = 'flowstate_etsy_kb_'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderContent(raw: string): string {
  const lines = raw.split('\n')
  const out: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length

    // Blank line
    if (trimmed === '') {
      if (inList) { out.push('</ul>'); inList = false }
      out.push('<div style="height:8px"></div>')
      continue
    }

    // Section header (ALL CAPS line, no dash, no bracket)
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('[') &&
      /[A-Z]/.test(trimmed)
    ) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<div style="color:${C.amber};font-weight:700;font-size:13px;letter-spacing:0.05em;margin:14px 0 4px">${escapeHtml(trimmed)}</div>`)
      continue
    }

    // ## heading
    if (trimmed.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<div style="color:${C.blue};font-weight:700;font-size:14px;margin:12px 0 4px">${escapeHtml(trimmed.slice(3))}</div>`)
      continue
    }

    // ### heading
    if (trimmed.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<div style="color:${C.teal};font-weight:600;font-size:13px;margin:10px 0 3px">${escapeHtml(trimmed.slice(4))}</div>`)
      continue
    }

    // Step N: heading
    if (/^Step \d+:/.test(trimmed)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<div style="color:${C.green};font-weight:600;font-size:13px;margin:10px 0 3px">${escapeHtml(trimmed)}</div>`)
      continue
    }

    // Checkbox item [ ] or [x]
    if (trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      if (!inList) { out.push('<ul style="list-style:none;padding:0;margin:2px 0">'); inList = true }
      const checked = trimmed[1] !== ' '
      const text = escapeHtml(trimmed.slice(4))
      const pad = indent > 0 ? `margin-left:${Math.min(indent * 4, 32)}px` : ''
      out.push(
        `<li style="display:flex;gap:6px;align-items:flex-start;margin:2px 0;${pad}">` +
        `<span style="flex-shrink:0;width:14px;height:14px;border:1px solid ${C.border};border-radius:3px;margin-top:2px;background:${checked ? C.green : 'transparent'};display:inline-block"></span>` +
        `<span style="color:${C.text};font-size:13px;line-height:1.5">${text}</span>` +
        `</li>`
      )
      continue
    }

    // Bullet item (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { out.push('<ul style="list-style:none;padding:0;margin:2px 0">'); inList = true }
      const text = escapeHtml(trimmed.slice(2))
      const pad = indent > 0 ? `margin-left:${Math.min(indent * 4, 32)}px` : ''
      const bullet = indent >= 4 ? `color:${C.sec};font-size:9px` : `color:${C.orange};font-size:11px`
      out.push(
        `<li style="display:flex;gap:6px;align-items:flex-start;margin:2px 0;${pad}">` +
        `<span style="${bullet};flex-shrink:0;margin-top:4px">&#9679;</span>` +
        `<span style="color:${C.text};font-size:13px;line-height:1.5">${text}</span>` +
        `</li>`
      )
      continue
    }

    // Regular text
    if (inList) { out.push('</ul>'); inList = false }
    const pad = indent > 0 ? `padding-left:${Math.min(indent * 4, 32)}px` : ''
    out.push(`<div style="color:${C.text};font-size:13px;line-height:1.6;${pad}">${escapeHtml(trimmed)}</div>`)
  }

  if (inList) out.push('</ul>')
  return out.join('\n')
}

function EditablePage({ page, accentColor }: { page: KBPage; accentColor: string }) {
  const storageKey = `${STORAGE_PREFIX}${page.id}`
  const [content, setContent] = useState(page.content)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(page.content)
  const [modified, setModified] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setContent(saved)
        setDraft(saved)
        setModified(true)
      }
    } catch {}
  }, [storageKey])

  function startEdit() {
    setDraft(content)
    setEditing(true)
  }

  function save() {
    try { localStorage.setItem(storageKey, draft) } catch {}
    setContent(draft)
    setModified(draft !== page.content)
    setEditing(false)
  }

  function cancel() {
    setDraft(content)
    setEditing(false)
  }

  function reset() {
    if (!confirm('Reset to original Notion content? Your edits will be lost.')) return
    try { localStorage.removeItem(storageKey) } catch {}
    setContent(page.content)
    setDraft(page.content)
    setModified(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '16px 20px 20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'flex-end', alignItems: 'center' }}>
        {modified && !editing && (
          <span style={{ fontSize: 11, color: C.amber, marginRight: 'auto' }}>&#9679; Modified</span>
        )}
        {editing ? (
          <>
            <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.green, color: '#000', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Save size={13} /> Save
            </button>
            <button onClick={cancel} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.surface, color: C.sec, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              <X size={13} /> Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              <Edit3 size={13} /> Edit
            </button>
            {modified && (
              <button onClick={reset} title="Reset to original" style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.card, color: C.red, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </>
        )}
      </div>

      {/* Content area */}
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          style={{
            width: '100%', minHeight: 420, background: C.surface, color: C.text,
            border: `1px solid ${accentColor}`, borderRadius: 8, padding: '12px 14px',
            fontSize: 13, lineHeight: 1.6, fontFamily: 'ui-monospace,monospace',
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
          }}
          spellCheck={false}
        />
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: renderContent(content) }}
          style={{ minHeight: 60 }}
        />
      )}
    </div>
  )
}

function PageAccordion({ page, accentColor }: { page: KBPage; accentColor: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: 6, borderRadius: 8, border: `1px solid ${open ? accentColor + '55' : C.border}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: open ? C.card : C.surface, border: 'none', padding: '12px 16px',
          cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
        }}
      >
        {open
          ? <ChevronDown size={15} color={accentColor} />
          : <ChevronRight size={15} color={C.sec} />}
        <span style={{ color: open ? C.text : C.sec, fontSize: 14, fontWeight: open ? 600 : 400, flex: 1 }}>
          {page.title}
        </span>
      </button>
      {open && <EditablePage page={page} accentColor={accentColor} />}
    </div>
  )
}

export default function EtsyKnowledge() {
  const router = useRouter()
  const [section, setSection] = useState<SectionKey>('framework')
  const [expandAll, setExpandAll] = useState(false)

  const current = SECTIONS[section]
  const sectionKeys = Object.keys(SECTIONS) as SectionKey[]

  // Count modified pages for a section
  function countModified(key: SectionKey) {
    if (typeof window === 'undefined') return 0
    return SECTIONS[key].pages.filter(p => {
      try { return localStorage.getItem(`${STORAGE_PREFIX}${p.id}`) !== null } catch { return false }
    }).length
  }

  return (
    <main style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 50 }}>
        <button
          onClick={() => router.push('/etsy')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.sec, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 13 }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color={current.color} />
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Etsy Knowledge Base</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.sec }}>
          {current.pages.length} pages
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, background: C.surface, overflowX: 'auto' }}>
        {sectionKeys.map(key => {
          const s = SECTIONS[key]
          const active = key === section
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                color: active ? s.color : C.sec, fontWeight: active ? 700 : 400, fontSize: 13,
                borderBottom: active ? `2px solid ${s.color}` : '2px solid transparent',
                whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}
            >
              {s.title}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: current.color }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: current.color }}>{current.title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{current.pages.length} pages</span>
        </div>

        {current.pages.map(page => (
          <PageAccordion key={page.id} page={page} accentColor={current.color} />
        ))}
      </div>
    </main>
  )
}
