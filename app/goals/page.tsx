'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

type Goal = {
  id: string; name: string; priority: string | null; status: string | null
  is_top_level: boolean; notion_url: string | null; archived: boolean
}

const STATUS_COLOR: Record<string, string> = { Green: C.green, Yellow: C.amber, Red: C.red }
const PRIORITY_COLOR: Record<string, string> = { P0: C.red, P1: C.amber, P2: C.muted }
const STATUSES = ['Green', 'Yellow', 'Red'] as const
const PRIORITIES = ['P0', 'P1', 'P2'] as const

function GoalCard({ goal, onArchive }: { goal: Goal; onArchive: (id: string) => void }) {
  const statusColor = goal.status ? STATUS_COLOR[goal.status] ?? C.muted : C.muted
  const priorityColor = goal.priority ? PRIORITY_COLOR[goal.priority] ?? C.muted : C.muted
  return (
    <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{goal.name}</span>
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
        {goal.priority && (
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: priorityColor, border: '1px solid ' + priorityColor, borderRadius: '0.25rem', padding: '0.1rem 0.35rem' }}>{goal.priority}</span>
        )}
        {goal.status && (
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: statusColor, border: '1px solid ' + statusColor, borderRadius: '0.25rem', padding: '0.1rem 0.35rem', opacity: 0.85 }}>{goal.status}</span>
        )}
        {goal.is_top_level && (
          <span style={{ fontSize: '0.6rem', color: C.cyan, border: '1px solid rgba(0,212,255,0.3)', borderRadius: '0.25rem', padding: '0.1rem 0.35rem' }}>Top</span>
        )}
        {goal.notion_url && (
          <a href={goal.notion_url} target="_blank" rel="noreferrer"
            style={{ fontSize: '0.6rem', color: C.muted, border: '1px solid ' + C.border, borderRadius: '0.25rem', padding: '0.1rem 0.3rem', textDecoration: 'none' }}>Notion</a>
        )}
        <button onClick={() => onArchive(goal.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}

function AddModal({ onSave, onClose }: { onSave: (name: string, priority: string, status: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('P1')
  const [status, setStatus] = useState('Yellow')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim(), priority, status)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem', width: '90%', maxWidth: '24rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.text }}>New Goal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name..."
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: C.text, fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
        <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: '0 0 0.4rem' }}>Priority</p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid ' + (priority === p ? PRIORITY_COLOR[p] : C.border), background: priority === p ? 'rgba(255,255,255,0.05)' : 'transparent', color: priority === p ? PRIORITY_COLOR[p] : C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700 }}>{p}</button>
          ))}
        </div>
        <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, margin: '0 0 0.4rem' }}>Status</p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid ' + (status === s ? STATUS_COLOR[s] : C.border), background: status === s ? 'rgba(255,255,255,0.05)' : 'transparent', color: status === s ? STATUS_COLOR[s] : C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700 }}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} style={{ padding: '0.5rem 1.25rem', background: C.green, border: 'none', borderRadius: '0.625rem', color: '#000', fontWeight: 700, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', opacity: saving || !name.trim() ? 0.5 : 1 }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').neq('archived', true).order('priority').order('name')
    setGoals(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleArchive = async (id: string) => {
    await supabase.from('goals').update({ archived: true }).eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const handleAdd = async (name: string, priority: string, status: string) => {
    const { data } = await supabase.from('goals').insert({ name, priority, status, archived: false }).select().single()
    if (data) setGoals(prev => [...prev, data as Goal])
  }

  const filtered = goals.filter(g => {
    if (filterStatus && g.status !== filterStatus) return false
    if (filterPriority && g.priority !== filterPriority) return false
    return true
  })

  const topLevel = filtered.filter(g => g.is_top_level)
  const subGoals = filtered.filter(g => !g.is_top_level)

  const statusCounts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = goals.filter(g => g.status === s).length
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
          <span style={{ fontWeight: 800, color: C.text }}>Goals</span>
          {loading && <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid ' + C.green, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)} style={{ fontSize: '0.7rem', padding: '0.3rem 0.65rem', borderRadius: '0.4rem', border: '1px solid ' + (filterStatus === s ? STATUS_COLOR[s] : C.border), background: filterStatus === s ? 'rgba(255,255,255,0.04)' : 'transparent', color: filterStatus === s ? STATUS_COLOR[s] : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{s} ({statusCounts[s]})</button>
          ))}
          <div style={{ width: '1px', height: '20px', background: C.border }} />
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setFilterPriority(filterPriority === p ? null : p)} style={{ fontSize: '0.7rem', padding: '0.3rem 0.65rem', borderRadius: '0.4rem', border: '1px solid ' + (filterPriority === p ? PRIORITY_COLOR[p] : C.border), background: filterPriority === p ? 'rgba(255,255,255,0.04)' : 'transparent', color: filterPriority === p ? PRIORITY_COLOR[p] : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
          ))}
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid ' + C.green, background: 'rgba(0,255,136,0.08)', color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            <Plus size={13} />Add
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
        {topLevel.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.cyan }}>Top Level Goals ({topLevel.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {topLevel.map(g => <GoalCard key={g.id} goal={g} onArchive={handleArchive} />)}
            </div>
          </div>
        )}
        {subGoals.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.sec }}>Sub Goals ({subGoals.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {subGoals.map(g => <GoalCard key={g.id} goal={g} onArchive={handleArchive} />)}
            </div>
          </div>
        )}
        {!loading && goals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.muted }}>
            <p style={{ fontSize: '0.9rem' }}>No goals yet.</p>
          </div>
        )}
      </div>

      {adding && <AddModal onSave={handleAdd} onClose={() => setAdding(false)} />}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,255,136,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>
    </main>
  )
}
