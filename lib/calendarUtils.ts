import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'
import { C } from '@/lib/theme'

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export type Task = {
  id: string; title: string; due_date: string | null; status: string
  urgency: string | null; importance: string | null; time_commitment: string | null
  task_type: string | null; is_frog: boolean; why_note: string | null
  notion_id: string | null; notion_url: string | null; priority: string | null
  start_time: string | null; duration_min: number | null
}

export type HoverTip = { x: number; y: number; color: string; title: string; lines: string[] }

export type OrgMove = { id: string; from: string; to: string; title: string }

export type OverdueMove = { id: string; title: string; task_type: string | null; fromDate: string; toDate: string; selected: boolean }

export type HabitBlock = { id: string; title: string; emoji: string; color: string; days: number[]; timeLabel: string; durationMin: number }

export const TYPE_LIMITS: Record<string, number> = { Flow: 2, Personal: 2, Admin: 2, 'Quick Task': 2 }

export function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0,0,0,0); return mon
}

// Picks a range start so `d` lands roughly in the middle column of a
// `days`-wide view instead of wherever a Monday-aligned week happens to put
// it (which could be the very first or very last column depending on the
// weekday). Used for "jump to today" so today's always easy to spot rather
// than buried at an edge.
export function centeredStart(d: Date, days: number): Date {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  return addDays(start, -Math.floor(Math.max(1, days) / 2))
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

export function toDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

export function addMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth()+n); return r }

// Reschedule quick-picks for the Edit Task modal. Offsets are relative to
// `from` — the task's own current due date, not always today — so
// rescheduling a task that's already a few weeks out moves further from
// where it sits rather than snapping back near the present. "Later this
// week"/"Next week" assume a Monday-start week; "Next month"/"2 months"
// are straight date offsets, not calendar-month starts.
export function rescheduleOptions(from: Date = new Date()): { label: string; date: string }[] {
  const dow = from.getDay() // 0=Sun..6=Sat
  const daysLeftInWeek = dow === 0 ? 0 : 7 - dow
  const laterThisWeekStep = Math.min(2, Math.max(1, daysLeftInWeek))
  const daysUntilNextMonday = ((8 - dow) % 7) || 7
  return [
    { label: 'Later this week', date: toDateStr(addDays(from, laterThisWeekStep)) },
    { label: 'Next week', date: toDateStr(addDays(from, daysUntilNextMonday)) },
    { label: 'Next month', date: toDateStr(addMonths(from, 1)) },
    { label: '2 months from now', date: toDateStr(addMonths(from, 2)) },
  ]
}

export function fmtWeekRange(start: Date, days: number = 7): string {
  const end = addDays(start, Math.max(1, days) - 1)
  const sm = MONTHS[start.getMonth()].slice(0,3)
  const em = MONTHS[end.getMonth()].slice(0,3)
  if (days <= 1) return sm + ' ' + start.getDate() + ', ' + start.getFullYear()
  if (start.getMonth() === end.getMonth()) return sm + ' ' + start.getDate() + ' - ' + end.getDate() + ', ' + start.getFullYear()
  return sm + ' ' + start.getDate() + ' - ' + em + ' ' + end.getDate() + ', ' + end.getFullYear()
}

// ── Timeline view — time-of-day grid ────────────────────────────────────────
// Shows 06:00-23:00 as a scrollable hourly grid instead of section cards.
// Tasks with an explicit start_time (set by dragging, or by Recommend for
// Tomorrow's auto-organise) render exactly there; anything else falls back
// to a default anchor by task_type (Flow -> morning, Personal/Admin ->
// evening, everything else -> midday) purely for display — dragging a task
// commits a real start_time so it stops floating.
export const TL_START_MIN = 6 * 60   // 06:00

export const TL_END_MIN = 23 * 60    // 23:00

export const TL_SNAP_MIN = 15

// Zoom presets (px/minute) — low end shows the whole 06:00-23:00 day in one
// screen ("all of today's tasks"), high end spreads a single hour out for
// precise placement ("some in the next hour"). Default sits in the middle.
export const TL_ZOOM_LEVELS = [0.35, 0.55, 0.85, 1.3, 2, 3]

export const TL_DEFAULT_ZOOM_IDX = 2

export const TL_ANCHOR_MORNING = 9 * 60   // Flow

export const TL_ANCHOR_MIDDAY = 13 * 60   // Quick Task / unclassified

export const TL_ANCHOR_EVENING = 19 * 60  // Personal / Admin

export const TL_DEFAULT_DURATION = 30

export function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.round(min))
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

export function hhmmToMinutes(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function fmtHour12(min: number): string {
  const h = Math.floor(min / 60) % 24
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return h12 + ap
}

// Lenient parser for the free-text reminder/habit timeLabel field
// ("9am", "9:30 PM", "18:00"...). Returns null for anything unparseable
// ("Anytime", ""), which is treated as "no fixed time" in the timeline.
export function parseTimeLabel(label: string): number | null {
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

export function anchorForTask(t: Task): number {
  if (t.task_type === 'Flow') return TL_ANCHOR_MORNING
  if (t.task_type === 'Personal' || t.task_type === 'Admin') return TL_ANCHOR_EVENING
  return TL_ANCHOR_MIDDAY
}

export type TLBlock = { id: string; kind: 'task' | 'reminder' | 'habit'; title: string; color: string; start: number; duration: number; timed: boolean; task?: Task; reminder?: Reminder; habit?: HabitBlock }

// Any task without an explicit start_time gets stacked sequentially from its
// type's default anchor, in is_frog-first order, purely for display.
export function autoPlaceTasks(tasks: Task[]): Map<string, number> {
  const placed = new Map<string, number>()
  const buckets = new Map<number, Task[]>()
  for (const t of tasks) {
    if (t.start_time) continue
    const anchor = anchorForTask(t)
    if (!buckets.has(anchor)) buckets.set(anchor, [])
    buckets.get(anchor)!.push(t)
  }
  for (const [anchor, list] of buckets) {
    list.sort((a, b) => (b.is_frog ? 1 : 0) - (a.is_frog ? 1 : 0))
    let cursor = anchor
    for (const t of list) {
      placed.set(t.id, cursor)
      cursor += (t.duration_min ?? TL_DEFAULT_DURATION) + 10
    }
  }
  return placed
}

// Greedy lane assignment so overlapping blocks sit side by side instead of
// stacking on top of each other.
export function layoutTimelineBlocks(blocks: TLBlock[]): (TLBlock & { lane: number; lanes: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start)
  const result: (TLBlock & { lane: number })[] = []
  let cluster: (TLBlock & { lane: number })[] = []
  let clusterEnd = -Infinity
  const laneEnds: number[] = []
  const flush = () => {
    if (cluster.length === 0) return
    const lanes = Math.max(...cluster.map(b => b.lane)) + 1
    for (const b of cluster) result.push({ ...b, lanes } as TLBlock & { lane: number; lanes: number })
    cluster = []
    laneEnds.length = 0
  }
  for (const b of sorted) {
    if (cluster.length > 0 && b.start >= clusterEnd) { flush(); clusterEnd = -Infinity }
    let lane = laneEnds.findIndex(end => end <= b.start)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.start + b.duration) }
    else laneEnds[lane] = b.start + b.duration
    cluster.push({ ...b, lane })
    clusterEnd = Math.max(clusterEnd, b.start + b.duration)
  }
  flush()
  return result as (TLBlock & { lane: number; lanes: number })[]
}

export function buildOrganisePlan(allTasks: Record<string, Task[]>, weekStart: Date): OrgMove[] {
  const moves: OrgMove[] = []
  const dates = Array.from({ length: 14 }, (_, i) => toDateStr(addDays(weekStart, i)))

  // Build per-type per-day buckets
  const byType: Record<string, Record<string, Task[]>> = {}
  for (const type of Object.keys(TYPE_LIMITS)) {
    byType[type] = {}
    for (const date of dates) {
      byType[type][date] = (allTasks[date] ?? []).filter(t => t.task_type === type && t.status !== 'Done')
    }
  }

  for (const type of Object.keys(TYPE_LIMITS)) {
    const limit = TYPE_LIMITS[type]
    const bucket = byType[type]
    for (let i = 0; i < dates.length; i++) {
      const tasks = bucket[dates[i]]
      if (tasks.length <= limit) continue
      const overflow = tasks.splice(limit)
      for (const task of overflow) {
        let moved = false
        for (let j = i + 1; j < dates.length; j++) {
          if (bucket[dates[j]].length < limit) {
            const dest = dates[j]
            if ((task.due_date ?? dates[i]) !== dest) moves.push({ id: task.id, from: task.due_date ?? dates[i], to: dest, title: task.title })
            bucket[dest].push({ ...task, due_date: dest }); moved = true; break
          }
        }
        if (!moved) {
          const fallback = dates[dates.length - 1]
          if ((task.due_date ?? dates[i]) !== fallback) moves.push({ id: task.id, from: task.due_date ?? dates[i], to: fallback, title: task.title })
          bucket[fallback].push({ ...task, due_date: fallback })
        }
      }
    }
  }
  return moves
}
