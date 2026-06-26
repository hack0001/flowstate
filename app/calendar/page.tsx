'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, ExternalLink, Check, Trash2, X, Edit2, Sun } from 'lucide-react'
import { NOTION_LINKS } from '@/lib/notion'
import type { NotionTask, NotionEvent, NotionContent } from '@/lib/notion'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800', red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const EVENT_CATS = ['Personal','Work','Home']
const TASK_STATUSES = ['Not started','In progress','Done']
const REFRESH_MS = 5 * 60 * 1000 // auto-refresh every 5 min

type DayData = { tasks: NotionTask[]; events: NotionEvent[] }

function fmt(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' })
}

// ---- Inline edit form ----
function EventForm({ initial, onSave, onCancel, dateStr }: {
  initial?: Partial<NotionEvent>; onSave: (v: { title: string; date: string; category: string }) => void
  onCancel: () => void; dateStr: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? dateStr)
  const [cat, setCat] = useState(initial?.category ?? 'Work')
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', padding:'0.75rem', background:C.surface, border:'1px solid '+C.cyan, borderRadius:'0.75rem', marginBottom:'0.5rem' }}>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Event name"
        style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none' }}/>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{ flex:1, background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none' }}/>
        <select value={cat} onChange={e=>setCat(e.target.value)}
          style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none' }}>
          {EVENT_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'0.35rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
        <button onClick={() => title.trim() && onSave({ title: title.trim(), date, category: cat })}
          style={{ padding:'0.35rem 0.75rem', background:C.cyan, border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Save</button>
      </div>
    </div>
  )
}

function TaskForm({ onSave, onCancel, dateStr }: {
  onSave: (v: { title: string; dueDate: string }) => void; onCancel: () => void; dateStr: string
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(dateStr)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', padding:'0.75rem', background:C.surface, border:'1px solid '+C.amber, borderRadius:'0.75rem', marginBottom:'0.5rem' }}>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task name"
        style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none' }}/>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}
        style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none' }}/>
      <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'0.35rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
        <button onClick={() => title.trim() && onSave({ title: title.trim(), dueDate: date })}
          style={{ padding:'0.35rem 0.75rem', background:C.amber, border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Save</button>
      </div>
    </div>
  )
}

// ---- Item rows ----
function EventRow({ ev, onUpdate, onDelete }: {
  ev: NotionEvent
  onUpdate: (id: string, v: { title?: string; date?: string; category?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const catColor = ev.category==='Work' ? C.cyan : ev.category==='Personal' ? C.purple : C.amber

  if (editing) return (
    <EventForm initial={ev} dateStr={ev.date}
      onSave={async v => { setBusy(true); await onUpdate(ev.id, v); setBusy(false); setEditing(false) }}
      onCancel={() => setEditing(false)}/>
  )
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', marginBottom:'0.375rem', opacity:busy?0.5:1 }}>
      <div style={{ width:'3px', height:'1.5rem', borderRadius:'2px', background:catColor, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.875rem', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</p>
        <p style={{ fontSize:'0.7rem', color:C.muted }}>{ev.category ?? 'Event'}</p>
      </div>
      <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, flexShrink:0 }}><ExternalLink size={12}/></a>
      <button onClick={() => setEditing(true)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', flexShrink:0 }}><Edit2 size={12}/></button>
      <button onClick={async () => { setBusy(true); await onDelete(ev.id) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', flexShrink:0 }}><Trash2 size={12}/></button>
    </div>
  )
}

function TaskRow({ task, onUpdate, onDelete }: {
  task: NotionTask
  onUpdate: (id: string, v: { title?: string; status?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [busy, setBusy] = useState(false)
  const done = task.status === 'Done'

  async function toggleDone() {
    setBusy(true)
    await onUpdate(task.id, { status: done ? 'Not started' : 'Done' })
    setBusy(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', marginBottom:'0.375rem', opacity:busy?0.5:1 }}>
      <button onClick={toggleDone} style={{ width:'18px', height:'18px', borderRadius:'50%', border:'2px solid '+(done?C.green:C.border), background:done?C.green:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {done && <Check size={10} color="#000"/>}
      </button>
      {editingTitle ? (
        <input value={draft} onChange={e=>setDraft(e.target.value)}
          onBlur={async () => { if (draft.trim() !== task.title) { setBusy(true); await onUpdate(task.id, { title: draft.trim() }); setBusy(false) } setEditingTitle(false) }}
          onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
          autoFocus
          style={{ flex:1, background:'transparent', border:'none', borderBottom:'1px solid '+C.cyan, color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none', padding:'0 2px' }}/>
      ) : (
        <p onClick={() => setEditingTitle(true)} style={{ flex:1, fontSize:'0.875rem', fontWeight:600, color:done?C.muted:C.text, textDecoration:done?'line-through':'none', cursor:'text', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</p>
      )}
      <a href={task.url} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, flexShrink:0 }}><ExternalLink size={12}/></a>
      <button onClick={async () => { setBusy(true); await onDelete(task.id) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', flexShrink:0 }}><Trash2 size={12}/></button>
    </div>
  )
}

// ---- Main page ----
export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [dayData, setDayData] = useState<DayData>({ tasks:[], events:[] })
  const [content, setContent] = useState<NotionContent[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [noToken, setNoToken] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const year = cur.getFullYear()
  const month = cur.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const dateStr = (d: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const selDate = dateStr(selectedDay)
  const isToday = (d: number) => dateStr(d) === today.toISOString().split('T')[0]
  const contentDots = (d: number) => content.filter(c => c.date === dateStr(d))

  // Fetch content for month
  useEffect(() => {
    fetch(`/api/notion/content?year=${year}&month=${month+1}`)
      .then(r=>r.json())
      .then(d => { if (d.content) setContent(d.content) })
      .catch(()=>{})
  }, [year, month])

  // Fetch selected day
  const loadDay = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await fetch(`/api/notion/today?date=${selDate}`)
      const d = await r.json()
      if (d.error?.includes('NOTION_TOKEN')) { setNoToken(true); return }
      setDayData({ tasks: d.tasks ?? [], events: d.events ?? [] })
      setNoToken(false)
      setLastSync(new Date())
    } catch { setNoToken(true) }
    setLoading(false); setRefreshing(false)
  }, [selDate])

  useEffect(() => { loadDay() }, [loadDay])

  // Auto-refresh every 5 min
  useEffect(() => {
    refreshTimer.current = setTimeout(() => loadDay(true), REFRESH_MS)
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, [loadDay, lastSync])

  // ---- Event CRUD ----
  async function handleAddEvent(v: { title: string; date: string; category: string }) {
    const r = await fetch('/api/notion/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) })
    const newEv = await r.json()
    if (!newEv.error) setDayData(d => ({ ...d, events: [...d.events, newEv] }))
    setAddingEvent(false)
  }

  async function handleUpdateEvent(id: string, v: { title?: string; date?: string; category?: string }) {
    await fetch('/api/notion/events', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, ...v }) })
    setDayData(d => ({ ...d, events: d.events.map(e => e.id===id ? { ...e, ...v } : e) }))
  }

  async function handleDeleteEvent(id: string) {
    await fetch('/api/notion/events', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setDayData(d => ({ ...d, events: d.events.filter(e => e.id!==id) }))
  }

  // ---- Task CRUD ----
  async function handleAddTask(v: { title: string; dueDate: string }) {
    const r = await fetch('/api/notion/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) })
    const newTask = await r.json()
    if (!newTask.error) setDayData(d => ({ ...d, tasks: [...d.tasks, newTask] }))
    setAddingTask(false)
  }

  async function handleUpdateTask(id: string, v: { title?: string; status?: string }) {
    await fetch('/api/notion/tasks', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, ...v }) })
    setDayData(d => ({ ...d, tasks: d.tasks.map(t => t.id===id ? { ...t, ...v } : t) }))
  }

  async function handleDeleteTask(id: string) {
    await fetch('/api/notion/tasks', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setDayData(d => ({ ...d, tasks: d.tasks.filter(t => t.id!==id) }))
  }

  // Calendar grid
  const cells: { day: number; cur: boolean }[] = []
  for (let i=firstDay-1; i>=0; i--) cells.push({ day: daysInPrev-i, cur: false })
  for (let i=1; i<=daysInMonth; i++) cells.push({ day:i, cur:true })
  while (cells.length < 42) cells.push({ day: cells.length-daysInMonth-firstDay+2, cur:false })

  const totalItems = dayData.events.length + dayData.tasks.length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid '+C.border, flexWrap:'wrap', gap:'0.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}>
            <ArrowLeft size={14}/>Home
          </button>
          <span style={{ color:C.border }}>|</span>
          <span style={{ fontWeight:800, color:C.text }}>Calendar</span>
          {refreshing && <div style={{ width:'12px', height:'12px', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>}
          {lastSync && !refreshing && <span style={{ fontSize:'0.65rem', color:C.muted }}>synced {lastSync.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => loadDay(true)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600 }}>
            <RefreshCw size={12}/>Refresh
          </button>
          <button onClick={() => router.push('/morning')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.75rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            <Sun size={12}/>Morning
          </button>
          <a href={NOTION_LINKS.daily} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, textDecoration:'none', fontSize:'0.8rem', fontWeight:600 }}>
            <ExternalLink size={12}/>Notion
          </a>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', flexWrap:'wrap' }}>
        {/* Left: Calendar grid */}
        <div style={{ width:'340px', flexShrink:0, padding:'1.25rem', borderRight:'1px solid '+C.border, overflowY:'auto' }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <button onClick={() => setCur(new Date(year, month-1, 1))} style={{ padding:'0.4rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>{'<'}</button>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontWeight:800, fontSize:'1rem', color:C.text }}>{MONTHS[month]} {year}</p>
              <button onClick={() => { setCur(new Date(today.getFullYear(),today.getMonth(),1)); setSelectedDay(today.getDate()) }}
                style={{ fontSize:'0.65rem', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>Today</button>
            </div>
            <button onClick={() => setCur(new Date(year, month+1, 1))} style={{ padding:'0.4rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>{'>'}</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', color:C.muted, padding:'0.2rem 0' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
            {cells.map((cell,i) => {
              const todayCell = cell.cur && isToday(cell.day)
              const sel = cell.cur && selectedDay===cell.day
              const dots = cell.cur ? contentDots(cell.day) : []
              return (
                <button key={i} onClick={() => cell.cur && setSelectedDay(cell.day)}
                  style={{ aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', paddingTop:'0.3rem', borderRadius:'0.5rem', border:'1px solid '+(sel?C.cyan:todayCell?'rgba(0,212,255,0.25)':'transparent'), background:sel?'rgba(0,212,255,0.1)':todayCell?'rgba(0,212,255,0.04)':'transparent', cursor:cell.cur?'pointer':'default', fontFamily:'inherit' }}>
                  <span style={{ fontSize:'0.75rem', fontWeight:sel||todayCell?700:400, color:!cell.cur?C.muted:sel||todayCell?C.cyan:C.text }}>{cell.day}</span>
                  {dots.length>0 && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:C.purple, marginTop:'1px' }}/>}
                </button>
              )
            })}
          </div>

          {/* Content sidebar */}
          {content.length>0 && (
            <div style={{ marginTop:'1.25rem' }}>
              <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.625rem' }}>Content This Month</p>
              {content.sort((a,b)=>(a.date??'').localeCompare(b.date??'')).map(c => (
                <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none', marginBottom:'0.375rem' }}>
                  <div style={{ padding:'0.5rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', marginBottom:'0.1rem' }}>
                      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:c.status==='Live'?C.green:c.status==='Scheduled'?C.cyan:c.status==='In Progress'?C.amber:C.muted }}/>
                      <span style={{ fontSize:'0.65rem', color:C.muted }}>{c.date ? fmt(c.date) : 'TBD'}</span>
                    </div>
                    <p style={{ fontSize:'0.75rem', fontWeight:600, color:C.text, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: Day panel */}
        <div style={{ flex:1, minWidth:'300px', display:'flex', flexDirection:'column' }}>
          {/* Day header */}
          <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:'1rem', color:C.text }}>
                {new Date(selDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
              </p>
              <p style={{ fontSize:'0.75rem', color:C.sec }}>
                {totalItems} item{totalItems!==1?'s':''}
                {dayData.events.length>0 ? ` (${dayData.events.length} event${dayData.events.length!==1?'s':''})` : ''}
                {dayData.tasks.length>0 ? ` (${dayData.tasks.length} task${dayData.tasks.length!==1?'s':''})` : ''}
              </p>
            </div>
            <div style={{ display:'flex', gap:'0.375rem' }}>
              <button onClick={() => { setAddingEvent(true); setAddingTask(false) }}
                style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.45rem 0.875rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                <Plus size={12}/>Event
              </button>
              <button onClick={() => { setAddingTask(true); setAddingEvent(false) }}
                style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.45rem 0.875rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.75rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                <Plus size={12}/>Task
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.5rem' }}>
            {loading && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:C.sec, padding:'2rem 0' }}>
                <div style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
                Loading from Notion...
              </div>
            )}

            {!loading && noToken && (
              <div style={{ padding:'1.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', maxWidth:'380px' }}>
                <p style={{ fontWeight:700, color:C.amber, marginBottom:'0.5rem' }}>Notion not connected</p>
                <p style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6, marginBottom:'0.75rem' }}>
                  Add <code style={{ background:C.surface, padding:'0.1rem 0.3rem', borderRadius:'0.25rem' }}>NOTION_TOKEN</code> to Vercel env vars, then share your Tasks and Events databases with your integration.
                </p>
                <a href="https://notion.so/my-integrations" target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.8rem', color:C.cyan, textDecoration:'none' }}>
                  Create integration<ExternalLink size={10}/>
                </a>
              </div>
            )}

            {!loading && !noToken && (
              <>
                {/* Add forms */}
                {addingEvent && (
                  <EventForm dateStr={selDate} onSave={handleAddEvent} onCancel={() => setAddingEvent(false)}/>
                )}
                {addingTask && (
                  <TaskForm dateStr={selDate} onSave={handleAddTask} onCancel={() => setAddingTask(false)}/>
                )}

                {/* Events section */}
                {(dayData.events.length>0 || addingEvent) && (
                  <div style={{ marginBottom:'1.25rem' }}>
                    <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan, marginBottom:'0.5rem' }}>Events</p>
                    {dayData.events.map(ev => (
                      <EventRow key={ev.id} ev={ev} onUpdate={handleUpdateEvent} onDelete={handleDeleteEvent}/>
                    ))}
                  </div>
                )}

                {/* Tasks section */}
                {(dayData.tasks.length>0 || addingTask) && (
                  <div style={{ marginBottom:'1.25rem' }}>
                    <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.amber, marginBottom:'0.5rem' }}>Tasks</p>
                    {dayData.tasks.map(task => (
                      <TaskRow key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask}/>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {totalItems===0 && !addingEvent && !addingTask && (
                  <div style={{ textAlign:'center', padding:'3rem 0', color:C.muted }}>
                    <p style={{ marginBottom:'0.75rem' }}>Nothing scheduled for this day.</p>
                    <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center' }}>
                      <button onClick={() => setAddingEvent(true)} style={{ padding:'0.4rem 0.875rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>+ Add event</button>
                      <button onClick={() => setAddingTask(true)} style={{ padding:'0.4rem 0.875rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'0.625rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>+ Add task</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
