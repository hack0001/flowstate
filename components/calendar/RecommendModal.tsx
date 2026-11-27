'use client'
import type { Draft } from '@/lib/dailyPlan'
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
export function RecommendModal({ showRecModal, setShowRecModal, setRecCandidates, openRecommendModal, recDateChoice, recDate, recLoading, recCandidates, selectAllRec, toggleRecCandidate, recResult, confirmRecommend, recCommitting }: { showRecModal: boolean; setShowRecModal: Dispatch<SetStateAction<boolean>>; setRecCandidates: Dispatch<SetStateAction<(Draft & { key: string; } & { checked: boolean; })[] | null>>; openRecommendModal: (choice?: "today" | "tomorrow") => Promise<void>; recDateChoice: "today" | "tomorrow"; recDate: string; recLoading: boolean; recCandidates: (Draft & { key: string; } & { checked: boolean; })[] | null; selectAllRec: (val: boolean) => void; toggleRecCandidate: (key: string) => void; recResult: string | null; confirmRecommend: () => Promise<void>; recCommitting: boolean }) {
  if (!(showRecModal)) return null
  return (
    
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
      
  )
}
