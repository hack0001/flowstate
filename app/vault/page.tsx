'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Search, ExternalLink, X, BookOpen, Wrench, Lightbulb, Film, FileText, Headphones, ShoppingCart, Star, Plus, Edit3, Trash2, ClipboardList, RotateCcw, Layers } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const CATEGORIES = ['All','Book','Article','Tool / Software','Business Idea','Reference','Movie','Academic','Audiobook / Podcast','Video','Spreadsheet','Buy']
const CATEGORY_OPTS = ['Book','Article','Tool / Software','Business Idea','Reference','Movie','Academic','Audiobook / Podcast','Video','Spreadsheet','Buy']
const STATUS_OPTS = ['', 'To Read', 'In Progress', 'Read', 'Done', 'On Hold']

const VAULT_SORTS = [
  { key: 'priority',        label: 'Priority order' },
  { key: 'created_at_desc', label: 'Newest first' },
  { key: 'created_at_asc',  label: 'Oldest first' },
  { key: 'category',        label: 'Category' },
]

const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  'Book':               { icon: <BookOpen size={13}/>,   color: '#8b5cf6' },
  'Article':            { icon: <FileText size={13}/>,    color: '#00d4ff' },
  'Tool / Software':    { icon: <Wrench size={13}/>,      color: '#00ff88' },
  'Business Idea':      { icon: <Lightbulb size={13}/>,   color: '#ffb800' },
  'Reference':          { icon: <Star size={13}/>,         color: '#4a9eff' },
  'Movie':              { icon: <Film size={13}/>,          color: '#ff4466' },
  'Academic':           { icon: <BookOpen size={13}/>,     color: '#10b981' },
  'Audiobook / Podcast':{ icon: <Headphones size={13}/>,  color: '#f472b6' },
  'Video':              { icon: <Film size={13}/>,          color: '#ff6b35' },
  'Spreadsheet':        { icon: <FileText size={13}/>,     color: '#6b7280' },
  'Buy':                { icon: <ShoppingCart size={13}/>, color: '#ffb800' },
}

type VaultItem = {
  id: string
  notion_id: string | null
  title: string
  category: string | null
  author_source: string | null
  link: string | null
  key_takeaway: string | null
  notes: string | null
  platform: string | null
  tag: string | null
  status: string
  notion_url: string | null
  created_at: string
}

type DraftItem = {
  id?: string
  title: string
  category: string
  author_source: string
  link: string
  key_takeaway: string
  notes: string
  platform: string
  tag: string
  status: string
  notion_url: string
}

const EMPTY_DRAFT: DraftItem = {
  title:'', category:'', author_source:'', link:'',
  key_takeaway:'', notes:'', platform:'', tag:'', status:'', notion_url:'',
}

function itemToDraft(item: VaultItem): DraftItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category ?? '',
    author_source: item.author_source ?? '',
    link: item.link ?? '',
    key_takeaway: item.key_takeaway ?? '',
    notes: item.notes ?? '',
    platform: item.platform ?? '',
    tag: item.tag ?? '',
    status: item.status ?? '',
    notion_url: item.notion_url ?? '',
  }
}

function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return null
  const meta = CAT_META[cat]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:'0.25rem',
      fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const,
      color: meta?.color ?? C.muted,
      background: (meta?.color ?? '#4a4a6a') + '18',
      border: '1px solid ' + (meta?.color ?? '#4a4a6a') + '40',
      borderRadius:'9999px', padding:'0.15rem 0.5rem',
    }}>
      {meta?.icon}{cat}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  if (!status) return null
  const color = status === 'Read' || status === 'Done' ? C.green
    : status === 'In Progress' ? C.cyan
    : status === 'On Hold' ? C.amber
    : C.muted
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, color, background:color+'15', border:'1px solid '+color+'40', borderRadius:'9999px', padding:'0.1rem 0.45rem', letterSpacing:'0.05em', textTransform:'uppercase' as const }}>
      {status}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none',
  boxSizing:'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor:'pointer', appearance:'none' as const }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize:'vertical' as const, minHeight:90, lineHeight:1.6 }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function VaultDrawer({
  draft, setDraft, onSave, onClose, saving,
}: {
  draft: DraftItem
  setDraft: (d: DraftItem) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  const set = (k: keyof DraftItem, v: string) => setDraft({ ...draft, [k]: v })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100 }}/>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'min(520px,100vw)',
        background:C.surface, borderLeft:'1px solid '+C.border,
        zIndex:101, display:'flex', flexDirection:'column', overflowY:'auto',
      }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, flex:1 }}>
            {draft.id ? 'Edit Item' : 'New Vault Item'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding:'1.25rem 1.5rem', flex:1 }}>
          <Field label="Title *">
            <input
              autoFocus
              value={draft.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Book, article, tool name..."
              style={inputStyle}
            />
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <Field label="Category">
              <select value={draft.category} onChange={e => set('category', e.target.value)} style={selectStyle}>
                <option value="">None</option>
                {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={draft.status} onChange={e => set('status', e.target.value)} style={selectStyle}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'None'}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <Field label="Author / Source">
              <input value={draft.author_source} onChange={e => set('author_source', e.target.value)} placeholder="e.g. James Clear" style={inputStyle}/>
            </Field>
            <Field label="Platform">
              <input value={draft.platform} onChange={e => set('platform', e.target.value)} placeholder="e.g. Audible, YouTube" style={inputStyle}/>
            </Field>
          </div>

          <Field label="Link / URL">
            <input value={draft.link} onChange={e => set('link', e.target.value)} placeholder="https://..." style={inputStyle}/>
          </Field>

          <Field label="Tag">
            <input value={draft.tag} onChange={e => set('tag', e.target.value)} placeholder="e.g. productivity, business" style={inputStyle}/>
          </Field>

          <Field label="Key Takeaway">
            <textarea value={draft.key_takeaway} onChange={e => set('key_takeaway', e.target.value)} placeholder="Main insight or summary..." style={textareaStyle}/>
          </Field>

          <Field label="Notes">
            <textarea value={draft.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." style={{ ...textareaStyle, minHeight:120 }}/>
          </Field>

          <Field label="Notion URL">
            <input value={draft.notion_url} onChange={e => set('notion_url', e.target.value)} placeholder="https://notion.so/..." style={inputStyle}/>
          </Field>
        </div>

        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid '+C.border, display:'flex', gap:'0.75rem', flexShrink:0 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.title.trim()}
            style={{
              flex:1, padding:'0.75rem', background:C.purple, border:'none',
              borderRadius:'0.75rem', color:'#fff', fontWeight:800, fontSize:'0.9rem',
              cursor: saving || !draft.title.trim() ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', opacity: saving || !draft.title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : draft.id ? 'Save Changes' : 'Add to Vault'}
          </button>
          <button onClick={onClose} style={{ padding:'0.75rem 1.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

export default function VaultPage() {
  const router = useRouter()
  const [items, setItems] = useState<VaultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'all'|'priority'|'done'>('all')
  const [toast, setToast] = useState<string|null>(null)
  const [vPriorityOrder, setVPriorityOrder] = useState<string[]>([])
  const [vDragId, setVDragId] = useState<string|null>(null)
  const [vDragOver, setVDragOver] = useState<string|null>(null)
  const [vDragFrom, setVDragFrom] = useState<'unassigned'|'priority'|null>(null)
  const [vGroupByType, setVGroupByType] = useState(false)
  const [vSort, setVSort] = useState('priority')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('vault_items')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let vPLsLoaded = false
    let vLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_vault')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setVPriorityOrder(ids); vPLsLoaded = true; vLocalIds = ids } }
    } catch {}
    async function init() {
      const [, { data: pdata }] = await Promise.all([
        load(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'vault_priority').single()
      ])
      if (pdata?.ordered_ids && Array.isArray(pdata.ordered_ids) && (pdata.ordered_ids as string[]).length > 0) {
        const ids = pdata.ordered_ids as string[]
        setVPriorityOrder(ids)
        try { localStorage.setItem('fs_p_vault', JSON.stringify(ids)) } catch {}
      } else if (vPLsLoaded) {
        supabase.from('priority_lists').upsert({ key: 'vault_priority', ordered_ids: vLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      } else {
        const { data: ids } = await supabase.from('vault_items').select('id').neq('archived', true).order('created_at', { ascending: false })
        if (ids && ids.length > 0) {
          const allIds = (ids as { id: string }[]).map(i => i.id)
          setVPriorityOrder(allIds)
          try { localStorage.setItem('fs_p_vault', JSON.stringify(allIds)) } catch {}
          supabase.from('priority_lists').upsert({ key: 'vault_priority', ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
        }
      }
    }
    init()
  }, [load])

  function saveVPriority(order: string[]) {
    const y = window.scrollY
    setVPriorityOrder(order)
    try { localStorage.setItem('fs_p_vault', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: 'vault_priority', ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  const activeItems = items.filter(it => it.status !== 'Done' && it.status !== 'Read')

  const filtered = activeItems.filter(item => {
    const matchCat = catFilter === 'All' || item.category === catFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.title.toLowerCase().includes(q) ||
      (item.author_source ?? '').toLowerCase().includes(q) ||
      (item.key_takeaway ?? '').toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q) ||
      (item.tag ?? '').toLowerCase().includes(q)
    return matchCat && matchSearch
  }).sort((a, b) => {
    if (vSort === 'priority') {
      // Same ranking Priority View drag-reorders -- reordering there is
      // reflected here immediately, no separate sort to keep in sync.
      const ai = vPriorityOrder.indexOf(a.id), bi = vPriorityOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }
    if (vSort === 'created_at_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (vSort === 'created_at_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (vSort === 'category') return (a.category ?? 'z').localeCompare(b.category ?? 'z')
    return 0
  })

  const catCounts: Record<string, number> = {}
  activeItems.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] ?? 0) + 1 })

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setDrawerOpen(true)
  }

  function openEdit(item: VaultItem, e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(itemToDraft(item))
    setDrawerOpen(true)
  }

  async function saveDrawer() {
    if (!draft.title.trim()) return
    setSaving(true)
    const payload = {
      title: draft.title.trim(),
      category: draft.category || null,
      author_source: draft.author_source || null,
      link: draft.link || null,
      key_takeaway: draft.key_takeaway || null,
      notes: draft.notes || null,
      platform: draft.platform || null,
      tag: draft.tag || null,
      status: draft.status || '',
      notion_url: draft.notion_url || null,
    }
    if (draft.id) {
      await supabase.from('vault_items').update(payload).eq('id', draft.id)
      setItems(prev => prev.map(i => i.id === draft.id ? { ...i, ...payload } as VaultItem : i))
    } else {
      const { data: inserted } = await supabase
        .from('vault_items').insert({ ...payload, archived: false }).select().single()
      if (inserted) setItems(prev => [inserted as VaultItem, ...prev])
    }
    setSaving(false)
    setDrawerOpen(false)
  }

  async function archiveItem(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Remove this item from vault?')) return
    await supabase.from('vault_items').update({ archived: true }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function convertToTask(item: VaultItem, e: React.MouseEvent) {
    e.stopPropagation()
    const { error } = await supabase.from('master_tasks').insert({
      title: item.title,
      status: 'Not started',
      archived: false,
      from_vault: true,
    })
    if (!error) {
      await supabase.from('vault_items').delete().eq('id', item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      if (expanded === item.id) setExpanded(null)
      setToast('Moved to tasks: ' + item.title.slice(0, 40))
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function restoreItem(item: VaultItem, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('vault_items').update({ status: '' }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: '' } : i))
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#128218; Knowledge Vault
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {activeItems.length} active &mdash; {items.filter(i=>i.status==='Done'||i.status==='Read').length} done
              </p>
            </div>
            <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.75rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-end' }}>
              <Plus size={14}/> New Item
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {/* View toggle */}
        {(() => {
          const vValidOrder = vPriorityOrder.filter(id => activeItems.some(it => it.id === id))
          const vAssignedSet = new Set(vValidOrder)
          const vUnassignedCount = activeItems.filter(it => !vAssignedSet.has(it.id)).length
          const doneCount = items.filter(it => it.status === 'Done' || it.status === 'Read').length
          return (
            <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
              <button onClick={() => setView('all')} style={{ padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(view === 'all' ? C.purple : C.border), background:view === 'all' ? 'rgba(139,92,246,0.12)' : 'transparent', color:view === 'all' ? C.purple : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                All Items
              </button>
              <button onClick={() => setView('priority')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(view === 'priority' ? '#ff6b35' : C.border), background:view === 'priority' ? 'rgba(255,107,53,0.12)' : 'transparent', color:view === 'priority' ? '#ff6b35' : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                Priority View
                {vUnassignedCount > 0 && (
                  <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{vUnassignedCount}</span>
                )}
              </button>
              <button onClick={() => setView('done')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(view === 'done' ? C.green : C.border), background:view === 'done' ? 'rgba(0,255,136,0.08)' : 'transparent', color:view === 'done' ? C.green : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                Done
                {doneCount > 0 && <span style={{ background:C.green, color:'#000', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{doneCount}</span>}
              </button>
            </div>
          )
        })()}

        {/* Priority view */}
        {view === 'priority' && (() => {
          const vValidOrder = vPriorityOrder.filter(id => activeItems.some(it => it.id === id))
          const vAssignedSet = new Set(vValidOrder)
          const vUnassigned = activeItems.filter(it => !vAssignedSet.has(it.id))

          function vHandleDragStart(id: string, from: 'unassigned'|'priority') {
            setVDragId(id); setVDragFrom(from)
          }
          function vHandleDragEnd() {
            setVDragId(null); setVDragOver(null); setVDragFrom(null)
          }
          function vHandleDropOnPriority(targetId: string) {
            if (!vDragId) return
            const newOrder = vValidOrder.filter(i => i !== vDragId)
            const idx = newOrder.indexOf(targetId)
            if (idx === -1) { saveVPriority([...newOrder, vDragId]); return }
            newOrder.splice(idx, 0, vDragId)
            saveVPriority(newOrder)
            setVDragId(null); setVDragOver(null); setVDragFrom(null)
          }
          function vHandleDropOnBottom() {
            if (!vDragId) return
            const newOrder = vValidOrder.filter(i => i !== vDragId)
            saveVPriority([...newOrder, vDragId])
            setVDragId(null); setVDragOver(null); setVDragFrom(null)
          }
          function vHandleRemove(id: string) {
            saveVPriority(vValidOrder.filter(i => i !== id))
          }

          return (
            <div>
              {/* Unassigned */}
              <div style={{ marginBottom:'1.75rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:C.red }}>Unassigned</span>
                  {vUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{vUnassigned.length}</span>}
                </div>
                {vUnassigned.length === 0 ? (
                  <div style={{ padding:'1rem', background:C.card, borderRadius:'0.75rem', border:'1px solid '+C.border, color:C.muted, fontSize:'0.8rem', textAlign:'center' }}>
                    All items assigned
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
                    {vUnassigned.map(it => {
                      const meta = it.category ? CAT_META[it.category] : null
                      return (
                        <div key={it.id}
                          draggable
                          onDragStart={() => vHandleDragStart(it.id, 'unassigned')}
                          onDragEnd={vHandleDragEnd}
                          style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', cursor:'grab', opacity: vDragId === it.id ? 0.4 : 1 }}>
                          <span style={{ color:C.muted, fontSize:'0.75rem' }}>&#9776;</span>
                          <span style={{ fontSize:'0.82rem', fontWeight:600, color:C.text, flex:1 }}>{it.title}</span>
                          {it.category && meta ? (
                            <span style={{ fontSize:'0.65rem', fontWeight:700, color:meta.color, background:meta.color+'15', border:'1px solid '+meta.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>{meta.icon}{it.category}</span>
                          ) : (
                            <span style={{ fontSize:'0.65rem', fontWeight:700, color:C.amber, background:C.amber+'15', border:'1px solid '+C.amber+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>No type</span>
                          )}
                          <button type="button" draggable={false} onClick={e => convertToTask(it, e)} style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', color:C.cyan, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.68rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.25rem' }} title="Convert to Task">
                            <ClipboardList size={11}/> Task
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Priority order */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', flexWrap:'wrap' as const }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase' as const, letterSpacing:'0.08em', color:'#ff6b35' }}>Priority Order</span>
                  <span style={{ fontSize:'0.65rem', color:C.muted }}>{vGroupByType ? 'grouped by type' : 'drag to reorder'}</span>
                  <button type="button" onClick={() => setVGroupByType(g => !g)} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.7rem', borderRadius:'0.5rem', border:'1px solid '+(vGroupByType ? C.purple : C.border), background:vGroupByType ? 'rgba(139,92,246,0.12)' : 'transparent', color:vGroupByType ? C.purple : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:700 }}>
                    <Layers size={11}/> Group by type
                  </button>
                </div>
                {vGroupByType && vValidOrder.some(id => { const it = items.find(x=>x.id===id); return it && !it.category }) && (
                  <div style={{ marginBottom:'0.6rem', fontSize:'0.68rem', color:C.amber }}>
                    &#9888; Some items in this list have no category assigned &mdash; see &ldquo;No type assigned&rdquo; group below.
                  </div>
                )}
                {vValidOrder.length === 0 ? (
                  <div
                    onDragOver={e => { e.preventDefault(); setVDragOver('__bottom__') }}
                    onDragLeave={() => setVDragOver(null)}
                    onDrop={() => { vHandleDropOnBottom(); setVDragOver(null) }}
                    style={{ padding:'2rem', background:C.card, borderRadius:'0.75rem', border:'2px dashed '+(vDragOver === '__bottom__' ? '#ff6b35' : C.border), color:C.muted, fontSize:'0.8rem', textAlign:'center', transition:'border-color 0.15s' }}>
                    Drag items here to set priority
                  </div>
                ) : (() => {
                  const renderRow = (id: string, idx: number, draggableOn: boolean) => {
                    const it = items.find(x => x.id === id)
                    if (!it) return null
                    const meta = it.category ? CAT_META[it.category] : null
                    const isOver = vDragOver === id
                    return (
                      <div key={id}>
                        {draggableOn && isOver && vDragFrom !== 'unassigned' && (
                          <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 2px 0' }}/>
                        )}
                        <div
                          draggable={draggableOn}
                          onDragStart={draggableOn ? () => vHandleDragStart(id, 'priority') : undefined}
                          onDragEnd={draggableOn ? vHandleDragEnd : undefined}
                          onDragOver={draggableOn ? (e => { e.preventDefault(); setVDragOver(id) }) : undefined}
                          onDragLeave={draggableOn ? (e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setVDragOver(null) }) : undefined}
                          onDrop={draggableOn ? (() => vHandleDropOnPriority(id)) : undefined}
                          style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem', background:C.card, border:'1px solid '+(draggableOn && isOver ? '#ff6b35' : C.border), borderRadius:'0.75rem', cursor: draggableOn ? 'grab' : 'default', opacity: draggableOn && vDragId === id ? 0.4 : 1, marginBottom:'0.4rem', transition:'border-color 0.15s' }}>
                          <span style={{ fontSize:'0.65rem', fontWeight:800, color:'#ff6b35', minWidth:'1.5rem', textAlign:'center' }}>#{idx+1}</span>
                          {draggableOn && <span style={{ color:C.muted, fontSize:'0.75rem' }}>&#9776;</span>}
                          <span style={{ fontSize:'0.82rem', fontWeight:600, color:C.text, flex:1 }}>{it.title}</span>
                          {it.category && meta ? (
                            <span style={{ fontSize:'0.65rem', fontWeight:700, color:meta.color, background:meta.color+'15', border:'1px solid '+meta.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>{meta.icon}{it.category}</span>
                          ) : (
                            <span style={{ fontSize:'0.65rem', fontWeight:700, color:C.amber, background:C.amber+'15', border:'1px solid '+C.amber+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>No type</span>
                          )}
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveVPriority([id, ...vValidOrder.filter(i=>i!==id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveVPriority([...vValidOrder.filter(i=>i!==id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button type="button" draggable={false} onClick={e => convertToTask(it, e)} style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', color:C.cyan, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.68rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.25rem' }} title="Convert to Task">
                            <ClipboardList size={11}/> Task
                          </button>
                          <button onClick={() => vHandleRemove(id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.15rem', borderRadius:'0.25rem' }}>
                            <X size={13}/>
                          </button>
                        </div>
                      </div>
                    )
                  }

                  if (vGroupByType) {
                    const groups: Record<string, string[]> = {}
                    const order: string[] = []
                    vValidOrder.forEach(id => {
                      const it = items.find(x => x.id === id)
                      const key = it?.category || 'No type assigned'
                      if (!groups[key]) { groups[key] = []; order.push(key) }
                      groups[key].push(id)
                    })
                    order.sort((a, b) => a === 'No type assigned' ? -1 : b === 'No type assigned' ? 1 : 0)
                    return (
                      <div style={{ display:'flex', flexDirection:'column' as const, gap:'1.1rem' }}>
                        {order.map(key => {
                          const meta = key !== 'No type assigned' ? CAT_META[key] : null
                          const color = meta ? meta.color : C.amber
                          return (
                            <div key={key}>
                              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                                {meta && <span style={{ color }}>{meta.icon}</span>}
                                <span style={{ fontSize:'0.68rem', fontWeight:800, color, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{key}</span>
                                <span style={{ fontSize:'0.62rem', color:C.muted }}>({groups[key].length})</span>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0' }}>
                                {groups[key].map(id => renderRow(id, vValidOrder.indexOf(id), false))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  return (
                    <div style={{ display:'flex', flexDirection:'column' as const, gap:'0' }}>
                      {vValidOrder.map((id, idx) => renderRow(id, idx, true))}
                      {/* Bottom drop zone */}
                      <div
                        onDragOver={e => { e.preventDefault(); setVDragOver('__bottom__') }}
                        onDragLeave={() => setVDragOver(null)}
                        onDrop={() => { vHandleDropOnBottom(); setVDragOver(null) }}
                        style={{ height:'2.5rem', borderRadius:'0.75rem', border:'2px dashed '+(vDragOver === '__bottom__' ? '#ff6b35' : 'transparent'), display:'flex', alignItems:'center', justifyContent:'center', transition:'border-color 0.15s' }}>
                        {vDragOver === '__bottom__' && <span style={{ fontSize:'0.7rem', color:'#ff6b35' }}>Drop to add last</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* Done view */}
        {view === 'done' && (() => {
          const doneItems = items.filter(it => it.status === 'Done' || it.status === 'Read')
          return (
            <div>
              {doneItems.length === 0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
                  <p style={{ margin:0, fontSize:'0.875rem' }}>Nothing completed yet</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem' }}>
                  {doneItems.map(item => {
                    const meta = item.category ? CAT_META[item.category] : null
                    return (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                        {meta && <span style={{ color:meta.color, flexShrink:0 }}>{meta.icon}</span>}
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'0.85rem', fontWeight:600, color:C.text, margin:'0 0 0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'line-through', opacity:0.6 }}>
                            {item.title}
                          </p>
                          <p style={{ fontSize:'0.7rem', color:C.muted, margin:0 }}>
                            {item.category && <span>{item.category}</span>}
                            {item.category && item.author_source && <span> &middot; </span>}
                            {item.author_source && <span>{item.author_source}</span>}
                          </p>
                        </div>
                        <StatusChip status={item.status}/>
                        <button onClick={e => convertToTask(item, e)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.7rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, flexShrink:0 }}>
                          <ClipboardList size={11}/> Task
                        </button>
                        <button onClick={e => restoreItem(item, e)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.7rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.5rem', color:C.green, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, flexShrink:0 }}>
                          <RotateCcw size={11}/> Restore
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {view === 'all' && <>
        {/* Search */}
        <div style={{ position:'relative', marginBottom:'1.25rem' }}>
          <Search size={15} color={C.muted} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, author, notes, tags..."
            style={{ width:'100%', padding:'0.65rem 2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'0.88rem', boxSizing:'border-box', outline:'none' }}/>
          {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'0.875rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={14}/></button>}
        </div>

        {/* Sort -- same options/default as the Tasks page: Priority order
            first, following whatever Priority View is currently ranked. */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
          <label style={{ fontSize:'0.7rem', color:C.muted, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Sort</label>
          <select value={vSort} onChange={e => setVSort(e.target.value)}
            style={{ padding:'0.5rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', cursor:'pointer' }}>
            {VAULT_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Category filter pills */}
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1.75rem' }}>
          {CATEGORIES.map(cat => {
            const active = catFilter === cat
            const count = cat === 'All' ? activeItems.length : (catCounts[cat] ?? 0)
            if (cat !== 'All' && count === 0) return null
            const meta = cat !== 'All' ? CAT_META[cat] : null
            return (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.72rem', fontWeight:700,
                background: active ? (meta?.color ?? C.purple) + '18' : C.card,
                border: '1px solid ' + (active ? (meta?.color ?? C.purple) + '50' : C.border),
                color: active ? (meta?.color ?? C.purple) : C.sec,
                transition:'all 0.15s',
              }}>
                {meta?.icon}{cat} <span style={{ opacity:0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Items grid */}
        {loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            {items.length === 0 ? (
              <>
                <p style={{ fontSize:'1rem', color:C.sec, marginBottom:'0.5rem', fontWeight:700 }}>Vault is empty</p>
                <button onClick={openNew} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,'+C.purple+',#7c3aed)', border:'none', borderRadius:'0.875rem', color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit', marginTop:'1rem' }}>
                  <Plus size={16}/> Add First Item
                </button>
              </>
            ) : (
              <p>No items match your filters.</p>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.75rem' }}>
            {filtered.map(item => {
              const isExp = expanded === item.id
              const meta = item.category ? CAT_META[item.category] : null
              const takeawayStyle: React.CSSProperties = isExp
                ? { fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }
                : { fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5, overflow:'hidden', display:'-webkit-box' as React.CSSProperties['display'], WebkitLineClamp:2, WebkitBoxOrient:'vertical' as React.CSSProperties['WebkitBoxOrient'] }
              return (
                <div key={item.id} onClick={() => setExpanded(isExp ? null : item.id)}
                  style={{
                    background:C.card, border:'1px solid '+(isExp?(meta?.color??C.purple)+'40':C.border),
                    borderRadius:'1rem', padding:'1rem', cursor:'pointer',
                    transition:'all 0.2s ease',
                    boxShadow: isExp ? '0 0 20px '+(meta?.color??C.purple)+'15' : 'none',
                  }}>

                  {/* Top row */}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                    <CategoryBadge cat={item.category}/>
                    {item.tag && (
                      <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>
                    )}
                    {item.status && (
                      <span style={{ marginLeft:'auto' }}><StatusChip status={item.status}/></span>
                    )}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ color:C.cyan, display:'flex', marginLeft: item.status ? '0' : 'auto' }}>
                        <ExternalLink size={12}/>
                      </a>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.3rem', lineHeight:1.35 }}>{item.title}</h3>

                  {/* Author + platform */}
                  {(item.author_source || item.platform) && (
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.5rem' }}>
                      {item.author_source && <span>by {item.author_source}</span>}
                      {item.author_source && item.platform && <span> &middot; </span>}
                      {item.platform && <span>{item.platform}</span>}
                    </p>
                  )}

                  {/* Key takeaway */}
                  {item.key_takeaway && (
                    <p style={takeawayStyle}>
                      {item.key_takeaway}
                    </p>
                  )}

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{ marginTop:'0.875rem' }}>
                      {item.notes && (
                        <div style={{ padding:'0.75rem', background:C.surface, borderRadius:'0.625rem', border:'1px solid '+C.border, marginBottom:'0.875rem' }}>
                          <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 0.3rem', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Notes</p>
                          <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{item.notes}</p>
                        </div>
                      )}

                      <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 0.875rem' }}>
                        Added {new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                      </p>

                      {/* Action buttons */}
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        <button
                          onClick={e => openEdit(item, e)}
                          style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}
                        >
                          <Edit3 size={12}/> Edit
                        </button>
                        <button
                          onClick={e => convertToTask(item, e)}
                          style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}
                        >
                          <ClipboardList size={12}/> &#8594; Task
                        </button>
                        <button
                          onClick={e => archiveItem(item.id, e)}
                          style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, marginLeft:'auto' }}
                        >
                          <Trash2 size={12}/> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </>}
      </div>

      {drawerOpen && (
        <VaultDrawer
          draft={draft}
          setDraft={setDraft}
          onSave={saveDrawer}
          onClose={() => setDrawerOpen(false)}
          saving={saving}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)', background:C.green, color:'#0a0a0f', padding:'0.75rem 1.5rem', borderRadius:'0.875rem', fontWeight:800, fontSize:'0.82rem', zIndex:200, boxShadow:'0 4px 24px rgba(0,255,136,0.3)', display:'flex', alignItems:'center', gap:'0.5rem', whiteSpace:'nowrap' }}>
          <ClipboardList size={14}/> {toast}
        </div>
      )}

      <style>{`
        input:focus, select:focus, textarea:focus { border-color: ${C.purple} !important; }
        button:hover { opacity:0.85; }
        select { appearance:none; }
        textarea { font-family:inherit; }
      `}</style>
    </main>
  )
}
