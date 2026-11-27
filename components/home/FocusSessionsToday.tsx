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

// ---- Focus sessions today (Content Pipeline chunked sessions) ----
// Counts today's content_focus_sessions rows (see 035_content_focus_sessions.sql
// / lib/sops.ts nextSessionChunk) so "how many focus sessions did I do today,
// how much progress" is visible at a glance -- nothing surfaced this before.
// Self-hides entirely if none have happened yet today.
export function FocusSessionsToday() {
  const [stats, setStats] = useState<{ count: number; tasks: number; mins: number } | null>(null)
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { data } = await supabase.from('content_focus_sessions')
        .select('tasks_completed,actual_mins,estimated_mins,status')
        .gte('started_at', start.toISOString())
      const rows = (data ?? []) as { tasks_completed: number; actual_mins: number | null; estimated_mins: number; status: string }[]
      const count = rows.filter(r => r.status !== 'in_progress').length
      const tasks = rows.reduce((s, r) => s + (r.tasks_completed || 0), 0)
      const mins = rows.reduce((s, r) => s + (r.actual_mins ?? r.estimated_mins ?? 0), 0)
      setStats({ count, tasks, mins })
    })()
  }, [])
  if (!stats || stats.count === 0) return null
  return (
    <div style={{ position:'relative', zIndex:1, borderBottom:'1px solid '+C.border, background:'rgba(255,255,255,0.012)' }}>
      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0.75rem 2rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <div title="Chunked focus sessions completed today on the Content Pipeline" style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.7rem', background:C.cyan+'14', border:'1px solid '+C.cyan+'40', borderRadius:'9999px' }}>
          <Zap size={12} color={C.cyan} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:C.cyan }}>{stats.count} focus session{stats.count === 1 ? '' : 's'} today</span>
          <span style={{ fontSize:'0.72rem', color:C.sec }}>&middot; {stats.tasks} task{stats.tasks === 1 ? '' : 's'} &middot; {stats.mins}m</span>
        </div>
      </div>
    </div>
  )
}
