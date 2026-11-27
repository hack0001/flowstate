'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'

import { C } from '@/lib/theme'
import { MONTHS, DAY_ABBR, Task, HoverTip, OrgMove, OverdueMove, HabitBlock, TYPE_LIMITS, getMondayOfWeek, centeredStart, addDays, toDateStr, rescheduleOptions, fmtWeekRange, TL_START_MIN, TL_END_MIN, TL_SNAP_MIN, TL_ZOOM_LEVELS, TL_DEFAULT_ZOOM_IDX, TL_DEFAULT_DURATION, minutesToHHMM, hhmmToMinutes, parseTimeLabel, TLBlock, autoPlaceTasks, buildOrganisePlan } from '@/lib/calendarUtils'
import { TaskCard } from '@/components/calendar/TaskCard'
import { TimelineBlock } from '@/components/calendar/TimelineBlock'
import { TimelineDay } from '@/components/calendar/TimelineDay'
import { QuickAdd } from '@/components/calendar/QuickAdd'


















function CalendarPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const todayStr = toDateStr(today)
  // Centered on today (not Monday-aligned) so today lands mid-row instead of
  // wherever a calendar week happens to put it — e.g. on a Sunday, a
  // Monday-start week would bury today in the last column.
  const [weekStart, setWeekStart] = useState(() => centeredStart(today, 7))
  // How many day columns to show at once (1-7). Nav buttons step by this
  // amount so "next" always lands on the day right after the visible range.
  const [viewDays, setViewDays] = useState(7)
  // 'list' = existing section-grouped cards. 'timeline' = hourly grid where
  // items are placed by time-of-day and can be dragged to reschedule.
  const [dayViewMode, setDayViewMode] = useState<'list' | 'timeline'>('timeline')
  // Timeline zoom — index into TL_ZOOM_LEVELS. Zoom out to see the whole
  // day's tasks at a glance, zoom in to space out the next hour or so.
  const [tlZoomIdx, setTlZoomIdx] = useState(TL_DEFAULT_ZOOM_IDX)
  const tlPxPerMin = TL_ZOOM_LEVELS[tlZoomIdx]
  const [weekTasks, setWeekTasks] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(false)
  const [orgPlan, setOrgPlan] = useState<OrgMove[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [overduePlan, setOverduePlan] = useState<OverdueMove[] | null>(null)
  const [overdueLoading, setOverdueLoading] = useState(false)
  // Weighted daily plan (YouTube/Etsy/Tasks/X/Vault -> master_tasks)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [planDate, setPlanDate] = useState(() => toDateStr(addDays(today, 1)))
  const [planSettings, setPlanSettings] = useState<DailyPlanSettings | null>(null)
  const [planGenerating, setPlanGenerating] = useState(false)
  const [planResult, setPlanResult] = useState<string | null>(null)
  // Recommend & Organise — same weighted-plan engine, but gathered as a
  // checkable review list first (nothing is written until Confirm), and on
  // confirm the day also gets auto time-blocked (organised), not just filled.
  // Works for Today or Tomorrow — Today is the default since that's what
  // drives the Home page's Today column; a deep link from Home
  // ("?openRecommend=today") opens straight into this modal.
  const [showRecModal, setShowRecModal] = useState(false)
  const [recDateChoice, setRecDateChoice] = useState<'today' | 'tomorrow'>('today')
  const [recCandidates, setRecCandidates] = useState<(PlanCandidate & { checked: boolean })[] | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recCommitting, setRecCommitting] = useState(false)
  const [recResult, setRecResult] = useState<string | null>(null)
  const recDate = toDateStr(recDateChoice === 'today' ? today : addDays(today, 1))
  const recDateLabel = recDateChoice === 'today' ? 'today' : 'tomorrow'
  // Task editing
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('Flow')
  const [editDueDate, setEditDueDate] = useState('')
  const [editUrgency, setEditUrgency] = useState('')
  const [editIsFrog, setEditIsFrog] = useState(false)
  const [editStatus, setEditStatus] = useState('Not started')
  const [editStartTime, setEditStartTime] = useState('')
  const [editDurationMin, setEditDurationMin] = useState(TL_DEFAULT_DURATION)
  const [savingEdit, setSavingEdit] = useState(false)
  // true when the modal is being used to create a brand-new task (opened by
  // double-clicking empty Timeline space) rather than edit an existing one —
  // same modal, Save inserts instead of updates.
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  // Habits
  const [habits, setHabits] = useState<HabitBlock[]>([])
  const [showHabitModal, setShowHabitModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitBlock | null>(null)
  const [habitDraft, setHabitDraft] = useState<{ title:string; emoji:string; color:string; days:number[]; timeLabel:string; durationMin:number }>({ title:'', emoji:'', color:C.cyan, days:[], timeLabel:'', durationMin:30 })
  // Reminders
  const [calTab, setCalTab] = useState<'calendar' | 'reminders'>('calendar')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [reminderDraft, setReminderDraft] = useState<{ title:string; emoji:string; color:string; startDate:string; recurrence:ReminderRecurrence; timeLabel:string; durationMin:number }>({ title:'', emoji:'', color:C.green, startDate:todayStr, recurrence:{ type:'daily' }, timeLabel:'', durationMin:30 })

  // Hover tooltip — schedule items (task cards, reminder chips, habit chips)
  // truncate their title in the compact day column, so hovering shows the
  // full thing in a small floating chip. Fixed-position so it isn't clipped
  // by the day column's own scroll/overflow.
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null)
  function showTip(e: React.MouseEvent, color: string, title: string, lines: string[]) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 240)
    setHoverTip({ x: Math.max(8, x), y: rect.top - 8, color, title, lines })
  }
  function hideTip() { setHoverTip(null) }
  function handleTaskHover(e: React.MouseEvent, task: Task) {
    const color = task.task_type === 'Flow' ? C.cyan : task.task_type === 'Personal' ? C.purple : task.task_type === 'Admin' ? C.muted : C.amber
    const lines: string[] = []
    if (task.is_frog) lines.push('Frog -- top priority today')
    if (task.task_type) lines.push('Type: ' + task.task_type)
    if (task.urgency) lines.push('Urgency: ' + task.urgency)
    if (task.importance) lines.push('Importance: ' + task.importance)
    if (task.time_commitment) lines.push('Time: ' + task.time_commitment)
    if (task.why_note) lines.push('Why: ' + task.why_note)
    showTip(e, color, task.title, lines)
  }

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
  const weekDates = Array.from({ length: viewDays }, (_, i) => toDateStr(addDays(weekStart, i)))

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
    // Show local cache instantly, then fetch Supabase (authoritative)
    try {
      const raw = localStorage.getItem('flowstate_cal_habits')
      if (raw) setHabits(JSON.parse(raw) as HabitBlock[])
    } catch {}
    supabase.from('habit_blocks').select('*').then(({ data }) => {
      if (!data || data.length === 0) return
      const h = data.map(r => ({ id: r.id, title: r.title, emoji: r.emoji, color: r.color, days: r.days as number[], timeLabel: r.time_label as string, durationMin: (r.duration_min as number | null) ?? 30 }))
      setHabits(h)
      try { localStorage.setItem('flowstate_cal_habits', JSON.stringify(h)) } catch {}
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('flowstate_reminders')
      if (raw) setReminders(JSON.parse(raw) as Reminder[])
    } catch {}
    supabase.from('reminders').select('*').order('start_date').then(({ data }) => {
      if (!data || data.length === 0) return
      const r = data.map(row => ({ id: row.id, title: row.title, emoji: row.emoji, color: row.color, startDate: row.start_date as string, recurrence: row.recurrence as ReminderRecurrence, timeLabel: row.time_label as string, durationMin: (row.duration_min as number | null) ?? 30 }))
      setReminders(r)
      try { localStorage.setItem('flowstate_reminders', JSON.stringify(r)) } catch {}
    })
  }, [])

  function handleOrganise() { setOrgPlan(buildOrganisePlan(weekTasks, weekStart)) }

  async function openPlanModal() {
    setPlanDate(toDateStr(addDays(today, 1)))
    setPlanResult(null)
    const s = await getDailyPlanSettings()
    setPlanSettings(s)
    setShowPlanModal(true)
  }

  async function savePlanSettings() {
    if (!planSettings) return
    await saveDailyPlanSettings(planSettings)
  }

  async function runGeneratePlan() {
    setPlanGenerating(true)
    setPlanResult(null)
    try {
      if (planSettings) await saveDailyPlanSettings(planSettings)
      const { created, scheduled } = await generateDailyPlan(planDate)
      setPlanResult(
        created + scheduled === 0
          ? 'Nothing to add — add priority items in Vault/Tasks/Etsy/X, or pin YouTube videos in the Content Pipeline, then try again.'
          : `Added ${created} new task${created !== 1 ? 's' : ''} and scheduled ${scheduled} from your backlog for ${planDate}.`
      )
      await fetchWeek()
    } catch (e) {
      setPlanResult('Failed: ' + String(e))
    }
    setPlanGenerating(false)
  }

  // Auto-organise: give every task on `date` that has no explicit start_time
  // a real, persisted slot (Flow -> morning, Personal/Admin -> evening,
  // everything else -> midday, stacked in is_frog-first order) so the day
  // shows up already time-blocked on the Timeline view, not just a list.
  async function organiseDayTimeBlocks(date: string): Promise<number> {
    const { data } = await supabase.from('master_tasks').select('*').eq('due_date', date).neq('archived', true).neq('status', 'Done')
    const dayTasks = (data ?? []) as Task[]
    const placements = autoPlaceTasks(dayTasks)
    const toUpdate = dayTasks.filter(t => !t.start_time && placements.has(t.id))
    await Promise.all(toUpdate.map(t =>
      supabase.from('master_tasks').update({
        start_time: minutesToHHMM(placements.get(t.id)!),
        duration_min: t.duration_min ?? TL_DEFAULT_DURATION,
      }).eq('id', t.id)
    ))
    return toUpdate.length
  }

  async function openRecommendModal(choice: 'today' | 'tomorrow' = recDateChoice) {
    setRecDateChoice(choice)
    setShowRecModal(true)
    setRecResult(null)
    setRecLoading(true)
    try {
      const date = toDateStr(choice === 'today' ? today : addDays(today, 1))
      const candidates = await getDailyPlanCandidates(date)
      setRecCandidates(candidates.map(c => ({ ...c, checked: true })))
    } catch (e) {
      setRecResult('Failed to load recommendations: ' + String(e))
      setRecCandidates([])
    }
    setRecLoading(false)
  }

  // Deep link from Home's "Organise Today" button — ?openRecommend=today|tomorrow
  useEffect(() => {
    const v = searchParams.get('openRecommend')
    if (v === 'today' || v === 'tomorrow') openRecommendModal(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function toggleRecCandidate(key: string) {
    setRecCandidates(prev => prev ? prev.map(c => c.key === key ? { ...c, checked: !c.checked } : c) : prev)
  }
  function selectAllRec(val: boolean) {
    setRecCandidates(prev => prev ? prev.map(c => ({ ...c, checked: val })) : prev)
  }

  async function confirmRecommend() {
    if (!recCandidates) return
    const selected = recCandidates.filter(c => c.checked)
    setRecCommitting(true)
    try {
      const { created, scheduled } = await commitDailyPlan(recDate, selected)
      const organised = await organiseDayTimeBlocks(recDate)
      setRecResult(
        created + scheduled === 0
          ? 'Nothing selected — check at least one recommendation, or add priority items in Vault/Tasks/Etsy/X first.'
          : `Added ${created} new task${created !== 1 ? 's' : ''} and scheduled ${scheduled} from your backlog for ${recDateLabel}, and time-blocked ${organised} of them on the Timeline.`
      )
      await fetchWeek()
    } catch (e) {
      setRecResult('Failed: ' + String(e))
    }
    setRecCommitting(false)
  }

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

  // Timeline view — drag-move / drag-resize commits here.
  async function commitTaskTime(task: Task, startMin: number, durationMin: number) {
    const start_time = minutesToHHMM(startMin)
    const date = task.due_date ?? todayStr
    setWeekTasks(prev => ({
      ...prev,
      [date]: (prev[date] ?? []).map(t => t.id === task.id ? { ...t, start_time, duration_min: durationMin } : t),
    }))
    try { await supabase.from('master_tasks').update({ start_time, duration_min: durationMin }).eq('id', task.id) } catch {}
  }

  // Same drag-move / drag-resize commit for reminders and habit blocks —
  // these are recurring (one row covers every occurrence), so dragging any
  // one occurrence on the Timeline changes the time for all of them, same as
  // editing it in the Reminder/Habit modal. duration_min added in
  // 041_reminder_habit_duration.sql; falls back to 30 for older rows.
  async function commitReminderTime(r: Reminder, startMin: number, durationMin: number) {
    const timeLabel = minutesToHHMM(startMin)
    setReminders(prev => {
      const next = prev.map(x => x.id === r.id ? { ...x, timeLabel, durationMin } : x)
      try { localStorage.setItem('flowstate_reminders', JSON.stringify(next)) } catch {}
      return next
    })
    try { await supabase.from('reminders').update({ time_label: timeLabel, duration_min: durationMin }).eq('id', r.id) } catch {}
  }

  async function commitHabitTime(h: HabitBlock, startMin: number, durationMin: number) {
    const timeLabel = minutesToHHMM(startMin)
    setHabits(prev => {
      const next = prev.map(x => x.id === h.id ? { ...x, timeLabel, durationMin } : x)
      try { localStorage.setItem('flowstate_cal_habits', JSON.stringify(next)) } catch {}
      return next
    })
    try { await supabase.from('habit_blocks').update({ time_label: timeLabel, duration_min: durationMin }).eq('id', h.id) } catch {}
  }

  // Cross-day drag on the Timeline -- dropping a block on a different day's
  // column (TimelineBlock's onMoveDay, resolved via elementFromPoint against
  // each day's data-tl-day). Tasks reassign due_date, same as the List
  // view's own day-to-day drag-drop. Habits swap which day-of-week they're
  // pinned to (drop the day dragged from, add the day dropped on) -- a
  // natural read of "drag this habit block to another day". Reminders shift
  // their whole recurrence anchor (start_date) by the same number of days --
  // like the time-drag above, this changes every occurrence, so it confirms
  // first rather than silently rewriting the recurrence.
  async function onMoveItemDay(block: TLBlock, fromDate: string, newDate: string) {
    if (fromDate === newDate) return
    if (block.kind === 'task' && block.task) {
      const task = block.task
      setWeekTasks(prev => {
        const next = { ...prev }
        next[fromDate] = (next[fromDate] ?? []).filter(t => t.id !== task.id)
        next[newDate] = [...(next[newDate] ?? []), { ...task, due_date: newDate }]
        return next
      })
      await supabase.from('master_tasks').update({ due_date: newDate }).eq('id', task.id)
    } else if (block.kind === 'reminder' && block.reminder) {
      const r = block.reminder
      const ok = window.confirm(`Move "${r.title}" to ${newDate}? This changes every occurrence of this reminder.`)
      if (!ok) return
      const diffDays = Math.round((new Date(newDate + 'T12:00:00').getTime() - new Date(fromDate + 'T12:00:00').getTime()) / 86400000)
      const newStartDate = toDateStr(addDays(new Date(r.startDate + 'T12:00:00'), diffDays))
      setReminders(prev => {
        const next = prev.map(x => x.id === r.id ? { ...x, startDate: newStartDate } : x)
        try { localStorage.setItem('flowstate_reminders', JSON.stringify(next)) } catch {}
        return next
      })
      await supabase.from('reminders').update({ start_date: newStartDate }).eq('id', r.id)
    } else if (block.kind === 'habit' && block.habit) {
      const h = block.habit
      const fromDow = new Date(fromDate + 'T12:00:00').getDay()
      const toDow = new Date(newDate + 'T12:00:00').getDay()
      const newDays = Array.from(new Set([...h.days.filter(d => d !== fromDow), toDow]))
      setHabits(prev => {
        const next = prev.map(x => x.id === h.id ? { ...x, days: newDays } : x)
        try { localStorage.setItem('flowstate_cal_habits', JSON.stringify(next)) } catch {}
        return next
      })
      await supabase.from('habit_blocks').update({ days: newDays }).eq('id', h.id)
    }
  }

  function jumpToWeek(day: number) {
    const clicked = new Date(calYear, calMonth, day)
    setWeekStart(viewDays === 7 ? getMondayOfWeek(clicked) : clicked)
  }
  function isInCurrentWeek(day: number): boolean { return weekDates.includes(toDateStr(new Date(calYear, calMonth, day))) }

  async function handleOrganiseOverdue() {
    setOverdueLoading(true)
    try {
      const { data: overdueTasks } = await supabase
        .from('master_tasks').select('*')
        .lt('due_date', todayStr).neq('archived', true).neq('status', 'Done')
        .order('due_date', { ascending: true })

      // Today's overflow per type
      const todayTasks = weekTasks[todayStr] ?? []
      const todayOverflow: Task[] = []
      for (const type of Object.keys(TYPE_LIMITS)) {
        const limit = TYPE_LIMITS[type]
        const typed = todayTasks.filter(t => t.task_type === type)
        if (typed.length > limit) todayOverflow.push(...typed.slice(limit))
      }

      const futureEnd = toDateStr(addDays(today, 28))
      const { data: futureTasks } = await supabase
        .from('master_tasks').select('id,due_date,task_type')
        .gte('due_date', todayStr).lte('due_date', futureEnd)
        .neq('archived', true).neq('status', 'Done')

      // Per-type slot counters
      const typeSlots: Record<string, Record<string, number>> = {}
      for (const type of Object.keys(TYPE_LIMITS)) typeSlots[type] = {}
      for (const t of (futureTasks ?? [])) {
        if (t.task_type && t.due_date && typeSlots[t.task_type])
          typeSlots[t.task_type][t.due_date] = (typeSlots[t.task_type][t.due_date] ?? 0) + 1
      }

      const allToMove: Task[] = [...((overdueTasks ?? []) as Task[]), ...todayOverflow]
      const moves: OverdueMove[] = []

      for (const task of allToMove) {
        const type = task.task_type ?? 'Flow'
        const limit = TYPE_LIMITS[type] ?? 2
        const slots = typeSlots[type] ?? {}
        let placed = false
        for (let i = 0; i < 28; i++) {
          const d = toDateStr(addDays(today, i))
          if ((slots[d] ?? 0) < limit) {
            slots[d] = (slots[d] ?? 0) + 1
            moves.push({ id: task.id, title: task.title, task_type: task.task_type, fromDate: task.due_date ?? todayStr, toDate: d, selected: true })
            placed = true; break
          }
        }
        if (!placed) {
          const fallback = toDateStr(addDays(today, 28))
          moves.push({ id: task.id, title: task.title, task_type: task.task_type, fromDate: task.due_date ?? todayStr, toDate: fallback, selected: true })
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
    setIsCreatingTask(false)
    setEditingTask(task)
    setEditTitle(task.title)
    setEditType(task.task_type ?? 'Flow')
    setEditDueDate(task.due_date ?? todayStr)
    setEditUrgency(task.urgency ?? '')
    setEditIsFrog(task.is_frog)
    setEditStatus(task.status ?? 'Not started')
    setEditStartTime(task.start_time ?? '')
    setEditDurationMin(task.duration_min ?? TL_DEFAULT_DURATION)
  }

  // Opens the same edit modal in "create" mode, pre-filled with the date and
  // time the user double-clicked in the Timeline grid — Notion-style "click
  // empty space, fill in the details" instead of a separate add-task form.
  function openCreateAt(date: string, startMin: number) {
    const snapped = Math.max(TL_START_MIN, Math.min(TL_END_MIN - TL_SNAP_MIN, Math.round(startMin / TL_SNAP_MIN) * TL_SNAP_MIN))
    const startTime = minutesToHHMM(snapped)
    setIsCreatingTask(true)
    setEditingTask({
      id: '', title: '', due_date: date, status: 'Not started',
      urgency: null, importance: null, time_commitment: null,
      task_type: 'Flow', is_frog: false, why_note: null,
      notion_id: null, notion_url: null, priority: null,
      start_time: startTime, duration_min: TL_DEFAULT_DURATION,
    })
    setEditTitle('')
    setEditType('Flow')
    setEditDueDate(date)
    setEditUrgency('')
    setEditIsFrog(false)
    setEditStatus('Not started')
    setEditStartTime(startTime)
    setEditDurationMin(TL_DEFAULT_DURATION)
  }

  function closeEditModal() {
    setEditingTask(null)
    setIsCreatingTask(false)
  }

  async function handleSaveEdit() {
    if (!editingTask || !editTitle.trim()) return
    setSavingEdit(true)
    try {
      const timeFields = { start_time: editStartTime || null, duration_min: editStartTime ? editDurationMin : null }
      if (isCreatingTask) {
        const { data, error } = await supabase
          .from('master_tasks')
          .insert({
            title: editTitle, task_type: editType, due_date: editDueDate,
            urgency: editUrgency || null, is_frog: editIsFrog, status: 'Not started',
            ...timeFields,
          })
          .select()
          .single()
        if (!error && data) {
          setWeekTasks(prev => ({ ...prev, [editDueDate]: [...(prev[editDueDate] ?? []), data as Task] }))
        }
      } else {
        await supabase.from('master_tasks').update({
          title: editTitle, task_type: editType, due_date: editDueDate,
          urgency: editUrgency || null, is_frog: editIsFrog, status: editStatus,
          ...timeFields,
        }).eq('id', editingTask.id)
        const oldDate = editingTask.due_date ?? todayStr
        if (editStatus === 'Done') {
          // Same fetch (.neq('status','Done')) that keeps completed tasks out
          // of the calendar on load also means this one won't come back on
          // refresh -- drop it from local state now so it disappears
          // immediately instead of waiting for a reload.
          setWeekTasks(prev => {
            const next = { ...prev }
            if (next[oldDate]) next[oldDate] = next[oldDate].filter(t => t.id !== editingTask.id)
            return next
          })
        } else {
          const updated = { ...editingTask, title: editTitle, task_type: editType, due_date: editDueDate, urgency: editUrgency || null, is_frog: editIsFrog, status: editStatus, ...timeFields }
          setWeekTasks(prev => {
            const next = { ...prev }
            if (next[oldDate]) next[oldDate] = next[oldDate].filter(t => t.id !== editingTask.id)
            if (next[editDueDate] !== undefined) next[editDueDate] = [...(next[editDueDate] ?? []), updated]
            return next
          })
        }
      }
      closeEditModal()
    } catch {}
    setSavingEdit(false)
  }

  async function handleDeleteFromEdit() {
    if (!editingTask) return
    if (!isCreatingTask) await handleDelete(editingTask.id, editingTask.due_date ?? todayStr)
    closeEditModal()
  }

  function openHabitForm(h: HabitBlock | null) {
    setEditingHabit(h)
    setHabitDraft(h ? { title:h.title, emoji:h.emoji, color:h.color, days:[...h.days], timeLabel:h.timeLabel, durationMin:h.durationMin ?? 30 } : { title:'', emoji:'', color:C.cyan, days:[], timeLabel:'', durationMin:30 })
    setShowHabitModal(true)
  }

  function saveHabit() {
    if (!habitDraft.title.trim() || habitDraft.days.length === 0) return
    const h: HabitBlock = {
      id: editingHabit?.id ?? Date.now().toString(),
      title: habitDraft.title.trim(), emoji: habitDraft.emoji,
      color: habitDraft.color, days: habitDraft.days, timeLabel: habitDraft.timeLabel,
      durationMin: habitDraft.durationMin,
    }
    setHabits(prev => {
      const next = editingHabit ? prev.map(x => x.id === h.id ? h : x) : [...prev, h]
      try { localStorage.setItem('flowstate_cal_habits', JSON.stringify(next)) } catch {}
      return next
    })
    supabase.from('habit_blocks').upsert({ id: h.id, title: h.title, emoji: h.emoji, color: h.color, days: h.days, time_label: h.timeLabel, duration_min: h.durationMin }, { onConflict: 'id' }).then()
    setShowHabitModal(false)
    setEditingHabit(null)
  }

  function deleteHabit(id: string) {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id)
      try { localStorage.setItem('flowstate_cal_habits', JSON.stringify(next)) } catch {}
      return next
    })
    supabase.from('habit_blocks').delete().eq('id', id).then()
  }

  function openReminderForm(r: Reminder | null) {
    setEditingReminder(r)
    setReminderDraft(r
      ? { title:r.title, emoji:r.emoji, color:r.color, startDate:r.startDate, recurrence:{ ...r.recurrence } as ReminderRecurrence, timeLabel:r.timeLabel, durationMin:r.durationMin ?? 30 }
      : { title:'', emoji:'', color:C.green, startDate:todayStr, recurrence:{ type:'daily' }, timeLabel:'', durationMin:30 }
    )
    setShowReminderModal(true)
  }

  function saveReminder() {
    if (!reminderDraft.title.trim()) return
    const r: Reminder = {
      id: editingReminder?.id ?? Date.now().toString(),
      title: reminderDraft.title.trim(), emoji: reminderDraft.emoji,
      color: reminderDraft.color, startDate: reminderDraft.startDate,
      recurrence: reminderDraft.recurrence, timeLabel: reminderDraft.timeLabel,
      durationMin: reminderDraft.durationMin,
    }
    setReminders(prev => {
      const next = editingReminder ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]
      try { localStorage.setItem('flowstate_reminders', JSON.stringify(next)) } catch {}
      return next
    })
    supabase.from('reminders')
      .upsert({ id: r.id, title: r.title, emoji: r.emoji, color: r.color, start_date: r.startDate, recurrence: r.recurrence, time_label: r.timeLabel, duration_min: r.durationMin }, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.error('[reminders] upsert failed:', error.message, error) })
    setShowReminderModal(false)
    setEditingReminder(null)
  }

  function deleteReminder(id: string) {
    setReminders(prev => {
      const next = prev.filter(r => r.id !== id)
      try { localStorage.setItem('flowstate_reminders', JSON.stringify(next)) } catch {}
      return next
    })
    supabase.from('reminders').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[reminders] delete failed:', error.message, error) })
    setShowReminderModal(false)
    setEditingReminder(null)
  }

  async function handleReschedule(task: Task, currentDate: string) {
    const type = task.task_type ?? 'Flow'
    const limit = TYPE_LIMITS[type] ?? 2
    const futureEnd = toDateStr(addDays(today, 21))
    try {
      const { data } = await supabase
        .from('master_tasks').select('due_date,task_type')
        .gte('due_date', currentDate).lte('due_date', futureEnd)
        .neq('archived', true).neq('status', 'Done')
      const slots: Record<string, number> = {}
      for (const t of (data ?? [])) {
        if (t.task_type === type && t.due_date)
          slots[t.due_date] = (slots[t.due_date] ?? 0) + 1
      }
      // Find first date AFTER currentDate with capacity
      for (let i = 1; i <= 21; i++) {
        const d = toDateStr(addDays(today, i))
        if (d <= currentDate) continue
        if ((slots[d] ?? 0) < limit) {
          await supabase.from('master_tasks').update({ due_date: d }).eq('id', task.id)
          setWeekTasks(prev => {
            const next = { ...prev }
            if (next[currentDate]) next[currentDate] = next[currentDate].filter(t => t.id !== task.id)
            if (next[d] !== undefined) next[d] = [...(next[d] ?? []), { ...task, due_date: d }]
            return next
          })
          return
        }
      }
      // Fallback — 21 days out
      const fallback = toDateStr(addDays(today, 21))
      await supabase.from('master_tasks').update({ due_date: fallback }).eq('id', task.id)
      setWeekTasks(prev => {
        const next = { ...prev }
        if (next[currentDate]) next[currentDate] = next[currentDate].filter(t => t.id !== task.id)
        if (next[fallback] !== undefined) next[fallback] = [...(next[fallback] ?? []), { ...task, due_date: fallback }]
        return next
      })
    } catch {}
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
          <button onClick={openPlanModal} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            <Sparkles size={12} />Weighted Plan
          </button>
          <button onClick={() => openRecommendModal('today')} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,255,136,0.12))', border:'1px solid rgba(0,212,255,0.35)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
            <Sparkles size={12} />Recommend &amp; Organise
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
        {(['calendar','reminders'] as const).map(tab => (
          <button key={tab} onClick={() => setCalTab(tab)} style={{ padding:'0.55rem 1.25rem', background:'none', border:'none', borderBottom: calTab===tab ? '2px solid '+C.cyan : '2px solid transparent', color: calTab===tab ? C.cyan : C.muted, fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', textTransform:'capitalize', letterSpacing:'0.04em', transition:'all 0.15s', marginBottom:'-1px' }}>
            {tab === 'reminders' ? <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}><Bell size={12} />Reminders{reminders.length > 0 && <span style={{ background:C.green+'33', color:C.green, fontSize:'0.6rem', fontWeight:900, borderRadius:'9999px', padding:'0 0.35rem', lineHeight:1.6 }}>{reminders.length}</span>}</span> : tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
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
          <button onClick={() => { setCalDate(new Date(today.getFullYear(), today.getMonth(), 1)); setWeekStart(centeredStart(today, viewDays)) }}
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

          <div style={{ marginTop:'1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:0 }}>Reminders</p>
              <button onClick={() => openReminderForm(null)} style={{ fontSize:'0.65rem', color:C.green, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>+ Add</button>
            </div>
            {reminders.length === 0 ? (
              <p style={{ fontSize:'0.68rem', color:C.muted, lineHeight:1.5, margin:0 }}>No reminders. Add recurring reminders like Bills, Reviews, or Calls.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {reminders.map(r => (
                  <button key={r.id} onClick={() => openReminderForm(r)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.3rem 0.4rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.375rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    <Bell size={8} color={r.color} />
                    {r.emoji && <span style={{ fontSize:'0.8rem', lineHeight:1 }}>{r.emoji}</span>}
                    <span style={{ fontSize:'0.7rem', color:C.sec, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                    <span style={{ fontSize:'0.55rem', color:C.muted, flexShrink:0 }}>{describeRecurrence(r.recurrence).split(' ').slice(0,2).join(' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Reminders table */}
        {calTab === 'reminders' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'auto', padding:'1.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:C.text }}>All Reminders</h2>
                <p style={{ margin:'0.2rem 0 0', fontSize:'0.75rem', color:C.muted }}>{reminders.length} reminder{reminders.length !== 1 ? 's' : ''} active</p>
              </div>
              <button onClick={() => openReminderForm(null)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                <Bell size={13} />New Reminder
              </button>
            </div>
            {reminders.length === 0 ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem', opacity:0.5 }}>
                <Bell size={40} color={C.muted} />
                <p style={{ color:C.muted, fontSize:'0.9rem', margin:0 }}>No reminders yet</p>
                <button onClick={() => openReminderForm(null)} style={{ padding:'0.5rem 1.25rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Create your first reminder</button>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid '+C.border }}>
                      {['','Title','Recurrence','Start Date','Time','Next occurrence',''].map((h,i) => (
                        <th key={i} style={{ textAlign:'left', padding:'0.5rem 0.75rem', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map(r => {
                      // Find next occurrence in next 365 days
                      let nextDate = ''
                      for (let i = 0; i <= 365; i++) {
                        const d = toDateStr(addDays(today, i))
                        if (reminderOccursOn(r, d)) { nextDate = d; break }
                      }
                      const fmtD = (s: string) => s ? new Date(s+'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : '—'
                      const nextDiff = nextDate ? Math.round((new Date(nextDate+'T12:00:00').getTime() - today.getTime()) / 86400000) : null
                      const nextLabel = nextDiff === 0 ? 'Today' : nextDiff === 1 ? 'Tomorrow' : nextDiff !== null ? 'in ' + nextDiff + 'd' : '—'
                      return (
                        <tr key={r.id} style={{ borderBottom:'1px solid '+C.border+'66', cursor:'pointer', transition:'background 0.1s' }}
                          onClick={() => openReminderForm(r)}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.card}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                          <td style={{ padding:'0.625rem 0.75rem', width:'32px' }}>
                            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:r.color }} />
                          </td>
                          <td style={{ padding:'0.625rem 0.75rem' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                              {r.emoji && <span style={{ fontSize:'1rem' }}>{r.emoji}</span>}
                              <span style={{ fontWeight:700, color:C.text }}>{r.title}</span>
                            </div>
                          </td>
                          <td style={{ padding:'0.625rem 0.75rem', color:r.color, fontWeight:600 }}>{describeRecurrence(r.recurrence)}</td>
                          <td style={{ padding:'0.625rem 0.75rem', color:C.sec }}>{fmtD(r.startDate)}</td>
                          <td style={{ padding:'0.625rem 0.75rem', color:C.muted }}>{r.timeLabel || '—'}</td>
                          <td style={{ padding:'0.625rem 0.75rem' }}>
                            <span style={{ color: nextDiff === 0 ? C.green : nextDiff === 1 ? C.cyan : C.sec, fontWeight:600 }}>{nextLabel}</span>
                            {nextDate && nextDate !== toDateStr(today) && <span style={{ fontSize:'0.7rem', color:C.muted, marginLeft:'0.4rem' }}>{fmtD(nextDate)}</span>}
                          </td>
                          <td style={{ padding:'0.625rem 0.5rem' }}>
                            <button onClick={e => { e.stopPropagation(); deleteReminder(r.id) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', display:'flex', alignItems:'center' }}><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Week grid */}
        {calTab === 'calendar' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem', borderBottom:'1px solid '+C.border, flexShrink:0, flexWrap:'wrap' }}>
            <button onClick={() => setWeekStart(w => addDays(w, -viewDays))} title={`Back ${viewDays} day${viewDays===1?'':'s'}`} style={{ flexShrink:0, width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronsLeft size={16} /></button>
            <button onClick={() => setWeekStart(w => addDays(w, -1))} title="Back 1 day" style={{ flexShrink:0, width:'26px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', color:C.muted, cursor:'pointer' }}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight:700, fontSize:'0.9rem', color:C.text, flex:'1 1 auto', minWidth:'8rem', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fmtWeekRange(weekStart, viewDays)}</span>
            <button onClick={() => setWeekStart(w => addDays(w, 1))} title="Forward 1 day" style={{ flexShrink:0, width:'26px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', color:C.muted, cursor:'pointer' }}><ChevronRight size={14} /></button>
            <button onClick={() => setWeekStart(w => addDays(w, viewDays))} title={`Forward ${viewDays} day${viewDays===1?'':'s'}`} style={{ flexShrink:0, width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer' }}><ChevronsRight size={16} /></button>
            <div style={{ flexShrink:0, display:'flex', gap:'2px', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'2px' }}>
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} onClick={() => setViewDays(n)} title={n + ' day' + (n===1?'':'s')} style={{ width:'22px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', background:viewDays===n?C.cyan:'transparent', border:'none', borderRadius:'0.35rem', color:viewDays===n?'#000':C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:700 }}>{n}</button>
              ))}
            </div>
            <div style={{ flexShrink:0, display:'flex', gap:'2px', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'2px' }}>
              {(['list','timeline'] as const).map(m => (
                <button key={m} onClick={() => setDayViewMode(m)} style={{ padding:'0.3rem 0.6rem', background:dayViewMode===m?C.cyan:'transparent', border:'none', borderRadius:'0.35rem', color:dayViewMode===m?'#000':C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:700, textTransform:'capitalize' }}>{m}</button>
              ))}
            </div>
            {dayViewMode === 'timeline' && (
              <div style={{ display:'flex', alignItems:'center', gap:'2px', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'2px' }}>
                <button onClick={() => setTlZoomIdx(i => Math.max(0, i - 1))} disabled={tlZoomIdx === 0} title="Zoom out — see more of the day at once" style={{ width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', borderRadius:'0.35rem', color:tlZoomIdx===0?C.muted:C.sec, cursor:tlZoomIdx===0?'not-allowed':'pointer', opacity:tlZoomIdx===0?0.4:1 }}><ZoomOut size={13} /></button>
                <span style={{ fontSize:'0.62rem', color:C.muted, width:'2.2rem', textAlign:'center' }}>{Math.round(tlPxPerMin * 60)}px/hr</span>
                <button onClick={() => setTlZoomIdx(i => Math.min(TL_ZOOM_LEVELS.length - 1, i + 1))} disabled={tlZoomIdx === TL_ZOOM_LEVELS.length - 1} title="Zoom in — space out the next hour" style={{ width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', borderRadius:'0.35rem', color:tlZoomIdx===TL_ZOOM_LEVELS.length-1?C.muted:C.sec, cursor:tlZoomIdx===TL_ZOOM_LEVELS.length-1?'not-allowed':'pointer', opacity:tlZoomIdx===TL_ZOOM_LEVELS.length-1?0.4:1 }}><ZoomIn size={13} /></button>
              </div>
            )}
          </div>

          {dayViewMode === 'list' ? (
          <div style={{ flex:1, display:'flex', overflow:'auto', padding:'0.75rem', gap:'0.5rem' }}>
            {weekDates.map(date => {
              const tasks = weekTasks[date] ?? []
              const flowTasks = tasks.filter(t => t.task_type === 'Flow')
              const personalTasks = tasks.filter(t => t.task_type === 'Personal')
              const otherTasks = tasks.filter(t => t.task_type !== 'Flow' && t.task_type !== 'Personal')
              const dow = new Date(date+'T12:00:00').getDay()
              const dayName = DAY_ABBR[dow]
              const dayNum = parseInt(date.split('-')[2])
              const isToday = date === todayStr
              const isPast = date < todayStr
              const isWeekend = dow === 0 || dow === 6
              const hasOverflow = flowTasks.length > 2
              const isDragOver = dragOverDate === date
              return (
                <div key={date}
                  onDragOver={e => handleDragOver(e, date)}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={e => handleDrop(e, date)}
                  style={{ flex:'1 1 140px', minWidth:'140px', maxWidth:'220px', display:'flex', flexDirection:'column', borderRadius:'0.75rem', border:'1px solid '+(isDragOver?C.cyan:isToday?'rgba(0,212,255,0.25)':C.border), padding:'0.625rem', background:isDragOver?'rgba(0,212,255,0.04)':isWeekend?'rgba(255,255,255,0.01)':'transparent', opacity:isPast && !isDragOver?0.6:1, transition:'border-color 0.15s, background 0.15s, opacity 0.15s' }}>
                  <div
                    style={{ textAlign:'center', marginBottom:'0.5rem', paddingBottom:'0.5rem', borderBottom:'1px solid '+C.border, transition:'border-color 0.2s' }}>
                    <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 0.1rem', color:isToday?C.cyan:isWeekend?C.muted:C.sec }}>{dayName}</p>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
                      <p style={{ fontSize:'1.25rem', fontWeight:900, margin:0, color:isToday?C.cyan:isWeekend?C.sec:C.text }}>{dayNum}</p>
                      <button onClick={e => { e.stopPropagation(); setAddingFor(date) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'2px', display:'flex', alignItems:'center', lineHeight:1, marginTop:'2px' }}>
                        <Plus size={11} />
                      </button>
                    </div>
                    {isToday && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.cyan, margin:'0.15rem auto 0' }} />}
                  </div>

                  {reminders.filter(r => reminderOccursOn(r, date)).length > 0 && (
                    <div style={{ marginBottom:'0.4rem', display:'flex', flexDirection:'column', gap:'0.18rem' }}>
                      {reminders.filter(r => reminderOccursOn(r, date)).map(r => (
                        <div key={r.id} onClick={() => openReminderForm(r)}
                          onMouseEnter={e => showTip(e, r.color, (r.emoji ? r.emoji + ' ' : '') + r.title, [describeRecurrence(r.recurrence) + (r.timeLabel ? ' - ' + r.timeLabel : '')])}
                          onMouseLeave={hideTip}
                          style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.18rem 0.35rem', borderRadius:'0.3rem', background:r.color+'18', border:'1px solid '+r.color+'45', cursor:'pointer' }}>
                          <Bell size={8} color={r.color} style={{ flexShrink:0 }} />
                          {r.emoji && <span style={{ fontSize:'0.72rem', lineHeight:1, flexShrink:0 }}>{r.emoji}</span>}
                          <span style={{ fontSize:'0.6rem', fontWeight:600, color:r.color, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                          {r.timeLabel && <span style={{ fontSize:'0.52rem', color:r.color, opacity:0.7, flexShrink:0 }}>{r.timeLabel}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {habits.filter(h => h.days.includes(dow)).length > 0 && (
                    <div style={{ marginBottom:'0.5rem', display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                      {habits.filter(h => h.days.includes(dow)).map(h => (
                        <div key={h.id}
                          onMouseEnter={e => showTip(e, h.color, (h.emoji ? h.emoji + ' ' : '') + h.title, [h.days.map(d => DAY_ABBR[d]).join(', ') + (h.timeLabel ? ' - ' + h.timeLabel : '')])}
                          onMouseLeave={hideTip}
                          style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.2rem 0.4rem', borderRadius:'0.375rem', background:h.color+'20', border:'1px solid '+h.color+'50' }}>
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
                      <TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} onReschedule={t => handleReschedule(t, date)} onHover={handleTaskHover} onHoverEnd={hideTip} />
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
                      {otherTasks.map(t => (<TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} onReschedule={t => handleReschedule(t, date)} onHover={handleTaskHover} onHoverEnd={hideTip} />))}
                    </div>
                  )}

                  <div style={{ borderTop:'1px solid rgba(139,92,246,0.2)', paddingTop:'0.5rem', marginTop:'auto' }}>
                    <p style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.purple, margin:'0 0 0.3rem' }}>Evening</p>
                    {personalTasks.map(t => (<TaskCard key={t.id} task={t} onComplete={id => handleComplete(id,date)} onDelete={id => handleDelete(id,date)} onDragStart={handleDragStart} onEdit={openEdit} onReschedule={t => handleReschedule(t, date)} onHover={handleTaskHover} onHoverEnd={hideTip} />))}
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
          ) : (
          <div style={{ flex:1, display:'flex', overflow:'auto', padding:'0.75rem', gap:'0.5rem', alignItems:'flex-start' }}>
            {weekDates.map(date => {
              const tasks = weekTasks[date] ?? []
              const dow = new Date(date+'T12:00:00').getDay()
              const dateReminders = reminders.filter(r => reminderOccursOn(r, date))
              const dateHabits = habits.filter(h => h.days.includes(dow))
              return (
                <TimelineDay
                  key={date}
                  date={date}
                  tasks={tasks}
                  reminders={dateReminders}
                  habits={dateHabits}
                  isToday={date === todayStr}
                  isPast={date < todayStr}
                  pxPerMin={tlPxPerMin}
                  onCommitTask={commitTaskTime}
                  onCommitReminder={commitReminderTime}
                  onCommitHabit={commitHabitTime}
                  onMoveItemDay={onMoveItemDay}
                  onOpenTask={openEdit}
                  onOpenReminder={openReminderForm}
                  onOpenHabit={openHabitForm}
                  onHoverTask={handleTaskHover}
                  onHoverGeneric={showTip}
                  onHoverEnd={hideTip}
                  onCreateAt={openCreateAt}
                />
              )
            })}
          </div>
          )}
        </div>}
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

      {/* Weighted daily plan modal */}
      {showPlanModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', maxHeight:'85vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => setShowPlanModal(false)} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.35rem' }}>
              <Sparkles size={16} color={C.green} />
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>Weighted Plan</h2>
            </div>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.5 }}>
              Pulls top-priority items from Vault, Tasks, Etsy, X, and your pinned YouTube videos, weighted by the % below, and drops them onto the date as normal tasks — reschedule and Organise Week work on them like anything else.
            </p>

            <div style={{ marginBottom:'0.875rem' }}>
              <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Date</label>
              <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)}
                style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
            </div>

            {planSettings && (
              <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                  <Settings2 size={11} color={C.muted}/>
                  <label style={{ fontSize:'0.68rem', color:C.sec, flex:1 }}>Total working minutes/day</label>
                  <input type="number" value={planSettings.total_minutes} onChange={e => setPlanSettings({ ...planSettings, total_minutes: Number(e.target.value) })}
                    style={{ width:'4.5rem', padding:'0.3rem 0.4rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem' }}/>
                </div>
                {(['pct_youtube','pct_etsy','pct_tasks','pct_x','pct_vault'] as const).map(k => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.3rem' }}>
                    <label style={{ fontSize:'0.68rem', color:C.sec, flex:1 }}>{SECTION_LABEL[k.replace('pct_','') as keyof typeof SECTION_LABEL]} %</label>
                    <input type="number" value={planSettings[k]} onChange={e => setPlanSettings({ ...planSettings, [k]: Number(e.target.value) })}
                      style={{ width:'4.5rem', padding:'0.3rem 0.4rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem' }}/>
                  </div>
                ))}
                <button onClick={savePlanSettings} style={{ width:'100%', marginTop:'0.3rem', padding:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.62rem' }}>
                  Save weighting
                </button>
              </div>
            )}

            {planResult && <p style={{ fontSize:'0.75rem', color:planResult.startsWith('Failed') ? C.red : C.green, margin:'0 0 0.875rem', lineHeight:1.4 }}>{planResult}</p>}

            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
              <button onClick={() => setShowPlanModal(false)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Close</button>
              <button onClick={runGeneratePlan} disabled={planGenerating} style={{ padding:'0.5rem 1.25rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:planGenerating?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:planGenerating?0.6:1 }}>
                {planGenerating ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommend for Tomorrow — review then commit + auto time-block */}
      {showRecModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'100%', maxWidth:'30rem', maxHeight:'85vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => { setShowRecModal(false); setRecCandidates(null) }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.35rem' }}>
              <Sparkles size={16} color={C.cyan} />
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>Recommend &amp; Organise</h2>
            </div>
            <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.75rem' }}>
              {(['today', 'tomorrow'] as const).map(choice => (
                <button key={choice} onClick={() => openRecommendModal(choice)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:700, textTransform:'capitalize',
                  cursor:'pointer', fontFamily:'inherit',
                  background: recDateChoice === choice ? 'rgba(0,212,255,0.15)' : 'transparent',
                  border:'1px solid '+(recDateChoice === choice ? C.cyan : C.border),
                  color: recDateChoice === choice ? C.cyan : C.muted,
                }}>{choice}</button>
              ))}
            </div>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.5 }}>
              Top-priority items from Vault, Tasks, Etsy, X and your pinned YouTube videos — review and uncheck anything you don&apos;t want. Confirming adds the checked items to <strong style={{ color:C.text }}>{recDate}</strong> and auto time-blocks the whole day on the Timeline (Flow &rarr; morning, Personal/Admin &rarr; evening).
            </p>

            {recLoading ? (
              <p style={{ fontSize:'0.8rem', color:C.muted, textAlign:'center', padding:'1.5rem 0' }}>Loading recommendations...</p>
            ) : recCandidates && recCandidates.length > 0 ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                  <span style={{ fontSize:'0.68rem', color:C.muted }}>{recCandidates.filter(c=>c.checked).length}/{recCandidates.length} selected</span>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <button onClick={() => selectAllRec(true)} style={{ fontSize:'0.65rem', color:C.cyan, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Select all</button>
                    <button onClick={() => selectAllRec(false)} style={{ fontSize:'0.65rem', color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Clear</button>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', marginBottom:'1rem' }}>
                  {recCandidates.map(c => (
                    <label key={c.key} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.45rem 0.6rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', cursor:'pointer' }}>
                      <input type="checkbox" checked={c.checked} onChange={() => toggleRecCandidate(c.key)} style={{ width:'0.9rem', height:'0.9rem', flexShrink:0 }} />
                      <span style={{ fontSize:'0.6rem', fontWeight:700, color:C.cyan, textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0, width:'3.5rem' }}>{SECTION_LABEL[c.section]}</span>
                      <span style={{ fontSize:'0.78rem', color:C.text, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
                      <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{c.minutes}m</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize:'0.8rem', color:C.muted, textAlign:'center', padding:'1.5rem 0', lineHeight:1.5 }}>No recommendations found — add priority items in Vault/Tasks/Etsy/X, or pin YouTube videos in the Content Pipeline, then try again.</p>
            )}

            {recResult && <p style={{ fontSize:'0.75rem', color:recResult.startsWith('Failed') ? C.red : C.green, margin:'0 0 0.875rem', lineHeight:1.4 }}>{recResult}</p>}

            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
              <button onClick={() => { setShowRecModal(false); setRecCandidates(null) }} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Close</button>
              <button onClick={confirmRecommend} disabled={recCommitting || recLoading || !recCandidates || recCandidates.filter(c=>c.checked).length===0}
                style={{ padding:'0.5rem 1.25rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:(recCommitting||recLoading)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(recCommitting||recLoading||!recCandidates||recCandidates.filter(c=>c.checked).length===0)?0.5:1 }}>
                {recCommitting ? 'Organising...' : 'Confirm & Organise'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', position:'relative' }}>
            <button onClick={closeEditModal} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <h2 style={{ margin:'0 0 1.25rem', fontSize:'1rem', fontWeight:800, color:C.text }}>{isCreatingTask ? 'New Task' : 'Edit Task'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Title</label>
                <input autoFocus={isCreatingTask} value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  placeholder={isCreatingTask ? "What's this?" : undefined}
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
                <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap', marginTop:'0.5rem' }}>
                  {rescheduleOptions(editDueDate ? new Date(editDueDate + 'T12:00:00') : undefined).map(o => (
                    <button key={o.label} onClick={() => setEditDueDate(o.date)} title={o.date}
                      style={{
                        padding:'0.3rem 0.55rem', borderRadius:'0.4rem', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600, cursor:'pointer',
                        background: editDueDate === o.date ? 'rgba(0,212,255,0.12)' : 'transparent',
                        border:'1px solid '+(editDueDate === o.date ? C.cyan : C.border),
                        color: editDueDate === o.date ? C.cyan : C.sec,
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional — leave blank to auto-place)</label>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>Start</span>
                    <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)}
                      style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
                  </div>
                  <span style={{ color:C.muted, fontSize:'0.8rem' }}>&rarr;</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    <span style={{ fontSize:'0.62rem', color:editStartTime?C.muted:C.muted+'80', fontWeight:600 }}>End</span>
                    <input type="time" disabled={!editStartTime}
                      value={editStartTime && hhmmToMinutes(editStartTime) !== null ? minutesToHHMM(hhmmToMinutes(editStartTime)! + editDurationMin) : ''}
                      onChange={e => {
                        const startMin = hhmmToMinutes(editStartTime)
                        const endMin = hhmmToMinutes(e.target.value)
                        if (startMin === null || endMin === null) return
                        let duration = endMin - startMin
                        if (duration <= 0) duration += 24 * 60 // end past midnight
                        setEditDurationMin(Math.max(TL_SNAP_MIN, duration))
                      }}
                      style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:editStartTime?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', cursor:editStartTime?'text':'not-allowed' }} />
                  </div>
                  <select value={editDurationMin} onChange={e => setEditDurationMin(Number(e.target.value))} disabled={!editStartTime} title="Quick duration — sets End from Start"
                    style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:editStartTime?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', cursor:editStartTime?'pointer':'not-allowed' }}>
                    {[15,30,45,60,90,120,180].map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                  </select>
                  {editStartTime && (
                    <button onClick={() => setEditStartTime('')} title="Clear fixed time — goes back to auto-placed"
                      style={{ fontSize:'0.68rem', padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {!isCreatingTask && (
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Status</label>
                  <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
                    {(['Not started', 'In progress', 'Done'] as const).map(s => {
                      const meta = s === 'Done' ? { color:C.green, bg:'rgba(0,255,136,0.1)' } : s === 'In progress' ? { color:C.cyan, bg:'rgba(0,212,255,0.1)' } : { color:C.muted, bg:'rgba(74,74,106,0.15)' }
                      const active = editStatus === s
                      return (
                        <button key={s} onClick={() => setEditStatus(s)}
                          style={{ fontSize:'0.7rem', padding:'0.25rem 0.55rem', borderRadius:'0.375rem', border:'1px solid '+(active?meta.color:C.border), background:active?meta.bg:'transparent', color:active?meta.color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:active?700:400 }}>
                          {s}
                        </button>
                      )
                    })}
                  </div>
                  {editStatus === 'Done' && (
                    <p style={{ fontSize:'0.66rem', color:C.muted, margin:'0.35rem 0 0', lineHeight:1.4 }}>Saving as Done removes it from the calendar.</p>
                  )}
                </div>
              )}
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
              {isCreatingTask
                ? <span />
                : <button onClick={handleDeleteFromEdit} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={closeEditModal} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={savingEdit || !editTitle.trim()} style={{ padding:'0.5rem 1.25rem', background:C.cyan, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:(savingEdit||!editTitle.trim())?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(savingEdit||!editTitle.trim())?0.5:1 }}>
                  {savingEdit ? 'Saving...' : isCreatingTask ? 'Create' : 'Save'}
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
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional — leave blank for "Anytime")</label>
                {(() => {
                  const startMin = parseTimeLabel(habitDraft.timeLabel)
                  const startDisplay = startMin !== null ? minutesToHHMM(startMin) : ''
                  return (
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>Start</span>
                        <input type="time" value={startDisplay} onChange={e => setHabitDraft(d => ({ ...d, timeLabel: e.target.value }))}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
                      </div>
                      <span style={{ color:C.muted, fontSize:'0.8rem' }}>&rarr;</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>End</span>
                        <input type="time" disabled={startMin === null}
                          value={startMin !== null ? minutesToHHMM(startMin + habitDraft.durationMin) : ''}
                          onChange={e => {
                            const endMin = hhmmToMinutes(e.target.value)
                            if (startMin === null || endMin === null) return
                            let duration = endMin - startMin
                            if (duration <= 0) duration += 24 * 60
                            setHabitDraft(d => ({ ...d, durationMin: Math.max(TL_SNAP_MIN, duration) }))
                          }}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', cursor:startMin!==null?'text':'not-allowed' }} />
                      </div>
                      <select value={habitDraft.durationMin} onChange={e => setHabitDraft(d => ({ ...d, durationMin: Number(e.target.value) }))} disabled={startMin === null} title="Quick duration"
                        style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', cursor:startMin!==null?'pointer':'not-allowed' }}>
                        {[15,30,45,60,90,120,180].map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                      </select>
                      {habitDraft.timeLabel && (
                        <button onClick={() => setHabitDraft(d => ({ ...d, timeLabel: '' }))} title="Clear — goes back to Anytime"
                          style={{ fontSize:'0.68rem', padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )
                })()}
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

      {/* Reminder form modal */}
      {showReminderModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.87)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:80 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', maxHeight:'90vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => { setShowReminderModal(false); setEditingReminder(null) }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
              <Bell size={16} color={reminderDraft.color} />
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>{editingReminder ? 'Edit Reminder' : 'New Reminder'}</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {/* Title + Emoji */}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Title</label>
                  <input autoFocus value={reminderDraft.title} onChange={e => setReminderDraft(d => ({ ...d, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveReminder()}
                    placeholder="e.g. Pay bills, Review goals"
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ width:'64px' }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Icon</label>
                  <input value={reminderDraft.emoji} onChange={e => setReminderDraft(d => ({ ...d, emoji: e.target.value }))} placeholder="&#128276;" maxLength={2}
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem', padding:'0.45rem 0.5rem', outline:'none', textAlign:'center', boxSizing:'border-box' }} />
                </div>
              </div>
              {/* Colour */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Colour</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[C.cyan, C.green, C.amber, C.purple, C.red, '#14b8a6', '#f97316'].map(col => (
                    <button key={col} onClick={() => setReminderDraft(d => ({ ...d, color: col }))} style={{ width:'26px', height:'26px', borderRadius:'50%', background:col, border: reminderDraft.color===col ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', padding:0, outline:'none' }} />
                  ))}
                </div>
              </div>
              {/* Recurrence */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Repeat</label>
                <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                  {(['daily','weekday','weekly','monthly','yearly','custom'] as ReminderRecurrence['type'][]).map(t => {
                    const active = reminderDraft.recurrence.type === t
                    const defaultRec: ReminderRecurrence = t === 'daily' ? { type:'daily' } : t === 'weekday' ? { type:'weekday' } : t === 'weekly' ? { type:'weekly', every:1 } : t === 'monthly' ? { type:'monthly', every:1 } : t === 'yearly' ? { type:'yearly', every:1 } : { type:'custom', every:1, unit:'days' }
                    return (
                      <button key={t} onClick={() => setReminderDraft(d => ({ ...d, recurrence: active ? d.recurrence : defaultRec }))}
                        style={{ fontSize:'0.72rem', padding:'0.3rem 0.6rem', borderRadius:'0.375rem', border:'1px solid '+(active?reminderDraft.color:C.border), background:active?reminderDraft.color+'22':'transparent', color:active?reminderDraft.color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:active?700:400, textTransform:'capitalize' }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
                {/* Sub-options for recurrence types with "every N" */}
                {(reminderDraft.recurrence.type === 'weekly' || reminderDraft.recurrence.type === 'monthly' || reminderDraft.recurrence.type === 'yearly') && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem' }}>
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>Every</span>
                    <input type="number" min={1} max={99}
                      value={(reminderDraft.recurrence as { type:string; every:number }).every}
                      onChange={e => {
                        const every = Math.max(1, parseInt(e.target.value) || 1)
                        setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, every } as ReminderRecurrence }))
                      }}
                      style={{ width:'56px', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.3rem 0.5rem', outline:'none', textAlign:'center' }} />
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>
                      {reminderDraft.recurrence.type === 'weekly' ? 'week(s)' : reminderDraft.recurrence.type === 'monthly' ? 'month(s)' : 'year(s)'}
                    </span>
                  </div>
                )}
                {reminderDraft.recurrence.type === 'custom' && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>Every</span>
                    <input type="number" min={1} max={999}
                      value={(reminderDraft.recurrence as { type:string; every:number; unit:string }).every}
                      onChange={e => {
                        const every = Math.max(1, parseInt(e.target.value) || 1)
                        setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, every } as ReminderRecurrence }))
                      }}
                      style={{ width:'64px', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.3rem 0.5rem', outline:'none', textAlign:'center' }} />
                    <div style={{ display:'flex', gap:'0.25rem' }}>
                      {(['days','weeks','months','years'] as const).map(u => {
                        const active = (reminderDraft.recurrence as { type:string; every:number; unit:string }).unit === u
                        return (
                          <button key={u} onClick={() => setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, unit: u } as ReminderRecurrence }))}
                            style={{ fontSize:'0.68rem', padding:'0.25rem 0.45rem', borderRadius:'0.3rem', border:'1px solid '+(active?reminderDraft.color:C.border), background:active?reminderDraft.color+'22':'transparent', color:active?reminderDraft.color:C.sec, cursor:'pointer', fontFamily:'inherit' }}>
                            {u}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Start date */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Start date</label>
                <input type="date" value={reminderDraft.startDate} onChange={e => setReminderDraft(d => ({ ...d, startDate: e.target.value }))}
                  style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', boxSizing:'border-box' }} />
              </div>
              {/* Time */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional — leave blank for "Anytime")</label>
                {(() => {
                  const startMin = parseTimeLabel(reminderDraft.timeLabel)
                  const startDisplay = startMin !== null ? minutesToHHMM(startMin) : ''
                  return (
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>Start</span>
                        <input type="time" value={startDisplay} onChange={e => setReminderDraft(d => ({ ...d, timeLabel: e.target.value }))}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
                      </div>
                      <span style={{ color:C.muted, fontSize:'0.8rem' }}>&rarr;</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>End</span>
                        <input type="time" disabled={startMin === null}
                          value={startMin !== null ? minutesToHHMM(startMin + reminderDraft.durationMin) : ''}
                          onChange={e => {
                            const endMin = hhmmToMinutes(e.target.value)
                            if (startMin === null || endMin === null) return
                            let duration = endMin - startMin
                            if (duration <= 0) duration += 24 * 60
                            setReminderDraft(d => ({ ...d, durationMin: Math.max(TL_SNAP_MIN, duration) }))
                          }}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', cursor:startMin!==null?'text':'not-allowed' }} />
                      </div>
                      <select value={reminderDraft.durationMin} onChange={e => setReminderDraft(d => ({ ...d, durationMin: Number(e.target.value) }))} disabled={startMin === null} title="Quick duration"
                        style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', cursor:startMin!==null?'pointer':'not-allowed' }}>
                        {[15,30,45,60,90,120,180].map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                      </select>
                      {reminderDraft.timeLabel && (
                        <button onClick={() => setReminderDraft(d => ({ ...d, timeLabel: '' }))} title="Clear — goes back to Anytime"
                          style={{ fontSize:'0.68rem', padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
              {/* Preview */}
              {reminderDraft.title.trim() && (
                <div style={{ padding:'0.6rem 0.75rem', background:reminderDraft.color+'12', border:'1px solid '+reminderDraft.color+'35', borderRadius:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <Bell size={12} color={reminderDraft.color} />
                  {reminderDraft.emoji && <span style={{ fontSize:'0.9rem' }}>{reminderDraft.emoji}</span>}
                  <div>
                    <p style={{ margin:0, fontSize:'0.8rem', fontWeight:700, color:reminderDraft.color }}>{reminderDraft.title}</p>
                    <p style={{ margin:0, fontSize:'0.68rem', color:C.muted }}>{describeRecurrence(reminderDraft.recurrence)}{reminderDraft.timeLabel ? ' · ' + reminderDraft.timeLabel : ''}</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <div>
                {editingReminder && (
                  <button onClick={() => deleteReminder(editingReminder.id)} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>
                )}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => { setShowReminderModal(false); setEditingReminder(null) }} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={saveReminder} disabled={!reminderDraft.title.trim()}
                  style={{ padding:'0.5rem 1.25rem', background:reminderDraft.color, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:!reminderDraft.title.trim()?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:!reminderDraft.title.trim()?0.5:1 }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover tooltip — full schedule item, fixed-position so the day column's own overflow can't clip it */}
      {hoverTip && (
        <div style={{
          position:'fixed', left:hoverTip.x, top:hoverTip.y, transform:'translateY(-100%)',
          zIndex:80, maxWidth:'230px', padding:'0.5rem 0.65rem', borderRadius:'0.5rem',
          background:C.card, border:'1px solid '+hoverTip.color+'55', boxShadow:'0 8px 20px rgba(0,0,0,0.5)',
          pointerEvents:'none',
        }}>
          <p style={{ margin:'0 0 0.2rem', fontSize:'0.76rem', fontWeight:700, color:hoverTip.color, lineHeight:1.35, wordBreak:'break-word' }}>{hoverTip.title}</p>
          {hoverTip.lines.map((line, i) => (
            <p key={i} style={{ margin:'0.1rem 0 0', fontSize:'0.66rem', color:C.sec, lineHeight:1.4, wordBreak:'break-word' }}>{line}</p>
          ))}
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

export default function CalendarPage() {
  return <Suspense><CalendarPageInner/></Suspense>
}
