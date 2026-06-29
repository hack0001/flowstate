'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react'
import type { NotionTask } from '@/lib/notion'
import { MORNING_ROUTINE, DAY_START_HOUR, DAY_END_HOUR } from '@/lib/morningRoutine'
import type { RoutineItem } from '@/lib/morningRoutine'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4444', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

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

// Auto-schedule tasks across hours based on urgency + importance
function autoSchedule(tasks: NotionTask[]): Map<string, number> {
  const map = new Map<string, number>()
  const hourCapacity = new Map<number, number>() // hour -> minutes remaining

  HOURS.forEach(h => { if (h >= 9) hourCapacity.set(h, 55) }) // 55 min per hour

  // Sort: urgent+important first, then urgent, then important, then rest
  const sorted = [...tasks].sort((a, b) => {
    const scoreA = (a.urgency?.includes('Urgent') ? 4 : 0) + (a.isFrog ? 4 : 0) +
      (a.importance?.includes('Important') || a.importance?.includes('needle') ? 2 : 0)
    const scoreB = (b.urgency?.includes('Urgent') ? 4 : 0) + (b.isFrog ? 4 : 0) +
      (b.importance?.includes('Important') || b.importance?.includes('needle') ? 2 : 0)
    return scoreB - scoreA
  })

  for (const task of sorted) {
    // If task already has a Notion time, parse and use it
    if (task.timeCommitment) {
      // Just auto-slot based on priority tier
    }
    const mins = commitMins(task.timeCommitment)
    const isUrgent = task.urgency?.includes('Urgent')
    const isImportant = task.importance?.includes('Important') || task.importance?.includes('needle') || task.isFrog

    // Pick starting hour based on priority
    let preferredStart: number
    if (isUrgent && isImportant) preferredStart = 9
    else if (isUrgent) preferredStart = 10
    else if (isImportant) preferredStart = 11
    else preferredStart = 14

    // Find first hour from preferred start with capacity
    let placed = false
    for (let h = preferredStart; h <= DAY_END_HOUR - 1; h++) {
      const cap = hourCapacity.get(h) ?? 0
      if (cap >= Math.min(mins, 25)) {
        map.set(task.id, h)
        hourCapacity.set(h, cap - Math.min(mins, 55))
        placed = true
        break
      }
    }
    if (!placed) map.set(task.id, 18) // fallback evening
  }
  return map
}

// Parse a time string like "9:00 AM" or "14:30" -> hour number
function parseTimeStr(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  let h = parseInt(m[1])
  const meridiem = m[3]?.toLowerCase()
  if (meridiem === 'pm' && h !== 12) h += 12
  if (meridiem === 'am' && h === 12) h = 0
  return h
}

type TaskBlockProps = {
  task: NotionTask
  onDragStart: (id: string) => void
  onComplete: (id: string) => void
  done: boolean
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
function importanceLabel(i: string | null) {
  if (!i) return null
  if (i.includes('needle')) return 'Needle'
  if (i.includes('Important')) return 'Important'
  return null
}

function TaskBlock({ task, onDragStart, onComplete, done }: TaskBlockProps) {
  const mins = commitMins(task.timeCommitment)
  const heightPx = Math.max(36, Math.round(mins * 0.8))
  const uc = urgencyColor(task.urgency)
  const ic = importanceColor(task.importance)
  const il = importanceLabel(task.importance)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      style={{
        height: heightPx + 'px',
        background: done ? 'rgba(0,255,136,0.04)' : C.card,
        border: '1px solid ' + (task.isFrog ? C.amber : C.border),
        borderLeft: '3px solid ' + uc,
        borderRadius: '0.5rem',
        padding: '0.375rem 0.5rem',
        cursor: 'grab',
        opacity: done ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        userSelect: 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: done ? C.muted : C.text, lineHeight: 1.2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
          {task.isFrog ? '[F] ' : ''}{task.title}
        </p>
        <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
          <button onClick={() => onComplete(task.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: done ? C.green : C.muted, padding: '1px', display: 'flex' }}>
            <CheckCircle2 size={12} />
          </button>
          {task.url && (
            <a href={task.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, display: 'flex' }}>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
      {heightPx > 50 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {task.urgency && task.urgency !== 'Non Urgent' && (
            <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: uc + '22', color: uc, letterSpacing: '0.04em' }}>
              {task.urgency.replace('Urgent', 'URG').replace('Habit', 'HABIT')}
            </span>
          )}
          {il && (
            <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: ic + '22', color: ic, letterSpacing: '0.04em' }}>{il}</span>
          )}
          {task.timeCommitment && (
            <span style={{ fontSize: '0.55rem', color: C.muted }}>{task.timeCommitment}</span>
          )}
        </div>
      )}
    </div>
  )
}

function RoutineCheck({ item, done, onToggle }: { item: RoutineItem; done: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', background: done ? 'rgba(0,255,136,0.04)' : C.card, border: '1px solid ' + (done ? 'rgba(0,255,136,0.2)' : C.border), borderRadius: '0.625rem', cursor: 'pointer', transition: 'all 0.2s' }}
      onClick={onToggle}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid ' + (done ? C.green : C.border), background: done ? C.green : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {done && <CheckCircle2 size={10} color="#000" />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: done ? C.muted : C.text, textDecoration: done ? 'line-through' : 'none' }}>{item.title}</p>
        {item.note && !done && <p style={{ fontSize: '0.65rem', color: C.muted, marginTop: '1px' }}>{item.note}</p>}
      </div>
      <span style={{ fontSize: '0.65rem', color: C.muted, flexShrink: 0 }}>{item.minutes}m</span>
    </div>
  )
}

export default function MorningPage() {
  const router = useRouter()
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const dayLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const [tasks, setTasks] = useState<NotionTask[]>([])
  const [habits, setHabits] = useState<NotionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [schedule, setSchedule] = useState<Map<string, number>>(new Map())
  const [dragging, setDragging] = useState<string | null>(null)
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set())
  const [doneRoutine, setDoneRoutine] = useState<Set<string>>(new Set())
  const [unscheduled, setUnscheduled] = useState<string[]>([])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await fetch(`/api/notion/day?date=${dateStr}`)
      const d = await r.json()
      const allTasks: NotionTask[] = d.tasks ?? []
      const allHabits: NotionTask[] = d.habits ?? []
      setTasks(allTasks)
      setHabits(allHabits)

      // Build schedule: Notion Time field first, then auto-schedule rest
      const sched = new Map<string, number>()
      const noTime: NotionTask[] = []
      for (const t of allTasks) {
        // Try parsing a time from the task (if a 'Time' property existed)
        const h = null // master DB doesn't have a separate Time text field yet
        if (h !== null) { sched.set(t.id, h as number) }
        else { noTime.push(t) }
      }
      const auto = autoSchedule(noTime)
      auto.forEach((h, id) => sched.set(id, h))
      setSchedule(sched)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [dateStr])

  useEffect(() => { load() }, [load])

  function toggleRoutine(id: string) {
    setDoneRoutine(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTask(id: string) {
    setDoneTasks(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function onDrop(hour: number) {
    if (!dragging) return
    setSchedule(prev => {
      const next = new Map(prev)
      next.set(dragging, hour)
      return next
    })
    setDragging(null)
  }

  // Group tasks by hour
  const byHour = new Map<number, NotionTask[]>()
  HOURS.forEach(h => byHour.set(h, []))
  tasks.forEach(t => {
    const h = schedule.get(t.id)
    if (h !== undefined) {
      const arr = byHour.get(h) ?? []
      arr.push(t)
      byHour.set(h, arr)
    }
  })

  const routineDoneCount = doneRoutine.size + habits.filter(h => doneTasks.has(h.id)).length
  const routineTotal = MORNING_ROUTINE.length + habits.length
  const tasksDoneCount = doneTasks.size
  const tasksTotal = tasks.length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.sec, gap: '0.75rem' }}>
      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      Loading your day...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.push('/calendar')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} />Calendar
          </button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontWeight: 800, color: C.text }}>{dayLabel}</span>
          {refreshing && <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: C.muted }}>
            Tasks: {tasksDoneCount}/{tasksTotal} &nbsp;|&nbsp; Routine: {routineDoneCount}/{routineTotal}
          </span>
          <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: C.card, border: '1px solid ' + C.border, borderRadius: '0.625rem', color: C.sec, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}>
            <RefreshCw size={11} />Refresh
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Morning routine + timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Morning routine */}
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.amber, marginBottom: '0.625rem' }}>
              Morning Routine &mdash; 6am&ndash;9am
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {MORNING_ROUTINE.map(item => (
                <RoutineCheck key={item.id} item={item} done={doneRoutine.has(item.id)} onToggle={() => toggleRoutine(item.id)} />
              ))}
              {habits.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', background: doneTasks.has(h.id) ? 'rgba(139,92,246,0.05)' : C.card, border: '1px solid ' + (doneTasks.has(h.id) ? 'rgba(139,92,246,0.25)' : C.border), borderRadius: '0.625rem', cursor: 'pointer' }}
                  onClick={() => toggleTask(h.id)}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid ' + (doneTasks.has(h.id) ? C.purple : C.border), background: doneTasks.has(h.id) ? C.purple : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {doneTasks.has(h.id) && <CheckCircle2 size={10} color="#000" />}
                  </div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: doneTasks.has(h.id) ? C.muted : C.text, textDecoration: doneTasks.has(h.id) ? 'line-through' : 'none', flex: 1 }}>{h.title}</p>
                  <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(139,92,246,0.15)', color: C.purple, fontWeight: 700 }}>HABIT</span>
                </div>
              ))}
              {habits.length === 0 && (
                <p style={{ fontSize: '0.72rem', color: C.muted, fontStyle: 'italic', padding: '0.25rem 0.75rem' }}>No habit tasks due today (tag tasks with Urgency=Habit in Notion)</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cyan, marginBottom: '0.625rem' }}>
              Day Timeline &mdash; drag tasks to reschedule
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {HOURS.map(hour => {
                const isRoutineHour = hour >= 6 && hour < 9
                const hourTasks = byHour.get(hour) ?? []
                return (
                  <div key={hour}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(hour)}
                    style={{ display: 'flex', minHeight: '48px', borderTop: '1px solid ' + (hour === 9 ? C.cyan + '44' : C.border), position: 'relative' }}>
                    {/* Hour label */}
                    <div style={{ width: '52px', flexShrink: 0, paddingTop: '6px', paddingRight: '8px', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.65rem', color: isRoutineHour ? C.amber : hour >= 9 && hour < 13 ? C.cyan : C.muted, fontWeight: hour % 3 === 0 ? 700 : 400 }}>
                        {fmtHour(hour)}
                      </span>
                    </div>
                    {/* Drop zone + tasks */}
                    <div style={{ flex: 1, paddingLeft: '8px', paddingTop: '4px', paddingBottom: '4px', minHeight: '44px', background: isRoutineHour ? 'rgba(255,184,0,0.02)' : hour < 9 ? 'rgba(0,0,0,0.1)' : 'transparent', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {isRoutineHour && hourTasks.length === 0 && (
                        <p style={{ fontSize: '0.6rem', color: C.amber + '66', fontStyle: 'italic', paddingTop: '6px' }}>Morning routine time</p>
                      )}
                      {hourTasks.map(t => (
                        <TaskBlock key={t.id} task={t} onDragStart={setDragging} onComplete={toggleTask} done={doneTasks.has(t.id)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Task queue / unscheduled */}
        <div style={{ width: '260px', flexShrink: 0, borderLeft: '1px solid ' + C.border, overflowY: 'auto', padding: '1rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.purple, marginBottom: '0.75rem' }}>
            All Tasks ({tasks.length})
          </p>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
            {[['URG', C.red], ['HABIT', C.purple], ['Important', C.amber], ['Needle', C.green]].map(([label, color]) => (
              <span key={label as string} style={{ fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: (color as string) + '22', color: color as string }}>{label as string}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {[...tasks].sort((a, b) => {
              const sa = (a.isFrog ? 4 : 0) + (a.urgency?.includes('Urgent') ? 3 : 0) + (a.importance?.includes('Important') || a.importance?.includes('needle') ? 2 : 0)
              const sb = (b.isFrog ? 4 : 0) + (b.urgency?.includes('Urgent') ? 3 : 0) + (b.importance?.includes('Important') || b.importance?.includes('needle') ? 2 : 0)
              return sb - sa
            }).map(task => {
              const uc = urgencyColor(task.urgency)
              const ic = importanceColor(task.importance)
              const il = importanceLabel(task.importance)
              const isDone = doneTasks.has(task.id)
              return (
                <div key={task.id}
                  draggable
                  onDragStart={() => setDragging(task.id)}
                  onClick={() => toggleTask(task.id)}
                  style={{ padding: '0.5rem 0.625rem', background: isDone ? 'rgba(0,255,136,0.03)' : C.card, border: '1px solid ' + (task.isFrog ? C.amber : C.border), borderLeft: '3px solid ' + uc, borderRadius: '0.5rem', cursor: 'grab', opacity: isDone ? 0.5 : 1 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: isDone ? C.muted : C.text, textDecoration: isDone ? 'line-through' : 'none', marginBottom: '0.2rem', lineHeight: 1.3 }}>
                    {task.isFrog ? '[F] ' : ''}{task.title}
                  </p>
                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {task.urgency && task.urgency !== 'Non Urgent' && (
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: uc + '22', color: uc }}>
                        {task.urgency.includes('Urgent') ? 'URG' : 'HABIT'}
                      </span>
                    )}
                    {il && <span style={{ fontSize: '0.5rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: ic + '22', color: ic }}>{il}</span>}
                    {task.timeCommitment && <span style={{ fontSize: '0.5rem', color: C.muted }}>{task.timeCommitment}</span>}
                    <span style={{ fontSize: '0.5rem', color: C.muted, marginLeft: 'auto' }}>{fmtHour(schedule.get(task.id) ?? 14)}</span>
                  </div>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: C.muted, fontStyle: 'italic' }}>No tasks for today &mdash; add some in Notion with today&apos;s date.</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </main>
  )
}
