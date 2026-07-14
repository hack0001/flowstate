'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Layers, Plus, ExternalLink, Archive, Trash2,
  Search, X, Copy, Check, RotateCcw, ChevronDown,
  BookmarkIcon, FolderOpen,
} from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6', blue:'#60a5fa',
}

const GROUP_COLORS: Record<string, string> = {
  Etsy: C.orange, 'Sound Money': C.amber, Instagram: C.pink,
  Research: C.purple, Tools: C.teal, Reading: C.blue,
  Reference: C.sec, Dev: C.cyan,
}

function groupColor(g: string): string {
  return GROUP_COLORS[g] ?? C.purple
}

// Bookmarklet — saves current Chrome tab to the Tab Sheet with a toast
const BOOKMARKLET = "javascript:(function(){var d=document,u=d.querySelector('link[rel~=\"icon\"]');fetch('http://localhost:3000/api/tabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,title:d.title,favicon:u?u.href:'',source:'bookmarklet'})}).then(function(r){return r.json()}).then(function(x){var msg=x.duplicate?'Already saved':'\\u2714 Saved to Tab Sheet';var el=d.createElement('div');el.textContent=msg;Object.assign(el.style,{position:'fixed',top:'20px',right:'20px',background:x.duplicate?'#ffb800':'#00ff88',color:'#000',padding:'8px 16px',borderRadius:'8px',fontWeight:'bold',zIndex:'99999',fontSize:'14px',fontFamily:'sans-serif',boxShadow:'0 4px 12px rgba(0,0,0,0.3)'});d.body.appendChild(el);setTimeout(function(){el.remove()},2000)})})();"

type SavedTab = {
  id: string
  url: string
  title: string
  favicon: string
  group: string
  notes: string
  addedAt: string
  status: 'active' | 'archived'
  source: 'manual' | 'bookmarklet'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  if (days <  7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

// ── Tab card ────────────────────────────────────────────────────────────────
function TabCard({
  tab, onOpen, onArchive, onRestore, onDelete, archived,
}: {
  tab: SavedTab
  onOpen: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  archived: boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const domain = getDomain(tab.url)
  const initial = (tab.title || domain || '?')[0].toUpperCase()
  const faviconSrc = !imgErr && tab.favicon
    ? tab.favicon
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  const gc = tab.group ? groupColor(tab.group) : null

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.75rem',
      padding:'0.75rem 1rem', background: archived ? 'rgba(255,255,255,0.01)' : C.card,
      border:'1px solid '+(archived ? C.muted+'44' : C.border),
      borderRadius:'0.75rem', transition:'border-color 0.15s',
      opacity: archived ? 0.7 : 1,
    }}>
      {/* Favicon */}
      <div style={{
        width:28, height:28, flexShrink:0, borderRadius:'0.35rem',
        overflow:'hidden', background:C.surface,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <img
          src={faviconSrc} alt="" width={20} height={20}
          onError={() => setImgErr(true)}
          style={{ objectFit:'contain', display:'block' }}
        />
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{
          fontSize:'0.82rem', fontWeight:600, color: archived ? C.sec : C.text,
          margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          textDecoration: archived ? 'line-through' : 'none',
        }}>{tab.title || initial}</p>
        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem', flexWrap:'wrap' as const }}>
          <span style={{
            fontSize:'0.65rem', color:C.muted,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px',
          }}>{domain}</span>
          {gc && (
            <span style={{
              fontSize:'0.6rem', fontWeight:700, color:gc,
              background:gc+'18', border:'1px solid '+gc+'33',
              borderRadius:'0.25rem', padding:'0.05rem 0.35rem', flexShrink:0,
            }}>{tab.group}</span>
          )}
          <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{timeAgo(tab.addedAt)}</span>
          {tab.source === 'bookmarklet' && (
            <span style={{
              fontSize:'0.55rem', color:C.teal, background:C.teal+'15',
              borderRadius:'0.2rem', padding:'0.05rem 0.3rem', fontWeight:600, flexShrink:0,
            }}>clip</span>
          )}
        </div>
        {tab.notes && (
          <p style={{ fontSize:'0.67rem', color:C.sec, margin:'0.25rem 0 0', lineHeight:1.4 }}>{tab.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
        <button onClick={onOpen} title="Open in new tab" style={{
          padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border,
          background:'none', cursor:'pointer', color:C.cyan,
          display:'flex', alignItems:'center', fontFamily:'inherit',
        }}>
          <ExternalLink size={13} />
        </button>
        {archived ? (
          <button onClick={onRestore} title="Restore to active" style={{
            padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border,
            background:'none', cursor:'pointer', color:C.green,
            display:'flex', alignItems:'center', fontFamily:'inherit',
          }}>
            <RotateCcw size={13} />
          </button>
        ) : (
          <button onClick={onArchive} title="Archive" style={{
            padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border,
            background:'none', cursor:'pointer', color:C.amber,
            display:'flex', alignItems:'center', fontFamily:'inherit',
          }}>
            <Archive size={13} />
          </button>
        )}
        <button onClick={onDelete} title="Delete permanently" style={{
          padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border,
          background:'none', cursor:'pointer', color:C.red,
          display:'flex', alignItems:'center', fontFamily:'inherit',
        }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Add Tab Modal ───────────────────────────────────────────────────────────
const PRESET_GROUPS = ['Etsy', 'Sound Money', 'Instagram', 'Research', 'Tools', 'Reading', 'Reference', 'Dev']

function AddModal({
  onClose, onSave, existingGroups,
}: {
  onClose: () => void
  onSave: (tab: Partial<SavedTab>) => void
  existingGroups: string[]
}) {
  const [url, setUrl]       = useState('')
  const [title, setTitle]   = useState('')
  const [group, setGroup]   = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const allGroups = [...new Set([...PRESET_GROUPS, ...existingGroups])].sort()

  useEffect(() => { urlRef.current?.focus() }, [])

  function inp(label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; textarea?: boolean; required?: boolean }) {
    const style: React.CSSProperties = {
      width:'100%', background:C.surface, border:'1px solid '+C.border,
      borderRadius:'0.5rem', color:C.text, fontFamily:'inherit',
      fontSize:'0.82rem', padding:'0.55rem 0.75rem', outline:'none',
      resize: 'none', boxSizing:'border-box' as const,
    }
    return (
      <div>
        <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>
          {label}{opts?.required && <span style={{ color:C.red }}> *</span>}
        </label>
        {opts?.textarea
          ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={opts.placeholder} style={style} />
          : <input ref={label === 'URL' ? urlRef : undefined} value={value} onChange={e => onChange(e.target.value)} placeholder={opts?.placeholder} style={style} />
        }
      </div>
    )
  }

  async function save() {
    if (!url.trim()) return
    setSaving(true)
    await onSave({ url: url.trim(), title: title.trim(), group, notes: notes.trim() })
    setSaving(false)
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem',
        padding:'1.5rem', width:'100%', maxWidth:'440px',
        display:'flex', flexDirection:'column' as const, gap:'0.875rem',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:'1rem', fontWeight:800, margin:0 }}>Add Tab</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', display:'flex' }}>
            <X size={18} />
          </button>
        </div>

        {inp('URL', url, setUrl, { placeholder:'https://...', required: true })}
        {inp('Title', title, setTitle, { placeholder:'Leave blank to use page title' })}

        {/* Group select */}
        <div>
          <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>Group</label>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const, marginBottom:'0.4rem' }}>
            {allGroups.map(g => (
              <button key={g} onClick={() => setGroup(group === g ? '' : g)} style={{
                padding:'0.2rem 0.55rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.68rem', fontWeight:600,
                border:'1px solid '+(group === g ? groupColor(g) : C.border),
                background: group === g ? groupColor(g)+'22' : 'transparent',
                color: group === g ? groupColor(g) : C.muted,
              }}>{g}</button>
            ))}
          </div>
          <input
            value={group} onChange={e => setGroup(e.target.value)}
            placeholder="Or type a new group..."
            style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', padding:'0.45rem 0.75rem', outline:'none', boxSizing:'border-box' as const }}
          />
        </div>

        {inp('Notes', notes, setNotes, { placeholder:'Optional context...', textarea: true })}

        <div style={{ display:'flex', gap:'0.5rem', paddingTop:'0.25rem' }}>
          <button onClick={onClose} style={{
            flex:1, padding:'0.6rem', borderRadius:'0.6rem', border:'1px solid '+C.border,
            background:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:600,
          }}>Cancel</button>
          <button onClick={save} disabled={!url.trim() || saving} style={{
            flex:2, padding:'0.6rem', borderRadius:'0.6rem', border:'none',
            background: url.trim() ? C.cyan : C.muted+'44',
            color: url.trim() ? '#000' : C.muted, cursor: url.trim() ? 'pointer' : 'default',
            fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700,
          }}>{saving ? 'Saving...' : 'Save Tab'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Bookmarklet Panel ───────────────────────────────────────────────────────
function BookmarkletPanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(BOOKMARKLET).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const stepStyle: React.CSSProperties = {
    display:'flex', gap:'0.75rem', alignItems:'flex-start',
  }
  const numStyle: React.CSSProperties = {
    width:22, height:22, borderRadius:'50%', background:C.cyan+'22',
    border:'1px solid '+C.cyan+'55', display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, fontSize:'0.65rem', fontWeight:800, color:C.cyan, marginTop:'1px',
  }

  return (
    <div style={{ background:C.card, border:'1px solid '+C.cyan+'33', borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <BookmarkIcon size={15} color={C.cyan} />
          <p style={{ fontSize:'0.82rem', fontWeight:800, color:C.cyan, margin:0 }}>Chrome Bookmarklet Setup</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', display:'flex' }}><X size={15} /></button>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.75rem', marginBottom:'1.1rem' }}>
        {[
          { n:'1', text:'Copy the bookmarklet code below' },
          { n:'2', text:'In Chrome, open Bookmarks &rarr; Bookmark manager, or press Ctrl+Shift+B to show the bookmarks bar' },
          { n:'3', text:'Right-click the bookmarks bar &rarr; &ldquo;Add page&rdquo; &rarr; name it &ldquo;Save Tab&rdquo; and paste the code as the URL' },
          { n:'4', text:'Click &ldquo;Save Tab&rdquo; on any page to instantly add it to your Tab Sheet &mdash; a green toast confirms it' },
        ].map(s => (
          <div key={s.n} style={stepStyle}>
            <div style={numStyle}>{s.n}</div>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html: s.text }} />
          </div>
        ))}
      </div>

      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.6rem 0.75rem', marginBottom:'0.75rem' }}>
        <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0 0 0.35rem', fontFamily:'monospace', wordBreak:'break-all' as const, lineHeight:1.5 }}>
          {BOOKMARKLET.slice(0, 120)}&hellip;
        </p>
      </div>

      <button onClick={copy} style={{
        display:'flex', alignItems:'center', gap:'0.5rem',
        padding:'0.55rem 1rem', borderRadius:'0.6rem', border:'none',
        background: copied ? C.green+'22' : C.cyan+'22',
        border: '1px solid '+(copied ? C.green+'44' : C.cyan+'44'),
        color: copied ? C.green : C.cyan,
        cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700,
      }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy bookmarklet code'}
      </button>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function TabsPage() {
  const router = useRouter()
  const [tabs, setTabs]               = useState<SavedTab[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<'active' | 'archived'>('active')
  const [search, setSearch]           = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [showBM, setShowBM]           = useState(false)
  const [mounted, setMounted]         = useState(false)

  useEffect(() => { loadTabs(); setMounted(true) }, [])

  async function loadTabs() {
    try {
      const res = await fetch('/api/tabs')
      const data = await res.json()
      setTabs(Array.isArray(data) ? data : [])
    } catch { setTabs([]) }
    setLoading(false)
  }

  async function addTab(partial: Partial<SavedTab>) {
    await fetch('/api/tabs', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ...partial, source:'manual' }),
    })
    await loadTabs()
    setShowAdd(false)
  }

  async function archiveTab(id: string) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, status:'archived' as const } : t))
    await fetch('/api/tabs', { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id, status:'archived' }) })
  }

  async function restoreTab(id: string) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, status:'active' as const } : t))
    await fetch('/api/tabs', { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id, status:'active' }) })
  }

  async function deleteTab(id: string) {
    setTabs(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tabs?id=${id}`, { method:'DELETE' })
  }

  const activeTabs   = tabs.filter(t => t.status === 'active')
  const archivedTabs = tabs.filter(t => t.status === 'archived')
  const allGroups    = [...new Set(tabs.filter(t => t.group).map(t => t.group))].sort()

  function filterTabs(list: SavedTab[]) {
    return list
      .filter(t => groupFilter === 'all' || t.group === groupFilter)
      .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || getDomain(t.url).includes(search.toLowerCase()) || t.notes.toLowerCase().includes(search.toLowerCase()))
  }

  const displayTabs = filterTabs(view === 'active' ? activeTabs : archivedTabs)

  const openAll = () => {
    const targets = filterTabs(activeTabs)
    targets.forEach(t => window.open(t.url, '_blank'))
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        input::placeholder,textarea::placeholder{color:#4a4a6a}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.25rem 2rem' }}>
        <div style={{ maxWidth:'800px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'0.5rem' }}>
            <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
              &#8592; back
            </button>
            <div style={{ flex:1 }} />
            <Layers size={18} color={C.cyan} />
            <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.cyan }}>Tab Sheet</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem' }}>
            <h1 style={{ fontSize:'1.5rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>Tab Sheet</h1>
            <span style={{ fontSize:'0.75rem', color:C.muted }}>{activeTabs.length} saved &middot; {archivedTabs.length} archived</span>
          </div>
          <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0.2rem 0 0' }}>Save tabs from Chrome, clear your screen, come back to them here</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'1.5rem 2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s', animation:'fadeInUp 0.3s ease both' }}>

        {/* Bookmarklet panel */}
        {showBM && <BookmarkletPanel onClose={() => setShowBM(false)} />}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.875rem', flexWrap:'wrap' as const }}>
          {/* Search */}
          <div style={{ flex:1, minWidth:'180px', display:'flex', alignItems:'center', gap:'0.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.45rem 0.875rem' }}>
            <Search size={13} color={C.muted} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tabs..."
              style={{ flex:1, background:'none', border:'none', outline:'none', color:C.text, fontSize:'0.82rem', fontFamily:'inherit' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', padding:0 }}><X size={13} /></button>}
          </div>
          {/* View toggle */}
          <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', overflow:'hidden' }}>
            {(['active','archived'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:'0.45rem 0.875rem', border:'none', fontFamily:'inherit', cursor:'pointer',
                fontSize:'0.75rem', fontWeight: view===v ? 700 : 500,
                background: view===v ? C.cyan+'18' : 'transparent',
                color: view===v ? C.cyan : C.muted,
                transition:'all 0.15s',
              }}>
                {v === 'active' ? `Active (${activeTabs.length})` : `Archived (${archivedTabs.length})`}
              </button>
            ))}
          </div>
          {/* Bookmarklet button */}
          <button onClick={() => setShowBM(v => !v)} style={{
            display:'flex', alignItems:'center', gap:'0.4rem',
            padding:'0.45rem 0.875rem', background:C.card, border:'1px solid '+(showBM ? C.cyan+'44' : C.border),
            borderRadius:'0.75rem', color: showBM ? C.cyan : C.muted,
            cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600,
          }}>
            <BookmarkIcon size={13} />
            Bookmarklet
          </button>
        </div>

        {/* Group filter pills */}
        {allGroups.length > 0 && (
          <div style={{ display:'flex', gap:'0.3rem', marginBottom:'1rem', flexWrap:'wrap' as const }}>
            <button onClick={() => setGroupFilter('all')} style={{
              padding:'0.2rem 0.6rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.68rem', fontWeight:600,
              border:'1px solid '+(groupFilter==='all' ? C.cyan : C.border),
              background: groupFilter==='all' ? C.cyan+'18' : 'transparent',
              color: groupFilter==='all' ? C.cyan : C.muted,
            }}>All</button>
            {allGroups.map(g => {
              const gc = groupColor(g)
              const active = groupFilter === g
              const count  = (view==='active' ? activeTabs : archivedTabs).filter(t => t.group === g).length
              return (
                <button key={g} onClick={() => setGroupFilter(active ? 'all' : g)} style={{
                  padding:'0.2rem 0.6rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.68rem', fontWeight:600,
                  border:'1px solid '+(active ? gc : C.border),
                  background: active ? gc+'22' : 'transparent',
                  color: active ? gc : C.muted,
                }}>
                  {g} <span style={{ opacity:0.6 }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Open-all bar (active view only, when group or search filtered) */}
        {view === 'active' && (groupFilter !== 'all' || search) && displayTabs.length > 1 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.75rem' }}>
            <button onClick={openAll} style={{
              display:'flex', alignItems:'center', gap:'0.4rem',
              padding:'0.35rem 0.8rem', borderRadius:'0.5rem',
              background:C.cyan+'18', border:'1px solid '+C.cyan+'44',
              color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700,
            }}>
              <ExternalLink size={12} /> Open all {displayTabs.length} tabs
            </button>
          </div>
        )}

        {/* Tab list */}
        {loading ? (
          <p style={{ fontSize:'0.82rem', color:C.muted, textAlign:'center' as const, padding:'3rem 0' }}>Loading...</p>
        ) : displayTabs.length === 0 ? (
          <div style={{ textAlign:'center' as const, padding:'3rem 1rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>&#128216;</div>
            {view === 'active' && activeTabs.length === 0 ? (
              <>
                <p style={{ fontSize:'0.9rem', fontWeight:700, color:C.text, margin:'0 0 0.4rem' }}>No saved tabs yet</p>
                <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.25rem', lineHeight:1.6 }}>
                  Add tabs manually with the + button, or set up the bookmarklet<br />to save any Chrome tab in one click.
                </p>
                <div style={{ display:'flex', gap:'0.6rem', justifyContent:'center', flexWrap:'wrap' as const }}>
                  <button onClick={() => setShowAdd(true)} style={{
                    display:'flex', alignItems:'center', gap:'0.4rem',
                    padding:'0.55rem 1.1rem', borderRadius:'0.6rem', border:'none',
                    background:C.cyan, color:'#000', cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700,
                  }}>
                    <Plus size={15} /> Add tab
                  </button>
                  <button onClick={() => setShowBM(true)} style={{
                    display:'flex', alignItems:'center', gap:'0.4rem',
                    padding:'0.55rem 1.1rem', borderRadius:'0.6rem',
                    border:'1px solid '+C.border, background:'none',
                    color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:600,
                  }}>
                    <BookmarkIcon size={14} /> Set up bookmarklet
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize:'0.82rem', color:C.muted }}>No tabs match your filter</p>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
            {displayTabs.map(tab => (
              <TabCard
                key={tab.id}
                tab={tab}
                archived={view === 'archived'}
                onOpen={() => window.open(tab.url, '_blank')}
                onArchive={() => archiveTab(tab.id)}
                onRestore={() => restoreTab(tab.id)}
                onDelete={() => deleteTab(tab.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB — Add Tab */}
      <button
        onClick={() => setShowAdd(true)}
        title="Add a tab"
        style={{
          position:'fixed', bottom:'1.75rem', right:'1.75rem',
          width:52, height:52, borderRadius:'50%', border:'none',
          background:C.cyan, color:'#000', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 20px rgba(0,212,255,0.35)',
          transition:'transform 0.15s, box-shadow 0.15s',
          fontFamily:'inherit', zIndex:100,
        }}
      >
        <Plus size={22} />
      </button>

      {/* Add Modal */}
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSave={addTab}
          existingGroups={allGroups}
        />
      )}
    </main>
  )
}
