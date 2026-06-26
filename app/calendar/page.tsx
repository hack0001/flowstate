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

  async function h