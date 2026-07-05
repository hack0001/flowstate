'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Search, X, CheckSquare, Download } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const TYPE_META: Record<string, { color: string }> = {
  'Flow':       { color: '#00d4ff' },
  'Personal':   { color: '#8b5cf6' },
  'Admin':      { color: '#4a4a6a' },
  'Quick Task': { color: '#ffb800' },
  'Recurring':  { color: '#00ff88' },
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'Not started': { color:'#4a4a6a', bg:'rgba(74,74,106,0.15)' },
  'In progress': { color:'#00d4ff', bg:'rgba(0,212,255,0.1)' },
  'Done':        { color:'#00ff88', bg:'rgba(0,255,136,0.1)' },
}

const TYPES    = ['All', 'Flow', 'Personal', 'Admin', 'Quick Task', 'Recurring']
const STATUSES = ['All', 'Not started', 'In progress', 'Done']
const SORTS = [
  { key: 'created_at_desc', label: 'Newest first' },
  { key: 'created_at_asc',  label: 'Oldest first' },
  { key: 'deadline_asc',    label: 'Deadline (soonest)' },
  { key: 'task_type',       label: 'Category' },
  { key: 'urgency',         label: 'Urgency first' },
]

type Task = {
  id: string
  notion_id: string | null
  title: string
  status: string
  due_date: string | null
  task_type: string | null
  urgency: string | null
  importance: string | null
  time_commitment: string | null
  is_frog: boolean
  priority: string | null
  notion_url: string | null
  archived: boolean
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META['Not started']
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.bg, border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {status}
    </span>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const m = TYPE_META[type] ?? { color: C.muted }
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.color+'18', border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.12rem 0.45rem' }}>
      {type}
    </span>
  )
}

function sortTasks(tasks: Task[], sort: string): Task[] {
  return [...tasks].sort((a, b) => {
    if (sort === 'created_at_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'created_at_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'deadline_asc') {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    if (sort === 'task_type') return (a.task_type ?? 'z').localeCompare(b.task_type ?? 'z')
    if (sort === 'urgency') return (a.urgency === 'Urgent' ? 0 : 1) - (b.urgency === 'Urgent' ? 0 : 1)
    return 0
  })
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState('deadline_asc')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('master_tasks')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setTasks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleImport() {
    setImporting(true); setImportMsg('')
    try {
      const r = await fetch('/api/import', { method: 'POST' })
      const d = await r.json()
      const taskCount = d.tasks?.imported ?? 0
      const vaultCount = d.vault?.imported ?? 0
      const taskErr = d.tasks?.error
      const vaultErr = d.vault?.error
      if (taskErr || vaultErr) {
        setImportMsg(taskErr ?? vaultErr ?? 'Import error')
      } else {
        setImportMsg('Imported ' + taskCount + ' tasks + ' + vaultCount + ' vault items')
        await load()
      }
    } catch (e) {
      setImportMsg('Failed: ' + String(e))
    }
    setImporting(false)
    setTimeout(() => setImportMsg(''), 6000)
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = sortTasks(
    tasks.filter(t => {
      if (typeFilter !== 'All' && t.task_type !== typeFilter) return false
      if (statusFilter !== 'All' && t.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          (t.task_type ?? '').toLowerCase().includes(q) ||
          (t.urgency ?? '').toLowerCase().includes(q)
        )
      }
      return true
    }),
    sort
  )

  const typeCounts: Record<string, number> = {}
  tasks.forEach(t => { if (t.task_type) typeCounts[t.task_type] = (typeCounts[t.task_type] ?? 0) + 1 })
  const statusCounts: Record<string, number> = {}
  tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1 })

  const activeCount  = tasks.filter(t => t.status !== 'Done').length
  const frogCount    = tasks.filter(t => t.is_frog).length
  const urgentCount  = tasks.filter(t => t.urgency === 'Urgent').length
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Done').length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,212,255,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#9989; Master Tasks
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {activeCount} active &mdash; {tasks.length} total
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
              {importMsg && (
                <span style={{ fontSize:'0.72rem', color: importMsg.startsWith('Fail') || importMsg.startsWith('Import error') ? C.red : C.green, fontWeight:600 }}>
                  {importMsg}
                </span>
              )}
              <button onClick={handleImport} disabled={importing} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.875rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:importing?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700, opacity:importing?0.6:1 }}>
                <Download size={13} style={{ animation:importing?'spin 1s linear infinite':'none' }}/>
                {importing ? 'Importing...' : 'Import from CSV'}
              </button>
              <label style={{ fontSize:'0.7rem', color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Sort</label>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ padding:'0.5rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', cursor:'pointer' }}>
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Stats chips */}
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
            {urgentCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{urgentCount} urgent</span>
              </div>
            )}
            {frogCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)', borderRadius:'9999px' }}>
                <span style={{ fontSize:'0.75rem' }}>&#128293;</span>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#ff6b35' }}>{frogCount} frog{frogCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {overdueCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.18)', borderRadius:'9999px' }}>
                <span style={{ fontSize:'0.75rem' }}>&#9888;</span>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{overdueCount} overdue</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginTop:'1rem' }}>
            <Search size={15} color={C.muted} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
              style={{ width:'100%', padding:'0.65rem 2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'0.88rem', boxSizing:'border-box', outline:'none' }}/>
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'0.875rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={14}/></button>}
          </div>

          {/* Filter pills */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.875rem', alignItems:'center' }}>
            {TYPES.map(type => {
              const active = typeFilter === type
              const count = type === 'All' ? tasks.length : (typeCounts[type] ?? 0)
              if (type !== 'All' && count === 0) return null
              const m = type !== 'All' ? TYPE_META[type] : null
              return (
                <button key={type} onClick={() => setTypeFilter(type)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.72rem', fontWeight:700,
                  background: active ? (m?.color ?? C.cyan) + '18' : C.card,
                  border: '1px solid ' + (active ? (m?.color ?? C.cyan) + '50' : C.border),
                  color: active ? (m?.color ?? C.cyan) : C.sec,
                }}>
                  {type} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
            <span style={{ width:'1px', height:'20px', background:C.border, display:'inline-block', margin:'0 0.15rem' }}/>
            {STATUSES.map(s => {
              const active = statusFilter === s
              const sm = s !== 'All' ? STATUS_META[s] : null
              const count = s === 'All' ? tasks.length : (statusCounts[s] ?? 0)
              if (s !== 'All' && count === 0) return null
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.72rem', fontWeight:700,
                  background: active ? (sm?.bg ?? 'rgba(255,255,255,0.06)') : C.card,
                  border: '1px solid ' + (active ? (sm?.color ?? C.border)+'60' : C.border),
                  color: active ? (sm?.color ?? C.text) : C.sec,
                }}>
                  {s} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 1rem', color:C.muted }}>
            <CheckSquare size={40} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p style={{ fontSize:'1rem', color:C.sec, marginBottom:'0.5rem', fontWeight:700 }}>No tasks in Supabase yet</p>
            <p style={{ fontSize:'0.82rem', marginBottom:'2rem', lineHeight:1.6 }}>Your 212 Notion tasks are in the CSV export.<br/>Hit the button below to load them into Supabase.</p>
            <button onClick={handleImport} disabled={importing} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:800, fontSize:'0.95rem', cursor:importing?'not-allowed':'pointer', fontFamily:'inherit', opacity:importing?0.6:1, boxShadow:'0 4px 20px rgba(0,255,136,0.25)' }}>
              <Download size={18}/>
              {importing ? 'Importing...' : 'Import 212 tasks now'}
            </button>
            {importMsg && <p style={{ marginTop:'1rem', fontSize:'0.8rem', color: importMsg.startsWith('Fail') ? C.red : C.green, fontWeight:600 }}>{importMsg}</p>}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            <p>No tasks match your filters.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:'0.72rem', color:C.muted, marginBottom:'1rem' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
              {filtered.map(task => {
                const isExp = expanded === task.id
                const typeM = task.task_type ? TYPE_META[task.task_type] : null
                const isOverdue = task.due_date && task.due_date < today && task.status !== 'Done'
                return (
                  <div key={task.id} onClick={() => setExpanded(isExp ? null : task.id)}
                    style={{
                      background:C.card, border:'1px solid '+(isExp?(typeM?.color??C.cyan)+'40':C.border),
                      borderRadius:'1rem', padding:'1rem', cursor:'pointer',
                      transition:'border-color 0.2s ease',
                      boxShadow: isExp ? '0 0 18px '+(typeM?.color??C.cyan)+'12' : 'none',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                      <TypeBadge type={task.task_type}/>
                      {task.is_frog && <span style={{ fontSize:'0.85rem' }}>&#128293;</span>}
                      <span style={{ marginLeft:'auto' }}><StatusBadge status={task.status}/></span>
                    </div>

                    <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.4rem', lineHeight:1.35 }}>{task.title}</h3>

                    {task.due_date && (
                      <p style={{ fontSize:'0.7rem', color:isOverdue?C.red:C.muted, margin:'0 0 0.4rem', fontWeight:isOverdue?700:400 }}>
                        &#128197; {isOverdue ? 'Overdue: ' : ''}{task.due_date}
                      </p>
                    )}

                    <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
                      {task.urgency && (
                        <span style={{ fontSize:'0.58rem', color:task.urgency==='Urgent'?C.red:C.muted, border:'1px solid '+(task.urgency==='Urgent'?C.red:C.border), borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.urgency}
                        </span>
                      )}
                      {task.importance && (
                        <span style={{ fontSize:'0.58rem', color:task.importance==='Moved the Needle'||task.importance==='Important'?C.green:C.muted, border:'1px solid '+(task.importance==='Moved the Needle'||task.importance==='Important'?C.green:C.border), borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.importance === 'Moved the Needle' || task.importance === 'Important' ? 'High Impact' : 'Low Impact'}
                        </span>
                      )}
                      {task.time_commitment && (
                        <span style={{ fontSize:'0.58rem', color:C.muted, border:'1px solid '+C.border, borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.time_commitment}
                        </span>
                      )}
                    </div>

                    {isExp && (
                      <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid '+C.border }}>
                        {task.priority && (
                          <span style={{ fontSize:'0.62rem', color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.375rem', padding:'0.2rem 0.5rem', fontWeight:700, display:'inline-block', marginBottom:'0.5rem' }}>
                            {task.priority} priority
                          </span>
                        )}
                        <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}>
                          Added {new Date(task.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <style>{`
        input:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
        select { appearance:none; }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </main>
  )
}
