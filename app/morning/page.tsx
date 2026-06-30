'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle2, ExternalLink, Plus, Lock, Unlock, Flame } from 'lucide-react'
import { MORNING_ROUTINE, DAY_START_HOUR, DAY_END_HOUR } from '@/lib/morningRoutine'
import type { RoutineItem } from '@/lib/morningRoutine'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#ff8c00',
}

type DailyTask = {
  id: string
  title: string
  due_date: string | null
  status: string
  urgency: string | null
  importance: string | null
  time_commitment: string | null
  task_type: string | null
  is_frog: boolean
  why_note: string | null
  notion_id: string | null
}

type StreakInfo = { current: number; longest: number; completedToday: boolean }
type Intention = { id: string; intention_date: string; intention_text: string; locked: boolean } | null

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i)

function fmtHour(h: number) {
  if (h === 0 || h === 24) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function commitMins(tc: string | null): number {
  if (!tc) return 30
  if (tc.includes('60')) return 75
  if (tc.includes('30')) return 45
  if (tc.includes('15')) return 22
  return 15
}

function taskScore(t: DailyTask): number {
  let s = 0
  if (t.is_frog) s += 10
  if (t.urgency?.includes('Urgent')) s += 6
  if (t.importance?.includes('needle')) s += 5
  if (t.importance?.includes('Important')) s += 4
  return s
}

function autoSchedule(tasks: DailyTask[]): Map<string, number> {
  const map = new Map<string, number>()
  const cap = new Map<number, number>()
  HOURS.forEach(h => { if (h >= 9) cap.set(h, 55) })

  const sorted = [...tasks].sort((a, b) => taskScore(b) - taskScore(a))
  for (const task of sorted) {
    const mins = commitMins(task.time_commitment)
    const isUrgent = task.urgency?.includes('Urgent')
    const isImportant = task.importance?.includes('Important') || task.importance?.includes('needle') || task.is_frog
    let start = isUrgent && isImportant ? 9 : isUrgent ? 10 : isImportant ? 11 : 14
    let placed = false
    for (let h = start; h <= DAY_END_HOUR - 1; h++) {
      const c = cap.get(h) ?? 0
      if (c >= Math.min(mins, 25)) { map.set(task.id, h); cap.set(h, c - Math.min(mins, 55)); placed = true; break }
    }
    if (!placed) map.set(task.id, 18)
  }
  return map
}

type ReorgItem = { task: DailyTask; newDate: string }
function buildReorgPlan(tasks: DailyTask[], today: string): { keep: DailyTask[]; move: ReorgItem[] } {
  const sorted = [...tasks].sort((a, b) => taskScore(b) - taskScore(a))
  const CAPACITY = 420
  let used = 0; const keep: DailyTask[] = []; const move: ReorgItem[] = []
  for (const t of sorted) {
    const mins = commitMins(t.time_commitment)
    if (used + mins <= CAPACITY) { keep.push(t); used += mins }
    else {
      const score = taskScore(t)
      const days = Math.min(score >= 9 ? 1 : score >= 4 ? 2 : 3, 7)
      const d = new Date(today + 'T00:00:00')
      d.setDate(d.getDate() + days)
      move.push({ task: t, newDate: d.toISOString().split('T')[0] })
    }
  }
  return { keep, move }
}

function urgencyColor(u: string | null) {
  if (!u) return C.muted
  if (u.includes('Urgent')) return C.red
  if (u === 'Habit') return C.purple
  return C.muted
}
function importanceColor(i: string | null) {
  if (!i) return C.muted
  if (i.includes('needle')) return C.green
  if (i.includes('Important')) return C.amber
  return C.muted
}

// ---- Task Block (timeline) ----
function TaskBlock({ task, onDragStart, onComplete, done, onClick }: {
  task: DailyTask; onDragStart: (id: string) => void
  onComplete: (id: string) => void; done: boolean; onClick: () => void
}) {
  const mins = commitMins(task.time_commitment)
  const h = Math.max(36, Math.round(mins * 0.8))
  const uc = urgencyColor(task.urgency)
  return (
    <div draggable onDragStart={() => onDragStart(task.id)} onClick={onClick}
      style={{ height: h + 'px', background: done ? 'rgba(0,255,136,0.04)' : C.card,
        border: '1px solid ' + (task.is_frog ? C.amber : C.border), borderLeft: '3px solid ' + uc,
        borderRadius: '0.5rem', padding: '0.375rem 0.5rem', cursor: 'grab', opacity: done ? 0.5 : 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: done ? C.muted : C.text, lineHeight: 1.2, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
          {task.is_frog ? '[F] ' : ''}{task.title}
        </p>
        <button onClick={e => { e.stopPropagation(); onComplete(task.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: done ? C.green : C.muted, padding: '1px', display: 'flex' }}>
          <CheckCircle2 size={12} />
        </button>
      </div>
      {h > 50 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {task.urgency && task.urgency !== 'Not Urgent' && (
            <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
              background: uc + '22', color: uc }}>
              {task.urgency.includes('Urgent') ? 'URG' : 'HABIT'}
            </span>
          )}
          {task.time_commitment && <span style={{ fontSize: '0.55rem', color: C.muted }}>{task.time_commitment}</span>}
          {task.why_note && <span style={{ fontSize: '0.55rem', color: C.cyan }}>why</span>}
        </div>
      )}
    </div>
  )
}

// ---- Routine Check ----
function RoutineCheck({ item, done, onToggle }: { item: RoutineItem; done: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem',
      background: done ? 'rgba(0,255,136,0.04)' : C.card, border: '1px solid ' + (done ? 'rgba(0,255,136,0.2)' : C.border),
      borderRadius: '0.625rem', cursor: 'pointer' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (done ? C.green : C.border),
        background: done ? C.green : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {done && <CheckCircle2 size={10} color="#000" />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: done ? C.muted : C.text, textDecoration: done ? 'line-through' : 'none' }}>{item.title}</p>
        {item.note && !done && <p style={{ fontSize: '0.65rem', color: C.muted, marginTop: 1 }}>{item.note}</p>}
      </div>
      <span style={{ fontSize: '0.65rem', color: C.muted }}>{item.minutes}m</span>
    </div>
  )
}

// ---- Why Panel ----
function WhyPanel({ task, onClose, onSave }: { task: DailyTask; onClose: () => void; onSave: (why: string) => void }) {
  const [text, setText] = useState(task.why_note ?? '')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem',
        width: 400, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.2s ease' }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.cyan, marginBottom: '0.25rem' }}>Why this task matters</p>
          <p style={{ fontWeight: 800, fontSize: '0.95rem', color: C.text }}>{task.title}</p>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Connect this to your deeper purpose... What will it cost you NOT to do this? What will you gain?"
          style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '0.625rem', padding: '0.75rem',
            color: C.text, fontSize: '0.8rem', lineHeight: 1.6, resize: 'vertical', minHeight: '100px',
            fontFamily: 'inherit', outline: 'none' }} />
        <div style={{ fontSize: '0.65rem', color: C.muted, fontStyle: 'italic' }}>
          &ldquo;Feelings often come after the action, not before.&rdquo; &mdash; Jim Rohn
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid ' + C.border,
            borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>Cancel</button>
          <button onClick={() => { onSave(text); onClose() }}
            style={{ padding: '0.5rem 1rem', background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)',
              borderRadius: '0.625rem', color: C.cyan, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>Save Why</button>
        </div>
      </div>
    </div>
  )
}

// ---- Add Task Modal ----
function AddTaskModal({ date, onClose, onAdded }: { date: string; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState('')
  const [importance, setImportance] = useState('')
  const [timeCommit, setTimeCommit] = useState('')
  const [isFrog, setIsFrog] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    await fetch('/api/day/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), due_date: date, urgency: urgency || null,
        importance: importance || null, time_commitment: timeCommit || null, is_frog: isFrog }),
    })
    onAdded()
    onClose()
  }

  const selStyle = (active: boolean, color: string) => ({
    padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid ' + (active ? color : C.border),
    background: active ? color + '22' : 'transparent', color: active ? color : C.sec,
    cursor: 'pointer', fontSize: '0.7rem', fontWeight: active ? 700 : 400, fontFamily: 'inherit',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem',
        width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.2s ease' }}>
        <p style={{ fontWeight: 800, fontSize: '1rem', color: C.text }}>Add Task</p>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Task title..."
          style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '0.625rem', padding: '0.625rem 0.75rem',
            color: C.text, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />

        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '0.375rem' }}>Urgency</p>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {['Urgent', 'Not Urgent', 'Habit'].map(u => (
              <button key={u} onClick={() => setUrgency(urgency === u ? '' : u)}
                style={selStyle(urgency === u, u === 'Urgent' ? C.red : u === 'Habit' ? C.purple : C.muted)}>{u}</button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '0.375rem' }}>Importance</p>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {['Important', 'Not Important', 'Moved the needle'].map(i => (
              <button key={i} onClick={() => setImportance(importance === i ? '' : i)}
                style={selStyle(importance === i, i === 'Important' ? C.amber : i === 'Moved the needle' ? C.green : C.muted)}>{i}</button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '0.375rem' }}>Time</p>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {['< 15mins', '15 - 30 mins', '30 - 60 mins', '60 + mins'].map(t => (
              <button key={t} onClick={() => setTimeCommit(timeCommit === t ? '' : t)}
                style={selStyle(timeCommit === t, C.cyan)}>{t}</button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <div onClick={() => setIsFrog(!isFrog)}
            style={{ width: 18, height: 18, borderRadius: '4px', border: '2px solid ' + (isFrog ? C.amber : C.border),
              background: isFrog ? C.amber : 'transparent', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: C.text }}>[F] Mark as Frog &mdash; top priority task of the day</span>
        </label>

        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', borderTop: '1px solid ' + C.border, paddingTop: '1rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid ' + C.border,
            borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()}
            style={{ padding: '0.5rem 1rem', background: title.trim() ? 'rgba(0,255,136,0.15)' : C.card,
              border: '1px solid ' + (title.trim() ? 'rgba(0,255,136,0.4)' : C.border),
              borderRadius: '0.625rem', color: title.trim() ? C.green : C.muted, cursor: title.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>
            {saving ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function MorningPage() {
  const router = useRouter()
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const dayLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [habits, setHabits] = useState<DailyTask[]>([])
  const [intention, setIntention] = useState<Intention>(null)
  const [intentionText, setIntentionText] = useState('')
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, longest: 0, completedToday: false })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [schedule, setSchedule] = useState<Map<string, number>>(new Map())
  const [dragging, setDragging] = useState<string | null>(null)
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set())
  const [doneRoutine, setDoneRoutine] = useState<Set<string>>(new Set())
  const [whyTask, setWhyTask] = useState<DailyTask | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [reorgPlan, setReorgPlan] = useState<{ keep: DailyTask[]; move: ReorgItem[] } | null>(null)
  const [reorging, setReorging] = useState(false)
  const intentionTimer = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await fetch(`/api/day?date=${dateStr}`)
      const d = await r.json()
      const allTasks: DailyTask[] = d.tasks ?? []
      const allHabits: DailyTask[] = d.habits ?? []
      setTasks(allTasks)
      setHabits(allHabits)
      setIntention(d.intention ?? null)
      setIntentionText(d.intention?.intention_text ?? '')
      setStreak(d.streak ?? { current: 0, longest: 0, completedToday: false })

      const sched = autoSchedule(allTasks)
      setSchedule(sched)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [dateStr])

  useEffect(() => { load() }, [load])

  // Auto-save intention with debounce
  function handleIntentionChange(text: string) {
    setIntentionText(text)
    if (intentionTimer.current) clearTimeout(intentionTimer.current)
    intentionTimer.current = setTimeout(async () => {
      await fetch('/api/day/intention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, text }),
      })
    }, 800)
  }

  async function toggleLock() {
    const newLocked = !(intention?.locked ?? false)
    await fetch('/api/day/intention', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, locked: newLocked }),
    })
    setIntention(prev => prev ? { ...prev, locked: newLocked } : { id: '', intention_date: dateStr, intention_text: intentionText, locked: newLocked })
  }

  function toggleTask(id: string) {
    setDoneTasks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleRoutine(id: string) {
    setDoneRoutine(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Mark full routine done -- triggers streak update
  const routineAllDone = MORNING_ROUTINE.every(r => doneRoutine.has(r.id)) && habits.every(h => doneTasks.has(h.id))
  useEffect(() => {
    if (routineAllDone && !streak.completedToday) {
      fetch('/api/day/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, complete: true }),
      }).then(r => r.json()).then(d => { if (d.streak) setStreak(d.streak) })
    }
  }, [routineAllDone, streak.completedToday, dateStr])

  async function saveWhy(id: string, why: string) {
    await fetch('/api/day/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, why_note: why }),
    })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, why_note: why } : t))
  }

  function onDrop(hour: number) {
    if (!dragging || intention?.locked) return
    setSchedule(prev => { const n = new Map(prev); n.set(dragging, hour); return n })
    setDragging(null)
  }

  function openReorg() { setReorgPlan(buildReorgPlan(tasks, dateStr)) }

  async function executeReorg() {
    if (!reorgPlan) return
    setReorging(true)
    try {
      await fetch('/api/day/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: reorgPlan.move.map(({ task, newDate }) => ({ id: task.id, due_date: newDate })) }),
      })
      setReorgPlan(null)
      await load(true)
    } catch {}
    setReorging(false)
  }

  const byHour = new Map<number, DailyTask[]>()
  HOURS.forEach(h => byHour.set(h, []))
  tasks.forEach(t => {
    const h = schedule.get(t.id)
    if (h !== undefined) { const arr = byHour.get(h) ?? []; arr.push(t); byHour.set(h, arr) }
  })

  const locked = intention?.locked ?? false
  const routineDoneCount = doneRoutine.size + habits.filter(h => doneTasks.has(h.id)).length
  const tasksDoneCount = [...doneTasks].filter(id => tasks.some(t => t.id === id)).length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.sec, gap: '0.75rem' }}>
      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      Loading your day...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes flameFlicker { 0%,100%{transform:scale(1) rotate(-3deg)} 50%{transform:scale(1.15) rotate(3deg)} }
      `}</style>

      {/* Intention banner */}
      <div style={{ background: 'rgba(139,92,246,0.06)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '0.625rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.purple, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>Today I will</span>
        <input value={intentionText} onChange={e => handleIntentionChange(e.target.value)}
          placeholder="...define your one clear intention for today"
          disabled={locked}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: locked ? C.sec : C.text,
            fontSize: '0.875rem', fontWeight: locked ? 400 : 600, fontFamily: 'inherit',
            cursor: locked ? 'default' : 'text' }} />
        <button onClick={toggleLock} title={locked ? 'Unlock day plan' : 'Lock day plan (pre-decide)'}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.625rem',
            background: locked ? 'rgba(255,184,0,0.12)' : 'transparent', border: '1px solid ' + (locked ? 'rgba(255,184,0,0.35)' : C.border),
            borderRadius: '0.5rem', color: locked ? C.amber : C.muted, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'inherit' }}>
          {locked ? <Lock size={11} /> : <Unlock size={11} />}
          {locked ? 'Locked' : 'Lock'}
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.push('/calendar')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} />Calendar
          </button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontWeight: 800, color: C.text }}>{dayLabel}</span>
          {refreshing && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.7rem', color: C.muted }}>
            Tasks: {tasksDoneCount}/{tasks.length}
          </span>
          <button onClick={() => setAddingTask(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem',
              background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '0.625rem',
              color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700 }}>
            <Plus size={11} />Task
          </button>
          <button onClick={openReorg}
            style={{ padding: '0.4rem 0.75rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: '0.625rem', color: C.purple, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700 }}>
            Organise Day
          </button>
          <button onClick={() => load(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: C.card,
              border: '1px solid ' + C.border, borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}>
            <RefreshCw size={11} />Refresh
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Morning routine + timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Morning routine with streak */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.amber }}>
                Morning Routine &mdash; 6am&ndash;9am
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {streak.current > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem',
                    background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.3)', borderRadius: '1rem' }}>
                    <span style={{ animation: 'flameFlicker 1.5s ease-in-out infinite', display: 'inline-block', fontSize: '0.875rem' }}>&#128293;</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.orange }}>{streak.current}</span>
                    <span style={{ fontSize: '0.6rem', color: C.muted }}>day streak</span>
                  </div>
                )}
                {streak.completedToday && (
                  <span style={{ fontSize: '0.6rem', color: C.green, fontWeight: 700 }}>&#10003; Done today</span>
                )}
                {streak.longest > 1 && (
                  <span style={{ fontSize: '0.6rem', color: C.muted }}>Best: {streak.longest}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {MORNING_ROUTINE.map(item => (
                <RoutineCheck key={item.id} item={item} done={doneRoutine.has(item.id)} onToggle={() => toggleRoutine(item.id)} />
              ))}
              {habits.map(h => (
                <div key={h.id} onClick={() => toggleTask(h.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem',
                    background: doneTasks.has(h.id) ? 'rgba(139,92,246,0.05)' : C.card,
                    border: '1px solid ' + (doneTasks.has(h.id) ? 'rgba(139,92,246,0.25)' : C.border),
                    borderRadius: '0.625rem', cursor: 'pointer' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (doneTasks.has(h.id) ? C.purple : C.border),
                    background: doneTasks.has(h.id) ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {doneTasks.has(h.id) && <CheckCircle2 size={10} color="#000" />}
                  </div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: doneTasks.has(h.id) ? C.muted : C.text,
                    textDecoration: doneTasks.has(h.id) ? 'line-through' : 'none', flex: 1 }}>{h.title}</p>
                  <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(139,92,246,0.15)', color: C.purple, fontWeight: 700 }}>HABIT</span>
                </div>
              ))}
              {habits.length === 0 && (
                <p style={{ fontSize: '0.72rem', color: C.muted, fontStyle: 'italic', padding: '0.25rem 0.75rem' }}>
                  Add habit tasks with Urgency=Habit for today&apos;s date
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cyan }}>
                Day Timeline
              </p>
              {locked && <span style={{ fontSize: '0.6rem', color: C.amber, fontWeight: 700 }}><Lock size={9} /> Plan locked &mdash; drag disabled</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {HOURS.map(hour => {
                const isRoutine = hour >= 6 && hour < 9
                const hourTasks = byHour.get(hour) ?? []
                return (
                  <div key={hour}
                    onDragOver={e => { if (!locked) e.preventDefault() }}
                    onDrop={() => onDrop(hour)}
                    style={{ display: 'flex', minHeight: 48, borderTop: '1px solid ' + (hour === 9 ? C.cyan + '44' : C.border) }}>
                    <div style={{ width: 52, flexShrink: 0, paddingTop: 6, paddingRight: 8, textAlign: 'right' }}>
                      <span style={{ fontSize: '0.65rem', color: isRoutine ? C.amber : hour >= 9 && hour < 13 ? C.cyan : C.muted, fontWeight: hour % 3 === 0 ? 700 : 400 }}>
                        {fmtHour(hour)}
                      </span>
                    </div>
                    <div style={{ flex: 1, paddingLeft: 8, paddingTop: 4, paddingBottom: 4, minHeight: 44,
                      background: isRoutine ? 'rgba(255,184,0,0.02)' : 'transparent',
                      display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {isRoutine && hourTasks.length === 0 && (
                        <p style={{ fontSize: '0.6rem', color: C.amber + '66', fontStyle: 'italic', paddingTop: 6 }}>Morning routine time</p>
                      )}
                      {hourTasks.map(t => (
                        <TaskBlock key={t.id} task={t}
                          onDragStart={locked ? () => {} : setDragging}
                          onComplete={toggleTask}
                          done={doneTasks.has(t.id)}
                          onClick={() => setWhyTask(t)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Task queue */}
        <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid ' + C.border, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.purple }}>
              All Tasks ({tasks.length})
            </p>
            <button onClick={() => setAddingTask(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none',
                color: C.green, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit', fontWeight: 700 }}>
              <Plus size={11} />Add
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
            {[['URG', C.red], ['HABIT', C.purple], ['Important', C.amber], ['Needle', C.green]].map(([label, color]) => (
              <span key={label as string} style={{ fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: (color as string) + '22', color: color as string }}>{label as string}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {[...tasks].sort((a, b) => taskScore(b) - taskScore(a)).map(task => {
              const uc = urgencyColor(task.urgency)
              const ic = importanceColor(task.importance)
              const isDone = doneTasks.has(task.id)
              return (
                <div key={task.id} draggable onDragStart={() => !locked && setDragging(task.id)}
                  onClick={() => setWhyTask(task)}
                  style={{ padding: '0.5rem 0.625rem', background: isDone ? 'rgba(0,255,136,0.03)' : C.card,
                    border: '1px solid ' + (task.is_frog ? C.amber : C.border), borderLeft: '3px solid ' + uc,
                    borderRadius: '0.5rem', cursor: 'pointer', opacity: isDone ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: isDone ? C.muted : C.text,
                      textDecoration: isDone ? 'line-through' : 'none', flex: 1, lineHeight: 1.3 }}>
                      {task.is_frog ? '[F] ' : ''}{task.title}
                    </p>
                    <button onClick={e => { e.stopPropagation(); toggleTask(task.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDone ? C.green : C.muted, padding: 0 }}>
                      <CheckCircle2 size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.2rem' }}>
                    {task.urgency && task.urgency !== 'Not Urgent' && (
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: uc + '22', color: uc }}>
                        {task.urgency.includes('Urgent') ? 'URG' : 'HABIT'}
                      </span>
                    )}
                    {task.time_commitment && <span style={{ fontSize: '0.5rem', color: C.muted }}>{task.time_commitment}</span>}
                    {task.why_note && <span style={{ fontSize: '0.5rem', color: C.cyan }}>why &#10003;</span>}
                    <span style={{ fontSize: '0.5rem', color: C.muted, marginLeft: 'auto' }}>{fmtHour(schedule.get(task.id) ?? 14)}</span>
                  </div>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', paddingTop: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: C.muted, fontStyle: 'italic', textAlign: 'center' }}>No tasks for today yet.</p>
                <button onClick={() => setAddingTask(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem',
                    background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '0.625rem',
                    color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Plus size={12} />Add first task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Why Panel */}
      {whyTask && (
        <WhyPanel task={whyTask} onClose={() => setWhyTask(null)} onSave={(why) => saveWhy(whyTask.id, why)} />
      )}

      {/* Add Task Modal */}
      {addingTask && (
        <AddTaskModal date={dateStr} onClose={() => setAddingTask(false)} onAdded={() => load(true)} />
      )}

      {/* Organise Day Modal */}
      {reorgPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem',
            width: 480, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.25s ease' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: '1rem', color: C.text }}>Organise Day Plan</p>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.25rem' }}>Sorted by urgency + importance. Overflow moved within 7 days max.</p>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green, marginBottom: '0.375rem' }}>
                  Staying today ({reorgPlan.keep.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {reorgPlan.keep.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem',
                      background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '0.5rem' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                      <p style={{ fontSize: '0.75rem', color: C.text, flex: 1 }}>{t.is_frog ? '[F] ' : ''}{t.title}</p>
                      <span style={{ fontSize: '0.6rem', color: C.muted }}>{commitMins(t.time_commitment)}m</span>
                    </div>
                  ))}
                </div>
              </div>
              {reorgPlan.move.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.amber, marginBottom: '0.375rem' }}>
                    Moving later this week ({reorgPlan.move.length})
                  </p>
                  {reorgPlan.move.map(({ task: t, newDate }) => {
                    const d = new Date(newDate + 'T00:00:00')
                    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem',
                        background: 'rgba(255,184,0,0.04)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: '0.5rem', marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
                        <p style={{ fontSize: '0.75rem', color: C.text, flex: 1 }}>{t.title}</p>
                        <span style={{ fontSize: '0.6rem', color: C.amber, fontWeight: 700 }}>{label}</span>
                      </div>
                    )
                  })}
                  <p style={{ fontSize: '0.65rem', color: C.muted, marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Nothing pushed beyond 7 days. Never more without your approval.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', borderTop: '1px solid ' + C.border, paddingTop: '1rem' }}>
              <button onClick={() => setReorgPlan(null)}
                style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid ' + C.border, borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                Cancel
              </button>
              {reorgPlan.move.length === 0 ? (
                <button onClick={() => setReorgPlan(null)}
                  style={{ padding: '0.5rem 1rem', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '0.625rem', color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>
                  Day fits perfectly
                </button>
              ) : (
                <button onClick={executeReorg} disabled={reorging}
                  style={{ padding: '0.5rem 1rem', background: reorging ? C.card : 'rgba(139,92,246,0.2)',
                    border: '1px solid rgba(139,92,246,0.5)', borderRadius: '0.625rem', color: reorging ? C.muted : C.purple,
                    cursor: reorging ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>
                  {reorging ? 'Saving...' : 'Move ' + reorgPlan.move.length + ' task' + (reorgPlan.move.length !== 1 ? 's' : '')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
