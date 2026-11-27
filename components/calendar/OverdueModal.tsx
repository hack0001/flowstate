'use client'
import type { Dispatch, SetStateAction } from 'react'
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

/* props below are the parent page's state/handlers this modal reads */
export function OverdueModal({ overduePlan, setOverduePlan, selectAllOverdue, todayStr, toggleOverdueMove, handleApplyOverdue, applying }: { overduePlan: OverdueMove[] | null; setOverduePlan: Dispatch<SetStateAction<OverdueMove[] | null>>; selectAllOverdue: (val: boolean) => void; todayStr: string; toggleOverdueMove: (id: string) => void; handleApplyOverdue: () => Promise<void>; applying: boolean }) {
  if (!(overduePlan !== null)) return null
  return (
    
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
      
  )
}
