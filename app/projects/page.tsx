'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, RefreshCw, Plus, ExternalLink, X, Target, ChevronDown, ChevronUp } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'Not started': { color:'#4a4a6a', bg:'rgba(74,74,106,0.15)' },
  'In progress': { color:'#00d4ff', bg:'rgba(0,212,255,0.1)' },
  'Paused':      { color:'#ffb800', bg:'rgba(255,184,0,0.1)' },
  'Done':        { color:'#00ff88', bg:'rgba(0,255,136,0.1)' },
}

const PRIORITY_META: Record<string, { color: string }> = {
  'High':   { color: '#ff4466' },
  'Medium': { color: '#ffb800' },
  'Low':    { color: '#00ff88' },
}

const STATUS_ORDER = ['In progress','Not started','Paused','Done']

type Project = {
  id: string
  notion_id: string | null
  title: string
  status: string
  priority: string | null
  deadline: string | null
  goal: string | null
  next_action: string | null
  notes: string | null
  notion_url: string | null
  archived: boolean
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META['Not started']
  return (
    <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:m.color, background:m.bg, border:'1px solid '+m.color+'40', borderRadius:'9999px', padding:'0.15rem 0.55rem' }}>
      {status}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string | null }) {
  if (!priority) return null
  const m = PRIORITY_META[priority] ?? { color: C.muted }
  return <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:m.color, flexShrink:0, display:'inline-block' }} title={priority + ' priority'}/>
}

// Add/Edit modal
function ProjectModal({ initial, onSave, onClose }: {
  initial?: Partial<Project>
  onSave: (data: Partial<Project>) => void
  onClose: () => void
}) {
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [status, setStatus]         = useState(initial?.status ?? 'Not started')
  const [priority, setPriority]     = useState(initial?.priority ?? '')
  const [deadline, setDeadline]     = useState(initial?.deadline ?? '')
  const [goal, setGoal]             = useState(initial?.goal ?? '')
  const [nextAction, setNextAction] = useState(initial?.next_action ?? '')
  const [notes, setNotes]           = useState(initial?.notes ?? '')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem', overflowY:'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.5rem', padding:'1.75rem', width:'100%', maxWidth:'26rem', animation:'fadeInUp 0.25s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h3 style={{ fontSize:'1rem', fontWeight:800, color:C.text, margin:0 }}>{initial?.id ? 'Edit project' : 'New project'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>

        {[
          { label:'Project name', val:title, set:setTitle, placeholder:'e.g. YouTube channel relaunch', type:'text' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:'0.875rem' }}>
            <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.88rem', boxSizing:'border-box' }}/>
          </div>
        ))}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'0.875rem' }}>
          <div>
            <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box' }}>
              {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box' }}>
              <option value="">None</option>
              {Object.keys(PRIORITY_META).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Deadline</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box' }}/>
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Why does this project exist?</label>
          <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} placeholder="The goal / outcome..."
            style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', resize:'vertical', boxSizing:'border-box' }}/>
        </div>

        <div style={{ marginBottom:'1.25rem' }}>
          <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Single next action</label>
          <input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="The very next physical step..."
            style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box' }}/>
        </div>

        <button onClick={() => onSave({ title, status, priority: priority||null, deadline: deadline||null, goal: goal||null, next_action: nextAction||null, notes: notes||null })}
          disabled={!title.trim()} style={{
          width:'100%', padding:'0.75rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none',
          borderRadius:'0.875rem', color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor:title.trim()?'pointer':'default', fontFamily:'inherit',
          opacity:title.trim()?1:0.5,
        }}>Save project</button>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
    setProjects(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true); setSyncMsg('')
    const r = await fetch('/api/sync/notion', { method: 'POST' })
    const d = await r.json()
    setSyncMsg(d.error ? 'Error: ' + d.error : `Synced ${d.synced?.projects ?? 0} projects`)
    await load()
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  async function saveProject(data: Partial<Project>) {
    if (editProject) {
      await supabase.from('projects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editProject.id)
    } else {
      await supabase.from('projects').insert(data)
    }
    setShowModal(false); setEditProject(null)
    await load()
  }

  async function markDone(id: string) {
    await supabase.from('projects').update({ status: 'Done', updated_at: new Date().toISOString() }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'Done' } : p))
  }

  async function archiveProject(id: string) {
    await supabase.from('projects').update({ archived: true }).eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const allStatuses = ['All', ...STATUS_ORDER]
  const filtered = projects.filter(p => statusFilter === 'All' || p.status === statusFilter)
  const grouped = STATUS_ORDER.map(s => ({ status: s, items: filtered.filter(p => p.status === s) })).filter(g => g.items.length > 0)

  const today = new Date().toISOString().split('T')[0]

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,212,255,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#127919; Projects
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {projects.filter(p => p.status === 'In progress').length} active &mdash; {projects.length} total
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
              {syncMsg && <span style={{ fontSize:'0.72rem', color:C.green, fontWeight:600 }}>{syncMsg}</span>}
              <button onClick={handleSync} disabled={syncing} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'0.75rem', color:C.cyan, cursor:syncing?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, opacity:syncing?0.6:1 }}>
                <RefreshCw size={13} style={{ animation:syncing?'spin 1s linear infinite':'none' }}/>
                {syncing ? 'Syncing...' : 'Sync Notion'}
              </button>
              <button onClick={() => { setEditProject(null); setShowModal(true) }} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'0.75rem', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                <Plus size={14}/> New project
              </button>
            </div>
          </div>

          {/* Status filter */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'1.25rem' }}>
            {allStatuses.map(s => {
              const active = statusFilter === s
              const m = s !== 'All' ? STATUS_META[s] : null
              const cnt = s === 'All' ? projects.length : projects.filter(p => p.status === s).length
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.72rem', fontWeight:700,
                  background: active ? (m?.bg ?? 'rgba(255,255,255,0.06)') : C.card,
                  border: '1px solid ' + (active ? (m?.color ?? C.border)+'60' : C.border),
                  color: active ? (m?.color ?? C.text) : C.sec,
                }}>
                  {s} ({cnt})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {loading ? (
          <p style={{ color:C.muted }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            <Target size={32} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p>No projects yet. Sync from Notion or add one.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            {(statusFilter === 'All' ? grouped : [{ status: statusFilter, items: filtered }]).map(group => (
              <div key={group.status}>
                {statusFilter === 'All' && (
                  <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:STATUS_META[group.status]?.color ?? C.muted, margin:'0 0 0.625rem' }}>
                    {group.status} &mdash; {group.items.length}
                  </p>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                  {group.items.map(project => {
                    const isExp = expanded === project.id
                    const sm = STATUS_META[project.status] ?? STATUS_META['Not started']
                    const isOverdue = project.deadline && project.deadline < today && project.status !== 'Done'
                    return (
                      <div key={project.id} style={{
                        background:C.card, border:'1px solid '+(isExp?sm.color+'40':C.border),
                        borderRadius:'1.125rem', overflow:'hidden', transition:'all 0.2s',
                      }}>
                        {/* Main row */}
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem 1.125rem', cursor:'pointer' }}
                          onClick={() => setExpanded(isExp ? null : project.id)}>
                          <PriorityDot priority={project.priority}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.25rem', lineHeight:1.2 }}>{project.title}</p>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                              <StatusBadge status={project.status}/>
                              {project.deadline && (
                                <span style={{ fontSize:'0.65rem', color:isOverdue?C.red:C.muted, fontWeight:isOverdue?700:400 }}>
                                  {isOverdue ? '⚠ overdue: ' : 'by '}{project.deadline}
                                </span>
                              )}
                            </div>
                          </div>
                          {project.notion_url && (
                            <a href={project.notion_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color:C.muted, display:'flex', flexShrink:0 }}><ExternalLink size={13}/></a>
                          )}
                          {isExp ? <ChevronUp size={14} color={C.muted}/> : <ChevronDown size={14} color={C.muted}/>}
                        </div>

                        {/* Expanded detail */}
                        {isExp && (
                          <div style={{ borderTop:'1px solid '+C.border, padding:'1rem 1.125rem', background:C.surface }}>
                            {project.next_action && (
                              <div style={{ marginBottom:'0.875rem', padding:'0.75rem', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.75rem' }}>
                                <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan, margin:'0 0 0.3rem' }}>Single next action</p>
                                <p style={{ fontSize:'0.88rem', fontWeight:700, color:C.text, margin:0, lineHeight:1.4 }}>{project.next_action}</p>
                              </div>
                            )}
                            {project.goal && (
                              <div style={{ marginBottom:'0.875rem' }}>
                                <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.3rem' }}>Why this exists</p>
                                <p style={{ fontSize:'0.82rem', color:C.sec, margin:0, lineHeight:1.6 }}>{project.goal}</p>
                              </div>
                            )}
                            {project.notes && (
                              <div style={{ marginBottom:'0.875rem' }}>
                                <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.3rem' }}>Notes</p>
                                <p style={{ fontSize:'0.82rem', color:C.sec, margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{project.notes}</p>
                              </div>
                            )}
                            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                              <button onClick={() => { setEditProject(project); setShowModal(true) }}
                                style={{ padding:'0.4rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600 }}>
                                Edit
                              </button>
                              {project.status !== 'Done' && (
                                <button onClick={() => markDone(project.id)}
                                  style={{ padding:'0.4rem 0.875rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.625rem', color:C.green, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                                  Mark done
                                </button>
                              )}
                              <button onClick={() => archiveProject(project.id)}
                                style={{ padding:'0.4rem 0.875rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600 }}>
                                Archive
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ProjectModal
          initial={editProject ?? undefined}
          onSave={saveProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        button:hover { opacity:0.85; }
        input, select, textarea { outline:none; }
        input:focus, select:focus, textarea:focus { border-color:#8b5cf6 !important; }
      `}</style>
    </main>
  )
}
