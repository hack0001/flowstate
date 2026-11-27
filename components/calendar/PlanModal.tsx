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
export function PlanModal({ showPlanModal, setShowPlanModal, planDate, setPlanDate, planSettings, setPlanSettings, savePlanSettings, planResult, runGeneratePlan, planGenerating }: { showPlanModal: boolean; setShowPlanModal: Dispatch<SetStateAction<boolean>>; planDate: string; setPlanDate: Dispatch<SetStateAction<string>>; planSettings: DailyPlanSettings | null; setPlanSettings: Dispatch<SetStateAction<DailyPlanSettings | null>>; savePlanSettings: () => Promise<void>; planResult: string | null; runGeneratePlan: () => Promise<void>; planGenerating: boolean }) {
  if (!(showPlanModal)) return null
  return (
    
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
      
  )
}
