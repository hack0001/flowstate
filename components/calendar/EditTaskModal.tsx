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
export function EditTaskModal({ editingTask, closeEditModal, isCreatingTask, editTitle, setEditTitle, handleSaveEdit, setEditType, editType, editDueDate, setEditDueDate, editStartTime, setEditStartTime, editDurationMin, setEditDurationMin, editStatus, setEditStatus, setEditUrgency, editUrgency, setEditIsFrog, editIsFrog, handleDeleteFromEdit, savingEdit }: { editingTask: Task | null; closeEditModal: () => void; isCreatingTask: boolean; editTitle: string; setEditTitle: Dispatch<SetStateAction<string>>; handleSaveEdit: () => Promise<void>; setEditType: Dispatch<SetStateAction<string>>; editType: string; editDueDate: string; setEditDueDate: Dispatch<SetStateAction<string>>; editStartTime: string; setEditStartTime: Dispatch<SetStateAction<string>>; editDurationMin: number; setEditDurationMin: Dispatch<SetStateAction<number>>; editStatus: string; setEditStatus: Dispatch<SetStateAction<string>>; setEditUrgency: Dispatch<SetStateAction<string>>; editUrgency: string; setEditIsFrog: Dispatch<SetStateAction<boolean>>; editIsFrog: boolean; handleDeleteFromEdit: () => Promise<void>; savingEdit: boolean }) {
  if (!(editingTask)) return null
  return (
    
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
      
  )
}
