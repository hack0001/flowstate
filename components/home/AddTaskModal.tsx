'use client'
import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { Zap, Star, ChevronRight, CalendarDays, Sunrise, BarChart2, Moon, FolderOpen, Film, BookOpen, CheckSquare, User, Target, Tv, Link2, ShoppingBag, X, Activity, Camera, Layers, Lightbulb, Plus, Flame, GripVertical, ShoppingCart, Bell, Sparkles, Palette, Library, Disc3, FileEdit, TrendingUp, LineChart } from 'lucide-react'
import { getActiveFocusVideos } from '@/lib/supabase'
import { supabase, getPageVisits, recordPageVisit, getEveningReview, getDailyChecklistState, setDailyChecklistItem } from '@/lib/supabase'
import { SECTION_LABEL, type DailyPlanSection } from '@/lib/dailyPlan'
import { sopForStage } from '@/lib/sops'
import { ETSY_TODOS } from '@/lib/etsy-data'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'
import { useLanguage } from '@/context/LanguageContext'
import { type Reminder, reminderOccursOn, fetchRemindersRow } from '@/lib/reminders'
import { calcHabitStreak, calcConsistencyPct, type StreakHabit } from '@/lib/habitStreak'
import { C, DESK as D, MONO } from '@/lib/theme'
import { Tile, Panel, ListRow, Grid } from '@/components/ui'
import { toDateStr } from '@/components/home/homeShared'

// ---- Add Task modal ----
// Replaces the old inline "+ Add task" boxes inside Today/Tomorrow — opened
// from a single button in the top-right bar instead, so the list itself
// doesn't lose vertical space to an input row most of the time.
export function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(toDateStr(new Date()))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const t = title.trim()
    if (!t || saving) return
    setSaving(true)
    const { error } = await supabase.from('master_tasks')
      .insert({ title: t, status: 'Not started', due_date: dueDate || null, task_type: 'Quick Task', archived: false, is_frog: false })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onAdded()
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'1.25rem', padding:'1.75rem', width:'100%', maxWidth:'24rem', animation:'fadeInUp 0.25s ease both' }}>
        <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan, margin:'0 0 1rem' }}>Add task</p>
        {err && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem' }}>{err}</p>}
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder="Task title..." style={{ width:'100%', padding:'0.65rem 0.8rem', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', marginBottom:'0.75rem', boxSizing:'border-box' }} />
        <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.4rem' }}>Due date</p>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
          {[
            { label:'Today', date: toDateStr(new Date()) },
            { label:'Tomorrow', date: toDateStr(new Date(Date.now() + 86400000)) },
            { label:'No date', date:'' },
          ].map(o => (
            <button key={o.label} type="button" onClick={() => setDueDate(o.date)} style={{
              padding:'0.3rem 0.65rem', borderRadius:'9999px', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, cursor:'pointer',
              background: dueDate === o.date ? C.cyan : 'none',
              color: dueDate === o.date ? '#000' : C.sec,
              border:'1px solid '+(dueDate === o.date ? C.cyan : '#2a2a3a'),
            }}>{o.label}</button>
          ))}
        </div>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', marginBottom:'1.25rem', boxSizing:'border-box', colorScheme:'dark' }} />
        <div style={{ display:'flex', gap:'0.6rem' }}>
          <button onClick={onClose} style={{ flex:1, padding:'0.65rem', background:'none', border:'1px solid #2a2a3a', borderRadius:'0.6rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600 }}>Cancel</button>
          <button onClick={submit} disabled={saving || !title.trim()} style={{ flex:1, padding:'0.65rem', background: title.trim() ? C.cyan : '#2a2a3a', border:'none', borderRadius:'0.6rem', color: title.trim() ? '#000' : C.muted, cursor: title.trim() ? 'pointer' : 'default', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:800 }}>{saving ? 'Adding...' : 'Add task'}</button>
        </div>
      </div>
    </div>
  )
}
