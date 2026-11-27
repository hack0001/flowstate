'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Zap, Sun, X, RefreshCw, Bell, Settings2, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateDailyPlan, getDailyPlanSettings, saveDailyPlanSettings, getDailyPlanCandidates, commitDailyPlan, SECTION_LABEL, type DailyPlanSettings, type PlanCandidate } from '@/lib/dailyPlan'
import { type Reminder, type ReminderRecurrence, reminderOccursOn, describeRecurrence } from '@/lib/reminders'
import { C } from '@/lib/theme'
import { Task } from '@/lib/calendarUtils'

export function QuickAdd({ date, onSave, onClose }: { date: string; onSave: (title: string, type: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Flow')
  const submit = () => { if (title.trim()) onSave(title.trim(), type) }
  return (
    <div style={{ padding:'0.5rem', background:C.surface, border:'1px solid '+C.cyan, borderRadius:'0.625rem', marginTop:'0.5rem' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') submit(); if (e.key==='Escape') onClose() }}
        placeholder="Task title..."
        style={{ width:'100%', background:'transparent', border:'none', color:C.text, fontFamily:'inherit', fontSize:'0.75rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }} />
      <div style={{ display:'flex', gap:'0.2rem', marginBottom:'0.4rem', flexWrap:'wrap' }}>
        {['Flow','Personal','Admin','Quick Task'].map(t => (
          <button key={t} onClick={() => setType(t)} style={{ fontSize:'0.58rem', padding:'0.1rem 0.3rem', borderRadius:'0.2rem', border:'1px solid '+(type===t?C.cyan:C.border), background:type===t?'rgba(0,212,255,0.1)':'transparent', color:type===t?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit' }}>{t}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'0.25rem', justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{ fontSize:'0.65rem', padding:'0.2rem 0.4rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.25rem', color:C.muted, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        <button onClick={submit} style={{ fontSize:'0.65rem', padding:'0.2rem 0.5rem', background:C.cyan, border:'none', borderRadius:'0.25rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Add</button>
      </div>
    </div>
  )
}
