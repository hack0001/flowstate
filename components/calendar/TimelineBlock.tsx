'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'
import { C } from '@/lib/theme'
import { TL_START_MIN, TL_END_MIN, TL_SNAP_MIN, fmtHour12, TLBlock } from '@/lib/calendarUtils'
import { TimelineDay } from '@/components/calendar/TimelineDay'

// One positioned block on the Timeline grid. Only task blocks are
// draggable (reminders/habits have no per-day time field to persist to) —
// drag the body to move, drag the bottom handle to resize. Both snap to
// TL_SNAP_MIN and commit via onCommit on mouse-up; while dragging the block
// shows a live preview computed from the in-progress delta.
export function TimelineBlock({
  block, date, pxPerMin, onCommit, onMoveDay, onOpen, onHover, onHoverEnd,
}: {
  block: TLBlock & { lane: number; lanes: number }
  date: string
  pxPerMin: number
  onCommit?: (startMin: number, durationMin: number) => void
  onMoveDay?: (newDate: string) => void
  onOpen?: () => void
  onHover?: (e: React.MouseEvent) => void
  onHoverEnd?: () => void
}) {
  // 'move' drags the whole block (shifts start+end together, and — if
  // released over a different day column — moves it to that day instead).
  // 'resize' drags the bottom handle (adjusts the finish time, start stays
  // put). 'resize-top' drags the top handle (adjusts the start time, finish
  // stays put) — the three together cover "move it", "change when it ends"
  // and "change when it starts" with just the cursor.
  const [drag, setDrag] = useState<{ mode: 'move' | 'resize' | 'resize-top'; startY: number; deltaMin: number; clientX: number; clientY: number } | null>(null)
  // Tasks, reminders, and habit blocks are all draggable now — whichever
  // kind's onCommit the parent wired up (see TimelineDay's render loop).
  const draggable = !!onCommit

  useEffect(() => {
    if (!drag) return
    const startY = drag.startY
    function onMove(e: MouseEvent) {
      const rawDelta = (e.clientY - startY) / pxPerMin
      const snapped = Math.round(rawDelta / TL_SNAP_MIN) * TL_SNAP_MIN
      setDrag(d => (d ? { ...d, deltaMin: snapped, clientX: e.clientX, clientY: e.clientY } : d))
    }
    function onUp() {
      setDrag(d => {
        if (!d || !onCommit) return null

        // Whole-block drag released over a different day's column? Move it
        // there instead of adjusting its time-of-day — same time slot, new
        // date, mirroring how the List view and Home board move items
        // across days by dropping them on a different day.
        if (d.mode === 'move' && onMoveDay) {
          const under = document.elementFromPoint(d.clientX, d.clientY)?.closest('[data-tl-day]') as HTMLElement | null
          const targetDate = under?.dataset.tlDay
          if (targetDate && targetDate !== date) {
            onMoveDay(targetDate)
            return null
          }
        }

        let newStart = block.start
        let newDuration = block.duration
        if (d.mode === 'move') {
          newStart = Math.min(TL_END_MIN - 10, Math.max(TL_START_MIN, block.start + d.deltaMin))
        } else if (d.mode === 'resize') {
          newDuration = Math.max(TL_SNAP_MIN, block.duration + d.deltaMin)
        } else {
          // resize-top: end time (start+duration) stays fixed, start moves
          const end = block.start + block.duration
          newStart = Math.min(end - TL_SNAP_MIN, Math.max(TL_START_MIN, block.start + d.deltaMin))
          newDuration = end - newStart
        }
        if (newStart === block.start && newDuration === block.duration) return null // no-op drag (e.g. a plain click)

        // Reminders/habits are recurring — one row covers every occurrence,
        // so changing its time here changes it everywhere. Confirm before
        // committing a reminder (habits stay silent, same as tasks, since
        // Tom only asked for the extra check on reminders).
        if (block.kind === 'reminder') {
          const ok = window.confirm(`Move "${block.title}" to ${fmtHour12(newStart)}–${fmtHour12(newStart + newDuration)}? This changes every occurrence of this reminder.`)
          if (!ok) return null
        }
        onCommit(newStart, newDuration)
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, onCommit, onMoveDay, block.start, block.duration, block.kind, block.title, date, pxPerMin])

  const blockEnd = block.start + block.duration
  const liveStart = drag?.mode === 'move'
    ? Math.min(TL_END_MIN - 10, Math.max(TL_START_MIN, block.start + drag.deltaMin))
    : drag?.mode === 'resize-top'
      ? Math.min(blockEnd - TL_SNAP_MIN, Math.max(TL_START_MIN, block.start + drag.deltaMin))
      : block.start
  const liveDuration = drag?.mode === 'resize'
    ? Math.max(TL_SNAP_MIN, block.duration + drag.deltaMin)
    : drag?.mode === 'resize-top'
      ? blockEnd - liveStart
      : block.duration
  const top = (liveStart - TL_START_MIN) * pxPerMin
  const height = Math.max(16, liveDuration * pxPerMin)
  const widthPct = 100 / block.lanes
  const leftPct = block.lane * widthPct

  return (
    <div
      onMouseDown={e => { if (draggable) { e.stopPropagation(); setDrag({ mode:'move', startY:e.clientY, deltaMin:0, clientX:e.clientX, clientY:e.clientY }) } }}
      onClick={e => { e.stopPropagation(); if (!drag) onOpen?.() }}
      onDoubleClick={e => e.stopPropagation()}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      title={block.timed ? undefined : 'No fixed time yet — showing a suggested slot. Drag to lock it in.'}
      style={{
        position:'absolute', top, height, left:`calc(${leftPct}% + 1px)`, width:`calc(${widthPct}% - 3px)`,
        background: block.color + (block.timed ? '22' : '10'),
        border:'1px solid ' + block.color + (block.timed ? '70' : '35'),
        borderLeft:'3px solid ' + block.color,
        borderStyle: block.timed ? 'solid' : 'dashed',
        borderRadius:'0.3rem', padding:'0.1rem 0.3rem', overflow:'hidden',
        cursor: draggable ? (drag ? 'grabbing' : 'grab') : 'pointer',
        zIndex: drag ? 30 : 5, boxShadow: drag ? '0 4px 14px rgba(0,0,0,0.45)' : 'none', userSelect:'none',
        boxSizing:'border-box',
      }}
    >
      <p style={{ margin:0, fontSize:'0.6rem', fontWeight:700, color:block.color, lineHeight:1.25, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{block.title}</p>
      {height > 28 && <p style={{ margin:0, fontSize:'0.53rem', color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fmtHour12(liveStart)} – {fmtHour12(liveStart + liveDuration)}</p>}
      {draggable && (
        <>
          <div
            onMouseDown={e => { e.stopPropagation(); setDrag({ mode:'resize-top', startY:e.clientY, deltaMin:0, clientX:e.clientX, clientY:e.clientY }) }}
            title="Drag to change the start time"
            style={{ position:'absolute', left:0, right:0, top:0, height:'9px', cursor:'ns-resize', display:'flex', alignItems:'flex-start', justifyContent:'center' }}
          >
            <div style={{ width:'22px', height:'3px', borderRadius:'9999px', marginTop:'2px', background:block.color, opacity:0.55 }} />
          </div>
          <div
            onMouseDown={e => { e.stopPropagation(); setDrag({ mode:'resize', startY:e.clientY, deltaMin:0, clientX:e.clientX, clientY:e.clientY }) }}
            title="Drag to change the finish time"
            style={{ position:'absolute', left:0, right:0, bottom:0, height:'9px', cursor:'ns-resize', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          >
            <div style={{ width:'22px', height:'3px', borderRadius:'9999px', marginBottom:'2px', background:block.color, opacity:0.55 }} />
          </div>
        </>
      )}
    </div>
  )
}
