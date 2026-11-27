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
export function OrganiseModal({ orgPlan, setOrgPlan, handleApply, applying }: { orgPlan: OrgMove[] | null; setOrgPlan: Dispatch<SetStateAction<OrgMove[] | null>>; handleApply: () => Promise<void>; applying: boolean }) {
  if (!(orgPlan !== null)) return null
  return (
    
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
      
  )
}
