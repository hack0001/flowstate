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
export function ReminderModal({ showReminderModal, setShowReminderModal, setEditingReminder, reminderDraft, editingReminder, setReminderDraft, saveReminder, deleteReminder }: { showReminderModal: boolean; setShowReminderModal: Dispatch<SetStateAction<boolean>>; setEditingReminder: Dispatch<SetStateAction<Reminder | null>>; reminderDraft: { title: string; emoji: string; color: string; startDate: string; recurrence: ReminderRecurrence; timeLabel: string; durationMin: number; }; editingReminder: Reminder | null; setReminderDraft: Dispatch<SetStateAction<{ title: string; emoji: string; color: string; startDate: string; recurrence: ReminderRecurrence; timeLabel: string; durationMin: number; }>>; saveReminder: () => void; deleteReminder: (id: string) => void }) {
  if (!(showReminderModal)) return null
  return (
    
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.87)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:80 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'28rem', maxHeight:'90vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => { setShowReminderModal(false); setEditingReminder(null) }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16} /></button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
              <Bell size={16} color={reminderDraft.color} />
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:C.text }}>{editingReminder ? 'Edit Reminder' : 'New Reminder'}</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {/* Title + Emoji */}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Title</label>
                  <input autoFocus value={reminderDraft.title} onChange={e => setReminderDraft(d => ({ ...d, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveReminder()}
                    placeholder="e.g. Pay bills, Review goals"
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.5rem 0.75rem', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ width:'64px' }}>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Icon</label>
                  <input value={reminderDraft.emoji} onChange={e => setReminderDraft(d => ({ ...d, emoji: e.target.value }))} placeholder="&#128276;" maxLength={2}
                    style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem', padding:'0.45rem 0.5rem', outline:'none', textAlign:'center', boxSizing:'border-box' }} />
                </div>
              </div>
              {/* Colour */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Colour</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[C.cyan, C.green, C.amber, C.purple, C.red, '#14b8a6', '#f97316'].map(col => (
                    <button key={col} onClick={() => setReminderDraft(d => ({ ...d, color: col }))} style={{ width:'26px', height:'26px', borderRadius:'50%', background:col, border: reminderDraft.color===col ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', padding:0, outline:'none' }} />
                  ))}
                </div>
              </div>
              {/* Recurrence */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }}>Repeat</label>
                <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                  {(['daily','weekday','weekly','monthly','yearly','custom'] as ReminderRecurrence['type'][]).map(t => {
                    const active = reminderDraft.recurrence.type === t
                    const defaultRec: ReminderRecurrence = t === 'daily' ? { type:'daily' } : t === 'weekday' ? { type:'weekday' } : t === 'weekly' ? { type:'weekly', every:1 } : t === 'monthly' ? { type:'monthly', every:1 } : t === 'yearly' ? { type:'yearly', every:1 } : { type:'custom', every:1, unit:'days' }
                    return (
                      <button key={t} onClick={() => setReminderDraft(d => ({ ...d, recurrence: active ? d.recurrence : defaultRec }))}
                        style={{ fontSize:'0.72rem', padding:'0.3rem 0.6rem', borderRadius:'0.375rem', border:'1px solid '+(active?reminderDraft.color:C.border), background:active?reminderDraft.color+'22':'transparent', color:active?reminderDraft.color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:active?700:400, textTransform:'capitalize' }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
                {/* Sub-options for recurrence types with "every N" */}
                {(reminderDraft.recurrence.type === 'weekly' || reminderDraft.recurrence.type === 'monthly' || reminderDraft.recurrence.type === 'yearly') && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem' }}>
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>Every</span>
                    <input type="number" min={1} max={99}
                      value={(reminderDraft.recurrence as { type:string; every:number }).every}
                      onChange={e => {
                        const every = Math.max(1, parseInt(e.target.value) || 1)
                        setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, every } as ReminderRecurrence }))
                      }}
                      style={{ width:'56px', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.3rem 0.5rem', outline:'none', textAlign:'center' }} />
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>
                      {reminderDraft.recurrence.type === 'weekly' ? 'week(s)' : reminderDraft.recurrence.type === 'monthly' ? 'month(s)' : 'year(s)'}
                    </span>
                  </div>
                )}
                {reminderDraft.recurrence.type === 'custom' && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.75rem', color:C.sec }}>Every</span>
                    <input type="number" min={1} max={999}
                      value={(reminderDraft.recurrence as { type:string; every:number; unit:string }).every}
                      onChange={e => {
                        const every = Math.max(1, parseInt(e.target.value) || 1)
                        setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, every } as ReminderRecurrence }))
                      }}
                      style={{ width:'64px', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.375rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', padding:'0.3rem 0.5rem', outline:'none', textAlign:'center' }} />
                    <div style={{ display:'flex', gap:'0.25rem' }}>
                      {(['days','weeks','months','years'] as const).map(u => {
                        const active = (reminderDraft.recurrence as { type:string; every:number; unit:string }).unit === u
                        return (
                          <button key={u} onClick={() => setReminderDraft(d => ({ ...d, recurrence: { ...d.recurrence, unit: u } as ReminderRecurrence }))}
                            style={{ fontSize:'0.68rem', padding:'0.25rem 0.45rem', borderRadius:'0.3rem', border:'1px solid '+(active?reminderDraft.color:C.border), background:active?reminderDraft.color+'22':'transparent', color:active?reminderDraft.color:C.sec, cursor:'pointer', fontFamily:'inherit' }}>
                            {u}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Start date */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Start date</label>
                <input type="date" value={reminderDraft.startDate} onChange={e => setReminderDraft(d => ({ ...d, startDate: e.target.value }))}
                  style={{ width:'100%', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', boxSizing:'border-box' }} />
              </div>
              {/* Time */}
              <div>
                <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }}>Time (optional — leave blank for "Anytime")</label>
                {(() => {
                  const startMin = parseTimeLabel(reminderDraft.timeLabel)
                  const startDisplay = startMin !== null ? minutesToHHMM(startMin) : ''
                  return (
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>Start</span>
                        <input type="time" value={startDisplay} onChange={e => setReminderDraft(d => ({ ...d, timeLabel: e.target.value }))}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark' }} />
                      </div>
                      <span style={{ color:C.muted, fontSize:'0.8rem' }}>&rarr;</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, fontWeight:600 }}>End</span>
                        <input type="time" disabled={startMin === null}
                          value={startMin !== null ? minutesToHHMM(startMin + reminderDraft.durationMin) : ''}
                          onChange={e => {
                            const endMin = hhmmToMinutes(e.target.value)
                            if (startMin === null || endMin === null) return
                            let duration = endMin - startMin
                            if (duration <= 0) duration += 24 * 60
                            setReminderDraft(d => ({ ...d, durationMin: Math.max(TL_SNAP_MIN, duration) }))
                          }}
                          style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', colorScheme:'dark', cursor:startMin!==null?'text':'not-allowed' }} />
                      </div>
                      <select value={reminderDraft.durationMin} onChange={e => setReminderDraft(d => ({ ...d, durationMin: Number(e.target.value) }))} disabled={startMin === null} title="Quick duration"
                        style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:startMin!==null?C.text:C.muted, fontFamily:'inherit', fontSize:'0.825rem', padding:'0.5rem 0.75rem', outline:'none', cursor:startMin!==null?'pointer':'not-allowed' }}>
                        {[15,30,45,60,90,120,180].map(m => <option key={m} value={m}>{m < 60 ? m+' min' : (m/60)+'h'+(m%60?' '+(m%60)+'m':'')}</option>)}
                      </select>
                      {reminderDraft.timeLabel && (
                        <button onClick={() => setReminderDraft(d => ({ ...d, timeLabel: '' }))} title="Clear — goes back to Anytime"
                          style={{ fontSize:'0.68rem', padding:'0.3rem 0.55rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
              {/* Preview */}
              {reminderDraft.title.trim() && (
                <div style={{ padding:'0.6rem 0.75rem', background:reminderDraft.color+'12', border:'1px solid '+reminderDraft.color+'35', borderRadius:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <Bell size={12} color={reminderDraft.color} />
                  {reminderDraft.emoji && <span style={{ fontSize:'0.9rem' }}>{reminderDraft.emoji}</span>}
                  <div>
                    <p style={{ margin:0, fontSize:'0.8rem', fontWeight:700, color:reminderDraft.color }}>{reminderDraft.title}</p>
                    <p style={{ margin:0, fontSize:'0.68rem', color:C.muted }}>{describeRecurrence(reminderDraft.recurrence)}{reminderDraft.timeLabel ? ' · ' + reminderDraft.timeLabel : ''}</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'space-between', marginTop:'1.5rem' }}>
              <div>
                {editingReminder && (
                  <button onClick={() => deleteReminder(editingReminder.id)} style={{ padding:'0.5rem 0.875rem', background:'transparent', border:'1px solid rgba(255,68,68,0.3)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Delete</button>
                )}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => { setShowReminderModal(false); setEditingReminder(null) }} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
                <button onClick={saveReminder} disabled={!reminderDraft.title.trim()}
                  style={{ padding:'0.5rem 1.25rem', background:reminderDraft.color, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:!reminderDraft.title.trim()?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', opacity:!reminderDraft.title.trim()?0.5:1 }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      
  )
}
