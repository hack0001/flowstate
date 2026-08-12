'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Star, ChevronRight, CalendarDays, Sunrise, BarChart2, Moon, FolderOpen, Film, BookOpen, CheckSquare, User, Target, Tv, Link2, ShoppingBag, X, Activity, Camera, Layers, Lightbulb, Plus, Flame, GripVertical, ShoppingCart, Bell, Sparkles } from 'lucide-react'
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

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

const QUOTES = [
  { q:'The secret of getting ahead is getting started.', a:'Mark Twain' },
  { q:'Discipline is the bridge between goals and accomplishment.', a:'Jim Rohn' },
  { q:'Motivation gets you started. Habit keeps you going.', a:'Jim Rohn' },
  { q:'Done beats perfect.', a:'' },
  { q:'One task. Full attention. Ship it.', a:'' },
  { q:'Your future self is watching you right now through memories.', a:'Hal Elrod' },
  { q:'You never choose the morning — the system chooses it for you. That is the most efficient way.', a:'' },
  { q:'Efficiency is doing things right; effectiveness is doing the right things.', a:'Peter Drucker' },
  { q:'There is nothing so useless as doing efficiently that which should not be done at all.', a:'Peter Drucker' },
  { q:'The key is not to prioritize what’s on your schedule, but to schedule your priorities.', a:'Stephen Covey' },
  { q:'Work smarter, not harder.', a:'' },
  { q:'A system is a machine for turning decisions into actions you don’t have to think about.', a:'' },
  { q:'Remove the decision, remove the friction.', a:'' },
  { q:'The best system is the one you never have to think about.', a:'' },
  { q:'Automate the routine so you can focus on the remarkable.', a:'' },
  { q:'Every decision you skip today is energy saved for the one that matters.', a:'' },
  { q:'Build the system once. Let it carry you every day after.', a:'' },
]

// Website / app ideas parked for later -- not active projects, just a backlog
// to revisit when there's capacity. Stored in Supabase (site_ideas table).
// Full add/edit/delete UI now lives on its own page (app/ideas/page.tsx) --
// the home page only needs enough to show a preview tile that links there.
type SiteIdea = {
  id: string
  title: string
  tag: string
  summary: string
  next_step: string
  sort_order: number
  created_at: string
}

// Pre-flight check items -- must all be ticked before focus starts
const FOCUS_ITEMS = [
  { id:'desk',   emoji:'&#128187;', label:'Desk cleared',          note:'Remove everything except what you need right now' },
  { id:'phone',  emoji:'&#128245;', label:'Phone in another room', note:'Not on silent &mdash; physically gone' },
  { id:'timer',  emoji:'&#9201;',  label:'Timer set',              note:'Know exactly how long this session runs' },
  { id:'notif',  emoji:'&#128276;', label:'Notifications off',     note:'Do Not Disturb enabled &mdash; no pings' },
  { id:'water',  emoji:'&#128167;', label:'Drink within reach',    note:'No reason to leave your desk mid-session' },
  { id:'notepad',emoji:'&#128221;', label:'Notepad close by',      note:'Capture stray thoughts on paper so they don&apos;t hijack your focus' },
  { id:'distract',emoji:'&#128683;',label:'No distractions',       note:'Close every tab you don&apos;t need &mdash; no social media, email or news open' },
  { id:'task',   emoji:'&#127919;', label:'Task crystal clear',    note:'You know exactly what you are building' },
]

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

// ---- Top 5 per workflow ----
// Ranks a set of active items by that workflow's own priority_lists order
// (same list each page's Priority View drag-reorders), items not yet ranked
// fall in after the ranked ones, then takes the top N. Direct read of the
// same source of truth each workflow page uses -- no time-budget filtering.
type RankableItem = {
  id: string
  title: string
  // Optional extras, only populated for the YouTube pipeline list -- lets
  // its Top 5 card render the same rich row (stage/format/pin) as the old
  // "Active YouTube Focus" block instead of a plain numbered line.
  pipeline_stage?: string | null
  format?: string | null
  is_active_focus?: boolean
}

function rankTop<T extends RankableItem>(order: string[], items: T[], n = 5): T[] {
  const byId = new Map(items.map(i => [i.id, i]))
  const ranked = [...order.filter(id => byId.has(id)), ...items.map(i => i.id).filter(id => !order.includes(id))]
  return ranked.map(id => byId.get(id)!).slice(0, n)
}

// Distinct accent colour + icon per workflow for the Top 5 grid — makes
// "This week's overview" scannable at a glance instead of five identical
// grey cards.
const TOP5_COLOR: Record<DailyPlanSection, string> = {
  youtube: '#ff4466', etsy: '#f97316', tasks: '#00ff88', vault: '#8b5cf6', x: '#00d4ff',
}
const SECTION_ICON: Record<DailyPlanSection, JSX.Element> = {
  youtube: <Tv size={12} color={TOP5_COLOR.youtube} />,
  etsy: <ShoppingBag size={12} color={TOP5_COLOR.etsy} />,
  tasks: <CheckSquare size={12} color={TOP5_COLOR.tasks} />,
  vault: <BookOpen size={12} color={TOP5_COLOR.vault} />,
  x: <X size={12} color={TOP5_COLOR.x} />,
}

// ---- Streaks row (encouragement) ----
// Streak/consistency math itself now lives in lib/habitStreak.ts, shared
// with app/tracking/page.tsx so both pages agree on the same number for the
// same habit (schedule-aware, full history -- see that file for why the old
// per-page versions of this disagreed with each other).
type HabitStreak = { id: string; title: string; emoji: string; color: string; streak: number }

// ---- Focus sessions today (Content Pipeline chunked sessions) ----
// Counts today's content_focus_sessions rows (see 035_content_focus_sessions.sql
// / lib/sops.ts nextSessionChunk) so "how many focus sessions did I do today,
// how much progress" is visible at a glance -- nothing surfaced this before.
// Self-hides entirely if none have happened yet today.
function FocusSessionsToday() {
  const [stats, setStats] = useState<{ count: number; tasks: number; mins: number } | null>(null)
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { data } = await supabase.from('content_focus_sessions')
        .select('tasks_completed,actual_mins,estimated_mins,status')
        .gte('started_at', start.toISOString())
      const rows = (data ?? []) as { tasks_completed: number; actual_mins: number | null; estimated_mins: number; status: string }[]
      const count = rows.filter(r => r.status !== 'in_progress').length
      const tasks = rows.reduce((s, r) => s + (r.tasks_completed || 0), 0)
      const mins = rows.reduce((s, r) => s + (r.actual_mins ?? r.estimated_mins ?? 0), 0)
      setStats({ count, tasks, mins })
    })()
  }, [])
  if (!stats || stats.count === 0) return null
  return (
    <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.012)' }}>
      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0.75rem 2rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <div title="Chunked focus sessions completed today on the Content Pipeline" style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.7rem', background:C.cyan+'14', border:'1px solid '+C.cyan+'40', borderRadius:'9999px' }}>
          <Zap size={12} color={C.cyan} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:C.cyan }}>{stats.count} focus session{stats.count === 1 ? '' : 's'} today</span>
          <span style={{ fontSize:'0.72rem', color:C.sec }}>&middot; {stats.tasks} task{stats.tasks === 1 ? '' : 's'} &middot; {stats.mins}m</span>
        </div>
      </div>
    </div>
  )
}

// ---- Today / Tomorrow adjustable lists ----
// Pulls straight from master_tasks the same way Calendar does (due_date +
// start_time/duration_min), and orders each day by start_time first --
// Calendar is where that time actually gets set, so this list reflects
// whatever's been organised there rather than keeping its own order.
// Tasks with no time yet fall back to the shared 'tasks_priority' order
// (same list /tasks drag-reorders) so reordering here still syncs. Complete
// / add / reschedule all write straight to Supabase -- cross-device.
type HomeTask = { id: string; title: string; status: string; due_date: string | null; is_frog: boolean; start_time: string | null; duration_min: number | null }

// Recurring weekly commitments from the Calendar tab's habit_blocks table
// (e.g. "Gym - Mon/Wed/Fri"). Distinct from the Tracking-page Habit Tracker.
type HomeHabitBlock = { id: string; title: string; emoji: string; color: string; days: number[]; timeLabel: string }

function homeAddDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function homeAddMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }

// Same quick-pick logic as Calendar/Tasks reschedule buttons -- offsets are
// relative to the task's own current due date, never "today".
function rescheduleOptions(from: Date): { label: string; date: string }[] {
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

function fmtTimeLabel(hhmm: string | null): string | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + period
}

function TodayTomorrowLists({ refreshKey }: { refreshKey?: number }) {
  const router = useRouter()
  const { celebrate } = useCelebration()
  const todayStr = toDateStr(new Date())
  const tomorrowStr = toDateStr(new Date(Date.now() + 86400000))
  const [tasks, setTasks] = useState<HomeTask[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [habitBlocks, setHabitBlocks] = useState<HomeHabitBlock[]>([])
  const [ready, setReady] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)

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
  }, [todayStr, tomorrowStr])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, refreshKey])

  // Calendar-driven ordering: whatever has a start_time (set on Calendar's
  // Timeline) leads, earliest first; anything not yet time-blocked falls
  // back to the shared priority order.
  function sortByCalendar(list: HomeTask[]) {
    return [...list].sort((a, b) => {
      const at = a.start_time ? Number(a.start_time.slice(0,2)) * 60 + Number(a.start_time.slice(3,5)) : null
      const bt = b.start_time ? Number(b.start_time.slice(0,2)) * 60 + Number(b.start_time.slice(3,5)) : null
      if (at !== null && bt !== null) return at - bt
      if (at !== null) return -1
      if (bt !== null) return 1
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }

  // Tasks actually due that day, calendar-sorted as before.
  const dueTodayTasks = sortByCalendar(tasks.filter(t => t.due_date === todayStr))
  const dueTomorrowTasks = sortByCalendar(tasks.filter(t => t.due_date === tomorrowStr))

  // Fallback fill: when a day has few/no dated tasks, pull in undated
  // top-priority tasks (same order as the "Tasks" card in This week's
  // overview) so the column shows real work, not just reminders. Each
  // undated task is only used once across the two columns.
  const undatedByPriority = [...tasks.filter(t => !t.due_date)].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const FILL_TARGET = 5
  const todayFill = dueTodayTasks.length < FILL_TARGET ? undatedByPriority.slice(0, FILL_TARGET - dueTodayTasks.length) : []
  const usedFillIds = new Set(todayFill.map(t => t.id))
  const tomorrowFill = dueTomorrowTasks.length < FILL_TARGET
    ? undatedByPriority.filter(t => !usedFillIds.has(t.id)).slice(0, FILL_TARGET - dueTomorrowTasks.length)
    : []
  const fillIds = new Set([...todayFill, ...tomorrowFill].map(t => t.id))

  const todayTasks = [...dueTodayTasks, ...todayFill]
  const tomorrowTasks = [...dueTomorrowTasks, ...tomorrowFill]
  const todayReminders = reminders.filter(r => reminderOccursOn(r, todayStr))
  const tomorrowReminders = reminders.filter(r => reminderOccursOn(r, tomorrowStr))
  const todayDow = new Date(todayStr + 'T12:00:00').getDay()
  const tomorrowDow = new Date(tomorrowStr + 'T12:00:00').getDay()
  const todayHabits = habitBlocks.filter(h => h.days.includes(todayDow))
  const tomorrowHabits = habitBlocks.filter(h => h.days.includes(tomorrowDow))

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

  function Column({ label, list, reminderList, habitList, fillIds }: { label: string; dayKey: 'today' | 'tomorrow'; dueDate: string; list: HomeTask[]; reminderList: Reminder[]; habitList: HomeHabitBlock[]; fillIds: Set<string> }) {
    return (
      <div style={{ flex:1, minWidth:'240px' }}>
        <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>{label}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
          {list.length === 0 && reminderList.length === 0 && habitList.length === 0 && (
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 0.25rem' }}>Nothing scheduled.</p>
          )}
          {habitList.map(h => (
            <div
              key={h.id}
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
          ))}
          {reminderList.map(r => (
            <div
              key={r.id}
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
          ))}
          {list.map(task => {
            const done = task.status === 'Done'
            const timeLabel = fmtTimeLabel(task.start_time)
            const isFill = fillIds.has(task.id)
            const rescheduling = rescheduleId === task.id
            const opts = rescheduling ? rescheduleOptions(task.due_date ? new Date(task.due_date + 'T12:00:00') : new Date()) : []
            return (
              <div key={task.id}>
                <div
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null) }}
                  onDragOver={e => { e.preventDefault(); setDragOver(task.id) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOver === task.id) setDragOver(null) }}
                  onDrop={e => { e.preventDefault(); if (dragId) reorderWithin(list, dragId, task.id); setDragId(null); setDragOver(null) }}
                  style={{
                    display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem',
                    background: C.surface, border:'1px solid '+(dragOver===task.id?C.cyan+'80':isFill?C.amber+'35':C.border),
                    borderRadius:'0.6rem', opacity: dragId===task.id ? 0.4 : 1, cursor:'grab', transition:'opacity 0.1s,border-color 0.1s',
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
                  <span style={{ flex:1, minWidth:0, fontSize:'0.8rem', color: done?C.muted:C.text, textDecoration: done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                  <button type="button" draggable={false} onClick={() => setRescheduleId(rescheduling ? null : task.id)} title={isFill ? 'Set due date' : 'Reschedule'} style={{
                    background:'none', border:'none', color: rescheduling ? C.cyan : C.muted, cursor:'pointer', padding:'0.2rem', flexShrink:0, display:'flex', alignItems:'center',
                  }}>
                    <CalendarDays size={13} />
                  </button>
                </div>
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
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.65rem' }}>
        <button onClick={() => router.push('/calendar?openRecommend=today')} style={{
          display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.75rem',
          background:'linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,255,136,0.12))',
          border:'1px solid rgba(0,212,255,0.35)', borderRadius:'0.75rem', color:C.cyan,
          cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700,
        }}>
          <Sparkles size={12} />Organise Today
        </button>
      </div>
      <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
        <Column label="Today" dayKey="today" dueDate={todayStr} list={todayTasks} reminderList={todayReminders} habitList={todayHabits} fillIds={fillIds} />
        <Column label="Tomorrow" dayKey="tomorrow" dueDate={tomorrowStr} list={tomorrowTasks} reminderList={tomorrowReminders} habitList={tomorrowHabits} fillIds={fillIds} />
      </div>
    </div>
  )
}

// ---- Today's physical ----
// Reads today's row from the Physical page's weekly planner (day_of_week
// matches JS getDay()) and renders it as a real checklist. Completion is
// stored under checklist_key 'physical_plan' so ticking here or on the
// Physical page itself shows the same state either way.
type PhysicalPlanItem = { id: string; label: string; category: string | null }

function TodaysPhysical() {
  const router = useRouter()
  const { celebrate } = useCelebration()
  const todayStr = toDateStr(new Date())
  const [items, setItems] = useState<PhysicalPlanItem[]>([])
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const dow = new Date().getDay()
    Promise.all([
      supabase.from('weekly_exercise_plan').select('id,label,category,sort_order').eq('day_of_week', dow).order('sort_order'),
      getDailyChecklistState('physical_plan', todayStr),
    ]).then(([{ data, error }, { state }]) => {
      if (error) {
        setErr(error.message.includes('does not exist')
          ? 'Setup needed: run supabase/migrations/030_weekly_exercise_plan.sql against your database.'
          : error.message)
      }
      setItems((data ?? []) as PhysicalPlanItem[])
      setDone(state)
      setReady(true)
    })
  }, [todayStr])

  function toggle(id: string) {
    setDone(prev => {
      const next = !prev[id]
      if (next) { sounds.playTaskComplete(); celebrate('task') }
      setDailyChecklistItem('physical_plan', id, todayStr, next)
      return { ...prev, [id]: next }
    })
  }

  if (!ready) return null
  const doneCount = items.filter(i => done[i.id]).length

  return (
    <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.006)' }}>
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.25rem 2rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
        <button onClick={() => router.push('/physical')} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit' }}>
          <Activity size={13} color={C.green} />
          <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted }}>Today&apos;s physical</span>
        </button>
        {items.length > 0 && !err && (
          <span style={{ marginLeft:'auto', fontSize:'0.68rem', fontWeight:700, color: doneCount===items.length ? C.green : C.muted }}>{doneCount} / {items.length}</span>
        )}
      </div>
      {err ? (
        <p style={{ fontSize:'0.75rem', color:C.amber, margin:0 }}>{err}</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize:'0.75rem', color:C.muted, margin:0 }}>Nothing planned for today &#8212; add exercises to today&#39;s column in the Weekly Plan on the Physical page.</p>
      ) : (
      <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
        {items.map(item => {
          const isDone = !!done[item.id]
          return (
            <div key={item.id} onClick={() => toggle(item.id)} style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.6rem', cursor:'pointer' }}>
              <span style={{ width:'16px', height:'16px', borderRadius:'50%', flexShrink:0, border:'2px solid '+(isDone ? C.green : C.muted), background: isDone ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {isDone && <span style={{ fontSize:'0.5rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
              </span>
              <span style={{ flex:1, minWidth:0, fontSize:'0.8rem', color: isDone ? C.muted : C.text, textDecoration: isDone ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
              {item.category && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.category}</span>}
            </div>
          )
        })}
      </div>
      )}
    </div>
    </div>
  )
}

// ---- Weekly Targets ----
// "3 Shorts, 1 Long-form, 4 Etsy listings, Website work" style counters.
// Shorts/Long-form auto-count from content_items reaching the Live stage
// this week (no manual bookkeeping); Etsy/Website have no pipeline table
// yet so they're a simple cross-device +/- tally against the week.
type WeeklyTarget = { id: string; label: string; emoji: string; color: string; target_count: number; tracking: string; sort_order: number }

function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function WeeklyTargets() {
  const now = new Date()
  const weekStart = toDateStr(mondayOf(now))
  const prevWeekStart = toDateStr(new Date(mondayOf(now).getTime() - 7 * 86400000))
  // Mon=1 .. Sun=7 — used to judge whether progress is on pace for the "health bar" framing.
  const daysElapsed = ((now.getDay() + 6) % 7) + 1
  const daysLeft = 7 - daysElapsed

  const [targets, setTargets] = useState<WeeklyTarget[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [prevCounts, setPrevCounts] = useState<Record<string, number>>({})
  const [picks, setPicks] = useState<Record<string, string>>({}) // target_id -> picked content title
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const { data: targetRows } = await supabase.from('weekly_targets')
      .select('id,label,emoji,color,target_count,tracking,sort_order').eq('active', true).order('sort_order')
    const rows = (targetRows ?? []) as WeeklyTarget[]
    setTargets(rows)

    const next: Record<string, number> = {}
    const prevNext: Record<string, number> = {}
    const nextPicks: Record<string, string> = {}
    await Promise.all(rows.map(async t => {
      if (t.tracking === 'auto_shorts' || t.tracking === 'auto_longform') {
        // NOTE: content_items.format stores "Long-form" (hyphen), not "Long form" —
        // must match exactly or the long-form count silently stays at 0.
        const formats = t.tracking === 'auto_shorts' ? ['Short', 'Both'] : ['Long-form', 'Both']
        const [{ count }, { count: prevCount }] = await Promise.all([
          supabase.from('content_items').select('id', { count: 'exact', head: true })
            .ilike('pipeline_stage', '%Live%').in('format', formats).gte('updated_at', weekStart),
          supabase.from('content_items').select('id', { count: 'exact', head: true })
            .ilike('pipeline_stage', '%Live%').in('format', formats).gte('updated_at', prevWeekStart).lt('updated_at', weekStart),
        ])
        next[t.id] = count ?? 0
        prevNext[t.id] = prevCount ?? 0

        // This week's pick — selected on the Content page, shown here as the
        // specific title being worked toward rather than just a bare count.
        const { data: pick } = await supabase.from('weekly_target_picks')
          .select('content_item_id').eq('target_id', t.id).eq('week_start', weekStart).maybeSingle()
        if (pick?.content_item_id) {
          const { data: ci } = await supabase.from('content_items').select('title').eq('id', pick.content_item_id).maybeSingle()
          if (ci?.title) nextPicks[t.id] = ci.title
        }
      } else {
        const [{ data }, { data: prevData }] = await Promise.all([
          supabase.from('weekly_target_progress').select('manual_count').eq('target_id', t.id).eq('week_start', weekStart).maybeSingle(),
          supabase.from('weekly_target_progress').select('manual_count').eq('target_id', t.id).eq('week_start', prevWeekStart).maybeSingle(),
        ])
        next[t.id] = data?.manual_count ?? 0
        prevNext[t.id] = prevData?.manual_count ?? 0
      }
    }))
    setCounts(next)
    setPrevCounts(prevNext)
    setPicks(nextPicks)
    setReady(true)
  }, [weekStart, prevWeekStart])

  useEffect(() => { load() }, [load])

  async function bump(t: WeeklyTarget, delta: number) {
    const current = counts[t.id] ?? 0
    const next = Math.max(0, current + delta)
    setCounts(prev => ({ ...prev, [t.id]: next }))
    await supabase.from('weekly_target_progress').upsert(
      { target_id: t.id, week_start: weekStart, manual_count: next, updated_at: new Date().toISOString() },
      { onConflict: 'target_id,week_start' }
    )
  }

  if (!ready || targets.length === 0) return null

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0.75rem' }}>
      {targets.map(t => {
        const current = counts[t.id] ?? 0
        const pct = Math.min(100, Math.round((current / Math.max(1, t.target_count)) * 100))
        const met = current >= t.target_count

        // "Health bar" framing — colour reflects whether you're on pace for
        // the week, not just raw progress, so a stalled target visibly turns
        // urgent as days run out rather than sitting there as a neutral bar.
        const expectedPct = Math.round((daysElapsed / 7) * 100)
        const paceStatus = met ? 'met' : pct >= expectedPct ? 'ahead' : (expectedPct - pct > 20 ? 'behind' : 'ontrack')
        const paceColor = paceStatus === 'met' || paceStatus === 'ahead' ? C.green : paceStatus === 'behind' ? C.red : t.color
        const paceLabel = paceStatus === 'met' ? 'Hit for the week' : daysLeft <= 0 ? 'Last day' : daysLeft + ' day' + (daysLeft===1?'':'s') + ' left'

        const prevCount = prevCounts[t.id] ?? 0
        const delta = current - prevCount
        const deltaLabel = delta === 0 ? 'same as last week' : delta > 0 ? '+' + delta + ' vs last week' : delta + ' vs last week'
        const deltaColor = delta > 0 ? C.green : delta < 0 ? C.muted : C.muted

        return (
          <div key={t.id} style={{ padding:'0.75rem 0.85rem', background:C.surface, border:'1px solid '+(met?t.color+'50':paceStatus==='behind'?C.red+'40':C.border), borderRadius:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.4rem' }}>
              <span style={{ fontSize:'0.78rem', color:C.text, fontWeight:600 }}>{t.emoji} {t.label}</span>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color: met?t.color:C.sec }}>{current}/{t.target_count}</span>
            </div>
            <div style={{ height:'4px', background:C.border, borderRadius:'2px', overflow:'hidden', marginBottom:'0.4rem' }}>
              <div style={{ height:'100%', width:pct+'%', background:paceColor, borderRadius:'2px', transition:'width 0.3s ease, background 0.3s ease' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: (t.tracking==='manual' || picks[t.id]) ? '0.5rem' : 0, gap:'0.4rem' }}>
              <span style={{ fontSize:'0.62rem', fontWeight:700, color:paceColor }}>{paceLabel}</span>
              <span style={{ fontSize:'0.62rem', color:deltaColor }}>{deltaLabel}</span>
            </div>
            {picks[t.id] && (
              <p style={{ fontSize:'0.68rem', color:C.sec, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={picks[t.id]}>
                &#127919; {picks[t.id]}
              </p>
            )}
            {t.tracking === 'manual' && (
              <div style={{ display:'flex', gap:'0.4rem' }}>
                <button type="button" onClick={() => bump(t, -1)} style={{ flex:1, padding:'0.25rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>-</button>
                <button type="button" onClick={() => bump(t, 1)} style={{ flex:1, padding:'0.25rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>+</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- Isolated clock -- only this re-renders every second ----
function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700, color:C.text, letterSpacing:'0.05em' }}>{time}</span>
}

// ---- Focus environment pre-flight check ----
function FocusCheck({ onProceed, onClose }: { onProceed: () => void; onClose: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const allDone = checked.size === FOCUS_ITEMS.length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'1.5rem', padding:'2rem', width:'100%', maxWidth:'26rem', position:'relative', animation:'fadeInUp 0.3s ease both' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>&#127919;</div>
          <h2 style={{ fontSize:'1.25rem', fontWeight:900, color:C.text, margin:'0 0 0.35rem', letterSpacing:'-0.02em' }}>Pre-Flight Check</h2>
          <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Get the environment right before you lock in</p>
        </div>

        {/* Progress bar */}
        <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.5rem', overflow:'hidden' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,'+C.green+',#00cc6a)', width:(checked.size/FOCUS_ITEMS.length*100)+'%', transition:'width 0.3s ease', borderRadius:'2px' }} />
        </div>

        {/* Checklist */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.75rem' }}>
          {FOCUS_ITEMS.map(item => {
            const done = checked.has(item.id)
            return (
              <button key={item.id} onClick={() => toggle(item.id)} style={{
                display:'flex', alignItems:'center', gap:'0.875rem',
                padding:'0.75rem 1rem',
                background: done ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid '+(done ? 'rgba(0,255,136,0.25)' : '#2a2a3a'),
                borderRadius:'0.875rem', cursor:'pointer', fontFamily:'inherit',
                textAlign:'left', transition:'all 0.15s ease',
              }}>
                {/* Checkbox */}
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
                  border: '2px solid '+(done ? C.green : '#4a4a6a'),
                  background: done ? C.green : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s ease',
                }}>
                  {done && <span style={{ fontSize:'0.65rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
                </div>
                {/* Label */}
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'0.85rem', fontWeight:700, color:done?C.green:C.text, margin:0, transition:'color 0.15s' }}
                    dangerouslySetInnerHTML={{ __html: item.label }} />
                  <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.4, marginTop:'0.1rem' }}
                    dangerouslySetInnerHTML={{ __html: item.note }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <button onClick={allDone ? onProceed : undefined} style={{
          width:'100%', padding:'0.95rem',
          background: allDone ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : '#1a1a26',
          border: '1px solid '+(allDone ? 'transparent' : '#2a2a3a'),
          borderRadius:'1rem', cursor: allDone ? 'pointer' : 'default',
          fontFamily:'inherit', fontWeight:900, fontSize:'0.95rem',
          color: allDone ? '#000' : C.muted,
          transition:'all 0.25s ease',
          boxShadow: allDone ? '0 4px 24px rgba(0,255,136,0.3)' : 'none',
        }}>
          {allDone ? 'Begin deep work →' : checked.size + ' / ' + FOCUS_ITEMS.length + ' checked'}
        </button>

        <div style={{ textAlign:'center', marginTop:'0.875rem' }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', textDecoration:'underline' }}>
            Skip check &mdash; I&apos;m already set up
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Add Task modal ----
// Replaces the old inline "+ Add task" boxes inside Today/Tomorrow — opened
// from a single button in the top-right bar instead, so the list itself
// doesn't lose vertical space to an input row most of the time.
function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(toDateStr(new Date()))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const t = title.trim()
    if (!t || saving) return
    setSaving(true)
    const { error } = await supabase.from('master_tasks')
      .insert({ title: t, status: 'Not started', due_date: dueDate || null, task_type: 'Quick Task', archived: false, is_frog: false })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onAdded()
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'1.25rem', padding:'1.75rem', width:'100%', maxWidth:'24rem', animation:'fadeInUp 0.25s ease both' }}>
        <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan, margin:'0 0 1rem' }}>Add task</p>
        {err && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem' }}>{err}</p>}
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder="Task title..." style={{ width:'100%', padding:'0.65rem 0.8rem', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', marginBottom:'0.75rem', boxSizing:'border-box' }} />
        <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Due date</p>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
          {[
            { label:'Today', date: toDateStr(new Date()) },
            { label:'Tomorrow', date: toDateStr(new Date(Date.now() + 86400000)) },
            { label:'No date', date:'' },
          ].map(o => (
            <button key={o.label} type="button" onClick={() => setDueDate(o.date)} style={{
              padding:'0.3rem 0.65rem', borderRadius:'9999px', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, cursor:'pointer',
              background: dueDate === o.date ? C.cyan : 'none',
              color: dueDate === o.date ? '#000' : C.sec,
              border:'1px solid '+(dueDate === o.date ? C.cyan : '#2a2a3a'),
            }}>{o.label}</button>
          ))}
        </div>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', marginBottom:'1.25rem', boxSizing:'border-box', colorScheme:'dark' }} />
        <div style={{ display:'flex', gap:'0.6rem' }}>
          <button onClick={onClose} style={{ flex:1, padding:'0.65rem', background:'none', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600 }}>Cancel</button>
          <button onClick={submit} disabled={saving || !title.trim()} style={{ flex:1, padding:'0.65rem', background: title.trim() ? C.cyan : '#2a2a3a', border:'none', borderRadius:'0.6rem', color: title.trim() ? '#000' : C.muted, cursor: title.trim() ? 'pointer' : 'default', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:800 }}>{saving ? 'Adding...' : 'Add task'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const { t, lang, toggle } = useLanguage()

  const h = new Date().getHours()
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const greeting =
    h < 6  ? 'Up early, Tom' :
    h < 12 ? 'Good morning, Tom' :
    h < 17 ? 'Good afternoon, Tom' :
    h < 21 ? 'Good evening, Tom' : 'Late night, Tom'

  const lateStart = h >= 10 && h < 14
  const veryLate  = h >= 14

  const [focusError, setFocusError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [routineDone, setRoutineDone] = useState(false)
  const [topTask, setTopTask] = useState<{ title: string; id: string; instructions?: string[]; meta?: string } | null>(null)
  const [eveningDone, setEveningDone] = useState(false)
  const [topTaskIsPipeline, setTopTaskIsPipeline] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [showFocusCheck, setShowFocusCheck] = useState(false)
  const [pendingFocusItem, setPendingFocusItem] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [pageAlerts, setPageAlerts] = useState<Record<string, 'green' | 'orange' | 'red'>>({})
  const [pageWarn, setPageWarn] = useState<Set<string>>(new Set())
  const [pageVisitsErr, setPageVisitsErr] = useState<string | null>(null)
  // Preview only -- full add/edit/delete lives on the dedicated /ideas page.
  const [ideas, setIdeas] = useState<SiteIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [streaks, setStreaks] = useState<HabitStreak[]>([])
  const [consistencyPct, setConsistencyPct] = useState<number | null>(null)
  const [top5, setTop5] = useState<Partial<Record<'tasks'|'vault'|'etsy'|'x'|'youtube', RankableItem[]>>>({})
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskRefresh, setTaskRefresh] = useState(0)

  const TRACKED_ROUTES = ['morning','calendar','tracking','evening','welsh','vault','content','projects','tasks','personal','youtube','etsy','x','nsdr','physical','instagram','tabs','ideas']

  const today = toDateStr(new Date())
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  const loadData = useCallback(async () => {
    let localDone = false
    try {
      localDone = localStorage.getItem('flowstate_routine_done') === toDateStr(new Date())
      if (localDone) setRoutineDone(true)
    } catch {}

    try {
      const [focusResult, routineRes, tasksRes, eveningRes, habitRes] = await Promise.all([
        getActiveFocusVideos(),
        supabase.from('routine_completions').select('routine_date').eq('routine_date', toDateStr(new Date())).maybeSingle(),
        // Query the tasks table for today's top task (frog first)
        supabase.from('master_tasks')
          .select('id,title,urgency,importance,task_type,is_frog,why_note,time_commitment')
          .eq('due_date', toDateStr(new Date()))
          .eq('archived', false)
          .neq('status','Done')
          .order('is_frog', { ascending:false })
          .limit(10),
        getEveningReview(toDateStr(new Date())),
        // Cross-check against the Habit Tracker's "Morning routine" habit --
        // the same source the streaks row reads. The morning routine writes
        // to routine_completions AND this habit together when it finishes;
        // if one write ever silently fails, the other still lets us detect
        // "done" correctly instead of the CTA/header chip going stale.
        // .limit(1) not .maybeSingle() -- see 036_dedupe_habits.sql; this
        // must not error out if duplicate "Morning routine" rows ever
        // exist again, it should just pick the oldest and move on.
        supabase.from('habits').select('id').eq('title', 'Morning routine').order('created_at', { ascending: true }).limit(1),
      ])

      let habitDoneToday = false
      const morningHabitId = habitRes.data?.[0]?.id
      if (morningHabitId) {
        const { data: hc } = await supabase.from('habit_completions')
          .select('completed_date').eq('habit_id', morningHabitId).eq('completed_date', toDateStr(new Date())).maybeSingle()
        habitDoneToday = !!hc
      }

      setFocusError(focusResult.error)
      const done = !!routineRes.data || localDone || habitDoneToday
      setRoutineDone(done)
      setEveningDone(!!eveningRes.review?.completedAt)
      try { if (done) localStorage.setItem('flowstate_routine_done', toDateStr(new Date())) } catch {}

      // The #1 task should generally point at the Pipeline — if there's an
      // active focus video, that's the thing to work on today. Only fall
      // back to a generic master_tasks pick (frog/urgent) when nothing is
      // pinned or in production. Either way, carry along "how to do it"
      // instructions -- the SOP steps for a pipeline video, or the task's
      // own why_note -- so the home page CTA can show more than a title.
      const topVideo = focusResult.videos[0]
      if (topVideo) {
        const sop = sopForStage(topVideo.pipeline_stage)
        setTopTask({
          id: topVideo.id,
          title: sop ? sop.title + ' — ' + topVideo.title : 'Advance "' + topVideo.title + '"',
          instructions: sop ? sop.steps.slice(0, 3) : undefined,
          meta: topVideo.pipeline_stage ?? undefined,
        })
        setTopTaskIsPipeline(true)
      } else {
        const tasks: Array<{ id:string; title:string; urgency:string|null; importance:string|null; task_type:string|null; is_frog:boolean; why_note:string|null; time_commitment:string|null }> = tasksRes.data ?? []
        const frog   = tasks.find(t => t.is_frog)
        const urgent = tasks.find(t => t.urgency === 'Urgent' && t.importance === 'Moved the Needle')
        const top    = frog ?? urgent ?? tasks[0]
        if (top) {
          const meta = [top.task_type, top.urgency, top.time_commitment].filter(Boolean).join(' · ')
          setTopTask({ id:top.id, title:top.title, instructions: top.why_note ? [top.why_note] : undefined, meta: meta || undefined })
        } else {
          setTopTask(null)
        }
        setTopTaskIsPipeline(false)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setTimeout(() => setContentReady(true), 80)
    }
  }, [])

  useEffect(() => {
    loadData()
    const onVisible = () => { if (!document.hidden) loadData() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', loadData)
    // Also poll every 60s — if this tab stays open and focused while the
    // morning routine gets completed elsewhere (another device, or just
    // never blurring this window), visibilitychange/focus never fire and
    // the "Morning routine pending" chip would otherwise go stale.
    const poll = setInterval(loadData, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', loadData)
      clearInterval(poll)
    }
  }, [loadData])

  useEffect(() => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    const isWeekday = day >= 1 && day <= 5
    const isAfternoon = hour >= 13 && hour < 20
    const dismissed = (() => { try { return localStorage.getItem('flowstate_reminder_dismissed') === toDateStr(now) } catch { return false } })()
    setShowReminder(isWeekday && isAfternoon && !dismissed)
  }, [])

  // Streaks row — active habits from the general Habit Tracker, including
  // the Morning routine (which now auto-ticks itself when the flow
  // finishes). Streak + consistency math is schedule-aware and shared with
  // the Tracking page (lib/habitStreak.ts) so the two pages always agree on
  // the same number for the same habit -- a Mon/Wed/Fri habit's own rest
  // days no longer break its streak here just because they did on the old
  // strict-consecutive-calendar-day math. Full completion history is
  // fetched (not windowed) so a streak longer than a few weeks still shows
  // its real length; this is a small personal table so that's cheap.
  // Pulled out to a callback (not just an inline mount effect) so it can
  // also be re-run on demand -- see the 'flowstate:routine-complete' /
  // 'flowstate:evening-complete' listener below.
  const loadStreaks = useCallback(() => {
    Promise.all([
      supabase.from('habits').select('id,title,emoji,color,schedule_type,schedule_days,schedule_time,created_at').eq('active', true).order('sort_order'),
      supabase.from('habit_completions').select('habit_id,completed_date'),
    ]).then(([{ data: habits, error: habitsErr }, { data: completions, error: compErr }]) => {
      if (habitsErr) console.error('[home streaks] habits query failed', habitsErr.message)
      if (compErr) console.error('[home streaks] completions query failed', compErr.message)
      const byHabit = new Map<string, Set<string>>()
      for (const c of (completions ?? []) as { habit_id: string; completed_date: string }[]) {
        if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, new Set())
        byHabit.get(c.habit_id)!.add(c.completed_date)
      }
      const habitRows = (habits ?? []) as (StreakHabit & { title: string; emoji: string; color: string })[]
      // Per-habit try/catch so one malformed row (e.g. a bad created_at)
      // can't silently zero out every other habit's streak too.
      const rows = habitRows
        .map(h => {
          let streak = 0
          try { streak = calcHabitStreak(h, byHabit.get(h.id) ?? new Set()) }
          catch (e) { console.error('[home streaks] calc failed for habit', h.id, e) }
          return { id: h.id, title: h.title, emoji: h.emoji, color: h.color, streak }
        })
        .filter(h => h.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 6)
      setStreaks(rows)

      // Unified consistency score — % of SCHEDULED habit-days actually
      // completed over the trailing 7 days. Schedule-aware for the same
      // reason streaks are: a habit's own off-days shouldn't count against
      // it in the denominator.
      try { setConsistencyPct(calcConsistencyPct(habitRows, byHabit, 7)) }
      catch (e) { console.error('[home streaks] consistency calc failed', e) }
    }).catch(e => console.error('[home streaks] load failed', e))
  }, [])

  useEffect(() => { loadStreaks() }, [loadStreaks])

  // Same-tab client-side navigation (router.push) back to Home doesn't
  // always trigger a fresh mount or a visibilitychange/focus event -- so
  // completing the morning/evening routine on its own page and clicking
  // back here can leave the CTA, header chip, and streaks all showing
  // stale "not done yet" state until a manual reload. Morning/evening pages
  // dispatch these events the moment they actually finish writing
  // completion, and Home listens for them the whole time it's mounted
  // (even while another route is showing on top of it), so the fresh state
  // is already loaded by the time you navigate back.
  useEffect(() => {
    const onRoutineComplete = () => { loadData(); loadStreaks() }
    window.addEventListener('flowstate:routine-complete', onRoutineComplete)
    window.addEventListener('flowstate:evening-complete', onRoutineComplete)
    return () => {
      window.removeEventListener('flowstate:routine-complete', onRoutineComplete)
      window.removeEventListener('flowstate:evening-complete', onRoutineComplete)
    }
  }, [loadData, loadStreaks])

  // Top 5 per workflow — direct read of each workflow's own priority_lists
  // order (the same list its own Priority View drag-reorders), independent
  // of the Calendar's time-budgeted daily plan. YouTube reads its own
  // 'youtube_pipeline_priority' list (set from Content's Priority tab), same
  // as every other workflow — no more falling back to pinned focus videos.
  useEffect(() => {
    (async () => {
      const [tasksRes, vaultRes, xRes, ytRes, etsyPl, etsyCs, tasksPl, vaultPl, xPl, ytPl] = await Promise.all([
        supabase.from('master_tasks').select('id,title,status,archived').eq('archived', false).neq('status', 'Done'),
        supabase.from('vault_items').select('id,title,status').neq('archived', true),
        supabase.from('x_ideas').select('id,text,status').eq('archived', false),
        supabase.from('content_items').select('id,title,pipeline_stage,format,is_active_focus').neq('archived', true),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'etsy_todos_priority').maybeSingle(),
        supabase.from('checklist_state').select('state').eq('key', 'etsy_checklists').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'tasks_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'vault_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'x_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'youtube_pipeline_priority').maybeSingle(),
      ])

      const tasksItems: RankableItem[] = ((tasksRes.data ?? []) as { id:string; title:string }[]).map(t => ({ id:t.id, title:t.title }))
      const vaultItems: RankableItem[] = ((vaultRes.data ?? []) as { id:string; title:string; status:string|null }[])
        .filter(v => v.status !== 'Done' && v.status !== 'Read')
        .map(v => ({ id:v.id, title:v.title }))
      const xItems: RankableItem[] = ((xRes.data ?? []) as { id:string; text:string; status:string|null }[])
        .filter(i => i.status !== 'done')
        .map(i => ({ id:i.id, title:i.text }))
      const checked = (etsyCs.data?.state as Record<string, boolean> | undefined) ?? {}
      const etsyItems: RankableItem[] = ETSY_TODOS
        .map(td => ({ id: td.notion_url || td.name, title: td.name, checked: !!checked[td.notion_url || td.name] }))
        .filter(td => !td.checked)
        .map(({ id, title }) => ({ id, title }))
      const ytItems: RankableItem[] = ((ytRes.data ?? []) as { id:string; title:string; pipeline_stage:string|null; format:string|null; is_active_focus:boolean|null }[])
        .filter(v => v.pipeline_stage !== '📣 Live' && v.pipeline_stage !== '📊 Post-Published')
        .map(v => ({ id:v.id, title:v.title, pipeline_stage:v.pipeline_stage, format:v.format, is_active_focus:!!v.is_active_focus }))

      setTop5({
        tasks:   rankTop((tasksPl.data?.ordered_ids as string[] | undefined) ?? [], tasksItems),
        vault:   rankTop((vaultPl.data?.ordered_ids as string[] | undefined) ?? [], vaultItems),
        x:       rankTop((xPl.data?.ordered_ids as string[] | undefined) ?? [], xItems),
        etsy:    rankTop((etsyPl.data?.ordered_ids as string[] | undefined) ?? [], etsyItems),
        youtube: rankTop((ytPl.data?.ordered_ids as string[] | undefined) ?? [], ytItems),
      })
    })().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-launch the Morning/Evening Routine on the first app open of the
  // day/evening — cross-device, so opening on a different phone or laptop
  // still counts as "already been on the app" rather than firing again.
  // Uses the existing page_visits table (route text PK, last_visited_at)
  // as a same-day marker rather than localStorage, which is per-device.
  // Gated on the routine actually being undone, so it never yanks you back
  // in after you've already finished it (on any device).
  useEffect(() => {
    (async () => {
      try {
        const now = new Date()
        const hour = now.getHours()
        const todayStr = toDateStr(now)
        const EVENING_HOUR = 20

        const [{ data: routineRow }, eveningRes, { visits }] = await Promise.all([
          supabase.from('routine_completions').select('routine_date').eq('routine_date', todayStr).maybeSingle(),
          getEveningReview(todayStr),
          getPageVisits(),
        ])

        if (hour >= EVENING_HOUR) {
          const eveningDone = !!eveningRes.review?.completedAt
          const marker = visits['__evening_auto_launch__']
          const alreadyTonight = !!marker && toDateStr(new Date(marker)) === todayStr
          if (!eveningDone && !alreadyTonight) {
            await recordPageVisit('__evening_auto_launch__')
            router.push('/evening')
          }
        } else {
          const morningDone = !!routineRow
          const marker = visits['__morning_auto_launch__']
          const alreadyToday = !!marker && toDateStr(new Date(marker)) === todayStr
          if (!morningDone && !alreadyToday) {
            await recordPageVisit('__morning_auto_launch__')
            router.push('/morning')
          }
        }
      } catch { /* never block the home page over this */ }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getPageVisits().then(({ visits, error }) => {
      setPageVisitsErr(error)
      const now = Date.now()
      const alerts: Record<string, 'green' | 'orange' | 'red'> = {}
      const warn = new Set<string>()
      for (const route of TRACKED_ROUTES) {
        const raw = visits[route]
        if (!raw) { alerts[route] = 'red'; warn.add(route); continue }
        const age = now - new Date(raw).getTime()
        const days = age / (24 * 3600 * 1000)
        if (days >= 5) alerts[route] = 'red'
        else if (days >= 4) alerts[route] = 'orange'
        else if (days >= 2) alerts[route] = 'green'
        if (days >= 3) warn.add(route)
      }
      setPageAlerts(alerts)
      setPageWarn(warn)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navTo(route: string) {
    recordPageVisit(route)
    // Clear the badge immediately rather than waiting on the next full page
    // load — visiting today should drop the warning right away.
    setPageWarn(prev => {
      if (!prev.has(route)) return prev
      const next = new Set(prev)
      next.delete(route)
      return next
    })
    setPageAlerts(prev => {
      if (!(route in prev)) return prev
      const next = { ...prev }
      delete next[route]
      return next
    })
    router.push('/' + route)
  }

  // Same as navTo but deep-links straight to one item — the target page
  // reads ?focus=<id> on load and scrolls/highlights that row so clicking
  // a Top 5 card actually lands you on the thing, not just the list.
  function navToItem(route: string, id: string) {
    recordPageVisit(route)
    setPageWarn(prev => {
      if (!prev.has(route)) return prev
      const next = new Set(prev)
      next.delete(route)
      return next
    })
    setPageAlerts(prev => {
      if (!(route in prev)) return prev
      const next = { ...prev }
      delete next[route]
      return next
    })
    router.push('/' + route + '?focus=' + encodeURIComponent(id))
  }

  // YouTube Top 5 items go through the same Pre-Flight Check -> content-focus
  // flow as the old "Active YouTube Focus" list — pin the clicked video first
  // so it's the one waiting when the focus session actually opens.
  async function focusYoutubeItem(id: string) {
    supabase.from('content_items').update({ is_active_focus: true }).eq('id', id).then()
    setPendingFocusItem(id)
    handleFocusClick()
  }

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true)
    const { data } = await supabase
      .from('site_ideas')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setIdeas((data ?? []) as SiteIdea[])
    setIdeasLoading(false)
  }, [])

  useEffect(() => { loadIdeas() }, [loadIdeas])

  function handleFocusClick() {
    // Show the pre-flight check before starting focus
    setShowFocusCheck(true)
  }

  function proceedToFocus() {
    setShowFocusCheck(false)
    router.push(pendingFocusItem ? '/content-focus?item=' + pendingFocusItem : '/content-focus')
    setPendingFocusItem(null)
  }

  const accentColor = routineDone ? C.green : C.cyan
  const morningCtaLabel =
    veryLate  ? 'Still time to win the afternoon' :
    lateStart ? "Running late — let's go!" :
    "Let's get the day started"
  const morningCtaGrad = veryLate
    ? 'linear-gradient(135deg,'+C.purple+',#6d28d9)'
    : lateStart
    ? 'linear-gradient(135deg,'+C.amber+',#cc8800)'
    : 'linear-gradient(135deg,'+C.cyan+',#0099cc)'
  const morningCtaGlow = veryLate ? 'rgba(139,92,246,0.3)' : lateStart ? 'rgba(255,184,0,0.3)' : 'rgba(0,212,255,0.25)'

  // Three states for the main CTA card: morning routine not done yet,
  // evening routine due and not done, or -- the common case -- neither
  // routine is blocking, so show today's actual highest-priority task.
  const isEveningReady = h >= 20 && !eveningDone
  const ctaState: 'morning' | 'evening' | 'focus' = !routineDone ? 'morning' : isEveningReady ? 'evening' : 'focus'

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg, position:'relative', overflow:'hidden' }}>

      {/* Ambient background orbs */}
      <div aria-hidden="true" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:'-120px', left:'-80px', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle,'+(routineDone?'rgba(0,255,136,0.055)':'rgba(0,212,255,0.055)')+' 0%,transparent 65%)', animation:'orbFloat1 18s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'-100px', right:'-60px', width:'420px', height:'420px', borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.045) 0%,transparent 65%)', animation:'orbFloat2 22s ease-in-out infinite' }} />
        <div style={{ position:'absolute', top:'45%', left:'55%', width:'300px', height:'300px', borderRadius:'50%', background:'radial-gradient(circle,'+(routineDone?'rgba(0,255,136,0.03)':'rgba(0,212,255,0.028)')+' 0%,transparent 70%)', animation:'orbFloat3 28s ease-in-out infinite', transform:'translate(-50%,-50%)' }} />
      </div>

      {/* Header */}
      <div style={{
        position:'relative', zIndex:1, padding:'2.5rem 2rem 2rem',
        borderBottom:'1px solid '+C.border,
        background: routineDone
          ? 'linear-gradient(160deg,rgba(0,255,136,0.05) 0%,rgba(0,212,255,0.03) 60%,transparent 100%)'
          : 'linear-gradient(160deg,rgba(0,212,255,0.05) 0%,rgba(139,92,246,0.04) 60%,transparent 100%)',
        transition:'background 0.8s ease',
      }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem' }}>
              <Zap size={16} color={accentColor} />
              <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:accentColor }}>FlowState</span>
            </div>
            <h1 style={{ fontSize:'clamp(1.6rem,3.5vw,2.25rem)', fontWeight:900, color:C.text, margin:'0 0 0.35rem', letterSpacing:'-0.02em' }}>{greeting}</h1>
            <p style={{ fontSize:'0.9rem', color:C.sec, margin:'0 0 0.75rem' }}>{dateLabel}</p>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
              <LiveClock />
              {!loading && routineDone && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem', animation:'fadeInUp 0.35s ease both' }}>
                  &#10003; Morning routine complete
                </span>
              )}
              {!loading && !routineDone && h >= 6 && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem' }}>
                  Morning routine pending
                </span>
              )}
              {/* Evening routine checker -- only shows once evening is actually
                  time-relevant (h>=20), same pending/complete treatment as morning */}
              {!loading && h >= 20 && eveningDone && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem', animation:'fadeInUp 0.35s ease both' }}>
                  &#10003; Evening routine complete
                </span>
              )}
              {!loading && h >= 20 && !eveningDone && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem' }}>
                  Evening routine pending
                </span>
              )}
            </div>
          </div>

          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'flex-start' }}>
            {/* Add task — opens a modal instead of eating space in Today/Tomorrow */}
            <button onClick={() => setShowAddTask(true)} title="Add task" style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:'pointer', fontSize:'0.75rem', fontWeight:700, fontFamily:'inherit' }}>
              <Plus size={14}/> Task
            </button>
            {/* Welsh / English toggle */}
            <button onClick={toggle} title={lang === 'en' ? 'Switch to Welsh' : 'Newid i Saesneg'} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1rem', background: lang === 'cy' ? 'rgba(0,192,75,0.12)' : 'rgba(255,255,255,0.04)', border:'1px solid '+(lang === 'cy' ? 'rgba(0,192,75,0.3)' : C.border), borderRadius:'0.75rem', color: lang === 'cy' ? '#00c04b' : C.muted, cursor:'pointer', fontSize:'0.75rem', fontWeight:700, fontFamily:'inherit', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'CY' : 'EN'}
            </button>
            {([
              { route:'morning', icon:<Sunrise size={14}/>, label:t('morning'), bg:'rgba(255,184,0,0.08)', border:'rgba(255,184,0,0.25)', color:C.amber },
              { route:'calendar', icon:<CalendarDays size={14}/>, label:t('calendar'), bg:'rgba(0,212,255,0.06)', border:'rgba(0,212,255,0.18)', color:C.cyan },
              { route:'tracking', icon:<BarChart2 size={14}/>, label:t('tracking'), bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.25)', color:C.purple },
              { route:'evening', icon:<Moon size={14}/>, label:t('evening'), bg:'rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.18)', color:'#8b5cf6' },
              { route:'welsh', icon:<span style={{ fontSize:'0.8rem' }}>&#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;</span>, label:'Welsh', bg:'rgba(0,192,75,0.07)', border:'rgba(0,192,75,0.25)', color:'#00c04b' },
              { route:'vault', icon:<BookOpen size={14}/>, label:'Vault', bg:'rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.18)', color:'#8b5cf6' },
              { route:'content', icon:<Film size={14}/>, label:'Content', bg:'rgba(255,107,53,0.07)', border:'rgba(255,107,53,0.2)', color:'#ff6b35' },
              { route:'projects', icon:<FolderOpen size={14}/>, label:t('projects'), bg:'rgba(0,212,255,0.06)', border:'rgba(0,212,255,0.18)', color:'#00d4ff' },
              { route:'tasks', icon:<CheckSquare size={14}/>, label:t('tasks'), bg:'rgba(0,255,136,0.06)', border:'rgba(0,255,136,0.18)', color:'#00ff88' },
              { route:'personal', icon:<User size={14}/>, label:t('personal'), bg:'rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.18)', color:'#8b5cf6' },
              { route:'youtube', icon:<Tv size={14}/>, label:t('youtube'), bg:'rgba(255,68,102,0.07)', border:'rgba(255,68,102,0.2)', color:'#ff4466' },
              { route:'etsy', icon:<ShoppingBag size={14}/>, label:t('etsy'), bg:'rgba(249,115,22,0.07)', border:'rgba(249,115,22,0.22)', color:'#f97316' },
              { route:'x', icon:<X size={14}/>, label:'X / Social', bg:'rgba(249,115,22,0.07)', border:'rgba(249,115,22,0.22)', color:'#f97316' },
              { route:'nsdr', icon:<Moon size={14}/>, label:'NSDR', bg:'rgba(139,92,246,0.07)', border:'rgba(139,92,246,0.22)', color:'#8b5cf6' },
              { route:'physical', icon:<Activity size={14}/>, label:'Physical', bg:'rgba(0,255,136,0.06)', border:'rgba(0,255,136,0.2)', color:'#00ff88' },
              { route:'instagram', icon:<Camera size={14}/>, label:'Instagram', bg:'rgba(225,48,108,0.07)', border:'rgba(225,48,108,0.22)', color:'#e1306c' },
              { route:'tabs', icon:<Layers size={14}/>, label:'Tab Sheet', bg:'rgba(0,212,255,0.06)', border:'rgba(0,212,255,0.18)', color:'#00d4ff' },
              { route:'ideas', icon:<Lightbulb size={14}/>, label:'Ideas', bg:'rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.18)', color:'#8b5cf6' },
            ] as { route:string; icon:JSX.Element; label:string; bg:string; border:string; color:string; bold?:boolean }[]).map(({ route, icon, label, bg, border, color, bold }) => {
              const alert = pageAlerts[route]
              const alertBg     = alert === 'red' ? 'rgba(255,68,102,0.15)' : alert === 'orange' ? 'rgba(255,184,0,0.13)' : alert === 'green' ? 'rgba(0,255,136,0.11)' : null
              const alertBorder = alert === 'red' ? 'rgba(255,68,102,0.5)'  : alert === 'orange' ? 'rgba(255,184,0,0.45)'  : alert === 'green' ? 'rgba(0,255,136,0.4)'   : null
              const finalBg     = alertBg ?? bg
              const finalBorder = alertBorder ?? border
              const showWarn = pageWarn.has(route)
              return (
                <button key={route} onClick={() => navTo(route)} style={{ position:'relative', display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.1rem', background:finalBg, border:finalBorder==='none'?'none':'1px solid '+finalBorder, borderRadius:'0.75rem', color, cursor:'pointer', fontSize:'0.8rem', fontWeight:bold?700:600, fontFamily:'inherit', transition:'background 0.3s,border-color 0.3s' }}>
                  {icon}{label}
                  {showWarn && (
                    <span style={{ position:'absolute', top:'-7px', right:'-7px', minWidth:'16px', height:'16px', borderRadius:'9999px', background:C.amber, color:'#000', fontSize:'0.55rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:'0 3px', boxShadow:'0 0 0 2px '+C.bg, pointerEvents:'none' }}>!</span>
                  )}
                </button>
              )
            })}
          </div>
          {pageVisitsErr && (
            <div style={{ marginTop:'0.75rem', padding:'0.5rem 0.75rem', background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:'0.6rem', color:'#ff4466', fontSize:'0.72rem' }}>
              {pageVisitsErr}
            </div>
          )}
        </div>
      </div>

      {/* Weekday afternoon reminder banner -- one place above the streaks row */}
      {showReminder && (
        <div style={{ position:'relative', zIndex:2, background:'rgba(249,115,22,0.08)', borderBottom:'1px solid rgba(249,115,22,0.2)' }}>
          <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0.75rem 2rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'1rem' }}>&#9989;</span>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#f97316' }}>{t('reminderTitle')}: </span>
              <span style={{ fontSize:'0.78rem', color:'#8888aa' }}>{t('reminderMemes')} &nbsp;&bull;&nbsp; {t('reminderMewing')}</span>
            </div>
            <button onClick={() => {
              try { localStorage.setItem('flowstate_reminder_dismissed', toDateStr(new Date())) } catch {}
              setShowReminder(false)
            }} style={{ background:'none', border:'none', color:'#4a4a6a', cursor:'pointer', display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'0.25rem' }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Today's physical — moved directly under the afternoon check-in bar.
          Component renders nothing (no wrapper) if nothing's queued for today */}
      {!loading && <TodaysPhysical />}

      {/* Streaks row — always visible, today-relevant at a glance */}
      {!loading && (streaks.length > 0 || consistencyPct !== null) && (
        <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.012)' }}>
          <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1rem 2rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap' }}>
              {consistencyPct !== null && (() => {
                const cColor = consistencyPct >= 80 ? C.green : consistencyPct >= 50 ? C.amber : C.red
                return (
                  <div title="% of active habits completed over the last 7 days" style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.7rem', background:cColor+'14', border:'1px solid '+cColor+'50', borderRadius:'9999px' }}>
                    <span style={{ fontSize:'0.85rem', fontWeight:900, color:cColor }}>{consistencyPct}%</span>
                    <span style={{ fontSize:'0.72rem', color:C.sec }}>consistency (7d)</span>
                  </div>
                )
              })()}
              {streaks.map(s => (
                <div key={s.id} title={s.title} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.35rem 0.7rem', background:s.color+'14', border:'1px solid '+s.color+'40', borderRadius:'9999px' }}>
                  <Flame size={12} color={s.color} />
                  {s.emoji && <span style={{ fontSize:'0.8rem', lineHeight:1 }}>{s.emoji}</span>}
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:s.color }}>{s.streak}</span>
                  <span style={{ fontSize:'0.72rem', color:C.sec }}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && <FocusSessionsToday />}

      {/* Today / Tomorrow — full calendar-day view: tasks, reminders, and
          recurring habit blocks, same content and functionality as the
          Calendar tab for these two days. Directly under the streak bar so
          it's the first thing seen after the morning/evening status. */}
      {!loading && (
        <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.006)' }}>
          <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.25rem 2rem' }}>
            <TodayTomorrowLists refreshKey={taskRefresh} />
          </div>
        </div>
      )}

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onAdded={() => setTaskRefresh(k => k + 1)} />}

      {/* Next up / routine CTA -- moved up right after streaks so it's one of
          the first things seen, not buried under Today/Tomorrow and This
          week's overview. No longer a full-viewport hero (it used to be the
          last element on the page and filled remaining height) -- now a
          normal bounded section like everything else below it. */}
      {!loading && (
        <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.006)' }}>
          <div style={{
            maxWidth:'900px', margin:'0 auto', padding:'1.75rem 2rem',
            display:'flex', flexDirection:'column', alignItems:'center',
            opacity: contentReady ? 1 : 0,
            transform: contentReady ? 'translateY(0)' : 'translateY(10px)',
            transition:'opacity 0.4s ease, transform 0.4s ease',
          }}>

            {error ? (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', maxWidth:'28rem', textAlign:'center' }}>
                <p style={{ fontWeight:700, color:C.amber, marginBottom:'0.5rem' }}>Supabase Not Connected</p>
                <p style={{ fontSize:'0.875rem', color:C.sec, marginBottom:'1rem' }}>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.</p>
                <button onClick={() => router.push('/content')} style={{ padding:'0.6rem 1.2rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Browse Anyway</button>
              </div>
            ) : ctaState === 'morning' ? (
              /* ---- Morning card ---- */
              <div style={{ textAlign:'center', animation:'fadeInUp 0.4s ease both' }}>
                <div style={{ position:'relative', display:'inline-block', marginBottom:'1.5rem' }}>
                  <div style={{ position:'absolute', inset:'-28px', borderRadius:'50%', background:'radial-gradient(circle,'+morningCtaGlow+' 0%,transparent 70%)', animation:'breathe 3s ease-in-out infinite', pointerEvents:'none' }} />
                  <button onClick={() => router.push('/morning')} style={{
                    position:'relative',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem',
                    padding:'1.5rem 2.75rem', borderRadius:'1.5rem',
                    background:morningCtaGrad,
                    border:'none', cursor:'pointer', fontFamily:'inherit',
                    boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
                  }}>
                    <span style={{ fontSize:'1rem', fontWeight:900, color:'#000', letterSpacing:'-0.01em' }}>{morningCtaLabel}</span>
                    <span style={{ fontSize:'0.72rem', fontWeight:600, color:'rgba(0,0,0,0.65)' }}>
                      {veryLate ? 'Do the routine, then lock in' : lateStart ? 'Morning routine — quick version' : 'Start your morning routine'}
                    </span>
                    <span style={{ fontSize:'1.1rem', marginTop:'0.15rem' }}>&#8594;</span>
                  </button>
                </div>
                <div style={{ maxWidth:'24rem', margin:'0 auto' }}>
                  <p style={{ fontSize:'0.85rem', color:C.sec, fontStyle:'italic', lineHeight:1.6, margin:0 }}>"{quote.q}"</p>
                  {quote.a && <p style={{ fontSize:'0.72rem', color:C.muted, marginTop:'0.25rem' }}>-- {quote.a}</p>}
                </div>
              </div>
            ) : ctaState === 'evening' ? (
              /* ---- Evening card ---- */
              <div style={{ textAlign:'center', animation:'fadeInUp 0.4s ease both' }}>
                <div style={{ position:'relative', display:'inline-block', marginBottom:'1.5rem' }}>
                  <div style={{ position:'absolute', inset:'-28px', borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.3) 0%,transparent 70%)', animation:'breathe 3s ease-in-out infinite', pointerEvents:'none' }} />
                  <button onClick={() => router.push('/evening')} style={{
                    position:'relative',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem',
                    padding:'1.5rem 2.75rem', borderRadius:'1.5rem',
                    background:'linear-gradient(135deg,'+C.purple+',#6d28d9)',
                    border:'none', cursor:'pointer', fontFamily:'inherit',
                    boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
                  }}>
                    <span style={{ fontSize:'1rem', fontWeight:900, color:'#fff', letterSpacing:'-0.01em' }}>Time to wind down</span>
                    <span style={{ fontSize:'0.72rem', fontWeight:600, color:'rgba(255,255,255,0.75)' }}>Evening routine &mdash; reflect &amp; reset</span>
                    <span style={{ fontSize:'1.1rem', marginTop:'0.15rem' }}>&#8594;</span>
                  </button>
                </div>
                <div style={{ maxWidth:'24rem', margin:'0 auto' }}>
                  <p style={{ fontSize:'0.85rem', color:C.sec, fontStyle:'italic', lineHeight:1.6, margin:0 }}>"{quote.q}"</p>
                  {quote.a && <p style={{ fontSize:'0.72rem', color:C.muted, marginTop:'0.25rem' }}>-- {quote.a}</p>}
                </div>
              </div>
            ) : (
              /* ---- Task-focus card ---- */
              <div style={{
                width:'100%', maxWidth:'32rem',
                background:'linear-gradient(135deg,rgba(0,255,136,0.07) 0%,rgba(0,212,255,0.04) 100%)',
                border:'1px solid rgba(0,255,136,0.22)',
                borderRadius:'1.5rem', padding:'2rem 2rem 1.75rem',
                position:'relative', overflow:'hidden',
                animation:'fadeInUp 0.4s ease both',
              }}>
                <div style={{ position:'absolute', top:'-50px', right:'-50px', width:'200px', height:'200px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,255,136,0.13) 0%,transparent 70%)', pointerEvents:'none' }} />
                <div style={{ position:'relative' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.5rem' }}>
                    <span style={{ fontSize:'1rem' }}>&#128293;</span>
                    <span style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color:C.green }}>Next up</span>
                  </div>
                  <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:C.text, margin:'0 0 1rem', letterSpacing:'-0.02em', lineHeight:1.25 }}>
                    {topTask ? topTask.title : 'Nothing queued for today.'}
                  </h2>

                  {topTask ? (
                    <>
                      {topTask.meta && (
                        <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', color:C.green, margin:'0 0 0.75rem' }}>{topTask.meta}</p>
                      )}
                      {topTask.instructions && topTask.instructions.length > 0 && (
                        <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,255,136,0.14)', borderRadius:'0.875rem', padding:'0.875rem 1rem', marginBottom:'1.25rem' }}>
                          <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.green, margin:'0 0 0.5rem' }}>How to do it</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                            {topTask.instructions.map((step, i) => (
                              <p key={i} style={{ fontSize:'0.82rem', color:C.sec, margin:0, lineHeight:1.5 }}>{i + 1}. {step}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={() => { if (topTaskIsPipeline) { setPendingFocusItem(topTask.id); handleFocusClick() } else navToItem('tasks', topTask.id) }} style={{
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem',
                        width:'100%', padding:'0.95rem 1.5rem',
                        background:'linear-gradient(135deg,'+C.green+',#00cc6a)',
                        border:'none', borderRadius:'1rem', cursor:'pointer', fontFamily:'inherit',
                        fontWeight:800, fontSize:'0.95rem', color:'#000',
                        boxShadow:'0 4px 24px rgba(0,255,136,0.28)',
                        marginBottom:'1.25rem',
                      }}>
                        &#9654;&nbsp; {topTaskIsPipeline ? 'Start focus session' : 'Open task'}
                      </button>
                    </>
                  ) : (
                    <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,255,136,0.14)', borderRadius:'0.875rem', padding:'0.875rem 1rem', marginBottom:'1.25rem' }}>
                      <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>No task set &mdash; pin a video in the Content Pipeline or add tasks in Calendar.</p>
                    </div>
                  )}

                  <p style={{ fontSize:'0.82rem', color:C.sec, fontStyle:'italic', lineHeight:1.6, margin:0 }}>"{quote.q}"</p>
                  {quote.a && <p style={{ fontSize:'0.7rem', color:C.muted, marginTop:'0.25rem' }}>-- {quote.a}</p>}
                </div>
              </div>
            )}

            {focusError && (
              <div style={{ width:'100%', maxWidth:'32rem', marginTop:'0.75rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
                <p style={{ fontSize:'0.75rem', color:C.amber, margin:0, lineHeight:1.5 }}>{focusError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* This week's overview — top 5 per workflow + weekly targets. */}
      {!loading && (
        <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.015)' }}>
          <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.5rem', marginBottom:'0.9rem' }}>
              <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted }}>This week&apos;s overview</span>
              <span style={{ fontSize:'0.68rem', color:C.muted }}>&mdash; priorities &amp; targets</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'0.7rem', marginBottom:'1.5rem' }}>
              {(['youtube','etsy','tasks','vault','x'] as DailyPlanSection[]).map(section => {
                const items: RankableItem[] = top5[section] ?? []
                const route = section === 'tasks' ? 'tasks' : section === 'youtube' ? 'content' : section === 'x' ? 'x' : section
                const accent = TOP5_COLOR[section]
                return (
                  <div key={section} style={{ padding:'0.8rem 0.85rem', background:C.surface, border:'1px solid '+accent+'35', borderTop:'2px solid '+accent, borderRadius:'0.75rem' }}>
                    <button onClick={() => navTo(route)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem', width:'100%', textAlign:'left', marginBottom:'0.55rem' }}>
                      {SECTION_ICON[section]}
                      <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:accent, margin:0 }}>
                        {SECTION_LABEL[section]}
                      </p>
                    </button>
                    {items.length === 0 ? (
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0 }}>Nothing queued</p>
                    ) : section === 'youtube' ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                        {items.map(item => (
                          <button key={item.id} onClick={() => focusYoutubeItem(item.id)}
                            style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.45rem 0.55rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left', width:'100%' }}>
                            <div style={{ width:'1.5rem', height:'1.5rem', borderRadius:'0.4rem', background:C.card, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Tv size={11} color={accent}/>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:'0.76rem', fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</p>
                              <p style={{ fontSize:'0.63rem', color:C.muted, margin:0 }}>{item.pipeline_stage ?? 'Idea'}{item.format ? ' · '+item.format : ''}</p>
                            </div>
                            {item.is_active_focus
                              ? <Star size={10} color={C.amber} fill="currentColor" style={{ flexShrink:0 }}/>
                              : <ChevronRight size={12} color={C.muted} style={{ flexShrink:0 }}/>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                        {items.map((item, i) => (
                          <button key={item.id} onClick={() => navToItem(route, item.id)}
                            style={{ display:'flex', alignItems:'center', gap:'0.45rem', background:'none', border:'none', borderLeft:'2px solid '+accent+'50', padding:'0.2rem 0 0.2rem 0.5rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left', width:'100%' }}>
                            <span style={{ fontSize:'0.65rem', color:accent, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                            <span style={{ flex:1, fontSize:'0.78rem', color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</span>
                            <ChevronRight size={11} color={C.muted} style={{ flexShrink:0 }}/>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Website / app ideas -- 6th tile, same visual treatment as the
                  workflow cards above, so the backlog can't be missed the way
                  it was when it lived collapsed at the very bottom of the page. */}
              <div style={{ padding:'0.8rem 0.85rem', background:C.surface, border:'1px solid '+C.purple+'35', borderTop:'2px solid '+C.purple, borderRadius:'0.75rem' }}>
                <button onClick={() => navTo('ideas')} style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem', width:'100%', textAlign:'left', marginBottom:'0.55rem' }}>
                  <Lightbulb size={12} color={C.purple} />
                  <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.purple, margin:0 }}>
                    Website &amp; App Ideas
                  </p>
                </button>
                {ideas.length === 0 ? (
                  <p style={{ fontSize:'0.72rem', color:C.muted, margin:0 }}>{ideasLoading ? 'Loading...' : 'Nothing parked'}</p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {ideas.slice(0, 5).map((idea, i) => (
                      <button key={idea.id} onClick={() => navTo('ideas')}
                        style={{ display:'flex', alignItems:'center', gap:'0.45rem', background:'none', border:'none', borderLeft:'2px solid '+C.purple+'50', padding:'0.2rem 0 0.2rem 0.5rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left', width:'100%' }}>
                        <span style={{ fontSize:'0.65rem', color:C.purple, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                        <span style={{ flex:1, fontSize:'0.78rem', color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{idea.title}</span>
                        <ChevronRight size={11} color={C.muted} style={{ flexShrink:0 }}/>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.6rem' }}>This week&apos;s targets</p>
            <WeeklyTargets />
          </div>
        </div>
      )}

      {/* Focus pre-flight check overlay */}
      {showFocusCheck && (
        <FocusCheck
          onProceed={proceedToFocus}
          onClose={() => setShowFocusCheck(false)}
        />
      )}

      <style>{`
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 30%{transform:translate(50px,-35px) scale(1.08)} 70%{transform:translate(-25px,20px) scale(0.94)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-40px,45px) scale(0.92)} 75%{transform:translate(30px,-20px) scale(1.06)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.18)} }
        @keyframes breathe { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </main>
  )
}
