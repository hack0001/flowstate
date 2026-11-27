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

// Pre-flight check items -- must all be ticked before focus starts
export const FOCUS_ITEMS = [
  { id:'desk',   emoji:'&#128187;', label:'Desk cleared',          note:'Remove everything except what you need right now' },
  { id:'phone',  emoji:'&#128245;', label:'Phone in another room', note:'Not on silent &mdash; physically gone' },
  { id:'timer',  emoji:'&#9201;',  label:'Timer set',              note:'Know exactly how long this session runs' },
  { id:'notif',  emoji:'&#128276;', label:'Notifications off',     note:'Do Not Disturb enabled &mdash; no pings' },
  { id:'water',  emoji:'&#128167;', label:'Drink within reach',    note:'No reason to leave your desk mid-session' },
  { id:'notepad',emoji:'&#128221;', label:'Notepad close by',      note:'Capture stray thoughts on paper so they don&apos;t hijack your focus' },
  { id:'distract',emoji:'&#128683;',label:'No distractions',       note:'Close every tab you don&apos;t need &mdash; no social media, email or news open' },
  { id:'task',   emoji:'&#127919;', label:'Task crystal clear',    note:'You know exactly what you are building' },
]

// ---- Focus environment pre-flight check ----
export function FocusCheck({ onProceed, onClose }: { onProceed: () => void; onClose: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const allDone = checked.size === FOCUS_ITEMS.length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'1.5rem', padding:'2rem', width:'100%', maxWidth:'26rem', position:'relative', animation:'fadeInUp 0.3s ease both' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>&#127919;</div>
          <h2 style={{ fontSize:'1.25rem', fontWeight:900, color:C.text, margin:'0 0 0.35rem', letterSpacing:'-0.02em' }}>Pre-Flight Check</h2>
          <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Get the environment right before you lock in</p>
        </div>

        {/* Progress bar */}
        <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.5rem', overflow:'hidden' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,'+C.green+',#00cc6a)', width:(checked.size/FOCUS_ITEMS.length*100)+'%', transition:'width 0.3s ease', borderRadius:'2px' }} />
        </div>

        {/* Checklist */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.75rem' }}>
          {FOCUS_ITEMS.map(item => {
            const done = checked.has(item.id)
            return (
              <button key={item.id} onClick={() => toggle(item.id)} style={{
                display:'flex', alignItems:'center', gap:'0.875rem',
                padding:'0.75rem 1rem',
                background: done ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid '+(done ? 'rgba(0,255,136,0.25)' : '#2a2a3a'),
                borderRadius:'0.875rem', cursor:'pointer', fontFamily:'inherit',
                textAlign:'left', transition:'all 0.15s ease',
              }}>
                {/* Checkbox */}
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
                  border: '2px solid '+(done ? C.green : '#4a4a6a'),
                  background: done ? C.green : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s ease',
                }}>
                  {done && <span style={{ fontSize:'0.65rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
                </div>
                {/* Label */}
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'0.85rem', fontWeight:700, color:done?C.green:C.text, margin:0, transition:'color 0.15s' }}
                    dangerouslySetInnerHTML={{ __html: item.label }} />
                  <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.4, marginTop:'0.1rem' }}
                    dangerouslySetInnerHTML={{ __html: item.note }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <button onClick={allDone ? onProceed : undefined} style={{
          width:'100%', padding:'0.95rem',
          background: allDone ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : '#1a1a26',
          border: '1px solid '+(allDone ? 'transparent' : '#2a2a3a'),
          borderRadius:'1rem', cursor: allDone ? 'pointer' : 'default',
          fontFamily:'inherit', fontWeight:900, fontSize:'0.95rem',
          color: allDone ? '#000' : C.muted,
          transition:'all 0.25s ease',
          boxShadow: allDone ? '0 4px 24px rgba(0,255,136,0.3)' : 'none',
        }}>
          {allDone ? 'Begin deep work →' : checked.size + ' / ' + FOCUS_ITEMS.length + ' checked'}
        </button>

        <div style={{ textAlign:'center', marginTop:'0.875rem' }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', textDecoration:'underline' }}>
            Skip check &mdash; I&apos;m already set up
          </button>
        </div>
      </div>
    </div>
  )
}
