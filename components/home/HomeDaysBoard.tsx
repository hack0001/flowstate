'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { Zap, Star, ChevronRight, CalendarDays, Sunrise, BarChart2, Moon, FolderOpen, Film, BookOpen, CheckSquare, User, Target, Tv, Link2, ShoppingBag, X, Activity, Camera, Layers, Lightbulb, Plus, Flame, GripVertical, ShoppingCart, Bell, Sparkles, Palette, Library, Disc3, FileEdit, TrendingUp, LineChart } from 'lucide-react'
import { getActiveFocusVideos } from '@/lib/supabase'
import { supabase, getPageVisits, recordPageVisit, getEveningReview, getDailyChecklistState, setDailyChecklistItem } from '@/lib/supabase'
import { SECTION_LABEL, type DailyPlanSection } from '@/lib/dailyPlan'
import { sopForStage } from '@/lib/sops'
import { ETSY_TODOS } from '@/lib/etsy-data'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'
import { useLanguage } from '@/context/LanguageContext'
import { type Reminder, reminderOccursOn, fetchRemindersRow } from '@/lib/reminders'
import { calcHabitStreak, calcConsistencyPct, type StreakHabit } from '@/lib/habitStreak'
import { C, DESK as D, MONO } from '@/lib/theme'
import { Tile, Panel, ListRow, Grid } from '@/components/ui'
import { toDateStr } from '@/components/home/homeShared'

// ---- Next-5-days adjustable board ----
// Pulls straight from master_tasks the same way Calendar does (due_date +
// start_time/duration_min), and orders each day by start_time first --
// Calendar is where that time traditionally gets set, but this board can now
// set it directly too, and can move a task to a different day by dragging it
// across columns (same due_date-update Calendar's week view drag does).
// Tasks with no time yet fall back to the shared 'tasks_priority' order
// (same list /tasks drag-reorders) so reordering here still syncs. Complete
// / add / reschedule / retime / move-day all write straight to Supabase --
// cross-device.
export const HOME_DAYS_COUNT = 5

// Same duration options as Calendar's own time editor (app/calendar/page.tsx)
// -- kept as a small local literal rather than a shared import since it's a
// one-line constant, not shared logic.
export const HOME_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180]

export type HomeTask = { id: string; title: string; status: string; due_date: string | null; is_frog: boolean; start_time: string | null; duration_min: number | null }

// Recurring weekly commitments from the Calendar tab's habit_blocks table
// (e.g. "Gym - Mon/Wed/Fri"). Distinct from the Tracking-page Habit Tracker.
export type HomeHabitBlock = { id: string; title: string; emoji: string; color: string; days: number[]; timeLabel: string }

export function homeAddDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export function homeAddMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }

// Same quick-pick logic as Calendar/Tasks reschedule buttons -- offsets are
// relative to the task's own current due date, never "today".
export function rescheduleOptions(from: Date): { label: string; date: string }[] {
  const dow = from.getDay()
  const daysLeftInWeek = dow === 0 ? 0 : 7 - dow
  const laterThisWeekStep = Math.min(2, Math.max(1, daysLeftInWeek))
  const daysUntilNextMonday = ((8 - dow) % 7) || 7
  return [
    { label: 'Later this week', date: toDateStr(homeAddDays(from, laterThisWeekStep)) },
    { label: 'Next week', date: toDateStr(homeAddDays(from, daysUntilNextMonday)) },
    { label: 'Next month', date: toDateStr(homeAddMonths(from, 1)) },
    { label: '2 months', date: toDateStr(homeAddMonths(from, 2)) },
  ]
}

export function fmtTimeLabel(hhmm: string | null): string | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + period
}

// Minutes-since-midnight for a task's "HH:MM" start_time.
export function homeMinutesFromHHMM(hhmm: string | null): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

// Lenient parser for the free-text reminder/habit timeLabel field ("9am",
// "9:30 PM", "18:00"...) — same as Calendar's own parseTimeLabel
// (app/calendar/page.tsx), duplicated locally since it's a small pure
// function, not shared logic. Returns null for "Anytime"/unparseable, which
// sorts to the end alongside untimed tasks.
export function homeParseTimeLabel(label: string): number | null {
  if (!label) return null
  const m = label.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// One unified, time-ordered feed per day -- tasks, reminders and habit
// blocks interleaved by actual time of day, instead of three separate
// grouped lists (which is how it worked before: all habits, then all
// reminders, then all tasks, regardless of when any of them actually fall).
export type HomeDayEntry =
  | { kind: 'habit'; sortMin: number | null; habit: HomeHabitBlock }
  | { kind: 'reminder'; sortMin: number | null; reminder: Reminder }
  | { kind: 'task'; sortMin: number | null; task: HomeTask; isFill: boolean }

export function HomeDaysBoard({ refreshKey }: { refreshKey?: number }) {
  const router = useRouter()
  const { celebrate } = useCelebration()
  const todayStr = toDateStr(new Date())
  const [tasks, setTasks] = useState<HomeTask[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [habitBlocks, setHabitBlocks] = useState<HomeHabitBlock[]>([])
  const [ready, setReady] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null)
  const [timeDraft, setTimeDraft] = useState('')
  const [durationDraft, setDurationDraft] = useState(30)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  const load = useCallback(async () => {
    // Each source is fetched independently -- if reminders or habit_blocks
    // errors out (missing table, RLS, etc.) it must NOT take the task list
    // down with it via a rejected Promise.all. Tasks are the load-bearing
    // piece here, so they always get set even if the extras fail.
    const results = await Promise.allSettled([
      // Not filtered to due_date=today/tomorrow only -- also pulls in
      // undated tasks so the column can fall back to top-priority items
      // when nothing is actually due, instead of just showing reminders.
      supabase.from('master_tasks').select('id,title,status,due_date,is_frog,start_time,duration_min')
        .neq('archived', true).neq('status', 'Done').limit(500),
      supabase.from('priority_lists').select('ordered_ids').eq('key', 'tasks_priority').maybeSingle(),
      supabase.from('reminders').select('*'),
      supabase.from('habit_blocks').select('*'),
    ])
    const [taskRes, priorityRes, reminderRes, habitRes] = results

    if (taskRes.status === 'fulfilled') {
      if (taskRes.value.error) console.error('[home tasks load failed]', taskRes.value.error.message)
      setTasks((taskRes.value.data ?? []) as HomeTask[])
    } else {
      console.error('[home tasks load rejected]', taskRes.reason)
      setTasks([])
    }

    if (priorityRes.status === 'fulfilled') {
      setOrder(((priorityRes.value.data?.ordered_ids as string[]) ?? []))
    }

    if (reminderRes.status === 'fulfilled' && !reminderRes.value.error) {
      setReminders(((reminderRes.value.data ?? []) as Parameters<typeof fetchRemindersRow>[0][]).map(fetchRemindersRow))
    } else {
      if (reminderRes.status === 'fulfilled') console.error('[home reminders load failed]', reminderRes.value.error?.message)
      else console.error('[home reminders load rejected]', reminderRes.reason)
    }

    if (habitRes.status === 'fulfilled' && !habitRes.value.error) {
      setHabitBlocks(((habitRes.value.data ?? []) as Array<{ id:string; title:string; emoji:string; color:string; days:number[]; time_label:string }>)
        .map(r => ({ id:r.id, title:r.title, emoji:r.emoji, color:r.color, days:r.days, timeLabel:r.time_label })))
    } else {
      if (habitRes.status === 'fulfilled') console.error('[home habit_blocks load failed]', habitRes.value.error?.message)
      else console.error('[home habit_blocks load rejected]', habitRes.reason)
    }

    setReady(true)
  }, [todayStr])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, refreshKey])


  // The next HOME_DAYS_COUNT days (today first), each with its date string,
  // day-of-week (for habit_blocks matching), and a display label. dateLabel
  // is the small "day/month" shown under the heading, calendar-cell style --
  // shown on every column now, not just the later ones, so Today/Tomorrow
  // still read as an actual date at a glance.
  const dayInfo = Array.from({ length: HOME_DAYS_COUNT }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000)
    const dateStr = toDateStr(d)
    return {
      dateStr,
      dow: d.getDay(),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
  })

  // Fallback fill: when a day has few/no dated tasks, pull in undated
  // top-priority tasks (same order as the "Tasks" card in This week's
  // overview) so the column shows real work, not just reminders. Each
  // undated task is only used once across all the columns -- days are
  // filled in order (today first), so today still gets first pick exactly
  // as it did back when there were only two columns.
  const undatedByPriority = [...tasks.filter(t => !t.due_date)].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const FILL_TARGET = 5
  const usedFillIds = new Set<string>()
  const days = dayInfo.map(d => {
    const due = tasks.filter(t => t.due_date === d.dateStr)
    let fill: HomeTask[] = []
    if (due.length < FILL_TARGET) {
      fill = undatedByPriority.filter(t => !usedFillIds.has(t.id)).slice(0, FILL_TARGET - due.length)
      fill.forEach(t => usedFillIds.add(t.id))
    }
    const dayHabits = habitBlocks.filter(h => h.days.includes(d.dow))
    const dayReminders = reminders.filter(r => reminderOccursOn(r, d.dateStr))

    // One combined, chronological feed -- a quick snapshot of the day
    // actually reads top-to-bottom as the day unfolds, not grouped by type.
    const entries: HomeDayEntry[] = [
      ...dayHabits.map(habit => ({ kind:'habit' as const, sortMin: homeParseTimeLabel(habit.timeLabel), habit })),
      ...dayReminders.map(reminder => ({ kind:'reminder' as const, sortMin: homeParseTimeLabel(reminder.timeLabel), reminder })),
      ...due.map(task => ({ kind:'task' as const, sortMin: homeMinutesFromHHMM(task.start_time), task, isFill:false })),
      ...fill.map(task => ({ kind:'task' as const, sortMin: null, task, isFill:true })),
    ]
    entries.sort((a, b) => {
      if (a.sortMin !== null && b.sortMin !== null) return a.sortMin - b.sortMin
      if (a.sortMin !== null) return -1
      if (b.sortMin !== null) return 1
      // Both untimed -- two untimed tasks fall back to the shared priority
      // order; everything else keeps its original (stable-sort) position.
      if (a.kind === 'task' && b.kind === 'task') {
        const ai = order.indexOf(a.task.id), bi = order.indexOf(b.task.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      }
      return 0
    })

    return { ...d, entries }
  })

  async function toggleDone(task: HomeTask) {
    const next = task.status === 'Done' ? 'Not started' : 'Done'
    if (next === 'Done') { sounds.playTaskComplete(); celebrate('task') }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    await supabase.from('master_tasks').update({ status: next }).eq('id', task.id)
  }

  function reorderWithin(list: HomeTask[], fromId: string, toId: string) {
    if (fromId === toId) return
    const ids = list.map(t => t.id)
    const fromIdx = ids.indexOf(fromId)
    const toIdx = ids.indexOf(toId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, fromId)
    const base = order.length > 0 ? order : tasks.map(t => t.id)
    const withoutDay = base.filter(id => !ids.includes(id))
    const firstPos = base.findIndex(id => ids.includes(id))
    const insertAt = firstPos === -1 ? withoutDay.length : Math.min(firstPos, withoutDay.length)
    const newOrder = [...withoutDay.slice(0, insertAt), ...reordered, ...withoutDay.slice(insertAt)]
    setOrder(newOrder)
    supabase.from('priority_lists').upsert({ key: 'tasks_priority', ordered_ids: newOrder, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
  }

  async function reschedule(task: HomeTask, dateStr: string) {
    setRescheduleId(null)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    await supabase.from('master_tasks').update({ due_date: dateStr, start_time: null }).eq('id', task.id)
  }

  // Drag a task card onto a different day column -- reassigns due_date,
  // same as Calendar's own week-view drag-to-move (app/calendar/page.tsx
  // handleDrop). Keeps start_time as-is (a 9am task dragged a day later is
  // still probably a 9am task); dropping back onto its own day column with
  // no specific target task is a no-op, dropping onto a specific task in its
  // own column reorders instead (see reorderWithin above).
  async function moveToDay(taskId: string, fromDate: string, toDate: string) {
    if (fromDate === toDate) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: toDate } : t))
    await supabase.from('master_tasks').update({ due_date: toDate }).eq('id', taskId)
  }

  function handleTaskDragStart(e: React.DragEvent, taskId: string, columnDate: string) {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: taskId, fromDate: columnDate }))
    e.dataTransfer.effectAllowed = 'move'
    setDragId(taskId)
  }

  function handleColumnDrop(e: React.DragEvent, columnDate: string, list: HomeTask[], dropOnTaskId?: string) {
    e.preventDefault()
    setDragOverDay(null)
    setDragOver(null)
    let payload: { id: string; fromDate: string } | null = null
    try { payload = JSON.parse(e.dataTransfer.getData('application/json')) } catch { payload = null }
    setDragId(null)
    if (!payload) return
    if (payload.fromDate === columnDate) {
      if (dropOnTaskId) reorderWithin(list, payload.id, dropOnTaskId)
    } else {
      moveToDay(payload.id, payload.fromDate, columnDate)
    }
  }

  // Inline time editor -- Clock icon opens an <input type="time"> + duration
  // picker right on the card, same duration options as Calendar's own time
  // editor. Editing the time on an undated "Priority" filler task (due_date
  // is null) also assigns it to whichever day column it was edited from --
  // setting a time is itself a decision to do it that day.
  function startEditTime(task: HomeTask) {
    setEditingTimeId(task.id)
    setTimeDraft(task.start_time ?? '')
    setDurationDraft(task.duration_min ?? 30)
    setRescheduleId(null)
  }

  async function saveTime(task: HomeTask, columnDate: string) {
    const start_time = timeDraft || null
    const duration_min = start_time ? durationDraft : null
    const needsDueDate = !task.due_date
    setEditingTimeId(null)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, start_time, duration_min, due_date: needsDueDate ? columnDate : t.due_date } : t))
    const patch: Record<string, unknown> = { start_time, duration_min }
    if (needsDueDate) patch.due_date = columnDate
    await supabase.from('master_tasks').update(patch).eq('id', task.id)
  }

  // Inline title editing -- click the task text itself to rename it right
  // here, instead of needing to open the Tasks page for a text-only edit.
  function startEditTitle(task: HomeTask) {
    setEditingTitleId(task.id)
    setTitleDraft(task.title)
    setEditingTimeId(null)
    setRescheduleId(null)
  }

  async function saveTitle(task: HomeTask) {
    const trimmed = titleDraft.trim()
    setEditingTitleId(null)
    if (!trimmed || trimmed === task.title) return
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, title: trimmed } : t))
    await supabase.from('master_tasks').update({ title: trimmed }).eq('id', task.id)
  }

  function Column({ label, dateLabel, dueDate, entries }: { label: string; dateLabel: string; dueDate: string; entries: HomeDayEntry[] }) {
    const isColumnOver = dragOverDay === dueDate
    const isToday = dueDate === todayStr
    const taskEntries = entries.filter((e): e is Extract<HomeDayEntry, { kind: 'task' }> => e.kind === 'task').map(e => e.task)
    return (
      <div
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dueDate) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverDay === dueDate) setDragOverDay(null) }}
        onDrop={e => handleColumnDrop(e, dueDate, taskEntries)}
        style={{
          borderRadius:'0.875rem', padding:'0.65rem', background: isColumnOver ? C.cyan+'0c' : C.card,
          border:'1px solid '+(isColumnOver ? C.cyan+'60' : isToday ? C.cyan+'40' : C.border),
          boxShadow: isToday ? '0 0 0 1px '+C.cyan+'15' : 'none',
          transition:'background 0.1s,border-color 0.1s', display:'flex', flexDirection:'column', minWidth:0,
        }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:'0.4rem', marginBottom:'0.55rem', paddingBottom:'0.5rem', borderBottom:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.04em', textTransform:'uppercase', color: isToday ? C.cyan : C.text, margin:0 }}>{label}</p>
          <p style={{ fontSize:'0.64rem', color:C.muted, margin:0, flexShrink:0 }}>{dateLabel}</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
          {entries.length === 0 && (
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 0.25rem' }}>Nothing scheduled.</p>
          )}
          {entries.map(entry => {
            if (entry.kind === 'habit') {
              const h = entry.habit
              return (
                <div
                  key={'habit-'+h.id}
                  onClick={() => router.push('/calendar')}
                  title="Open Calendar to edit"
                  style={{
                    display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem',
                    background: (h.color || C.border) + '14', border:'1px solid '+(h.color || C.border)+'45', borderRadius:'0.6rem', cursor:'pointer',
                  }}>
                  {h.emoji && <span style={{ fontSize:'0.75rem', flexShrink:0 }}>{h.emoji}</span>}
                  {h.timeLabel && <span style={{ fontSize:'0.65rem', fontWeight:700, color:h.color || C.muted, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{h.timeLabel}</span>}
                  <span style={{ flex:1, minWidth:0, fontSize:'0.8rem', color:h.color || C.sec, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.title}</span>
                  <ChevronRight size={12} color={C.muted} style={{ flexShrink:0 }} />
                </div>
              )
            }
            if (entry.kind === 'reminder') {
              const r = entry.reminder
              return (
                <div
                  key={'reminder-'+r.id}
                  onClick={() => router.push('/calendar')}
                  title="Open Calendar to edit"
                  style={{
                    display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem',
                    background: C.surface, border:'1px dashed '+C.border, borderRadius:'0.6rem', cursor:'pointer',
                  }}>
                  <Bell size={12} color={r.color || C.muted} style={{ flexShrink:0 }} />
                  {r.emoji && <span style={{ fontSize:'0.7rem', flexShrink:0 }}>{r.emoji}</span>}
                  {r.timeLabel && <span style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{r.timeLabel}</span>}
                  <span style={{ flex:1, minWidth:0, fontSize:'0.8rem', color:C.sec, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                  <ChevronRight size={12} color={C.muted} style={{ flexShrink:0 }} />
                </div>
              )
            }
            const task = entry.task
            const isFill = entry.isFill
            const done = task.status === 'Done'
            const timeLabel = fmtTimeLabel(task.start_time)
            const rescheduling = rescheduleId === task.id
            const editingTime = editingTimeId === task.id
            const editingTitle = editingTitleId === task.id
            const opts = rescheduling ? rescheduleOptions(task.due_date ? new Date(task.due_date + 'T12:00:00') : new Date()) : []
            return (
              <div key={'task-'+task.id}>
                <div
                  draggable={!editingTitle}
                  onDragStart={e => handleTaskDragStart(e, task.id, dueDate)}
                  onDragEnd={() => { setDragId(null); setDragOver(null) }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(task.id) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOver === task.id) setDragOver(null) }}
                  onDrop={e => { e.stopPropagation(); handleColumnDrop(e, dueDate, taskEntries, task.id) }}
                  style={{
                    display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem',
                    background: C.surface, border:'1px solid '+(dragOver===task.id?C.cyan+'80':isFill?C.amber+'35':C.border),
                    borderRadius:'0.6rem', opacity: dragId===task.id ? 0.4 : 1, cursor: editingTitle ? 'default' : 'grab', transition:'opacity 0.1s,border-color 0.1s',
                  }}>
                  <GripVertical size={12} color={C.muted} style={{ flexShrink:0 }} />
                  <button type="button" onClick={() => toggleDone(task)} style={{
                    width:'16px', height:'16px', borderRadius:'50%', flexShrink:0, padding:0, cursor:'pointer',
                    border:'2px solid '+(done?C.green:C.muted), background: done ? C.green : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {done && <span style={{ fontSize:'0.5rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
                  </button>
                  {task.is_frog && <span style={{ fontSize:'0.7rem', flexShrink:0 }}>&#128054;</span>}
                  {timeLabel && <span style={{ fontSize:'0.65rem', fontWeight:700, color:C.cyan, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{timeLabel}</span>}
                  {!timeLabel && isFill && <span style={{ fontSize:'0.58rem', fontWeight:700, color:C.amber, flexShrink:0, textTransform:'uppercase', letterSpacing:'0.04em' }}>Priority</span>}
                  {editingTitle ? (
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)}
                      onBlur={() => saveTitle(task)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingTitleId(null) }}
                      onClick={e => e.stopPropagation()}
                      style={{ flex:1, minWidth:0, fontSize:'0.8rem', color:C.text, background:C.card, border:'1px solid '+C.cyan, borderRadius:'0.35rem', padding:'0.15rem 0.4rem', fontFamily:'inherit', outline:'none' }}
                    />
                  ) : (
                    <span
                      onClick={() => startEditTitle(task)}
                      title="Click to rename"
                      style={{ flex:1, minWidth:0, fontSize:'0.8rem', color: done?C.muted:C.text, textDecoration: done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'text' }}>
                      {task.title}
                    </span>
                  )}
                  <button type="button" draggable={false} onClick={() => { startEditTime(task); setRescheduleId(null) }} title={timeLabel ? 'Change time' : 'Set time'} style={{
                    background:'none', border:'none', color: editingTime ? C.cyan : C.muted, cursor:'pointer', padding:'0.2rem', flexShrink:0, display:'flex', alignItems:'center',
                  }}>
                    <Zap size={13} />
                  </button>
                  <button type="button" draggable={false} onClick={() => { setRescheduleId(rescheduling ? null : task.id); setEditingTimeId(null) }} title={isFill ? 'Set due date' : 'Reschedule'} style={{
                    background:'none', border:'none', color: rescheduling ? C.cyan : C.muted, cursor:'pointer', padding:'0.2rem', flexShrink:0, display:'flex', alignItems:'center',
                  }}>
                    <CalendarDays size={13} />
                  </button>
                </div>
                {editingTime && (
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap', padding:'0.4rem 0.65rem 0.15rem' }}>
                    <input type="time" value={timeDraft} onChange={e => setTimeDraft(e.target.value)}
                      style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.5rem', outline:'none', colorScheme:'dark' }} />
                    <select value={durationDraft} onChange={e => setDurationDraft(Number(e.target.value))} disabled={!timeDraft}
                      style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:timeDraft?C.text:C.muted, fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.5rem', outline:'none', cursor:timeDraft?'pointer':'not-allowed' }}>
                      {HOME_DURATION_OPTIONS.map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                    </select>
                    <button type="button" onClick={() => saveTime(task, dueDate)} style={{
                      padding:'0.3rem 0.6rem', background:'rgba(0,255,136,0.12)', border:'1px solid rgba(0,255,136,0.35)', borderRadius:'0.4rem',
                      color:C.green, fontSize:'0.68rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                    }}>Save</button>
                    {timeDraft && (
                      <button type="button" onClick={() => setTimeDraft('')} style={{
                        padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem',
                        color:C.muted, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                      }}>Clear</button>
                    )}
                    <button type="button" onClick={() => setEditingTimeId(null)} style={{
                      padding:'0.3rem 0.55rem', background:'transparent', border:'none', color:C.muted, fontSize:'0.68rem', cursor:'pointer', fontFamily:'inherit',
                    }}>Cancel</button>
                  </div>
                )}
                {rescheduling && (
                  <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap', padding:'0.4rem 0.65rem 0.15rem' }}>
                    {opts.map(o => (
                      <button key={o.label} type="button" onClick={() => reschedule(task, o.date)} style={{
                        padding:'0.25rem 0.55rem', background:C.card, border:'1px solid '+C.border, borderRadius:'9999px',
                        color:C.sec, fontSize:'0.65rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                      }}>{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (!ready) return null

  return (
    <div>
      {/* Pulls top-priority items from every workflow (Vault/Tasks/Etsy/X/
          YouTube) onto today's Calendar and assigns each a real start_time by
          filling open Timeline slots -- same engine as Calendar's own
          "Recommend & Organise", opened here with today pre-selected so this
          list updates the moment you confirm. */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.65rem', gap:'0.75rem', flexWrap:'wrap' }}>
        <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag a card to a different day to move it, click its title to rename, or use <Zap size={10} style={{ verticalAlign:'-1px' }}/> to set its time.</p>
        <button onClick={() => router.push('/calendar?openRecommend=today')} style={{
          display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.75rem',
          background:'linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,255,136,0.12))',
          border:'1px solid rgba(0,212,255,0.35)', borderRadius:'0.75rem', color:C.cyan,
          cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, flexShrink:0,
        }}>
          <Sparkles size={12} />Organise Today
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'0.75rem' }}>
        {days.map(d => (
          <Column key={d.dateStr} label={d.label} dateLabel={d.dateLabel} dueDate={d.dateStr} entries={d.entries} />
        ))}
      </div>
    </div>
  )
}
