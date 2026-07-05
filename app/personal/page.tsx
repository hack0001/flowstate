'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Check, ChevronDown, ChevronUp, RotateCcw, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const PRIORITY_META: Record<string, { color: string; bg: string; label: string }> = {
  High:   { color:'#ff4466', bg:'rgba(255,68,102,0.1)',  label:'High'   },
  Medium: { color:'#ffb800', bg:'rgba(255,184,0,0.1)',   label:'Medium' },
  Low:    { color:'#4a4a6a', bg:'rgba(74,74,106,0.15)',  label:'Low'    },
}

const PRIORITIES = ['High', 'Medium', 'Low'] as const

type Item = {
  id: string; name: string; priority: string; notes: string | null
  notion_url: string | null; archived: boolean; created_at: string
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? { color: C.muted, bg: 'transparent', label: priority }
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.bg, border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {m.label}
    </span>
  )
}

function ItemCard({ item, onDone, onRestore }: { item: Item; onDone?: (id: string) => void; onRestore?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const m = PRIORITY_META[item.priority]
  const isDone = item.archived

  return (
    <div
      onClick={() => item.notes && setExpanded(e => !e)}
      style={{
        background: C.card,
        border: '1px solid ' + (expanded ? (m?.color ?? C.cyan) + '40' : C.border),
        borderRadius: '1rem', padding: '1rem',
        cursor: item.notes ? 'pointer' : 'default',
        transition: 'border-color 0.2s', opacity: isDone ? 0.65 : 1,
        boxShadow: expanded ? '0 0 18px ' + (m?.color ?? C.cyan) + '10' : 'none',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
        <PriorityBadge priority={item.priority} />
        {item.notes && (
          <span style={{ fontSize:'0.6rem', color:C.muted, marginLeft:'auto' }}>
            {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </span>
        )}
      </div>

      <h3 style={{ fontSize:'0.9rem', fontWeight:800, color: isDone ? C.sec : C.text, margin:'0 0 0.6rem', lineHeight:1.35,
        textDecoration: isDone ? 'line-through' : 'none' }}>
        {item.name}
      </h3>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.25rem' }}>
        {item.notion_url ? (
          <a href={item.notion_url} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize:'0.6rem', color:C.muted, border:'1px solid '+C.border, borderRadius:'0.25rem', padding:'0.1rem 0.35rem', textDecoration:'none' }}>
            Notion &#8599;
          </a>
        ) : <span />}

        {onDone && !isDone && (
          <button
            onClick={e => { e.stopPropagation(); onDone(item.id) }}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.muted, cursor:'pointer', padding:'0.2rem 0.5rem', fontSize:'0.62rem', fontWeight:700 }}>
            <Check size={11}/> Done
          </button>
        )}
        {onRestore && isDone && (
          <button
            onClick={e => { e.stopPropagation(); onRestore(item.id) }}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.muted, cursor:'pointer', padding:'0.2rem 0.5rem', fontSize:'0.62rem', fontWeight:700 }}>
            <RotateCcw size={11}/> Restore
          </button>
        )}
      </div>

      {expanded && item.notes && (
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.65, whiteSpace:'pre-wrap' }}>{item.notes}</p>
          <p style={{ fontSize:'0.65rem', color:C.muted, margin:'0.5rem 0 0' }}>
            Added {new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </p>
        </div>
      )}
    </div>
  )
}

function AddModal({ onSave, onClose }: { onSave: (name: string, priority: string, notes: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim(), priority, notes.trim())
    onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'24rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>New Item</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16}/></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Item name..."
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
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={3}
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
  const [items, setItems] = useState<Item[]>([])
  const [done, setDone] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [activeRes, doneRes] = await Promise.all([
      supabase.from('personal_items').select('*').neq('archived', true).order('priority').order('name'),
      supabase.from('personal_items').select('*').eq('archived', true).order('name'),
    ])
    setItems(activeRes.data ?? [])
    setDone(doneRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDone = async (id: string) => {
    await supabase.from('personal_items').update({ archived: true }).eq('id', id)
    const item = items.find(x => x.id === id)
    if (item) {
      setItems(prev => prev.filter(x => x.id !== id))
      setDone(prev => [{ ...item, archived: true }, ...prev])
    }
  }

  const handleRestore = async (id: string) => {
    await supabase.from('personal_items').update({ archived: false }).eq('id', id)
    const item = done.find(x => x.id === id)
    if (item) {
      setDone(prev => prev.filter(x => x.id !== id))
      setItems(prev => [...prev, { ...item, archived: false }].sort((a, b) => (a.priority ?? '').localeCompare(b.priority ?? '')))
    }
  }

  const handleAdd = async (name: string, priority: string, notes: string) => {
    const { data } = await supabase.from('personal_items').insert({ name, priority, notes: notes || null, archived: false }).select().single()
    if (data) setItems(prev => [...prev, data as Item])
  }

  const filtered = filterPriority ? items.filter(i => i.priority === filterPriority) : items

  const highCount   = items.filter(i => i.priority === 'High').length
  const medCount    = items.filter(i => i.priority === 'Medium').length
  const lowCount    = items.filter(i => i.priority === 'Low').length

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
                {items.length} active &mdash; {done.length} done
              </p>
            </div>
            <button onClick={() => setAdding(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-start' }}>
              <Plus size={14}/> Add Item
            </button>
          </div>

          {/* Priority chips */}
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
            {highCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.07)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{highCount} high</span>
              </div>
            )}
            {medCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,184,0,0.07)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.amber }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.amber }}>{medCount} medium</span>
              </div>
            )}
            {lowCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(74,74,106,0.15)', border:'1px solid rgba(74,74,106,0.35)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.muted }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted }}>{lowCount} low</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.875rem', alignItems:'center' }}>
            <button onClick={() => setFilterPriority(null)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:!filterPriority ? 'rgba(255,255,255,0.07)' : C.card, border:'1px solid '+(!filterPriority ? 'rgba(255,255,255,0.2)' : C.border), color:!filterPriority ? C.text : C.sec }}>
              All <span style={{ opacity:0.6 }}>({items.length})</span>
            </button>
            {PRIORITIES.map(p => {
              const m = PRIORITY_META[p]
              const active = filterPriority === p
              const count = items.filter(i => i.priority === p).length
              if (count === 0) return null
              return (
                <button key={p} onClick={() => setFilterPriority(active ? null : p)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:active ? m.bg : C.card, border:'1px solid '+(active ? m.color+'60' : C.border), color:active ? m.color : C.sec }}>
                  {p} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {loading ? (
          <p style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</p>
        ) : filtered.length === 0 && items.length > 0 ? (
          <p style={{ color:C.muted, fontSize:'0.85rem' }}>No items match your filter.</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 1rem', color:C.muted }}>
            <User size={40} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p style={{ fontSize:'1rem', color:C.sec, fontWeight:700 }}>No items yet</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:'0.72rem', color:C.muted, marginBottom:'1rem' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
              {filtered.map(i => <ItemCard key={i.id} item={i} onDone={handleDone} />)}
            </div>
          </>
        )}

        {/* Done section */}
        {done.length > 0 && (
          <div style={{ marginTop:'2.5rem' }}>
            <button
              onClick={() => setShowDone(s => !s)}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', marginBottom:'1rem' }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>Done ({done.length})</span>
              {showDone ? <ChevronUp size={14} color={C.muted}/> : <ChevronDown size={14} color={C.muted}/>}
            </button>
            {showDone && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
                {done.map(i => <ItemCard key={i.id} item={i} onRestore={handleRestore} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {adding && <AddModal onSave={handleAdd} onClose={() => setAdding(false)} />}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
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
