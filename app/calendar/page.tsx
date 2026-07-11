'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Zap, Sun, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

type Task = {
  id: string; title: string; due_date: string | null; status: string
  urgency: string | null; importance: string | null; time_commitment: string | null
  task_type: string | null; is_frog: boolean; why_note: string | null
  notion_id: string | null; notion_url: string | null; priority: string | null
}

type OrgMove = { id: string; from: string; to: string; title: string }
type WFSession = { id: string; title: string; workflow_type: { name: string; icon: string } | null }
type OverdueMove = { id: string; title: string; task_type: string | null; fromDate: string; toDate: string; selected: boolean }
type HabitBlock = { id: string; title: string; emoji: string; color: string; days: number[]; timeLabel: string }

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0,0,0,0); return mon
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function toDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const sm = MONTHS[start.getMonth()].slice(0,3)
  const em = MONTHS[end.getMonth()].slice(0,3)
  if (start.getMonth() === end.getMonth()) return sm + ' ' + start.getDate() + ' - ' + end.getDate() + ', ' + start.getFullYear()
  return sm + ' ' + start.getDate() + ' - ' + em + ' ' + end.getDate() + ', ' + end.getFullYear()
}

function buildOrganisePlan(allTasks: Record<string, Task[]>, weekStart: Date): OrgMove[] {
  const moves: OrgMove[] = []
  const dates = Array.from({ length: 14 }, (_, i) => toDateStr(addDays(weekStart, i)))
  const flowByDay: Record<string, Task[]> = {}
  for (const date of dates) flowByDay[date] = (allTasks[date] ?? []).filter(t => t.task_type === 'Flow' && t.status !== 'Done')
  for (let i = 0; i < dates.length; i++) {
    const tasks = flowByDay[dates[i]]
    if (tasks.length <= 2) continue
    const overflow = tasks.splice(2)
    for (const task of overflow) {
      let moved = false
      for (let j = i + 1; j < dates.length; j++) {
        if (flowByDay[dates[j]].length < 2) {
          const dest = dates[j]
          if ((task.due_date ?? dates[i]) !== dest) moves.push({ id: task.id, from: task.due_date ?? dates[i], to: dest, title: task.title })
          flowByDay[dest].push({ ...task, due_date: dest }); moved = true; break
        }
      }
      if (!moved) {
        const fallback = dates[dates.length - 1]
        if ((task.due_date ?? dates[i]) !== fallback) moves.push({ id: task.id, from: task.due_date ?? dates[i], to: fallback, title: task.title })
        flowByDay[fallback].push({ ...task, due_date: fallback })
      }
    }
  }
  return moves
}

function TaskCard({
  task, onComplete, onDelete, onDragStart, onEdit,
}: {
  task: Task
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onDragStart: (e: React.DragEvent, task: Task) => void
  onEdit: (task: Task) => void
}) {
  const [busy, setBusy] = useState(false)
  const typeColor = task.task_type === 'Flow' ? C.cyan : task.task_type === 'Personal' ? C.purple : task.task_type === 'Admin' ? C.muted : C.amber
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, task) }}
      onClick={() => onEdit(task)}
      style={{ display:'flex', alignItems:'flex-start', gap:'0.375rem', padding:'0.45rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', marginBottom:'0.3rem', opacity:busy?0.5:1, cursor:'pointer' }}>
      <button onClick={e => { e.stopPropagation(); setBusy(true); onComplete(task.id) }}
        style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid '+C.border, background:'transparent', cursor:'pointer', flexShrink:0, marginTop:'2px', padding:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.75rem', fontWeight:600, color:C.text, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>
          {task.is_frog && <span style={{ marginRight:'0.2rem' }}>&#128293;</span>}
          {task.title}
        </p>
        <div style={{ display:'flex', gap:'0.2rem', marginTop:'0.15rem', flexWrap:'wrap' }}>
          {task.task_type && <span style={{ fontSize:'0.55rem', color:typeColor, border:'1px solid '+typeColor, borderRadius:'0.2rem', padding:'0 0.2rem', lineHeight:1.5, opacity:0.85 }}>{task.task_type}</span>}
          {task.urgency === 'Urgent' && <span style={{ fontSize:'0.55rem', color:C.red, border:'1px solid '+C.red, borderRadius:'0.2rem', padding:'0 0.2rem', lineHeight:1.5, opacity:0.85 }}>Urgent</span>}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); setBusy(true); onDelete(task.id) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'1px', flexShrink:0 }}><Trash2 size={10} /></button>
    </div>
  )
}

function QuickAdd({ date, onSave, onClose }: { date: string; onSave: (title: string, type: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Flow')
  const submit = () => { if (title.trim()) onSave(title.trim(), type) }
  return (
    <div style={{ padding:'0.5rem', background:C.surface, border:'1px solid '+C.cyan, borderRadius:'0.625rem', marginTop:'0.5rem' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') submit(); if (e.key==='Escape') onClose() }}
        placeholder="Task title..."
        style={{ width:'100%', background:'transparent', border:'none', color:C.text, fontFamily:'inherit', fontSize:'0.75rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }} />
      <div style={{ display:'flex', gap:'0.2rem', marginBottom:'0.4rem', flexWrap:'wrap' }}>
        {['Flow','Personal','Admin','Quick Task'].map(t => (
          <button key={t} onClick={() => setType(t)} style={{ fontSize:'0.58rem', padding:'0.1rem 0.3rem', borderRadius:'0.2rem', border:'1px solid '+(type===t?C.cyan:C.border), background:type===t?'rgba(0,212,255,0.1)':'transparent', color:type===t?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit' }}>{t}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'0.25rem', justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{ fontSize:'0.65rem', padding:'0.2rem 0.4rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.25rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        <button onClick={submit} style={{ fontSize:'0.65rem', padding:'0.2rem 0.5rem', background:C.cyan, border:'none', borderRadius:'0.25rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Add</button>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const todayStr = toDateStr(today)
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(today))
  const [weekTasks, setWeekTasks] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(false)
  const [orgPlan, setOrgPlan] = useState<OrgMove[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [wfSessions, setWfSessions] = useState<WFSession[]>([])
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [overduePlan, setOverduePlan] = useState<OverdueMove[] | null>(null)
  const [overdueLoading, setOverdueLoading] = useState(false)
  // Task editing
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('Flow')
  const [editDueDate, setEditDueDate] = useState('')
  const [editUrgency, setEditUrgency] = useState('')
  const [editIsFrog, setEditIsFrog] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  // Habits
  const [habits, setHabits] = useState<HabitBlock[]>([])
  const [showHabitModal, setShowHabitModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitBlock | null>(null)
  const [habitDraft, setHabitDraft] = useState<{ title:string; emoji:string; color:string; days:number[]; timeLabel:string }>({ title:'', emoji:'', color:C.cyan, days:[], timeLabel:'' })

  const calYear = calDate.getFullYear()
  const calMonth = calDate.getMonth()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const daysInPrev = new Date(calYear, calMonth, 0).getDate()
  const calCells: { day: number; cur: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) calCells.push({ day: daysInPrev - i, cur: false })
  for (let i = 1; i <= daysInMonth; i++) calCells.push({ day: i, cur: true })
  let nextMonthDay = 1
  while (calCells.length < 42) calCells.push({ day: nextMonthDay++, cur: false })
  const weekDates = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekStart, i)))

  const fetchWeek = useCallback(async () => {
    setLoading(true)
    try {
      const allDates = Array.from({ length: 14 }, (_, i) => toDateStr(addDays(weekStart, i)))
      const startDate = allDates[0]
      const endDate = allDates[allDates.length - 1]
      const { data } = await supabase
        .from('master_tasks')
        .select('*')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .neq('archived', true)
        .neq('status', 'Done')
        .order('is_frog', { ascending: false })
        .order('created_at')
      const map: Record<string, Task[]> = {}
      for (const date of allDates) map[date] = []
      for (const t of (data ?? [])) {
        if (t.due_date && map[t.due_date]) map[t.due_date].push(t as Task)
      }
      setWeekTasks(map)
    } catch {}
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  useEffect(() => {
    supabase
      .from('workflow_sessions')
      .select('id,title,workflow_type:workflow_types(name,icon)')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setWfSessions((data as unknown as WFSession[]) ?? []))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('flowstate_cal_habits')
      if (raw) setHabits(JSON.parse(raw) as HabitBlock[])
    } catch {}
  }, [])

  function handleOrganise() { setOrgPlan(buildOrganisePlan(weekTasks, weekStart)) }

  async function handleApply() {
    if (!orgPlan || orgPlan.length === 0) { setOrgPlan(null); return }
    setApplying(true)
    try {
      await Promise.all(orgPlan.map(m => supabase.from('master_tasks').update({ due_date: m.to }).eq('id', m.id)))
      setOrgPlan(null)
      await fetchWeek()
    } catch {}
    setApplying(false)
  }

  async function handleAddTask(date: string, title: string, type: string) {
    setAddingFor(null)
    try {
      const { data, error } = await supabase
        .from('master_tasks')
        .insert({ title, due_date: date, task_type: type, status: 'Not started' })
        .select()
        .single()
      if (!error && data) setWeekTasks(prev => ({ ...prev, [date]: [...(prev[date] ?? []), data as Task] }))
    } catch {}
  }

  async function handleComplete(id: string, date: string) {
    try {
      await supabase.from('master_tasks').update({ status: 'Done' }).eq('id', id)
      setWeekTasks(prev => ({ ...prev, [date]: (prev[date] ?? []).filter(t => t.id !== id) }))
    } catch {}
  }

  async function handleDelete(id: string, date: string) {
    try {
      await supabase.from('master_tasks').update({ archived: true }).eq('id', id)
      setWeekTasks(prev => ({ ...prev, [date]: (prev[date] ?? []).filter(t => t.id !== id) }))
    } catch {}
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: task.id, fromDate: task.due_date }))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, toDate: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(toDate)
  }

  async function handleDrop(e: React.DragEvent, toDate: string) {
    e.preventDefault()
    setDragOverDate(null)
    try {
      const { id, fromDate } = JSON.parse(e.dataTransfer.getData('application/json')) as { id: string; fromDate: string | null }
      if (!fromDate || fromDate === toDate) return
      await supabase.from('master_tasks').update({ due_date: toDate }).eq('id', id)
      setWeekTasks(prev => {
        const task = (prev[fromDate] ?? []).find(t => t.id === id)
        if (!task) return prev
        return {
          ...prev,
          [fromDate]: (prev[fromDate] ?? []).filter(t => t.id !== id),
          [toDate]: [...(prev[toDate] ?? []), { ...task, due_date: toDate }],
        }
      })
    } catch {}
  }

  function jumpToWeek(day: number) { setWeekStart(getMondayOfWeek(new Date(calYear, calMonth, day))) }
  function isInCurrentWeek(day: number): boolean { return weekDates.includes(toDateStr(new Date(calYear, calMonth, day))) }

  async function handleOrganiseOverdue() {
    setOverdueLoading(true)
    try {
      const { data: overdueTasks } = await supabase
        .from('master_tasks').select('*')
        .lt('due_date', todayStr).neq('archived', true).neq('status', 'Done')
        .order('due_date', { ascending: true })

      const todayOverflow = (weekTasks[todayStr] ?? [])
        .filter(t => t.task_type === 'Flow').slice(2)

      const futureEnd = toDateStr(addDays(today, 28))
      const { data: futureTasks } = await supabase
        .from('master_tasks').select('id,due_date,task_type')
        .gte('due_date', todayStr).lte('due_date', futureEnd)
        .neq('archived', true).neq('status', 'Done')

      const flowSlots: Record<string, number> = {}
      for (const t of (futureTasks ?? [])) {
        if (t.task_type === 'Flow' && t.due_date)
          flowSlots[t.due_date] = (flowSlots[t.due_date] ?? 0) + 1
      }

      const allToMove: Task[] = [...((overdueTasks ?? []) as Task[]), ...todayOverflow]
      const moves: OverdueMove[] = []

      for (const task of allToMove) {
        if (task.task_type === 'Flow') {
          let placed = false
          for (let i = 0; i < 28; i++) {
            const d = toDateStr(addDays(today, i))
            if ((flowSlots[d] ?? 0) < 2) {
              flowSlots[d] = (flowSlots[d] ?? 0) + 1
              moves.push({ id: task.id, title: task.title, task_type: task.task_type, fromDate: task.due_date ?? todayStr, toDate: d, selected: true })
              placed = true; break
            }
          }
          if (!placed) {
            const fallback = toDateStr(addDays(today, 28))
            moves.push({ id: task.id, title: task.title, task_type: task.task_type, fromDate: task.due_date ?? todayStr, toDate: fallback, selected: true })
          }
        } else {
          moves.push({ id: task.id, title: task.title, task_type: task.task_type, fromDate: task.due_date ?? todayStr, toDate: toDateStr(addDays(today, 1)), selected: true })
        }
      }
      setOverduePlan(moves)
    } catch {}
    setOverdueLoading(false)
  }

  async function handleApplyOverdue() {
    if (!overduePlan) return
    const selected = overduePlan.filter(m => m.selected)
    setApplying(true)
    try {
      await Promise.all(selected.map(m => supabase.from('master_tasks').update({ due_date: m.toDate }).eq('id', m.id)))
      setOverduePlan(null)
      await fetchWeek()
    } catch {}
    setApplying(false)
  }

  function toggleOverdueMove(id: string) {
    setOverduePlan(prev => prev ? prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m) : prev)
  }
  function selectAllOverdue(val: boolean) {
    setOverduePlan(prev => prev ? prev.map(m => ({ ...m, selected: val })) : prev)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditType(task.task_type ?? 'Flow')
    setEditDueDate(task.due_date ?? todayStr)
    setEditUrgency(task.urgency ?? '')
    setEditIsFrog(task.is_frog)
  }

  async function handleSaveEdit() {
    if (!editingTask) return
    setSavingEdit(true)
    try {
      await supabase.from('master_tasks').update({
        title: editTitle, task_type: editType, due_date: editDueDate,
        urgency: editUrgency || null, is_frog: editIsFrog,
      }).eq('id', editingTask.id)
      const oldDate = editingTask.due_date ?? todayStr
      const updated = { ...editingTask, title: editTitle, task_type: editType, due_date: editDueDate, urgency: editUrgency || null, is_frog: editIsFrog }
      setWeekTasks(prev => {
        const next = { ...prev }
        if (next[oldDate]) next[oldDate] = next[oldDate].filter(t => t.id !== editingTask.id)
        if (next[editDueDate] !== undefined) next[editDueDate] = [...(next[editDueDate] ?? []), updated]
        return next
      })
      setEditingTask(null)
    } catch {}
    setSavingEdit(false)
  }

  async function handleDeleteFromEdit() {
    if (!editingTask) return
    await handleDelete(editingTask.id, editingTask.due_date ?? todayStr)
    setEditingTask(null)
  }

  function openHabitForm(h: HabitBlock | null) {
    setEditingHabit(h)
    setHabitDraft(h ? { title:h.title, emoji:h.emoji, color:h.color, days:[...h.days], timeLabel:h.timeLabel } : { title:'', emoji:'', color:C.cyan, days:[], timeLabel:'' })
    setShowHabitModal(true)
  }

  function saveHabit() {
    if (!habitDraft.title.trim() || habitDraft.days.length === 0) return
    const h: HabitBlock = {
      id: editingHabit?.id ?? (Date.now().toString()),
      title: habitDraft.title.trim(), emoji: habitDraft.emoji,
      color: habitDraft.color, days: habitDraft.days, timeLabel: habitDraft.timeLabel,
    }
    setHabits(prev => {
      const next = editingHabit ? prev.map(x => x.id === h.id ? h : x) : [...prev, h]
      localStorage.setItem('flowstate_cal_habits', JSON.stringify(next))
      return next
    })
    setShowHabitModal(false)
    setEditingHabit(null)
  }

  function deleteHabit(id: string) {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id)
      localStorage.setItem('flowstate_cal_habits', JSON.stringify(next))
      return next
    })
    setShowHabitModal(false)
    setEditingHabit(null)
  }

  return (
    <main style={{ minHeight:'100vh', maxHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.5rem', borderBottom:'1px solid '+C.border, flexShrink:0, flexWrap:'wrap', gap:'0.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}>
            <ArrowLeft size={14} />Home
          </button>
          <span style={{ color:C.border }}>|</span>
          <span style={{ fontWeight:800, color:C.text }}>Calendar</span>
          {loading && <div style={{ width:'12px', height:'12px', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }} />}
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button onClick={() => router.push('/morning')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.75rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            <Sun size={12} />Morning
          </button>
          <button onClick={() => router.push('/tracking')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'0.75rem', color:'#8b5cf6', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            &#128293; Tracking
          </button>
          <button onClick={handleOrganiseOverdue} disabled={overdueLoading} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.25)', borderRadius:'0.75rem', color:C.red, cursor:overdueLoading?'wait':'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, opacity:overdueLoading?0.6:1 }}>
            &#128467; {overdueLoading ? 'Loading...' : 'Organise'}
          </button>
          <button onClick={handleOrganise} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(0,212,255,0.15))', border:'1px solid rgba(139,92,246,0.4)', borderRadius:'0.75rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            <Zap size={12} />Organise Week
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Sidebar */}
        <div style={{ width:'240px', flexShrink:0, padding:'1rem', borderRight:'1px solid '+C.border, overflowY:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
            <button onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))} style={{ width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronLeft size={14} /></button>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontWeight:700, fontSize:'0.875rem', color:C.text, margin:0 }}>{MONTHS[calMonth]}</p>
              <p style={{ fontSize:'0.7rem', color:C.muted, margin:0 }}>{calYear}</p>
            </div>
            <button onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))} style={{ width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronRight size={14} /></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'3px' }}>
            {DAY_ABBR.map(d => <div key={d} style={{ textAlign:'center', fontSize:'0.55rem', fontWeight:700, color:C.muted }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
            {calCells.map((cell, i) => {
              const cellStr = toDateStr(new Date(calYear, calMonth, cell.day))
              const isT = cell.cur && cellStr === todayStr
              const inWeek = cell.cur && isInCurrentWeek(cell.day)
              return (
                <button key={i} onClick={() => cell.cur && jumpToWeek(cell.day)} style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0.375rem', border:'1px solid '+(isT?C.cyan:inWeek?'rgba(0,212,255,0.2)':'transparent'), background:isT?'rgba(0,212,255,0.12)':inWeek?'rgba(0,212,255,0.05)':'transparent', cursor:cell.cur?'pointer':'default', fontFamily:'inherit', padding:0 }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:isT||inWeek?700:400, color:!cell.cur?C.muted:isT?C.cyan:inWeek?'rgba(0,212,255,0.8)':C.text }}>{cell.day}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => { setCalDate(new Date(today.getFullYear(), today.getMonth(), 1)); setWeekStart(getMondayOfWeek(today)) }}
            style={{ marginTop:'0.75rem', width:'100%', padding:'0.4rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem' }}>Today</button>

          <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:0 }}>Task Types</p>
            {([['Flow',C.cyan],['Personal',C.purple],['Admin',C.muted],['Quick Task',C.amber]] as [string,string][]).map(([label,color]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:color, flexShrink:0 }} />
                <span style={{ fontSize:'0.7rem', color:C.sec }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop:'0.5rem', padding:'0.6rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem' }}>
              <p style={{ fontSize:'0.65rem', color:C.muted, margin:0, lineHeight:1.5 }}>Max <strong style={{ color:C.cyan }}>2 Flow</strong> per day. Drag tasks between columns to reschedule.</p>
            </div>
          </div>

          <div style={{ marginTop:'1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:0 }}>Habits &amp; Blocks</p>
              <button onClick={() => openHabitForm(null)} style={{ fontSize:'0.65rem', color:C.green, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>+ Add</button>
            </div>
            {habits.length === 0 ? (
              <p style={{ fontSize:'0.68rem', color:C.muted, lineHeight:1.5, margin:0 }}>No habits yet. Add recurring blocks like Gym, Walk, or Reading.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {habits.map(h => (
                  <button key={h.id} onClick={() => openHabitForm(h)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.3rem 0.4rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.375rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:h.color, flexShrink:0 }} />
                    {h.emoji && <span style={{ fontSize:'0.8rem', lineHeight:1 }}>{h.emoji}</span>}
                    <span style={{ fontSize:'0.7rem', color:C.sec, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.title}</span>
                    <span style={{ fontSize:'0.58rem', color:C.muted }}>{h.days.length}d/wk</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {wfSessions.length > 0 && (
            <div style={{ marginTop:'1.25rem' }}>
              <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Workflows</p>
              {schedulingId
                ? <p style={{ fontSize:'0.65rem', color:C.cyan, margin:'0 0 0.5rem', lineHeight:1.4 }}>&#8593; Click a day column to schedule</p>
                : <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0 0 0.5rem', lineHeight:1.4 }}>Select a workflow then click a day</p>
              }
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {wfSessions.map(s => {
                  const active = schedulingId === s.id
                  return (
                    <button key={s.id} onClick={() => setSchedulingId(active ? null : s.id)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 0.5rem', background: active ? 'rgba(0,212,255,0.1)' : C.surface, border: '1px solid '+(active ? C.cyan : C.border), borderRadius:'0.5rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ fontSize:'0.85rem', flexShrink:0 }}>{s.workflow_type?.icon ?? '&#9889;'}</span>
                      <span style={{ fontSize:'0.72rem', fontWeight:600, color:active?C.cyan:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{s.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {wfSessions.length === 0 && (
            <div style={{ marginTop:'1.25rem' }}>
              <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Workflows</p>
              <p style={{ fontSize:'0.68rem', color:C.muted, lineHeight:1.5 }}>No active workflows yet.</p>
            </div>
          )}
        </div>

        {/* Week grid */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
            <button onClick={() => setWeekStart(w => getMondayOfWeek(addDays(w, -7)))} style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight:700, fontSize:'0.9rem', color:C.text, flex:1 }}>{fmtWeekRange(weekStart)}</span>
            <button onClick={() => setWeekStart(w => getMondayOfWeek(addDays(w, 7)))} style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronRight size={16} /></button>
          </div>

          <div style={{ flex:1, display:'flex', overflowX:'auto', overflowY:'hidden', padding:'0.75rem', gap:'0.5rem' }}>
            {weekDates.map(date => {
              const tasks = weekTasks[date] ?? []
              const flowTasks = tasks.filter(t => t.task_type === 'Flow')
              const personalTasks = tasks.filter(t => t.task_type === 'Personal')
              const otherTasks = tasks.filter(t => t.task_type !== 'Flow' && t.task_type !== 'Personal')
              const dow = new Date(date+'T12:00:00').getDay()
              const dayName = DAY_ABBR[dow]
              const dayNum = parseInt(date.split('-')[2])
              const isToday = date === todayStr
              const isWeekend = dow === 0 || dow === 6
              const hasOverflow = flowTasks.length > 2
              const isDragOver = dragOverDate === date
              return (
                <div key={date}
                  onDragOver={e => handleDragOver(e, date)}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={e => handleDrop(e, date)}
                  style={{ flex:'1 1 140px', minWidth:'140px', maxWidth:'220px', display:'flex', flexDirection:'column', overflowY:'auto', borderRadius:'0.75rem', border:'1px solid '+(isDragOver?C.cyan:isToday?'rgba(0,212,255,0.25)':C.border), padding:'0.625rem', background:isDragOver?'rgba(0,212,255,0.04)':isWeekend?'rgba(255,255,255,0.01)':'transparent', transition:'border-color 0.15s, background 0.15s' }}>
                  <div
                    onClick={() => { if (schedulingId) { const s = wfSessions.find(w => w.id === schedulingId); if (s) { handleAddTask(date, s.title, 'Flow'); setSchedulingId(null) } } }}
                    style={{ textAlign:'center', marginBottom:'0.5rem', paddingBottom:'0.5rem', borderBottom:'1px solid '+(schedulingId?C.cyan:C.border), cursor:schedulingId?'crosshair':'default', transition:'border-color 0.2s' }}>
                    <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 0.1rem', color:isToday?C.cyan:isWeekend?C.muted:C.sec }}>{dayName}</p>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
                      <p style={{ fontSize:'1.25rem', fontWeight:900, margin:0, color:isToday?C.cyan:isWeekend?C.sec:C.text }}>{dayNum}</p>
                      <button onClick={e => { e.stopPropagation(); setAddingFor(date) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', display:'flex', alignItems:'center', lineHeight:1, marginTop:'2px' }}>
                        <Plus size={11} />
                      </button>
                    </div>
                    {isToday && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.cyan, margin:'0.15rem auto 0' }} />}
                    {schedulingId && <div style={{ fontSize:'0.55rem', color:C.cyan, marginTop:'0.15rem', fontWeight:700 }}>+ add here</div>}
                  </div>

                  {habits.filter(h => h.days.includes(dow)).length > 0 && (
                    <div style={{ marginBottom:'0.5rem', display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                      {habits.filter(h => h.days.includes(dow)).map(h => (
                        <div key={h.id} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.2rem 0.4rem', borderRadius:'0.375rem', background:h.color+'20', border:'1px solid '+h.color+'50' }}>
                          {h.emoji && <span style={{ fontSize:'0.8rem', lineHeight:1, flexShrink:0 }}>{h.emoji}</span>}
                          <span style={{ fontSize:'0.63rem', fontWeight:600, color:h.color, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.title}</span>
                          {h.timeLabel && <span style={{ fontSize:'0.55rem', color:h.color, opacity:0.7, flexShrink:0 }}>{h.timeLabel}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginBottom:'0.625rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                      <p style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, margin:0 }}>Flow</p>
                      <span style={{ fontSize:'0.58rem', fontWeight:700, color:hasOverflow?C.red:flowTasks.length===2?C.amber:C.muted }}>{Math.min(flowTasks.length,2)}/2{hasOverflow?' !':''}</span>
                    </div>
                    {flowTasks.slice(0,2).map(t => (
                      <TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} />
                    ))}
                    {flowTasks.length === 0 && (
                      <div style={{ height:'36px', border:'1px dashed rgba(0,212,255,0.2)', borderRadius:'0.5rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'0.6rem', color:C.muted }}>empty</span>
                      </div>
                    )}
                    {hasOverflow && <p style={{ fontSize:'0.6rem', color:C.red, margin:'0.2rem 0 0', textAlign:'center' }}>+{flowTasks.length-2} overflow</p>}
                  </div>

                  {otherTasks.length > 0 && (
                    <div style={{ marginBottom:'0.625rem' }}>
                      <p style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.amber, margin:'0 0 0.3rem' }}>Tasks</p>
                      {otherTasks.map(t => (<TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} />))}
                    </div>
                  )}

                  <div style={{ borderTop:'1px solid rgba(139,92,246,0.2)', paddingTop:'0.5rem', marginTop:'auto' }}>
                    <p style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.purple, margin:'0 0 0.3rem' }}>Evening</p>
                    {personalTasks.map(t => (<TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} />))}
                    {personalTasks.length === 0 && (
                      <div style={{ height:'32px', border:'1px dashed rgba(139,92,246,0.2)', borderRadius:'0.5rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'0.6rem', color:C.muted }}>personal tasks</span>
                      </div>
                    )}
                  </div>

                  {addingFor === date ? (
                    <QuickAdd date={date} onSave={(title,type) => handleAddTask(date,title,type)} onClose={() => setAddingFor(null)} />
                  ) : (
                    <button onClick={() => setAddingFor(date)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.2rem', marginTop:'0.5rem', padding:'0.3rem', width:'100%', background:'transparent', border:'1px dashed '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem' }}>
                      <Plus size={10} />Add task
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Organise modal */}
      {orgPlan !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', maxHeight:'80vh', overflow:'auto', position:'relative' }}>
            <button onClick={() => setOrgPlan(null)} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
              <Zap size={18} color={C.purple} />
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>Organise Week</h2>
            </div>
            <p style={{ fontSize:'0.8rem', color:C.sec, marginBottom:'1rem', lineHeight:1.5 }}>Max 2 Flow tasks per day. Overflow pushed to next available day within 14 days.</p>
            {orgPlan.length === 0 ? (
              <div style={{ padding:'1.25rem', background:C.surface, borderRadius:'0.75rem', textAlign:'center' }}>
                <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }}>&#10003;</div>
                <p style={{ fontWeight:700, color:C.green, margin:'0 0 0.25rem' }}>Already organised</p>
                <p style={{ fontSize:'0.8rem', color:C.sec, margin:0 }}>No day has more than 2 Flow tasks.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize:'0.75rem', color:C.amber, fontWeight:600, marginBottom:'0.75rem' }}>{orgPlan.length} task{orgPlan.length!==1?'s':''} will be rescheduled:</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginBottom:'1.25rem' }}>
                  {orgPlan.map(m => {
                    const fmtD = (s: string) => new Date(s+'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
                    return (
                      <div key={m.id} style={{ padding:'0.625rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem' }}>
                        <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</p>
                        <p style={{ fontSize:'0.7rem', color:C.sec, margin:0 }}>{fmtD(m.from)} <span style={{ color:C.purple }}>&rarr;</span> <span style={{ color:C.cyan }}>{fmtD(m.to)}</span></p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
              <button onClick={() => setOrgPlan(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
              {orgPlan.length > 0 && (
                <button onClick={handleApply} disabled={applying} style={{ padding:'0.5rem 1.25rem', background:'linear-gradient(135deg,'+C.purple+',rgba(139,92,246,0.7))', border:'none', borderRadius:'0.625rem', color:'#fff', fontWeight:700, cursor:applying?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:applying?0.6:1 }}>
                  {applying?'Applying...':'Apply'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {overduePlan !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'32rem', maxHeight:'85vh', display:'flex', flexDirection:'column', position:'relative' }}>
            <button onClick={() => setOverduePlan(null)} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.35rem' }}>
              <span style={{ fontSize:'1.1rem' }}>&#128467;</span>
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>Organise Overdue</h2>
            </div>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.5 }}>
              Overdue tasks scheduled first, then today&apos;s overflow. Flow tasks fill the next available slot (max 2/day). Deselect anything you want to handle manually.
            </p>

            {overduePlan.length === 0 ? (
              <div style={{ padding:'1.5rem', background:C.surface, borderRadius:'0.75rem', textAlign:'center' }}>
                <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }}>&#10003;</div>
                <p style={{ fontWeight:700, color:C.green, margin:'0 0 0.25rem' }}>Nothing to organise</p>
                <p style={{ fontSize:'0.8rem', color:C.sec, margin:0 }}>No overdue tasks and no overflow today.</p>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.625rem' }}>
                  <p style={{ fontSize:'0.75rem', color:C.amber, fontWeight:600, margin:0 }}>
                    {overduePlan.filter(m => m.selected).length} of {overduePlan.length} selected
                  </p>
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    <button onClick={() => selectAllOverdue(true)} style={{ fontSize:'0.65rem', padding:'0.2rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.25rem', color:C.sec, cursor:'pointer', fontFamily:'inherit' }}>All</button>
                    <button onClick={() => selectAllOverdue(false)} style={{ fontSize:'0.65rem', padding:'0.2rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.25rem', color:C.sec, cursor:'pointer', fontFamily:'inherit' }}>None</button>
                  </div>
                </div>
                <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'0.35rem', marginBottom:'1rem' }}>
                  {overduePlan.map(m => {
                    const fmtD = (s: string) => new Date(s+'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
                    const typeColor = m.task_type === 'Flow' ? C.cyan : m.task_type === 'Personal' ? C.purple : C.amber
                    const isOverdue = m.fromDate < todayStr
                    return (
                      <button key={m.id} onClick={() => toggleOverdueMove(m.id)} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 0.75rem', background:m.selected ? 'rgba(255,255,255,0.04)' : 'transparent', border:'1px solid '+(m.selected ? C.border : 'rgba(255,255,255,0.06)'), borderRadius:'0.625rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all 0.1s', opacity:m.selected ? 1 : 0.45 }}>
                        <div style={{ width:'16px', height:'16px', borderRadius:'3px', border:'2px solid '+(m.selected ? C.cyan : C.muted), background:m.selected ? 'rgba(0,212,255,0.15)' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {m.selected && <span style={{ fontSize:'0.6rem', color:C.cyan, fontWeight:900 }}>&#10003;</span>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap' }}>
                            {isOverdue && <span style={{ fontSize:'0.58rem', color:C.red, border:'1px solid rgba(255,68,68,0.4)', borderRadius:'0.2rem', padding:'0 0.25rem', lineHeight:1.6 }}>Overdue</span>}
                            {m.task_type && <span style={{ fontSize:'0.58rem', color:typeColor, border:'1px solid '+typeColor, borderRadius:'0.2rem', padding:'0 0.25rem', lineHeight:1.6, opacity:0.8 }}>{m.task_type}</span>}
                            <span style={{ fontSize:'0.7rem', color:C.muted }}>{fmtD(m.fromDate)}</span>
                            <span style={{ color:C.purple, fontSize:'0.7rem' }}>&rarr;</span>
                            <span style={{ fontSize:'0.7rem', color:C.cyan, fontWeight:600 }}>{fmtD(m.toDate)}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={() => setOverduePlan(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
              {overduePlan.length > 0 && (
                <button onClick={handleApplyOverdue} disabled={applying || overduePlan.filter(m => m.selected).length === 0} style={{ padding:'0.5rem 1.25rem', background:'linear-gradient(135deg,'+C.red+',rgba(255,68,68,0.7))', border:'none', borderRadius:'0.625rem', color:'#fff', fontWeight:700, cursor:(applying || overduePlan.filter(m => m.selected).length === 0) ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(applying || overduePlan.filter(m => m.selected).length === 0) ? 0.5 : 1 }}>
                  {applying ? 'Applying...' : `Move ${overduePlan.filter(m => m.selected).length} task${overduePlan.filter(m => m.selected).length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', position:'relative' }}>
            <button onClick={() => setEditingTask(null)} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <h2 style={{ margin:'0 0 1.25rem', fontSize:'1rem', fontWeight:800, color:C.text }}>Edit Task</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Type</label>
                <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
                  {['Flow','Personal','Admin','Quick Task'].map(t => (
                    <button key={t} onClick={() => setEditType(t)} style={{ fontSize:'0.7rem', padding:'0.25rem 0.5rem', borderRadius:'0.375rem', border:'1px solid '+(editType===t?C.cyan:C.border), background:editType===t?'rgba(0,212,255,0.1)':'transparent', color:editType===t?C.cyan:C.sec, cursor:'pointer', fontFamily:'inherit' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Due Date</label>
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
              </div>
              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Urgency</label>
                  <div style={{ display:'flex', gap:'0.3rem' }}>
                    {[['Normal',''],['Urgent','Urgent']].map(([lbl,val]) => (
                      <button key={val} onClick={() => setEditUrgency(val)} style={{ fontSize:'0.7rem', padding:'0.25rem 0.5rem', borderRadius:'0.375rem', border:'1px solid '+(editUrgency===val?(val?C.red:C.green):C.border), background:editUrgency===val?(val?'rgba(255,68,68,0.1)':'rgba(0,255,136,0.1)'):'transparent', color:editUrgency===val?(val?C.red:C.green):C.sec, cursor:'pointer', fontFamily:'inherit' }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Frog</label>
                  <button onClick={() => setEditIsFrog(f => !f)} style={{ fontSize:'0.7rem', padding:'0.25rem 0.5rem', borderRadius:'0.375rem', border:'1px solid '+(editIsFrog?C.amber:C.border), background:editIsFrog?'rgba(255,184,0,0.1)':'transparent', color:editIsFrog?C.amber:C.sec, cursor:'pointer', fontFamily:'inherit' }}
                    dangerouslySetInnerHTML={{ __html: editIsFrog ? '&#128293; Frog' : 'Set as Frog' }} />
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <button onClick={handleDeleteFromEdit} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setEditingTask(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={savingEdit || !editTitle.trim()} style={{ padding:'0.5rem 1.25rem', background:C.cyan, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:(savingEdit||!editTitle.trim())?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(savingEdit||!editTitle.trim())?0.5:1 }}>
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Habit form modal */}
      {showHabitModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'26rem', position:'relative' }}>
            <button onClick={() => { setShowHabitModal(false); setEditingHabit(null) }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <h2 style={{ margin:'0 0 1.25rem', fontSize:'1rem', fontWeight:800, color:C.text }}>{editingHabit ? 'Edit Habit' : 'Add Habit'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Name</label>
                  <input value={habitDraft.title} onChange={e => setHabitDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Gym, Walk, Reading"
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ width:'64px' }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Icon</label>
                  <input value={habitDraft.emoji} onChange={e => setHabitDraft(d => ({ ...d, emoji: e.target.value }))} placeholder="&#128170;" maxLength={2}
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem', padding:'0.45rem 0.5rem', outline:'none', textAlign:'center', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Colour</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[C.cyan, C.green, C.amber, C.purple, C.red].map(col => (
                    <button key={col} onClick={() => setHabitDraft(d => ({ ...d, color: col }))} style={{ width:'26px', height:'26px', borderRadius:'50%', background:col, border: habitDraft.color===col ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', padding:0, outline:'none' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Days</label>
                <div style={{ display:'flex', gap:'0.3rem' }}>
                  {([['Mo',1],['Tu',2],['We',3],['Th',4],['Fr',5],['Sa',6],['Su',0]] as [string,number][]).map(([lbl,d]) => {
                    const sel = habitDraft.days.includes(d)
                    return (
                      <button key={d} onClick={() => setHabitDraft(p => ({ ...p, days: sel ? p.days.filter(x => x !== d) : [...p.days, d] }))}
                        style={{ width:'30px', height:'30px', borderRadius:'50%', border:'1px solid '+(sel?habitDraft.color:C.border), background:sel?habitDraft.color+'33':'transparent', color:sel?habitDraft.color:C.muted, fontSize:'0.62rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:0 }}>{lbl}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional)</label>
                <input value={habitDraft.timeLabel} onChange={e => setHabitDraft(d => ({ ...d, timeLabel: e.target.value }))} placeholder="e.g. 7-8am"
                  style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <div>
                {editingHabit && (
                  <button onClick={() => deleteHabit(editingHabit.id)} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>
                )}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => { setShowHabitModal(false); setEditingHabit(null) }} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={saveHabit} disabled={!habitDraft.title.trim() || habitDraft.days.length === 0}
                  style={{ padding:'0.5rem 1.25rem', background:habitDraft.color, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:(!habitDraft.title.trim()||habitDraft.days.length===0)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(!habitDraft.title.trim()||habitDraft.days.length===0)?0.5:1 }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
