'use client'
import { useRouter } from 'next/navigation'
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

// ---- Today's physical ----
// Reads today's row from the Physical page's weekly planner (day_of_week
// matches JS getDay()) and renders it as a real checklist. Completion is
// stored under checklist_key 'physical_plan' so ticking here or on the
// Physical page itself shows the same state either way.
export type PhysicalPlanItem = { id: string; label: string; category: string | null }

export function TodaysPhysical() {
  const router = useRouter()
  const { celebrate } = useCelebration()
  const todayStr = toDateStr(new Date())
  const [items, setItems] = useState<PhysicalPlanItem[]>([])
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const dow = new Date().getDay()
    Promise.all([
      supabase.from('weekly_exercise_plan').select('id,label,category,sort_order').eq('day_of_week', dow).order('sort_order'),
      getDailyChecklistState('physical_plan', todayStr),
    ]).then(([{ data, error }, { state }]) => {
      if (error) {
        setErr(error.message.includes('does not exist')
          ? 'Setup needed: run supabase/migrations/030_weekly_exercise_plan.sql against your database.'
          : error.message)
      }
      setItems((data ?? []) as PhysicalPlanItem[])
      setDone(state)
      setReady(true)
    })
  }, [todayStr])

  function toggle(id: string) {
    setDone(prev => {
      const next = !prev[id]
      if (next) { sounds.playTaskComplete(); celebrate('task') }
      setDailyChecklistItem('physical_plan', id, todayStr, next)
      return { ...prev, [id]: next }
    })
  }

  if (!ready) return null
  const doneCount = items.filter(i => done[i.id]).length

  return (
    <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.006)' }}>
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.25rem 2rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
        <button onClick={() => router.push('/physical')} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit' }}>
          <Activity size={13} color={C.green} />
          <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted }}>Today&apos;s physical</span>
        </button>
        {items.length > 0 && !err && (
          <span style={{ marginLeft:'auto', fontSize:'0.68rem', fontWeight:700, color: doneCount===items.length ? C.green : C.muted }}>{doneCount} / {items.length}</span>
        )}
      </div>
      {err ? (
        <p style={{ fontSize:'0.75rem', color:C.amber, margin:0 }}>{err}</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize:'0.75rem', color:C.muted, margin:0 }}>Nothing planned for today &#8212; add exercises to today&#39;s column in the Weekly Plan on the Physical page.</p>
      ) : (
      <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
        {items.map(item => {
          const isDone = !!done[item.id]
          return (
            <div key={item.id} onClick={() => toggle(item.id)} style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.65rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.6rem', cursor:'pointer' }}>
              <span style={{ width:'16px', height:'16px', borderRadius:'50%', flexShrink:0, border:'2px solid '+(isDone ? C.green : C.muted), background: isDone ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {isDone && <span style={{ fontSize:'0.5rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
              </span>
              <span style={{ flex:1, minWidth:0, fontSize:'0.8rem', color: isDone ? C.muted : C.text, textDecoration: isDone ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
              {item.category && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.category}</span>}
            </div>
          )
        })}
      </div>
      )}
    </div>
    </div>
  )
}
