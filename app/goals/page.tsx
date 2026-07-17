'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Check, ChevronDown, ChevronUp, RotateCcw, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/context/LanguageContext'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  Green:  { color: '#00ff88', bg: 'rgba(0,255,136,0.1)' },
  Yellow: { color: '#ffb800', bg: 'rgba(255,184,0,0.1)' },
  Red:    { color: '#ff4466', bg: 'rgba(255,68,102,0.1)' },
}

const PRIORITY_META: Record<string, { color: string }> = {
  P0: { color: '#ff4466' },
  P1: { color: '#ffb800' },
  P2: { color: '#4a4a6a' },
}

const STATUSES  = ['Green', 'Yellow', 'Red'] as const
const PRIORITIES = ['P0', 'P1', 'P2'] as const

type Goal = {
  id: string; name: string; priority: string | null; status: string | null
  is_top_level: boolean; notion_url: string | null; archived: boolean; created_at: string
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const m = STATUS_META[status] ?? { color: C.muted, bg: 'transparent' }
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.bg, border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null
  const m = PRIORITY_META[priority] ?? { color: C.muted }
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', color:m.color, background:m.color+'18', border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {priority}
    </span>
  )
}

function GoalCard({ goal, onDone, onRestore }: { goal: Goal; onDone?: (id: string) => void; onRestore?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const sm = goal.status ? STATUS_META[goal.status] : null
  const isDone = goal.archived

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: C.card,
        border: '1px solid ' + (expanded ? (sm?.color ?? C.cyan) + '40' : C.border),
        borderRadius: '1rem', padding: '1rem', cursor: 'pointer',
        transition: 'border-color 0.2s', opacity: isDone ? 0.65 : 1,
        boxShadow: expanded ? '0 0 18px ' + (sm?.color ?? C.cyan) + '10' : 'none',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
        <PriorityBadge priority={goal.priority} />
        {goal.is_top_level && (
          <span style={{ fontSize:'0.6rem', fontWeight:700, color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>Top</span>
        )}
        <span style={{ marginLeft:'auto' }}><StatusBadge status={goal.status} /></span>
      </div>

      <h3 style={{ fontSize:'0.9rem', fontWeight:800, color: isDone ? C.sec : C.text, margin:'0 0 0.6rem', lineHeight:1.35,
        textDecoration: isDone ? 'line-through' : 'none' }}>
        {goal.name}
      </h3>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.25rem' }}>
        <span />

        {onDone && !isDone && (
          <button
            onClick={e => { e.stopPropagation(); onDone(goal.id) }}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.muted, cursor:'pointer', padding:'0.2rem 0.5rem', fontSize:'0.62rem', fontWeight:700 }}>
            <Check size={11} /> Done
          </button>
        )}
        {onRestore && isDone && (
          <button
            onClick={e => { e.stopPropagation(); onRestore(goal.id) }}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.muted, cursor:'pointer', padding:'0.2rem 0.5rem', fontSize:'0.62rem', fontWeight:700 }}>
            <RotateCcw size={11} /> Restore
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}>
            Added {new Date(goal.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </p>
        </div>
      )}
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'24rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>New Goal</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16}/></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name..."
          onKeyDown={e => { if (e.key==='Enter') submit() }}
          style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.6rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none', boxSizing:'border-box', marginBottom:'0.75rem' }}/>
        <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Priority</p>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.875rem' }}>
          {PRIORITIES.map(p => {
            const m = PRIORITY_META[p]
            return (
              <button key={p} onClick={() => setPriority(p)} style={{ flex:1, padding:'0.4rem', borderRadius:'0.4rem', border:'1px solid '+(priority===p?m.color:C.border), background:priority===p?m.color+'18':'transparent', color:priority===p?m.color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>{p}</button>
            )
          })}
        </div>
        <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Status</p>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem' }}>
          {STATUSES.map(s => {
            const m = STATUS_META[s]
            return (
              <button key={s} onClick={() => setStatus(s)} style={{ flex:1, padding:'0.4rem', borderRadius:'0.4rem', border:'1px solid '+(status===s?m.color:C.border), background:status===s?m.bg:'transparent', color:status===s?m.color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>{s}</button>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} style={{ padding:'0.5rem 1.25rem', background:C.green, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:saving||!name.trim()?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:saving||!name.trim()?0.5:1 }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [goals, setGoals] = useState<Goal[]>([])
  const [done, setDone] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [activeRes, doneRes] = await Promise.all([
      supabase.from('goals').select('*').neq('archived', true).order('priority').order('name'),
      supabase.from('goals').select('*').eq('archived', true).order('name'),
    ])
    setGoals(activeRes.data ?? [])
    setDone(doneRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDone = async (id: string) => {
    await supabase.from('goals').update({ archived: true }).eq('id', id)
    const g = goals.find(x => x.id === id)
    if (g) {
      setGoals(prev => prev.filter(x => x.id !== id))
      setDone(prev => [{ ...g, archived: true }, ...prev])
    }
  }

  const handleRestore = async (id: string) => {
    await supabase.from('goals').update({ archived: false }).eq('id', id)
    const g = done.find(x => x.id === id)
    if (g) {
      setDone(prev => prev.filter(x => x.id !== id))
      setGoals(prev => [...prev, { ...g, archived: false }].sort((a, b) => (a.priority ?? '').localeCompare(b.priority ?? '')))
    }
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

  const statusCounts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = goals.filter(g => g.status === s).length
    return acc
  }, {})

  const greenCount  = goals.filter(g => g.status === 'Green').length
  const yellowCount = goals.filter(g => g.status === 'Yellow').length
  const redCount    = goals.filter(g => g.status === 'Red').length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,255,136,0.04) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> {t('back')}
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Target size={22} color={C.green}/> {t('goals')}
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {goals.length} {t('active')} &mdash; {done.length} {t('done')}
              </p>
            </div>
            <button onClick={() => setAdding(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-start' }}>
              <Plus size={14}/> {t('addGoal')}
            </button>
          </div>

          {/* Status chips */}
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
            {greenCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(0,255,136,0.07)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.green }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.green }}>{greenCount} on track</span>
              </div>
            )}
            {yellowCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,184,0,0.07)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.amber }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.amber }}>{yellowCount} at risk</span>
              </div>
            )}
            {redCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.07)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{redCount} off track</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.875rem', alignItems:'center' }}>
            <button onClick={() => { setFilterStatus(null); setFilterPriority(null) }} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:!filterStatus && !filterPriority ? 'rgba(255,255,255,0.07)' : C.card, border:'1px solid '+(!filterStatus && !filterPriority ? 'rgba(255,255,255,0.2)' : C.border), color:!filterStatus && !filterPriority ? C.text : C.sec }}>
              All <span style={{ opacity:0.6 }}>({goals.length})</span>
            </button>
            {STATUSES.map(s => {
              const m = STATUS_META[s]
              const active = filterStatus === s
              const count = statusCounts[s] ?? 0
              if (count === 0) return null
              return (
                <button key={s} onClick={() => setFilterStatus(active ? null : s)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:active ? m.bg : C.card, border:'1px solid '+(active ? m.color+'60' : C.border), color:active ? m.color : C.sec }}>
                  {s} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
            <span style={{ width:'1px', height:'20px', background:C.border, display:'inline-block', margin:'0 0.15rem' }}/>
            {PRIORITIES.map(p => {
              const m = PRIORITY_META[p]
              const active = filterPriority === p
              const count = goals.filter(g => g.priority === p).length
              if (count === 0) return null
              return (
                <button key={p} onClick={() => setFilterPriority(active ? null : p)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background:active ? m.color+'18' : C.card, border:'1px solid '+(active ? m.color+'50' : C.border), color:active ? m.color : C.sec }}>
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
        ) : filtered.length === 0 && goals.length > 0 ? (
          <p style={{ color:C.muted, fontSize:'0.85rem' }}>No goals match your filters.</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 1rem', color:C.muted }}>
            <Target size={40} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p style={{ fontSize:'1rem', color:C.sec, fontWeight:700 }}>No goals yet</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:'0.72rem', color:C.muted, marginBottom:'1rem' }}>{filtered.length} goal{filtered.length !== 1 ? 's' : ''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
              {filtered.map(g => <GoalCard key={g.id} goal={g} onDone={handleDone} />)}
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
                {done.map(g => <GoalCard key={g.id} goal={g} onRestore={handleRestore} />)}
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
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,255,136,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
        button:hover{opacity:0.85}
        input:focus{border-color:#00ff88 !important}
      `}</style>
    </main>
  )
}
