'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'
import { C } from '@/lib/theme'
import { DAY_ABBR, Task, HabitBlock, TL_START_MIN, TL_END_MIN, TL_ANCHOR_MIDDAY, TL_DEFAULT_DURATION, hhmmToMinutes, fmtHour12, parseTimeLabel, TLBlock, autoPlaceTasks, layoutTimelineBlocks } from '@/lib/calendarUtils'
import { TimelineBlock } from '@/components/calendar/TimelineBlock'

// One day's vertical timeline: hour gridlines in a left gutter, blocks laid
// out by time with lane-splitting for overlaps, plus an "Anytime" strip
// above the grid for reminders/habits with no parseable time.
export function TimelineDay({
  date, tasks, reminders, habits, isToday, isPast, pxPerMin,
  onCommitTask, onCommitReminder, onCommitHabit, onMoveItemDay, onOpenTask, onOpenReminder, onOpenHabit, onHoverTask, onHoverGeneric, onHoverEnd, onCreateAt,
}: {
  date: string
  tasks: Task[]
  reminders: Reminder[]
  habits: HabitBlock[]
  isToday: boolean
  isPast: boolean
  pxPerMin: number
  onCommitTask: (task: Task, startMin: number, durationMin: number) => void
  onCommitReminder: (r: Reminder, startMin: number, durationMin: number) => void
  onCommitHabit: (h: HabitBlock, startMin: number, durationMin: number) => void
  onMoveItemDay: (block: TLBlock, fromDate: string, newDate: string) => void
  onOpenTask: (task: Task) => void
  onOpenReminder: (r: Reminder) => void
  onOpenHabit: (h: HabitBlock) => void
  onHoverTask: (e: React.MouseEvent, task: Task) => void
  onHoverGeneric: (e: React.MouseEvent, color: string, title: string, lines: string[]) => void
  onHoverEnd: () => void
  onCreateAt: (date: string, startMin: number) => void
}) {
  // Live "now" line (like Notion Calendar): current minute-of-day, refreshed
  // every 30s, only ticking on today's column.
  const minuteNow = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60 }
  const [nowMin, setNowMin] = useState(minuteNow)
  useEffect(() => {
    if (!isToday) return
    setNowMin(minuteNow())
    const id = setInterval(() => setNowMin(minuteNow()), 30000)
    return () => clearInterval(id)
  }, [isToday])

  const autoPlaced = autoPlaceTasks(tasks)
  const taskBlocks: TLBlock[] = tasks.map(t => {
    const explicit = t.start_time ? hhmmToMinutes(t.start_time) : null
    const start = explicit ?? autoPlaced.get(t.id) ?? TL_ANCHOR_MIDDAY
    return { id:'t-'+t.id, kind:'task', title:t.title, color: t.task_type==='Flow'?C.cyan:t.task_type==='Personal'?C.purple:t.task_type==='Admin'?C.muted:C.amber, start, duration: t.duration_min ?? TL_DEFAULT_DURATION, timed: !!explicit, task:t }
  })
  const timedReminders = reminders.map(r => ({ r, min: parseTimeLabel(r.timeLabel) })).filter(x => x.min !== null) as { r: Reminder; min: number }[]
  const anytimeReminders = reminders.filter(r => parseTimeLabel(r.timeLabel) === null)
  const reminderBlocks: TLBlock[] = timedReminders.map(({ r, min }) => ({ id:'r-'+r.id, kind:'reminder', title:(r.emoji?r.emoji+' ':'')+r.title, color:r.color, start:min, duration:r.durationMin ?? 30, timed:true, reminder:r }))
  const timedHabits = habits.map(h => ({ h, min: parseTimeLabel(h.timeLabel) })).filter(x => x.min !== null) as { h: HabitBlock; min: number }[]
  const anytimeHabits = habits.filter(h => parseTimeLabel(h.timeLabel) === null)
  const habitBlocks: TLBlock[] = timedHabits.map(({ h, min }) => ({ id:'h-'+h.id, kind:'habit', title:(h.emoji?h.emoji+' ':'')+h.title, color:h.color, start:min, duration:h.durationMin ?? 30, timed:true, habit:h }))

  const laidOut = layoutTimelineBlocks([...taskBlocks, ...reminderBlocks, ...habitBlocks])
  // Auto-placed (unscheduled) tasks stack sequentially from their type's
  // anchor time and can run past TL_END_MIN on a busy day (e.g. several
  // Personal/Admin tasks all anchored at 19:00). Grow the grid to fit
  // whatever actually got placed instead of clipping it at a fixed 23:00 —
  // that fixed-height grid used to let overflowing blocks render past the
  // bordered box and visually spill into whatever was below it on the page.
  const latestBlockEnd = laidOut.reduce((max, b) => Math.max(max, b.start + b.duration), TL_START_MIN)
  const effectiveEndMin = Math.max(TL_END_MIN, latestBlockEnd)
  const hours = Array.from({ length: Math.ceil((effectiveEndMin - TL_START_MIN) / 60) + 1 }, (_, i) => TL_START_MIN + i * 60)
  const gridHeight = (effectiveEndMin - TL_START_MIN) * pxPerMin
  const anytimeItems = [...anytimeReminders.map(r => ({ kind:'reminder' as const, r })), ...anytimeHabits.map(h => ({ kind:'habit' as const, h }))]

  const dow = new Date(date+'T12:00:00').getDay()
  const dayName = DAY_ABBR[dow]
  const dayNum = parseInt(date.split('-')[2])

  return (
    <div data-tl-day={date} style={{ flex:'1 1 160px', minWidth:'160px', maxWidth:'260px', display:'flex', flexDirection:'column', border:'1px solid '+(isToday?'rgba(0,212,255,0.25)':C.border), borderRadius:'0.75rem', opacity:isPast?0.6:1, transition:'opacity 0.15s' }}>
      <div style={{ textAlign:'center', padding:'0.4rem 0', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
        <p style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 0.1rem', color:isToday?C.cyan:C.sec }}>{dayName}</p>
        <p style={{ fontSize:'1.1rem', fontWeight:900, margin:0, color:isToday?C.cyan:C.text }}>{dayNum}</p>
      </div>
      {anytimeItems.length > 0 && (
        <div style={{ padding:'0.3rem 0.4rem', borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.015)', display:'flex', flexDirection:'column', gap:'0.2rem' }}>
          {anytimeItems.map((it, i) => it.kind === 'reminder' ? (
            <div key={'ar'+i} onClick={() => onOpenReminder(it.r)}
              onMouseEnter={e => onHoverGeneric(e, it.r.color, (it.r.emoji?it.r.emoji+' ':'')+it.r.title, [describeRecurrence(it.r.recurrence) + ' · Anytime'])}
              onMouseLeave={onHoverEnd}
              style={{ display:'flex', alignItems:'center', gap:'0.25rem', padding:'0.12rem 0.3rem', borderRadius:'0.3rem', background:it.r.color+'18', border:'1px solid '+it.r.color+'40', cursor:'pointer' }}>
              <span style={{ fontSize:'0.58rem', fontWeight:600, color:it.r.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(it.r.emoji?it.r.emoji+' ':'')+it.r.title}</span>
            </div>
          ) : (
            <div key={'ah'+i} onClick={() => onOpenHabit(it.h)}
              onMouseEnter={e => onHoverGeneric(e, it.h.color, (it.h.emoji?it.h.emoji+' ':'')+it.h.title, ['Anytime'])}
              onMouseLeave={onHoverEnd}
              style={{ display:'flex', alignItems:'center', gap:'0.25rem', padding:'0.12rem 0.3rem', borderRadius:'0.3rem', background:it.h.color+'18', border:'1px solid '+it.h.color+'40', cursor:'pointer' }}>
              <span style={{ fontSize:'0.58rem', fontWeight:600, color:it.h.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(it.h.emoji?it.h.emoji+' ':'')+it.h.title}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ position:'relative', flexShrink:0, overflow:'hidden' }}>
        <div style={{ position:'relative', height:gridHeight, overflow:'hidden' }}>
          {hours.map(h => (
            <div key={h} style={{ position:'absolute', top:(h-TL_START_MIN)*pxPerMin, left:0, right:0, display:'flex', alignItems:'flex-start' }}>
              {/* Fixed-width gutter matching the grid's left:'26px' offset below,
                  so a wide hour label (e.g. "12:00pm") can never spill into the
                  task-block area and get visually cut by a block drawn on top. */}
              <span style={{ width:'26px', flexShrink:0, boxSizing:'border-box', fontSize:'0.53rem', color:C.muted, transform:'translateY(-6px)', paddingLeft:'2px', overflow:'hidden', whiteSpace:'nowrap' }}>{fmtHour12(h)}</span>
              <div style={{ flex:1, borderTop:'1px solid '+C.border+'88' }} />
            </div>
          ))}
          <div
            onDoubleClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const rawMin = TL_START_MIN + (e.clientY - rect.top) / pxPerMin
              onCreateAt(date, rawMin)
            }}
            title="Double-click to add a task at this time"
            style={{ position:'absolute', left:'26px', right:0, top:0, bottom:0, cursor:'copy' }}
          >
            {laidOut.map(b => (
              <TimelineBlock
                key={b.id}
                block={b}
                date={date}
                pxPerMin={pxPerMin}
                onCommit={
                  b.kind === 'task' && b.task ? (start, duration) => onCommitTask(b.task!, start, duration)
                  : b.kind === 'reminder' && b.reminder ? (start, duration) => onCommitReminder(b.reminder!, start, duration)
                  : b.kind === 'habit' && b.habit ? (start, duration) => onCommitHabit(b.habit!, start, duration)
                  : undefined
                }
                onMoveDay={newDate => onMoveItemDay(b, date, newDate)}
                onOpen={() => {
                  if (b.kind === 'task' && b.task) onOpenTask(b.task)
                  else if (b.kind === 'reminder' && b.reminder) onOpenReminder(b.reminder)
                  else if (b.kind === 'habit' && b.habit) onOpenHabit(b.habit)
                }}
                onHover={e => b.kind === 'task' && b.task ? onHoverTask(e, b.task) : onHoverGeneric(e, b.color, b.title, [fmtHour12(b.start) + ' · ' + b.duration + 'min'])}
                onHoverEnd={onHoverEnd}
              />
            ))}
          </div>
          {/* Today only: fade everything above the current time, then draw the live line */}
          {isToday && nowMin >= TL_START_MIN && nowMin <= effectiveEndMin && (() => {
            const lineTop = (nowMin - TL_START_MIN) * pxPerMin
            return (
              <>
                <div style={{ position:'absolute', left:0, right:0, top:0, height:lineTop, background:'rgba(10,10,15,0.55)', pointerEvents:'none', zIndex:20 }} />
                <div style={{ position:'absolute', left:'26px', right:0, top:lineTop, height:0, borderTop:'2px solid '+C.red, pointerEvents:'none', zIndex:25 }}>
                  <div style={{ position:'absolute', left:'-5px', top:'-6px', width:'10px', height:'10px', borderRadius:'50%', background:C.red }} />
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
