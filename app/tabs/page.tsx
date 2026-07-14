'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Layers, Plus, ExternalLink, Archive, Trash2,
  Search, X, Copy, Check, RotateCcw, BookmarkIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
function groupColor(g: string) { return GROUP_COLORS[g] ?? C.purple }

const PRESET_GROUPS = ['Etsy', 'Sound Money', 'Instagram', 'Research', 'Tools', 'Reading', 'Reference', 'Dev']

// ── Types ────────────────────────────────────────────────────────────────────
type SavedTab = {
  id: string
  url: string
  title: string
  favicon: string
  group: string       // maps to tab_group in DB
  notes: string
  addedAt: string     // maps to added_at in DB
  status: 'active' | 'archived'
  source: 'manual' | 'bookmarklet'
}

// Supabase row → app type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): SavedTab {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    favicon: row.favicon,
    group: row.tab_group ?? '',
    notes: row.notes,
    addedAt: row.added_at,
    status: row.status,
    source: row.source,
  }
}

// App type → Supabase insert object
function toRow(tab: SavedTab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: tab.favicon,
    tab_group: tab.group,
    notes: tab.notes,
    added_at: tab.addedAt,
    status: tab.status,
    source: tab.source,
  }
}

function makeFaviconUrl(url: string, explicit?: string): string {
  if (explicit) return explicit
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` } catch { return '' }
}

function makeId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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
function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

// ── Tab Card ─────────────────────────────────────────────────────────────────
function TabCard({ tab, archived, onOpen, onArchive, onRestore, onDelete }:{
  tab:SavedTab; archived:boolean
  onOpen:()=>void; onArchive:()=>void; onRestore:()=>void; onDelete:()=>void
}) {
  const [imgErr, setImgErr] = useState(false)
  const domain = getDomain(tab.url)
  const src = !imgErr && tab.favicon ? tab.favicon : `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  const gc = tab.group ? groupColor(tab.group) : null

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem',
      background:archived ? 'rgba(255,255,255,0.01)' : C.card,
      border:'1px solid '+(archived ? C.muted+'44' : C.border),
      borderRadius:'0.75rem', opacity:archived ? 0.7 : 1,
    }}>
      <div style={{ width:28, height:28, flexShrink:0, borderRadius:'0.35rem', overflow:'hidden', background:C.surface, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <img src={src} alt="" width={20} height={20} onError={() => setImgErr(true)} style={{ objectFit:'contain', display:'block' }} />
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <p style={{
          fontSize:'0.82rem', fontWeight:600, color:archived ? C.sec : C.text,
          margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          textDecoration:archived ? 'line-through' : 'none',
        }}>{tab.title || domain}</p>
        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem', flexWrap:'wrap' as const }}>
          <span style={{ fontSize:'0.65rem', color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'180px' }}>{domain}</span>
          {gc && <span style={{ fontSize:'0.6rem', fontWeight:700, color:gc, background:gc+'18', border:'1px solid '+gc+'33', borderRadius:'0.25rem', padding:'0.05rem 0.35rem', flexShrink:0 }}>{tab.group}</span>}
          <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{timeAgo(tab.addedAt)}</span>
          {tab.source === 'bookmarklet' && <span style={{ fontSize:'0.55rem', color:C.teal, background:C.teal+'15', borderRadius:'0.2rem', padding:'0.05rem 0.3rem', fontWeight:600, flexShrink:0 }}>clip</span>}
        </div>
        {tab.notes && <p style={{ fontSize:'0.67rem', color:C.sec, margin:'0.25rem 0 0', lineHeight:1.4 }}>{tab.notes}</p>}
      </div>

      <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
        <button onClick={onOpen} title="Open" style={{ padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border, background:'none', cursor:'pointer', color:C.cyan, display:'flex', alignItems:'center', fontFamily:'inherit' }}><ExternalLink size={13} /></button>
        {archived
          ? <button onClick={onRestore} title="Restore" style={{ padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border, background:'none', cursor:'pointer', color:C.green, display:'flex', alignItems:'center', fontFamily:'inherit' }}><RotateCcw size={13} /></button>
          : <button onClick={onArchive} title="Archive" style={{ padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border, background:'none', cursor:'pointer', color:C.amber, display:'flex', alignItems:'center', fontFamily:'inherit' }}><Archive size={13} /></button>
        }
        <button onClick={onDelete} title="Delete" style={{ padding:'0.3rem', borderRadius:'0.4rem', border:'1px solid '+C.border, background:'none', cursor:'pointer', color:C.red, display:'flex', alignItems:'center', fontFamily:'inherit' }}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ── Add Tab Modal ─────────────────────────────────────────────────────────────
function AddModal({ onClose, onSave, existingGroups }:{
  onClose:()=>void; onSave:(p:Partial<SavedTab>)=>void; existingGroups:string[]
}) {
  const [url, setUrl]     = useState('')
  const [title, setTitle] = useState('')
  const [group, setGroup] = useState('')
  const [notes, setNotes] = useState('')
  const urlRef = useRef<HTMLInputElement>(null)
  const allGroups = [...new Set([...PRESET_GROUPS, ...existingGroups])].sort()

  useEffect(() => { urlRef.current?.focus() }, [])

  const inp: React.CSSProperties = {
    width:'100%', background:C.surface, border:'1px solid '+C.border,
    borderRadius:'0.5rem', color:C.text, fontFamily:'inherit',
    fontSize:'0.82rem', padding:'0.55rem 0.75rem', outline:'none', boxSizing:'border-box' as const,
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'440px', display:'flex', flexDirection:'column' as const, gap:'0.875rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:'1rem', fontWeight:800, margin:0 }}>Add Tab</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', display:'flex' }}><X size={18} /></button>
        </div>

        <div>
          <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>URL <span style={{ color:C.red }}>*</span></label>
          <input ref={urlRef} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inp} />
        </div>
        <div>
          <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave blank to auto-generate" style={inp} />
        </div>
        <div>
          <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>Group</label>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const, marginBottom:'0.4rem' }}>
            {allGroups.map(g => (
              <button key={g} onClick={() => setGroup(group === g ? '' : g)} style={{
                padding:'0.2rem 0.55rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                border:'1px solid '+(group === g ? groupColor(g) : C.border),
                background:group === g ? groupColor(g)+'22' : 'transparent',
                color:group === g ? groupColor(g) : C.muted,
              }}>{g}</button>
            ))}
          </div>
          <input value={group} onChange={e => setGroup(e.target.value)} placeholder="Or type a new group..." style={inp} />
        </div>
        <div>
          <label style={{ fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional context..." style={{ ...inp, resize:'none' as const }} />
        </div>

        <div style={{ display:'flex', gap:'0.5rem', paddingTop:'0.25rem' }}>
          <button onClick={onClose} style={{ flex:1, padding:'0.6rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:600 }}>Cancel</button>
          <button onClick={() => { if (url.trim()) { onSave({ url:url.trim(), title:title.trim(), group, notes:notes.trim() }); onClose() }}} disabled={!url.trim()} style={{
            flex:2, padding:'0.6rem', borderRadius:'0.6rem', border:'none',
            background:url.trim() ? C.cyan : C.muted+'44',
            color:url.trim() ? '#000' : C.muted,
            cursor:url.trim() ? 'pointer' : 'default',
            fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700,
          }}>Save Tab</button>
        </div>
      </div>
    </div>
  )
}

// ── Bookmarklet Panel ─────────────────────────────────────────────────────────
function BookmarkletPanel({ origin, onClose }:{ origin:string; onClose:()=>void }) {
  const [copied, setCopied] = useState(false)

  const bm = `javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title);var f=document.querySelector('link[rel~="icon"]');var i=f?encodeURIComponent(f.href):'';window.open('${origin}/tabs?add='+u+'&title='+t+'&fav='+i,'_tabsave','width=320,height=90,top=20,left=20');})();`

  function copy() {
    navigator.clipboard.writeText(bm).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  const stepSt: React.CSSProperties = { display:'flex', gap:'0.75rem', alignItems:'flex-start' }
  const numSt: React.CSSProperties = { width:22, height:22, borderRadius:'50%', background:C.cyan+'22', border:'1px solid '+C.cyan+'55', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.65rem', fontWeight:800, color:C.cyan, marginTop:'1px' }

  return (
    <div style={{ background:C.card, border:'1px solid '+C.cyan+'33', borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <BookmarkIcon size={15} color={C.cyan} />
          <p style={{ fontSize:'0.82rem', fontWeight:800, color:C.cyan, margin:0 }}>Bookmarklet Setup</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', display:'flex' }}><X size={15} /></button>
      </div>
      <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.75rem', marginBottom:'1.1rem' }}>
        {[
          { n:'1', text:'Copy the bookmarklet code below' },
          { n:'2', text:'In Chrome, right-click the bookmarks bar &rarr; &ldquo;Add page&rdquo;' },
          { n:'3', text:'Name it &ldquo;Save Tab&rdquo; and paste the code as the URL' },
          { n:'4', text:'Click it on any page to save that tab to your Tab Sheet &mdash; synced across all your devices' },
        ].map(s => (
          <div key={s.n} style={stepSt}>
            <div style={numSt}>{s.n}</div>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html:s.text }} />
          </div>
        ))}
      </div>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.6rem 0.75rem', marginBottom:'0.75rem' }}>
        <p style={{ fontSize:'0.62rem', color:C.muted, margin:0, fontFamily:'monospace', wordBreak:'break-all' as const, lineHeight:1.5 }}>{bm.slice(0, 130)}&hellip;</p>
      </div>
      <button onClick={copy} style={{
        display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.55rem 1rem', borderRadius:'0.6rem',
        background:copied ? C.green+'22' : C.cyan+'22',
        border:'1px solid '+(copied ? C.green+'44' : C.cyan+'44'),
        color:copied ? C.green : C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700,
      }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy bookmarklet code'}
      </button>
    </div>
  )
}

// ── Popup Save View ───────────────────────────────────────────────────────────
// Renders when the page is opened as a bookmarklet popup (?add=URL)
function PopupSave({ url, title, favicon }:{ url:string; title:string; favicon:string }) {
  const [state, setState] = useState<'saving' | 'saved' | 'duplicate' | 'error'>('saving')

  useEffect(() => {
    async function save() {
      try {
        let hostname = ''
        try { hostname = new URL(url).hostname } catch {}

        // Check for duplicate active tab
        const { data: existing } = await supabase
          .from('tabs')
          .select('id')
          .eq('url', url)
          .eq('status', 'active')
          .maybeSingle()

        if (existing) { setState('duplicate'); return }

        const tab: SavedTab = {
          id: makeId(),
          url,
          title: title || hostname || 'Untitled',
          favicon: favicon || makeFaviconUrl(url),
          group: '',
          notes: '',
          addedAt: new Date().toISOString(),
          status: 'active',
          source: 'bookmarklet',
        }

        const { error } = await supabase.from('tabs').insert([toRow(tab)])
        if (error) throw error
        setState('saved')
      } catch {
        setState('error')
      }
      setTimeout(() => { try { window.close() } catch {} }, 1800)
    }
    save()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const domain = getDomain(url)
  const col = state === 'saved' ? C.green : state === 'duplicate' ? C.amber : state === 'error' ? C.red : C.muted
  const label = state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved to Tab Sheet' : state === 'duplicate' ? 'Already saved' : 'Error saving'
  const icon  = state === 'saving' ? '&#8987;' : state === 'saved' ? '&#10004;' : state === 'duplicate' ? '&#128203;' : '&#10006;'

  return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ textAlign:'center' as const }}>
        <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }} dangerouslySetInnerHTML={{ __html:icon }} />
        <p style={{ fontSize:'0.9rem', fontWeight:800, color:col, margin:'0 0 0.25rem' }}>{label}</p>
        <p style={{ fontSize:'0.72rem', color:C.muted, margin:0 }}>{domain}</p>
        {state !== 'saving' && <p style={{ fontSize:'0.62rem', color:C.muted, marginTop:'0.5rem' }}>Closing&hellip;</p>}
      </div>
    </main>
  )
}

// ── Inner page (useSearchParams must be inside Suspense) ──────────────────────
function TabsInner() {
  const router  = useRouter()
  const params  = useSearchParams()
  const addUrl  = params.get('add')
  const addTitle = params.get('title') || ''
  const addFav  = params.get('fav')   || ''

  const [tabs, setTabs]               = useState<SavedTab[]>([])
  const [loading, setLoading]         = useState(true)
  const [mounted, setMounted]         = useState(false)
  const [view, setView]               = useState<'active' | 'archived'>('active')
  const [search, setSearch]           = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [showBM, setShowBM]           = useState(false)
  const [origin, setOrigin]           = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    setMounted(true)
    loadTabs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If popup bookmarklet request, render the mini save view
  if (mounted && addUrl) {
    return <PopupSave url={decodeURIComponent(addUrl)} title={decodeURIComponent(addTitle)} favicon={decodeURIComponent(addFav)} />
  }

  async function loadTabs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tabs')
      .select('*')
      .order('added_at', { ascending: false })
    if (!error && data) setTabs(data.map(fromRow))
    setLoading(false)
  }

  async function saveTab(partial: Partial<SavedTab>) {
    const url = partial.url?.trim() || ''
    if (!url) return
    // Optimistic dedup check
    if (tabs.some(t => t.url === url && t.status === 'active')) return

    let hostname = ''
    try { hostname = new URL(url).hostname } catch {}

    const newTab: SavedTab = {
      id: makeId(),
      url,
      title: partial.title || hostname || 'Untitled',
      favicon: partial.favicon || makeFaviconUrl(url),
      group: partial.group || '',
      notes: partial.notes || '',
      addedAt: new Date().toISOString(),
      status: 'active',
      source: partial.source || 'manual',
    }

    setTabs(prev => [newTab, ...prev])
    await supabase.from('tabs').insert([toRow(newTab)])
  }

  async function archiveTab(id: string) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, status:'archived' as const } : t))
    await supabase.from('tabs').update({ status:'archived' }).eq('id', id)
  }

  async function restoreTab(id: string) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, status:'active' as const } : t))
    await supabase.from('tabs').update({ status:'active' }).eq('id', id)
  }

  async function deleteTab(id: string) {
    setTabs(prev => prev.filter(t => t.id !== id))
    await supabase.from('tabs').delete().eq('id', id)
  }

  const activeTabs   = tabs.filter(t => t.status === 'active')
  const archivedTabs = tabs.filter(t => t.status === 'archived')
  const allGroups    = [...new Set(tabs.filter(t => t.group).map(t => t.group))].sort()

  function filterList(list: SavedTab[]) {
    return list
      .filter(t => groupFilter === 'all' || t.group === groupFilter)
      .filter(t => !search
        || t.title.toLowerCase().includes(search.toLowerCase())
        || getDomain(t.url).includes(search.toLowerCase())
        || t.notes.toLowerCase().includes(search.toLowerCase()))
  }

  const displayTabs = filterList(view === 'active' ? activeTabs : archivedTabs)

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
            <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>&#8592; back</button>
            <div style={{ flex:1 }} />
            <Layers size={18} color={C.cyan} />
            <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:C.cyan }}>Tab Sheet</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem' }}>
            <h1 style={{ fontSize:'1.5rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>Tab Sheet</h1>
            <span style={{ fontSize:'0.75rem', color:C.muted }}>{activeTabs.length} saved &middot; {archivedTabs.length} archived</span>
          </div>
          <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0.2rem 0 0' }}>Synced across all your devices via Supabase</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'1.5rem 2rem', opacity:mounted?1:0, transition:'opacity 0.3s', animation:'fadeInUp 0.3s ease both' }}>

        {showBM && origin && <BookmarkletPanel origin={origin} onClose={() => setShowBM(false)} />}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.875rem', flexWrap:'wrap' as const }}>
          <div style={{ flex:1, minWidth:'180px', display:'flex', alignItems:'center', gap:'0.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.45rem 0.875rem' }}>
            <Search size={13} color={C.muted} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tabs..."
              style={{ flex:1, background:'none', border:'none', outline:'none', color:C.text, fontSize:'0.82rem', fontFamily:'inherit' }} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', padding:0 }}><X size={13} /></button>}
          </div>

          <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', overflow:'hidden' }}>
            {(['active','archived'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:'0.45rem 0.875rem', border:'none', fontFamily:'inherit', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:view===v?700:500,
                background:view===v?C.cyan+'18':'transparent',
                color:view===v?C.cyan:C.muted, transition:'all 0.15s',
              }}>
                {v === 'active' ? `Active (${activeTabs.length})` : `Archived (${archivedTabs.length})`}
              </button>
            ))}
          </div>

          <button onClick={() => setShowBM(v => !v)} style={{
            display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 0.875rem',
            background:C.card, border:'1px solid '+(showBM ? C.cyan+'44' : C.border),
            borderRadius:'0.75rem', color:showBM?C.cyan:C.muted,
            cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600,
          }}>
            <BookmarkIcon size={13} /> Bookmarklet
          </button>
        </div>

        {/* Group pills */}
        {allGroups.length > 0 && (
          <div style={{ display:'flex', gap:'0.3rem', marginBottom:'1rem', flexWrap:'wrap' as const }}>
            <button onClick={() => setGroupFilter('all')} style={{
              padding:'0.2rem 0.6rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
              border:'1px solid '+(groupFilter==='all'?C.cyan:C.border),
              background:groupFilter==='all'?C.cyan+'18':'transparent',
              color:groupFilter==='all'?C.cyan:C.muted,
            }}>All</button>
            {allGroups.map(g => {
              const gc  = groupColor(g)
              const act = groupFilter === g
              const cnt = (view==='active'?activeTabs:archivedTabs).filter(t=>t.group===g).length
              return (
                <button key={g} onClick={() => setGroupFilter(act?'all':g)} style={{
                  padding:'0.2rem 0.6rem', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                  border:'1px solid '+(act?gc:C.border),
                  background:act?gc+'22':'transparent',
                  color:act?gc:C.muted,
                }}>
                  {g} <span style={{ opacity:0.6 }}>{cnt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Open all (when filtered) */}
        {view==='active' && (groupFilter!=='all'||search) && displayTabs.length>1 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.75rem' }}>
            <button onClick={() => displayTabs.forEach(t => window.open(t.url,'_blank'))} style={{
              display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.8rem', borderRadius:'0.5rem',
              background:C.cyan+'18', border:'1px solid '+C.cyan+'44',
              color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700,
            }}>
              <ExternalLink size={12} /> Open all {displayTabs.length} tabs
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem 0', gap:'0.5rem', color:C.muted, fontSize:'0.82rem' }}>
            <div style={{ width:'1rem', height:'1rem', borderRadius:'50%', border:'2px solid '+C.muted, borderTopColor:C.cyan, animation:'spin 0.8s linear infinite' }} />
            Loading&hellip;
          </div>
        ) : displayTabs.length === 0 ? (
          <div style={{ textAlign:'center' as const, padding:'3rem 1rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }} dangerouslySetInnerHTML={{ __html:'&#128216;' }} />
            {view==='active' && activeTabs.length===0 ? (
              <>
                <p style={{ fontSize:'0.9rem', fontWeight:700, color:C.text, margin:'0 0 0.4rem' }}>No saved tabs yet</p>
                <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.25rem', lineHeight:1.6 }}>
                  Add tabs manually, or set up the bookmarklet to save<br />any Chrome tab in one click &mdash; synced across all your devices.
                </p>
                <div style={{ display:'flex', gap:'0.6rem', justifyContent:'center', flexWrap:'wrap' as const }}>
                  <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1.1rem', borderRadius:'0.6rem', border:'none', background:C.cyan, color:'#000', cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700 }}>
                    <Plus size={15} /> Add tab
                  </button>
                  <button onClick={() => setShowBM(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1.1rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:600 }}>
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
                archived={view==='archived'}
                onOpen={() => window.open(tab.url,'_blank')}
                onArchive={() => archiveTab(tab.id)}
                onRestore={() => restoreTab(tab.id)}
                onDelete={() => deleteTab(tab.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} title="Add a tab" style={{
        position:'fixed', bottom:'1.75rem', right:'1.75rem',
        width:52, height:52, borderRadius:'50%', border:'none',
        background:C.cyan, color:'#000', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(0,212,255,0.35)', zIndex:100, fontFamily:'inherit',
      }}><Plus size={22} /></button>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSave={p => saveTab(p)}
          existingGroups={allGroups}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function TabsPage() {
  return (
    <Suspense>
      <TabsInner />
    </Suspense>
  )
}
