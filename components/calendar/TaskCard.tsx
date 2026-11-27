'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'
import { C } from '@/lib/theme'
import { Task } from '@/lib/calendarUtils'

export function TaskCard({
  task, onComplete, onDelete, onDragStart, onEdit, onReschedule, onHover, onHoverEnd,
}: {
  task: Task
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onDragStart: (e: React.DragEvent, task: Task) => void
  onEdit: (task: Task) => void
  onReschedule: (task: Task) => void
  onHover?: (e: React.MouseEvent, task: Task) => void
  onHoverEnd?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const typeColor = task.task_type === 'Flow' ? C.cyan : task.task_type === 'Personal' ? C.purple : task.task_type === 'Admin' ? C.muted : C.amber
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, task) }}
      onClick={() => onEdit(task)}
      onMouseEnter={e => onHover?.(e, task)}
      onMouseLeave={() => onHoverEnd?.()}
      style={{ display:'flex', alignItems:'flex-start', gap:'0.375rem', padding:'0.45rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', marginBottom:'0.3rem', opacity:(busy||rescheduling)?0.5:1, cursor:'pointer' }}>
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
      <button onClick={e => { e.stopPropagation(); setRescheduling(true); onReschedule(task) }} title="Reschedule to later" style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', padding:'1px', flexShrink:0 }}><RefreshCw size={10} /></button>
      <button onClick={e => { e.stopPropagation(); setBusy(true); onDelete(task.id) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'1px', flexShrink:0 }}><Trash2 size={10} /></button>
    </div>
  )
}
