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

// Website / app ideas parked for later -- not active projects, just a backlog
// to revisit when there's capacity. Stored in Supabase (site_ideas table).
// Full add/edit/delete UI now lives on its own page (app/ideas/page.tsx) --
// the home page only needs enough to show a preview tile that links there.
export type SiteIdea = {
  id: string
  title: string
  tag: string
  summary: string
  next_step: string
  sort_order: number
  created_at: string
}

export function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

// ---- Top 5 per workflow ----
// Ranks a set of active items by that workflow's own priority_lists order
// (same list each page's Priority View drag-reorders), items not yet ranked
// fall in after the ranked ones, then takes the top N. Direct read of the
// same source of truth each workflow page uses -- no time-budget filtering.
export type RankableItem = {
  id: string
  title: string
  // Optional extras, only populated for the YouTube pipeline list -- lets
  // its Top 5 card render the same rich row (stage/format/pin) as the old
  // "Active YouTube Focus" block instead of a plain numbered line.
  pipeline_stage?: string | null
  format?: string | null
  is_active_focus?: boolean
}

export function rankTop<T extends RankableItem>(order: string[], items: T[], n = 5): T[] {
  const byId = new Map(items.map(i => [i.id, i]))
  const ranked = [...order.filter(id => byId.has(id)), ...items.map(i => i.id).filter(id => !order.includes(id))]
  return ranked.map(id => byId.get(id)!).slice(0, n)
}

// Distinct accent colour + icon per workflow for the Top 5 grid — makes
// "This week's overview" scannable at a glance instead of five identical
// grey cards.
export const TOP5_COLOR: Record<DailyPlanSection, string> = {
  youtube: '#ff4466', etsy: '#f97316', tasks: '#00ff88', vault: '#8b5cf6', x: '#00d4ff',
}

export const SECTION_ICON: Record<DailyPlanSection, JSX.Element> = {
  youtube: <Tv size={12} color={TOP5_COLOR.youtube} />,
  etsy: <ShoppingBag size={12} color={TOP5_COLOR.etsy} />,
  tasks: <CheckSquare size={12} color={TOP5_COLOR.tasks} />,
  vault: <BookOpen size={12} color={TOP5_COLOR.vault} />,
  x: <X size={12} color={TOP5_COLOR.x} />,
}

// ---- Streaks row (encouragement) ----
// Streak/consistency math itself now lives in lib/habitStreak.ts, shared
// with app/tracking/page.tsx so both pages agree on the same number for the
// same habit (schedule-aware, full history -- see that file for why the old
// per-page versions of this disagreed with each other).
export type HabitStreak = { id: string; title: string; emoji: string; color: string; streak: number }
