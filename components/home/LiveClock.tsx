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

// ---- Isolated clock -- only this re-renders every second ----
export function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700, color:C.text, letterSpacing:'0.05em' }}>{time}</span>
}
