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
export function HabitModal({ showHabitModal, setShowHabitModal, setEditingHabit, editingHabit, habitDraft, setHabitDraft, deleteHabit, saveHabit }: { showHabitModal: boolean; setShowHabitModal: Dispatch<SetStateAction<boolean>>; setEditingHabit: Dispatch<SetStateAction<HabitBlock | null>>; editingHabit: HabitBlock | null; habitDraft: { title: string; emoji: string; color: string; days: number[]; timeLabel: string; durationMin: number; }; setHabitDraft: Dispatch<SetStateAction<{ title: string; emoji: string; color: string; days: number[]; timeLabel: string; durationMin: number; }>>; deleteHabit: (id: string) => void; saveHabit: () => void }) {
  if (!(showHabitModal)) return null
  return (
    
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'26rem', position:'relative' }}>
            <button onClick={() => { setShowHabitModal(false); setEditingHabit(null) }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <h2 style={{ margin:'0 0 1.25rem', fontSize:'1rem', fontWeight:800, color:C.text }}>{editingHabit ? 'Edit Habit' : 'Add Habit'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Name</label>
                  <input value={habitDraft.title} onChange={e => setHabitDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Gym, Walk, Reading"
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ width:'64px' }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Icon</label>
                  <input value={habitDraft.emoji} onChange={e => setHabitDraft(d => ({ ...d, emoji: e.target.value }))} placeholder="&#128170;" maxLength={2}
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem', padding:'0.45rem 0.5rem', outline:'none', textAlign:'center', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Colour</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[C.cyan, C.green, C.amber, C.purple, C.red].map(col => (
                    <button key={col} onClick={() => setHabitDraft(d => ({ ...d, color: col }))} style={{ width:'26px', height:'26px', borderRadius:'50%', background:col, border: habitDraft.color===col ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', padding:0, outline:'none' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Days</label>
                <div style={{ display:'flex', gap:'0.3rem' }}>
                  {([['Mo',1],['Tu',2],['We',3],['Th',4],['Fr',5],['Sa',6],['Su',0]] as [string,number][]).map(([lbl,d]) => {
                    const sel = habitDraft.days.includes(d)
                    return (
                      <button key={d} onClick={() => setHabitDraft(p => ({ ...p, days: sel ? p.days.filter(x => x !== d) : [...p.days, d] }))}
                        style={{ width:'30px', height:'30px', borderRadius:'50%', border:'1px solid '+(sel?habitDraft.color:C.border), background:sel?habitDraft.color+'33':'transparent', color:sel?habitDraft.color:C.muted, fontSize:'0.62rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:0 }}>{lbl}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional — leave blank for "Anytime")</label>
                {(() => {
                  const startMin = parseTimeLabel(habitDraft.timeLabel)
                  const startDisplay = startMin !== null ? minutesToHHMM(startMin) : ''
                  return (
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>Start</span>
                        <input type="time" value={startDisplay} onChange={e => setHabitDraft(d => ({ ...d, timeLabel: e.target.value }))}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
                      </div>
                      <span style={{ color:C.muted, fontSize:'0.8rem' }}>&rarr;</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>End</span>
                        <input type="time" disabled={startMin === null}
                          value={startMin !== null ? minutesToHHMM(startMin + habitDraft.durationMin) : ''}
                          onChange={e => {
                            const endMin = hhmmToMinutes(e.target.value)
                            if (startMin === null || endMin === null) return
                            let duration = endMin - startMin
                            if (duration <= 0) duration += 24 * 60
                            setHabitDraft(d => ({ ...d, durationMin: Math.max(TL_SNAP_MIN, duration) }))
                          }}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', cursor:startMin!==null?'text':'not-allowed' }} />
                      </div>
                      <select value={habitDraft.durationMin} onChange={e => setHabitDraft(d => ({ ...d, durationMin: Number(e.target.value) }))} disabled={startMin === null} title="Quick duration"
                        style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', cursor:startMin!==null?'pointer':'not-allowed' }}>
                        {[15,30,45,60,90,120,180].map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                      </select>
                      {habitDraft.timeLabel && (
                        <button onClick={() => setHabitDraft(d => ({ ...d, timeLabel: '' }))} title="Clear — goes back to Anytime"
                          style={{ fontSize:'0.68rem', padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <div>
                {editingHabit && (
                  <button onClick={() => deleteHabit(editingHabit.id)} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>
                )}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => { setShowHabitModal(false); setEditingHabit(null) }} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={saveHabit} disabled={!habitDraft.title.trim() || habitDraft.days.length === 0}
                  style={{ padding:'0.5rem 1.25rem', background:habitDraft.color, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:(!habitDraft.title.trim()||habitDraft.days.length===0)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:(!habitDraft.title.trim()||habitDraft.days.length===0)?0.5:1 }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      
  )
}
