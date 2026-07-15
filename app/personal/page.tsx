'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Check, RotateCcw, User, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const PRIORITY_META: Record<string, { color: string; bg: string }> = {
  High:   { color:'#ff4466', bg:'rgba(255,68,102,0.1)'  },
  Medium: { color:'#ffb800', bg:'rgba(255,184,0,0.1)'   },
  Low:    { color:'#4a4a6a', bg:'rgba(74,74,106,0.15)'  },
}

const PRIORITIES = ['High', 'Medium', 'Low'] as const
const PERSONAL_PRIORITY_KEY = 'personal_priority'

type Item = {
  id: string; name: string; priority: string; notes: string | null
  notion_url: string | null; archived: boolean; created_at: string
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? { color: C.muted, bg: 'transparent' }
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.bg, border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {priority}
    </span>
  )
}

function ItemCard({ item, onToggleDone, onEdit }: {
  item: Item
  onToggleDone: (id: string, archived: boolean) => void
  onEdit: (item: Item) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const m = PRIORITY_META[item.priority]
  const isDone = item.archived

  return (
    <div
      style={{
        background: C.card,
        border: '1px solid ' + (isDone ? C.border : (expanded ? (m?.color ?? C.cyan) + '40' : C.border)),
        borderRadius: '1rem', padding: '1rem',
        transition: 'border-color 0.2s', opacity: isDone ? 0.55 : 1,
        boxShadow: expanded && !isDone ? '0 0 18px ' + (m?.color ?? C.cyan) + '10' : 'none',
      }}>
      {/* Top row: badges + actions */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
        <PriorityBadge priority={item.priority} />
        {isDone && (
          <span style={{ fontSize:'0.6rem', fontWeight:700, color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>Done</span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:'0.35rem', alignItems:'center' }}>
          {/* Edit */}
          <button
            onClick={() => onEdit(item)}
            title="Edit"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', background:'none', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer' }}>
            <Pencil size={11}/>
          </button>
          {/* Done / Restore */}
          <button
            onClick={() => onToggleDone(item.id, !item.archived)}
            title={isDone ? 'Restore' : 'Mark done'}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', background: isDone ? 'rgba(0,255,136,0.08)' : 'none', border:'1px solid '+(isDone ? 'rgba(0,255,136,0.3)' : C.border), borderRadius:'0.4rem', color: isDone ? C.green : C.muted, cursor:'pointer' }}>
            {isDone ? <RotateCcw size={11}/> : <Check size={11}/>}
          </button>
        </div>
      </div>

      {/* Name */}
      <h3
        onClick={() => item.notes && setExpanded(e => !e)}
        style={{ fontSize:'0.9rem', fontWeight:800, color: isDone ? C.sec : C.text, margin:'0 0 0.35rem', lineHeight:1.35,
          textDecoration: isDone ? 'line-through' : 'none', cursor: item.notes ? 'pointer' : 'default' }}>
        {item.name}
      </h3>

      {/* Notes preview or expand */}
      {item.notes && !expanded && (
        <p onClick={() => setExpanded(true)} style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.35rem', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }}>
          {item.notes}
        </p>
      )}
      {item.notes && expanded && (
        <div onClick={() => setExpanded(false)} style={{ cursor:'pointer' }}>
          <p style={{ fontSize:'0.75rem', color:C.sec, margin:'0 0 0.35rem', lineHeight:1.65, whiteSpace:'pre-wrap' }}>{item.notes}</p>
        </div>
      )}

      {/* Notion link + date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.35rem' }}>
        {item.notion_url ? (
          <a href={item.notion_url} target="_blank" rel="noreferrer"
            style={{ fontSize:'0.6rem', color:C.muted, border:'1px solid '+C.border, borderRadius:'0.25rem', padding:'0.1rem 0.35rem', textDecoration:'none' }}>
            Notion &#8599;
          </a>
        ) : <span />}
        <span style={{ fontSize:'0.62rem', color:C.muted }}>
          {new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
        </span>
      </div>
    </div>
  )
}

function ItemModal({ item, onSave, onClose }: {
  item: Item | null
  onSave: (id: string | null, name: string, priority: string, notes: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]         = useState(item?.name ?? '')
  const [priority, setPriority] = useState(item?.priority ?? 'Medium')
  const [notes, setNotes]       = useState(item?.notes ?? '')
  const [saving, setSaving]     = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave(item?.id ?? null, name.trim(), priority, notes.trim())
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'24rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>{item ? 'Edit Item' : 'New Item'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16}/></button>
        </div>
        <input
          value={name} onChange={e => setName(e.target.value)} placeholder="Item name..."
          onKeyDown={e => { if (e.key==='Enter') submit() }}
          style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.6rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', marginBottom:'0.75rem' }}/>
        <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Priority</p>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.875rem' }}>
          {PRIORITIES.map(p => {
            const m = PRIORITY_META[p]
            return (
              <button key={p} onClick={() => setPriority(p)} style={{ flex:1, padding:'0.4rem', borderRadius:'0.4rem', border:'1px solid '+(priority===p?m.color:C.border), background:priority===p?m.bg:'transparent', color:priority===p?m.color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>{p}</button>
            )
          })}
        </div>
        <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Notes</p>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={3}
          style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.6rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', boxSizing:'border-box', resize:'vertical', marginBottom:'1rem' }}/>
        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} style={{ padding:'0.5rem 1.25rem', background:C.cyan, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:saving||!name.trim()?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:saving||!name.trim()?0.5:1 }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function PersonalPage() {
  const router = useRouter()
  const [items, setItems]               = useState<Item[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterPriority, setFilter]     = useState<string | null>(null)
  const [filterDone, setFilterDone]     = useState<'all' | 'active' | 'done'>('all')
  const [editItem, setEditItem]         = useState<Item | null | 'new'>('new' as unknown as Item | null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [priorityView, setPriorityView]     = useState(false)
  const [pPriorityOrder, setPPriorityOrder] = useState<string[]>([])
  const [pDragId, setPDragId]               = useState<string|null>(null)
  const [pDragOver, setPDragOver]           = useState<string|null>(null)
  const [pDragFrom, setPDragFrom]           = useState<'unassigned'|'priority'|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('personal_items').select('*').order('archived').order('priority').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let pLsLoaded = false
    try {
      const raw = localStorage.getItem('fs_p_personal')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setPPriorityOrder(ids); pLsLoaded = true } }
    } catch {}
    async function init() {
      const [, { data: pdata }] = await Promise.all([
        load(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', PERSONAL_PRIORITY_KEY).single()
      ])
      if (pdata?.ordered_ids && Array.isArray(pdata.ordered_ids) && (pdata.ordered_ids as string[]).length > 0) {
        const ids = pdata.ordered_ids as string[]
        setPPriorityOrder(ids)
        try { localStorage.setItem('fs_p_personal', JSON.stringify(ids)) } catch {}
      } else if (!pLsLoaded) {
        const { data: rows } = await supabase.from('personal_items').select('id').neq('archived', true).order('created_at', { ascending: false })
        if (rows && rows.length > 0) {
          const allIds = (rows as { id: string }[]).map(r => r.id)
          setPPriorityOrder(allIds)
          try { localStorage.setItem('fs_p_personal', JSON.stringify(allIds)) } catch {}
          supabase.from('priority_lists').upsert({ key: PERSONAL_PRIORITY_KEY, ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
        }
      }
    }
    init()
  }, [load])

  const handleToggleDone = async (id: string, archived: boolean) => {
    await supabase.from('personal_items').update({ archived }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, archived } : i))
  }

  const handleSave = async (id: string | null, name: string, priority: string, notes: string) => {
    if (id) {
      await supabase.from('personal_items').update({ name, priority, notes: notes || null }).eq('id', id)
      setItems(prev => prev.map(i => i.id === id ? { ...i, name, priority, notes: notes || null } : i))
    } else {
      const { data } = await supabase.from('personal_items').insert({ name, priority, notes: notes || null, archived: false }).select().single()
      if (data) setItems(prev => [...prev, data as Item])
    }
  }

  const openEdit = (item: Item | null) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  function savePPriority(order: string[]) {
    const y = window.scrollY
    setPPriorityOrder(order)
    try { localStorage.setItem('fs_p_personal', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: PERSONAL_PRIORITY_KEY, ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  const activeCount = items.filter(i => !i.archived).length
  const doneCount   = items.filter(i =>  i.archived).length

  const visible = items.filter(i => {
    if (filterDone === 'active' && i.archived)  return false
    if (filterDone === 'done'   && !i.archived) return false
    if (filterPriority && i.priority !== filterPriority) return false
    return true
  })

  const highCount = items.filter(i => i.priority === 'High'   && !i.archived).length
  const medCount  = items.filter(i => i.priority === 'Medium' && !i.archived).length
  const lowCount  = items.filter(i => i.priority === 'Low'    && !i.archived).length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,212,255,0.04) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <User size={22} color={C.cyan}/> Personal
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {activeCount} active &mdash; {doneCount} done
              </p>
            </div>
            <button onClick={() => openEdit(null)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-start' }}>
              <Plus size={14}/> Add Item
            </button>
          </div>

          {/* Priority chips (active only) */}
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
            {highCount > 0 && <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.07)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px' }}><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.red }}/><span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{highCount} high</span></div>}
            {medCount  > 0 && <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,184,0,0.07)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px' }}><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.amber }}/><span style={{ fontSize:'0.7rem', fontWeight:700, color:C.amber }}>{medCount} medium</span></div>}
            {lowCount  > 0 && <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(74,74,106,0.15)', border:'1px solid rgba(74,74,106,0.35)', borderRadius:'9999px' }}><div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.muted }}/><span style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted }}>{lowCount} low</span></div>}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.875rem', alignItems:'center' }}>
            {/* Show filter */}
            {(['all','active','done'] as const).map(v => (
              <button key={v} onClick={() => setFilterDone(v)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background: filterDone===v ? 'rgba(255,255,255,0.07)' : C.card, border:'1px solid '+(filterDone===v ? 'rgba(255,255,255,0.2)' : C.border), color: filterDone===v ? C.text : C.sec, textTransform:'capitalize' }}>
                {v === 'all' ? `All (${items.length})` : v === 'active' ? `Active (${activeCount})` : `Done (${doneCount})`}
              </button>
            ))}
            <span style={{ width:'1px', height:'20px', background:C.border, display:'inline-block', margin:'0 0.15rem' }}/>
            {/* Priority filter */}
            {PRIORITIES.map(p => {
              const m = PRIORITY_META[p]
              const active = filterPriority === p
              const count = items.filter(i => i.priority === p).length
              if (count === 0) return null
              return (
                <button key={p} onClick={() => setFilter(active ? null : p)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:active ? m.bg : C.card, border:'1px solid '+(active ? m.color+'60' : C.border), color:active ? m.color : C.sec }}>
                  {p} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'1.5rem 2rem' }}>

        {/* View toggle */}
        {!loading && items.length > 0 && (() => {
          const activeItems = items.filter(i => !i.archived)
          const pValid = pPriorityOrder.filter(id => activeItems.some(i => i.id === id))
          const pUnassigned = activeItems.filter(i => !pValid.includes(i.id))
          return (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
              <button onClick={() => setPriorityView(false)} style={{ padding:'0.35rem 0.875rem', borderRadius:'9999px', border:'1px solid '+(priorityView ? C.border : C.cyan+'60'), background: priorityView ? 'transparent' : 'rgba(0,212,255,0.1)', color: priorityView ? C.muted : C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s' }}>
                All Items
              </button>
              <button onClick={() => setPriorityView(true)} style={{ padding:'0.35rem 0.875rem', borderRadius:'9999px', border:'1px solid '+(priorityView ? '#ff6b3560' : C.border), background: priorityView ? 'rgba(255,107,53,0.1)' : 'transparent', color: priorityView ? '#ff6b35' : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                Priority View
                {pUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{pUnassigned.length}</span>}
              </button>
            </div>
          )
        })()}

        {/* Priority view */}
        {priorityView && !loading && (() => {
          const activeItems = items.filter(i => !i.archived)
          const pValid = pPriorityOrder.filter(id => activeItems.some(i => i.id === id))
          const pAssigned = new Set(pValid)
          const pUnassigned = activeItems.filter(i => !pAssigned.has(i.id))
          return (
            <div>
              {/* Unassigned zone */}
              <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                  {pUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{pUnassigned.length}</span>}
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into priority list to rank</p>
                </div>
                {pUnassigned.length === 0 ? (
                  <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                    <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All items assigned</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                    onDragOver={e => { e.preventDefault(); setPDragOver('unassigned-zone') }}
                    onDrop={e => {
                      e.preventDefault()
                      if (pDragFrom === 'priority' && pDragId) savePPriority(pValid.filter(i => i !== pDragId))
                      setPDragId(null); setPDragOver(null); setPDragFrom(null)
                    }}>
                    {pUnassigned.map(item => (
                      <div key={item.id} draggable
                        onDragStart={() => { setPDragId(item.id); setPDragFrom('unassigned') }}
                        onDragEnd={() => { setPDragId(null); setPDragOver(null); setPDragFrom(null) }}
                        style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', cursor:'grab', opacity: pDragId===item.id ? 0.4 : 1 }}>
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.name}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority list */}
              <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{pValid.length} items ranked</p>
                </div>
                {pValid.length === 0 ? (
                  <div style={{ padding:'2.5rem 1.5rem', textAlign:'center', border:'2px dashed '+(pDragOver==='p-priority-empty' ? '#ff6b35' : C.border), borderRadius:'0.875rem', background: pDragOver==='p-priority-empty' ? 'rgba(255,107,53,0.05)' : 'transparent', transition:'all 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setPDragOver('p-priority-empty') }}
                    onDrop={e => { e.preventDefault(); if (pDragFrom==='unassigned'&&pDragId) savePPriority([pDragId]); setPDragId(null); setPDragOver(null); setPDragFrom(null) }}>
                    <p style={{ fontSize:'0.82rem', color:C.muted, margin:0 }}>Drag items here to start ranking</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                    {pValid.map((id, idx) => {
                      const item = activeItems.find(i => i.id === id)
                      if (!item) return null
                      return (
                        <div key={id} draggable
                          onDragStart={() => { setPDragId(id); setPDragFrom('priority') }}
                          onDragEnd={() => { setPDragId(null); setPDragOver(null); setPDragFrom(null) }}
                          onDragOver={e => { e.preventDefault(); setPDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && pDragOver===id) setPDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (pDragFrom==='unassigned'&&pDragId) { const o=[...pValid]; o.splice(idx,0,pDragId); savePPriority(o) }
                            else if (pDragFrom==='priority'&&pDragId&&pDragId!==id) { const w=pValid.filter(i=>i!==pDragId); w.splice(w.indexOf(id),0,pDragId); savePPriority(w) }
                            setPDragId(null); setPDragOver(null); setPDragFrom(null)
                          }}
                          style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background: pDragOver===id ? 'rgba(255,107,53,0.07)' : C.card, border:'1px solid '+(pDragOver===id ? '#ff6b35' : C.border), borderRadius:'0.75rem', cursor:'grab', opacity: pDragId===id ? 0.4 : 1, transition:'background 0.1s, border-color 0.1s' }}>
                          <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:700, minWidth:'1.25rem', userSelect:'none' as const }}>{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.name}</span>
                          <PriorityBadge priority={item.priority} />
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePPriority([id, ...pValid.filter(i=>i!==id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePPriority([...pValid.filter(i=>i!==id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button type="button" draggable={false} onClick={e => { e.stopPropagation(); savePPriority(pValid.filter(i=>i!==id)) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}>x</button>
                        </div>
                      )
                    })}
                    {/* Drop on bottom */}
                    <div style={{ height:'2rem', borderRadius:'0.75rem', border:'2px dashed '+(pDragOver==='__p_bottom__' ? '#ff6b35' : 'transparent'), background: pDragOver==='__p_bottom__' ? 'rgba(255,107,53,0.05)' : 'transparent', transition:'all 0.15s', marginTop:'0.25rem' }}
                      onDragOver={e => { e.preventDefault(); setPDragOver('__p_bottom__') }}
                      onDrop={e => {
                        e.preventDefault()
                        if (pDragFrom==='unassigned'&&pDragId) savePPriority([...pValid,pDragId])
                        else if (pDragFrom==='priority'&&pDragId) savePPriority([...pValid.filter(i=>i!==pDragId),pDragId])
                        setPDragId(null); setPDragOver(null); setPDragFrom(null)
                      }} />
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Grid (normal view) */}
        {!priorityView && (loading ? (
          <p style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</p>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 1rem', color:C.muted }}>
            <User size={40} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p style={{ fontSize:'1rem', color:C.sec, fontWeight:700 }}>{items.length === 0 ? 'No items yet' : 'No items match your filter'}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:'0.72rem', color:C.muted, marginBottom:'1rem' }}>{visible.length} item{visible.length !== 1 ? 's' : ''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
              {visible.map(i => (
                <ItemCard key={i.id} item={i} onToggleDone={handleToggleDone} onEdit={openEdit} />
              ))}
            </div>
          </>
        ))}
      </div>

      {modalOpen && (
        <ItemModal
          item={selectedItem}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setSelectedItem(null) }}
        />
      )}

      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,212,255,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
        button:hover{opacity:0.85}
        input:focus{border-color:#00d4ff !important}
        textarea:focus{border-color:#00d4ff !important}
      `}</style>
    </main>
  )
}
