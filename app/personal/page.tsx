'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

type Item = {
  id: string; name: string; priority: string; notes: string | null; notion_url: string | null; archived: boolean
}

const PRIORITIES = ['High', 'Medium', 'Low'] as const
const PRIORITY_COLOR: Record<string, string> = { High: C.red, Medium: C.amber, Low: C.muted }

function ItemCard({ item, onArchive }: { item: Item; onArchive: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const color = PRIORITY_COLOR[item.priority] ?? C.muted
  return (
    <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '0.75rem', overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', cursor: item.notes ? 'pointer' : 'default' }}
        onClick={() => item.notes && setOpen(o => !o)}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{item.name}</span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {item.notion_url && (
            <a href={item.notion_url} target="_blank" rel="noreferrer"
              style={{ fontSize: '0.6rem', color: C.muted, border: '1px solid ' + C.border, borderRadius: '0.25rem', padding: '0.1rem 0.3rem', textDecoration: 'none' }}
              onClick={e => e.stopPropagation()}>Notion</a>
          )}
          <button onClick={e => { e.stopPropagation(); setBusy(true); onArchive(item.id) }}
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
            <Check size={13} />
          </button>
          {item.notes && (
            <span style={{ color: C.muted }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          )}
        </div>
      </div>
      {open && item.notes && (
        <div style={{ padding: '0 1rem 0.75rem', borderTop: '1px solid ' + C.border }}>
          <p style={{ fontSize: '0.78rem', color: C.sec, margin: '0.5rem 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.notes}</p>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem', width: '90%', maxWidth: '26rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.text }}>New Item</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name..."
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: C.text, fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid ' + (priority === p ? PRIORITY_COLOR[p] : C.border), background: priority === p ? 'rgba(255,255,255,0.05)' : 'transparent', color: priority === p ? PRIORITY_COLOR[p] : C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700 }}>{p}</button>
          ))}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)..." rows={3}
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: C.text, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '1rem' }} />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} style={{ padding: '0.5rem 1.25rem', background: C.cyan, border: 'none', borderRadius: '0.625rem', color: '#000', fontWeight: 700, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', opacity: saving || !name.trim() ? 0.5 : 1 }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function PersonalPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('personal_items').select('*').neq('archived', true).order('priority').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleArchive = async (id: string) => {
    await supabase.from('personal_items').update({ archived: true }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const handleAdd = async (name: string, priority: string, notes: string) => {
    const { data } = await supabase.from('personal_items').insert({ name, priority, notes: notes || null, archived: false }).select().single()
    if (data) setItems(prev => [...prev, data as Item])
  }

  const priorityOrder = ['High', 'Medium', 'Low']
  const filtered = filter ? items.filter(i => i.priority === filter) : items
  const grouped = priorityOrder.reduce<Record<string, Item[]>>((acc, p) => {
    acc[p] = filtered.filter(i => i.priority === p)
    return acc
  }, {})

  const counts = priorityOrder.reduce<Record<string, number>>((acc, p) => {
    acc[p] = items.filter(i => i.priority === p).length
    return acc
  }, {})

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid ' + C.border, flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} />Home
          </button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontWeight: 800, color: C.text }}>Personal</span>
          {loading && <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setFilter(null)} style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', border: '1px solid ' + (filter === null ? C.cyan : C.border), background: filter === null ? 'rgba(0,212,255,0.08)' : 'transparent', color: filter === null ? C.cyan : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>All ({items.length})</button>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setFilter(filter === p ? null : p)} style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', border: '1px solid ' + (filter === p ? PRIORITY_COLOR[p] : C.border), background: filter === p ? 'rgba(255,255,255,0.05)' : 'transparent', color: filter === p ? PRIORITY_COLOR[p] : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{p} ({counts[p]})</button>
          ))}
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid ' + C.cyan, background: 'rgba(0,212,255,0.08)', color: C.cyan, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            <Plus size={13} />Add
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
        {PRIORITIES.map(priority => {
          const group = grouped[priority]
          if (!group || group.length === 0) return null
          return (
            <div key={priority} style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: PRIORITY_COLOR[priority] }} />
                <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PRIORITY_COLOR[priority] }}>{priority}</h2>
                <span style={{ fontSize: '0.7rem', color: C.muted }}>({group.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {group.map(item => <ItemCard key={item.id} item={item} onArchive={handleArchive} />)}
              </div>
            </div>
          )
        })}
        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.muted }}>
            <p style={{ fontSize: '0.9rem' }}>No items yet.</p>
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
      `}</style>
    </main>
  )
}
