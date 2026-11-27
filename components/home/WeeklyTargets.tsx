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

// ---- Weekly Targets ----
// "3 Shorts, 1 Long-form, 4 Etsy listings, Website work" style counters.
// Shorts/Long-form auto-count from content_items reaching the Live stage
// this week (no manual bookkeeping); Etsy/Website have no pipeline table
// yet so they're a simple cross-device +/- tally against the week.
export type WeeklyTarget = { id: string; label: string; emoji: string; color: string; target_count: number; tracking: string; sort_order: number }

export function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

export function WeeklyTargets() {
  const now = new Date()
  const weekStart = toDateStr(mondayOf(now))
  const prevWeekStart = toDateStr(new Date(mondayOf(now).getTime() - 7 * 86400000))
  // Mon=1 .. Sun=7 — used to judge whether progress is on pace for the "health bar" framing.
  const daysElapsed = ((now.getDay() + 6) % 7) + 1
  const daysLeft = 7 - daysElapsed

  const [targets, setTargets] = useState<WeeklyTarget[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [prevCounts, setPrevCounts] = useState<Record<string, number>>({})
  const [picks, setPicks] = useState<Record<string, string>>({}) // target_id -> picked content title
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const { data: targetRows } = await supabase.from('weekly_targets')
      .select('id,label,emoji,color,target_count,tracking,sort_order').eq('active', true).order('sort_order')
    const rows = (targetRows ?? []) as WeeklyTarget[]
    setTargets(rows)

    const next: Record<string, number> = {}
    const prevNext: Record<string, number> = {}
    const nextPicks: Record<string, string> = {}
    await Promise.all(rows.map(async t => {
      if (t.tracking === 'auto_shorts' || t.tracking === 'auto_longform') {
        // NOTE: content_items.format stores "Long-form" (hyphen), not "Long form" —
        // must match exactly or the long-form count silently stays at 0.
        const formats = t.tracking === 'auto_shorts' ? ['Short', 'Both'] : ['Long-form', 'Both']
        const [{ count }, { count: prevCount }] = await Promise.all([
          supabase.from('content_items').select('id', { count: 'exact', head: true })
            .ilike('pipeline_stage', '%Live%').in('format', formats).gte('updated_at', weekStart),
          supabase.from('content_items').select('id', { count: 'exact', head: true })
            .ilike('pipeline_stage', '%Live%').in('format', formats).gte('updated_at', prevWeekStart).lt('updated_at', weekStart),
        ])
        next[t.id] = count ?? 0
        prevNext[t.id] = prevCount ?? 0

        // This week's pick — selected on the Content page, shown here as the
        // specific title being worked toward rather than just a bare count.
        const { data: pick } = await supabase.from('weekly_target_picks')
          .select('content_item_id').eq('target_id', t.id).eq('week_start', weekStart).maybeSingle()
        if (pick?.content_item_id) {
          const { data: ci } = await supabase.from('content_items').select('title').eq('id', pick.content_item_id).maybeSingle()
          if (ci?.title) nextPicks[t.id] = ci.title
        }
      } else {
        const [{ data }, { data: prevData }] = await Promise.all([
          supabase.from('weekly_target_progress').select('manual_count').eq('target_id', t.id).eq('week_start', weekStart).maybeSingle(),
          supabase.from('weekly_target_progress').select('manual_count').eq('target_id', t.id).eq('week_start', prevWeekStart).maybeSingle(),
        ])
        next[t.id] = data?.manual_count ?? 0
        prevNext[t.id] = prevData?.manual_count ?? 0
      }
    }))
    setCounts(next)
    setPrevCounts(prevNext)
    setPicks(nextPicks)
    setReady(true)
  }, [weekStart, prevWeekStart])

  useEffect(() => { load() }, [load])

  async function bump(t: WeeklyTarget, delta: number) {
    const current = counts[t.id] ?? 0
    const next = Math.max(0, current + delta)
    setCounts(prev => ({ ...prev, [t.id]: next }))
    await supabase.from('weekly_target_progress').upsert(
      { target_id: t.id, week_start: weekStart, manual_count: next, updated_at: new Date().toISOString() },
      { onConflict: 'target_id,week_start' }
    )
  }

  if (!ready || targets.length === 0) return null

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0.75rem' }}>
      {targets.map(t => {
        const current = counts[t.id] ?? 0
        const pct = Math.min(100, Math.round((current / Math.max(1, t.target_count)) * 100))
        const met = current >= t.target_count

        // "Health bar" framing — colour reflects whether you're on pace for
        // the week, not just raw progress, so a stalled target visibly turns
        // urgent as days run out rather than sitting there as a neutral bar.
        const expectedPct = Math.round((daysElapsed / 7) * 100)
        const paceStatus = met ? 'met' : pct >= expectedPct ? 'ahead' : (expectedPct - pct > 20 ? 'behind' : 'ontrack')
        const paceColor = paceStatus === 'met' || paceStatus === 'ahead' ? C.green : paceStatus === 'behind' ? C.red : t.color
        const paceLabel = paceStatus === 'met' ? 'Hit for the week' : daysLeft <= 0 ? 'Last day' : daysLeft + ' day' + (daysLeft===1?'':'s') + ' left'

        const prevCount = prevCounts[t.id] ?? 0
        const delta = current - prevCount
        const deltaLabel = delta === 0 ? 'same as last week' : delta > 0 ? '+' + delta + ' vs last week' : delta + ' vs last week'
        const deltaColor = delta > 0 ? C.green : delta < 0 ? C.muted : C.muted

        return (
          <div key={t.id} style={{ padding:'0.75rem 0.85rem', background:C.surface, border:'1px solid '+(met?t.color+'50':paceStatus==='behind'?C.red+'40':C.border), borderRadius:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.4rem' }}>
              <span style={{ fontSize:'0.78rem', color:C.text, fontWeight:600 }}>{t.emoji} {t.label}</span>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color: met?t.color:C.sec }}>{current}/{t.target_count}</span>
            </div>
            <div style={{ height:'4px', background:C.border, borderRadius:'2px', overflow:'hidden', marginBottom:'0.4rem' }}>
              <div style={{ height:'100%', width:pct+'%', background:paceColor, borderRadius:'2px', transition:'width 0.3s ease, background 0.3s ease' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: (t.tracking==='manual' || picks[t.id]) ? '0.5rem' : 0, gap:'0.4rem' }}>
              <span style={{ fontSize:'0.62rem', fontWeight:700, color:paceColor }}>{paceLabel}</span>
              <span style={{ fontSize:'0.62rem', color:deltaColor }}>{deltaLabel}</span>
            </div>
            {picks[t.id] && (
              <p style={{ fontSize:'0.68rem', color:C.sec, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={picks[t.id]}>
                &#127919; {picks[t.id]}
              </p>
            )}
            {t.tracking === 'manual' && (
              <div style={{ display:'flex', gap:'0.4rem' }}>
                <button type="button" onClick={() => bump(t, -1)} style={{ flex:1, padding:'0.25rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>-</button>
                <button type="button" onClick={() => bump(t, 1)} style={{ flex:1, padding:'0.25rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>+</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
