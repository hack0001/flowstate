'use client'
import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Star, ChevronRight, CalendarDays, Sunrise, BarChart2, Moon, FolderOpen, Film, BookOpen, CheckSquare, User, Target, Tv, Link2, ShoppingBag, X, Activity, Camera, Layers, Lightbulb, Plus, Flame, GripVertical, ShoppingCart, Bell, Sparkles, Palette, Library, Disc3, FileEdit, TrendingUp, LineChart } from 'lucide-react'
import SignOutButton from '@/components/SignOutButton'
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
import { SiteIdea, toDateStr, RankableItem, rankTop, TOP5_COLOR, HabitStreak } from '@/components/home/homeShared'
import { HomeDaysBoard } from '@/components/home/HomeDaysBoard'
import { FocusSessionsToday } from '@/components/home/FocusSessionsToday'
import { TodaysPhysical } from '@/components/home/TodaysPhysical'
import { WeeklyTargets } from '@/components/home/WeeklyTargets'
import { HabitTracker } from '@/components/home/HabitTracker'
import { LiveClock } from '@/components/home/LiveClock'
import { FocusCheck } from '@/components/home/FocusCheck'
import { AddTaskModal } from '@/components/home/AddTaskModal'
import { QUOTES } from '@/lib/homeQuotes'



























export default function Home() {
  const router = useRouter()
  const { t, lang, toggle } = useLanguage()

  const h = new Date().getHours()
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const greeting =
    h < 6  ? 'Up early, Tom' :
    h < 12 ? 'Good morning, Tom' :
    h < 17 ? 'Good afternoon, Tom' :
    h < 21 ? 'Good evening, Tom' : 'Late night, Tom'

  const lateStart = h >= 10 && h < 14
  const veryLate  = h >= 14

  const [focusError, setFocusError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [routineDone, setRoutineDone] = useState(false)
  const [topTask, setTopTask] = useState<{ title: string; id: string; instructions?: string[]; meta?: string } | null>(null)
  const [eveningDone, setEveningDone] = useState(false)
  const [topTaskIsPipeline, setTopTaskIsPipeline] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [showFocusCheck, setShowFocusCheck] = useState(false)
  const [pendingFocusItem, setPendingFocusItem] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [pageAlerts, setPageAlerts] = useState<Record<string, 'green' | 'orange' | 'red'>>({})
  const [pageWarn, setPageWarn] = useState<Set<string>>(new Set())
  const [pageVisitsErr, setPageVisitsErr] = useState<string | null>(null)
  // Preview only -- full add/edit/delete lives on the dedicated /ideas page.
  const [ideas, setIdeas] = useState<SiteIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [streaks, setStreaks] = useState<HabitStreak[]>([])
  const [consistencyPct, setConsistencyPct] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [top5, setTop5] = useState<Partial<Record<'tasks'|'vault'|'etsy'|'x'|'youtube', RankableItem[]>>>({})
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskRefresh, setTaskRefresh] = useState(0)

  const TRACKED_ROUTES = ['morning','calendar','evening','welsh','vault','content','projects','tasks','personal','youtube','etsy','x','nsdr','physical','instagram','tabs','ideas','adobe-skills','motion','references','music','script-editor','seo']

  const today = toDateStr(new Date())
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  const loadData = useCallback(async () => {
    let localDone = false
    try {
      localDone = localStorage.getItem('flowstate_routine_done') === toDateStr(new Date())
      if (localDone) setRoutineDone(true)
    } catch {}

    try {
      const [focusResult, routineRes, tasksRes, eveningRes, habitRes] = await Promise.all([
        getActiveFocusVideos(),
        supabase.from('routine_completions').select('routine_date').eq('routine_date', toDateStr(new Date())).maybeSingle(),
        // Query the tasks table for today's top task (frog first)
        supabase.from('master_tasks')
          .select('id,title,urgency,importance,task_type,is_frog,why_note,time_commitment')
          .eq('due_date', toDateStr(new Date()))
          .eq('archived', false)
          .neq('status','Done')
          .order('is_frog', { ascending:false })
          .limit(10),
        getEveningReview(toDateStr(new Date())),
        // Cross-check against the Habit Tracker's "Morning routine" habit --
        // the same source the streaks row reads. The morning routine writes
        // to routine_completions AND this habit together when it finishes;
        // if one write ever silently fails, the other still lets us detect
        // "done" correctly instead of the CTA/header chip going stale.
        // .limit(1) not .maybeSingle() -- see 036_dedupe_habits.sql; this
        // must not error out if duplicate "Morning routine" rows ever
        // exist again, it should just pick the oldest and move on.
        supabase.from('habits').select('id').eq('title', 'Morning routine').order('created_at', { ascending: true }).limit(1),
      ])

      let habitDoneToday = false
      const morningHabitId = habitRes.data?.[0]?.id
      if (morningHabitId) {
        const { data: hc } = await supabase.from('habit_completions')
          .select('completed_date').eq('habit_id', morningHabitId).eq('completed_date', toDateStr(new Date())).maybeSingle()
        habitDoneToday = !!hc
      }

      setFocusError(focusResult.error)
      const done = !!routineRes.data || localDone || habitDoneToday
      setRoutineDone(done)
      setEveningDone(!!eveningRes.review?.completedAt)
      try { if (done) localStorage.setItem('flowstate_routine_done', toDateStr(new Date())) } catch {}

      // The #1 task should generally point at the Pipeline — if there's an
      // active focus video, that's the thing to work on today. Only fall
      // back to a generic master_tasks pick (frog/urgent) when nothing is
      // pinned or in production. Either way, carry along "how to do it"
      // instructions -- the SOP steps for a pipeline video, or the task's
      // own why_note -- so the home page CTA can show more than a title.
      const topVideo = focusResult.videos[0]
      if (topVideo) {
        const sop = sopForStage(topVideo.pipeline_stage, topVideo.format)
        setTopTask({
          id: topVideo.id,
          title: sop ? sop.title + ' — ' + topVideo.title : 'Advance "' + topVideo.title + '"',
          instructions: sop ? sop.steps.slice(0, 3) : undefined,
          meta: topVideo.pipeline_stage ?? undefined,
        })
        setTopTaskIsPipeline(true)
      } else {
        const tasks: Array<{ id:string; title:string; urgency:string|null; importance:string|null; task_type:string|null; is_frog:boolean; why_note:string|null; time_commitment:string|null }> = tasksRes.data ?? []
        const frog   = tasks.find(t => t.is_frog)
        const urgent = tasks.find(t => t.urgency === 'Urgent' && t.importance === 'Moved the Needle')
        const top    = frog ?? urgent ?? tasks[0]
        if (top) {
          const meta = [top.task_type, top.urgency, top.time_commitment].filter(Boolean).join(' · ')
          setTopTask({ id:top.id, title:top.title, instructions: top.why_note ? [top.why_note] : undefined, meta: meta || undefined })
        } else {
          setTopTask(null)
        }
        setTopTaskIsPipeline(false)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setTimeout(() => setContentReady(true), 80)
    }
  }, [])

  useEffect(() => {
    loadData()
    const onVisible = () => { if (!document.hidden) loadData() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', loadData)
    // Also poll every 60s — if this tab stays open and focused while the
    // morning routine gets completed elsewhere (another device, or just
    // never blurring this window), visibilitychange/focus never fire and
    // the "Morning routine pending" chip would otherwise go stale.
    const poll = setInterval(loadData, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', loadData)
      clearInterval(poll)
    }
  }, [loadData])

  useEffect(() => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    const isWeekday = day >= 1 && day <= 5
    const isAfternoon = hour >= 13 && hour < 20
    const dismissed = (() => { try { return localStorage.getItem('flowstate_reminder_dismissed') === toDateStr(now) } catch { return false } })()
    setShowReminder(isWeekday && isAfternoon && !dismissed)
  }, [])

  // Streaks row — active habits from the general Habit Tracker, including
  // the Morning routine (which now auto-ticks itself when the flow
  // finishes). Streak + consistency math is schedule-aware and shared with
  // the Tracking page (lib/habitStreak.ts) so the two pages always agree on
  // the same number for the same habit -- a Mon/Wed/Fri habit's own rest
  // days no longer break its streak here just because they did on the old
  // strict-consecutive-calendar-day math. Full completion history is
  // fetched (not windowed) so a streak longer than a few weeks still shows
  // its real length; this is a small personal table so that's cheap.
  // Pulled out to a callback (not just an inline mount effect) so it can
  // also be re-run on demand -- see the 'flowstate:routine-complete' /
  // 'flowstate:evening-complete' listener below.
  const loadStreaks = useCallback(() => {
    Promise.all([
      supabase.from('habits').select('id,title,emoji,color,schedule_type,schedule_days,schedule_time,created_at').eq('active', true).order('sort_order'),
      supabase.from('habit_completions').select('habit_id,completed_date'),
    ]).then(([{ data: habits, error: habitsErr }, { data: completions, error: compErr }]) => {
      if (habitsErr) console.error('[home streaks] habits query failed', habitsErr.message)
      if (compErr) console.error('[home streaks] completions query failed', compErr.message)
      const byHabit = new Map<string, Set<string>>()
      for (const c of (completions ?? []) as { habit_id: string; completed_date: string }[]) {
        if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, new Set())
        byHabit.get(c.habit_id)!.add(c.completed_date)
      }
      const habitRows = (habits ?? []) as (StreakHabit & { title: string; emoji: string; color: string })[]
      // Per-habit try/catch so one malformed row (e.g. a bad created_at)
      // can't silently zero out every other habit's streak too.
      const rows = habitRows
        .map(h => {
          let streak = 0
          try { streak = calcHabitStreak(h, byHabit.get(h.id) ?? new Set()) }
          catch (e) { console.error('[home streaks] calc failed for habit', h.id, e) }
          return { id: h.id, title: h.title, emoji: h.emoji, color: h.color, streak }
        })
        .filter(h => h.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 6)
      setStreaks(rows)

      // Unified consistency score — % of SCHEDULED habit-days actually
      // completed over the trailing 7 days. Schedule-aware for the same
      // reason streaks are: a habit's own off-days shouldn't count against
      // it in the denominator.
      try { setConsistencyPct(calcConsistencyPct(habitRows, byHabit, 7)) }
      catch (e) { console.error('[home streaks] consistency calc failed', e) }
    }).catch(e => console.error('[home streaks] load failed', e))
  }, [])

  useEffect(() => { loadStreaks() }, [loadStreaks])

  // Same-tab client-side navigation (router.push) back to Home doesn't
  // always trigger a fresh mount or a visibilitychange/focus event -- so
  // completing the morning/evening routine on its own page and clicking
  // back here can leave the CTA, header chip, and streaks all showing
  // stale "not done yet" state until a manual reload. Morning/evening pages
  // dispatch these events the moment they actually finish writing
  // completion, and Home listens for them the whole time it's mounted
  // (even while another route is showing on top of it), so the fresh state
  // is already loaded by the time you navigate back.
  useEffect(() => {
    const onRoutineComplete = () => { loadData(); loadStreaks() }
    window.addEventListener('flowstate:routine-complete', onRoutineComplete)
    window.addEventListener('flowstate:evening-complete', onRoutineComplete)
    return () => {
      window.removeEventListener('flowstate:routine-complete', onRoutineComplete)
      window.removeEventListener('flowstate:evening-complete', onRoutineComplete)
    }
  }, [loadData, loadStreaks])

  // Top 5 per workflow — direct read of each workflow's own priority_lists
  // order (the same list its own Priority View drag-reorders), independent
  // of the Calendar's time-budgeted daily plan. YouTube reads its own
  // 'youtube_pipeline_priority' list (set from Content's Priority tab), same
  // as every other workflow — no more falling back to pinned focus videos.
  useEffect(() => {
    (async () => {
      const [tasksRes, vaultRes, xRes, ytRes, etsyPl, etsyCs, tasksPl, vaultPl, xPl, ytPl] = await Promise.all([
        supabase.from('master_tasks').select('id,title,status,archived').eq('archived', false).neq('status', 'Done'),
        supabase.from('vault_items').select('id,title,status').neq('archived', true),
        supabase.from('x_ideas').select('id,text,status').eq('archived', false),
        supabase.from('content_items').select('id,title,pipeline_stage,format,is_active_focus').neq('archived', true),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'etsy_todos_priority').maybeSingle(),
        supabase.from('checklist_state').select('state').eq('key', 'etsy_checklists').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'tasks_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'vault_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'x_priority').maybeSingle(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'youtube_pipeline_priority').maybeSingle(),
      ])

      const tasksItems: RankableItem[] = ((tasksRes.data ?? []) as { id:string; title:string }[]).map(t => ({ id:t.id, title:t.title }))
      const vaultItems: RankableItem[] = ((vaultRes.data ?? []) as { id:string; title:string; status:string|null }[])
        .filter(v => v.status !== 'Done' && v.status !== 'Read')
        .map(v => ({ id:v.id, title:v.title }))
      const xItems: RankableItem[] = ((xRes.data ?? []) as { id:string; text:string; status:string|null }[])
        .filter(i => i.status !== 'done')
        .map(i => ({ id:i.id, title:i.text }))
      const checked = (etsyCs.data?.state as Record<string, boolean> | undefined) ?? {}
      const etsyItems: RankableItem[] = ETSY_TODOS
        .map(td => ({ id: td.notion_url || td.name, title: td.name, checked: !!checked[td.notion_url || td.name] }))
        .filter(td => !td.checked)
        .map(({ id, title }) => ({ id, title }))
      const ytItems: RankableItem[] = ((ytRes.data ?? []) as { id:string; title:string; pipeline_stage:string|null; format:string|null; is_active_focus:boolean|null }[])
        .filter(v => v.pipeline_stage !== '📣 Live' && v.pipeline_stage !== '📊 Post-Published')
        .map(v => ({ id:v.id, title:v.title, pipeline_stage:v.pipeline_stage, format:v.format, is_active_focus:!!v.is_active_focus }))

      // Real totals (top5 below is capped) -- the dashboard shows "N to do".
      setCounts({ tasks: tasksItems.length, vault: vaultItems.length, x: xItems.length, etsy: etsyItems.length, youtube: ytItems.length })
      setTop5({
        tasks:   rankTop((tasksPl.data?.ordered_ids as string[] | undefined) ?? [], tasksItems),
        vault:   rankTop((vaultPl.data?.ordered_ids as string[] | undefined) ?? [], vaultItems),
        x:       rankTop((xPl.data?.ordered_ids as string[] | undefined) ?? [], xItems),
        etsy:    rankTop((etsyPl.data?.ordered_ids as string[] | undefined) ?? [], etsyItems),
        youtube: rankTop((ytPl.data?.ordered_ids as string[] | undefined) ?? [], ytItems),
      })
    })().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-launch the Morning/Evening Routine on the first app open of the
  // day/evening — cross-device, so opening on a different phone or laptop
  // still counts as "already been on the app" rather than firing again.
  // Uses the existing page_visits table (route text PK, last_visited_at)
  // as a same-day marker rather than localStorage, which is per-device.
  // Gated on the routine actually being undone, so it never yanks you back
  // in after you've already finished it (on any device).
  useEffect(() => {
    (async () => {
      try {
        const now = new Date()
        const hour = now.getHours()
        const todayStr = toDateStr(now)
        const EVENING_HOUR = 20

        const [{ data: routineRow }, eveningRes, { visits }] = await Promise.all([
          supabase.from('routine_completions').select('routine_date').eq('routine_date', todayStr).maybeSingle(),
          getEveningReview(todayStr),
          getPageVisits(),
        ])

        if (hour >= EVENING_HOUR) {
          const eveningDone = !!eveningRes.review?.completedAt
          const marker = visits['__evening_auto_launch__']
          const alreadyTonight = !!marker && toDateStr(new Date(marker)) === todayStr
          if (!eveningDone && !alreadyTonight) {
            await recordPageVisit('__evening_auto_launch__')
            router.push('/evening')
          }
        } else {
          const morningDone = !!routineRow
          const marker = visits['__morning_auto_launch__']
          const alreadyToday = !!marker && toDateStr(new Date(marker)) === todayStr
          if (!morningDone && !alreadyToday) {
            await recordPageVisit('__morning_auto_launch__')
            router.push('/morning')
          }
        }
      } catch { /* never block the home page over this */ }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getPageVisits().then(({ visits, error }) => {
      setPageVisitsErr(error)
      const now = Date.now()
      const alerts: Record<string, 'green' | 'orange' | 'red'> = {}
      const warn = new Set<string>()
      for (const route of TRACKED_ROUTES) {
        const raw = visits[route]
        if (!raw) { alerts[route] = 'red'; warn.add(route); continue }
        const age = now - new Date(raw).getTime()
        const days = age / (24 * 3600 * 1000)
        if (days >= 5) alerts[route] = 'red'
        else if (days >= 4) alerts[route] = 'orange'
        else if (days >= 2) alerts[route] = 'green'
        if (days >= 3) warn.add(route)
      }
      setPageAlerts(alerts)
      setPageWarn(warn)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navTo(route: string) {
    recordPageVisit(route)
    // Clear the badge immediately rather than waiting on the next full page
    // load — visiting today should drop the warning right away.
    setPageWarn(prev => {
      if (!prev.has(route)) return prev
      const next = new Set(prev)
      next.delete(route)
      return next
    })
    setPageAlerts(prev => {
      if (!(route in prev)) return prev
      const next = { ...prev }
      delete next[route]
      return next
    })
    router.push('/' + route)
  }

  // Same as navTo but deep-links straight to one item — the target page
  // reads ?focus=<id> on load and scrolls/highlights that row so clicking
  // a Top 5 card actually lands you on the thing, not just the list.
  function navToItem(route: string, id: string) {
    recordPageVisit(route)
    setPageWarn(prev => {
      if (!prev.has(route)) return prev
      const next = new Set(prev)
      next.delete(route)
      return next
    })
    setPageAlerts(prev => {
      if (!(route in prev)) return prev
      const next = { ...prev }
      delete next[route]
      return next
    })
    router.push('/' + route + '?focus=' + encodeURIComponent(id))
  }

  // YouTube Top 5 items go through the same Pre-Flight Check -> content-focus
  // flow as the old "Active YouTube Focus" list — pin the clicked video first
  // so it's the one waiting when the focus session actually opens.
  async function focusYoutubeItem(id: string) {
    supabase.from('content_items').update({ is_active_focus: true }).eq('id', id).then()
    setPendingFocusItem(id)
    handleFocusClick()
  }

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true)
    const { data } = await supabase
      .from('site_ideas')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setIdeas((data ?? []) as SiteIdea[])
    setIdeasLoading(false)
  }, [])

  useEffect(() => { loadIdeas() }, [loadIdeas])

  function handleFocusClick() {
    // Show the pre-flight check before starting focus
    setShowFocusCheck(true)
  }

  function proceedToFocus() {
    setShowFocusCheck(false)
    router.push(pendingFocusItem ? '/content-focus?item=' + pendingFocusItem : '/content-focus')
    setPendingFocusItem(null)
  }

  const accentColor = routineDone ? C.green : C.cyan
  const isEveningReady = h >= 20 && !eveningDone
  const routeFor = (s: DailyPlanSection) => (s === 'youtube' ? 'content' : s)
  const n = (k: string) => counts[k] ?? 0
  // The habit tracker lives on this page now (no separate Tracking tab).
  const goHabits = () => document.getElementById('habits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Thin wrappers over the shared templates in components/ui.
  const tile = (label: string, value: string, sub: string, color: string, onClick?: () => void) =>
    <Tile key={label} label={label} value={value} sub={sub} color={color} onClick={onClick} />

  const rows = (list: { id: string; title: string; badge?: string }[], color: string, onPick: (id: string) => void) =>
    list.length === 0
      ? <div style={{ fontSize:11, color:D.dim, padding:'6px 0' }}>all clear</div>
      : list.map((it, i) => <ListRow key={it.id} index={i + 1} title={it.title} badge={it.badge} color={color} onClick={() => onPick(it.id)} />)

  const renderList = (section: DailyPlanSection, max = 3) =>
    rows(
      (top5[section] ?? []).slice(0, max).map(i => ({ id: i.id, title: i.title, badge: section === 'youtube' ? i.pipeline_stage?.replace(/^\S+\s/, '') : undefined })),
      TOP5_COLOR[section],
      id => section === 'youtube' ? focusYoutubeItem(id) : navToItem(routeFor(section), id),
    )

  const panel = (title: string, color: string, note: string, route: string, body: ReactNode) =>
    <Panel key={title} title={title} color={color} note={note} onTitleClick={() => route === 'habits' ? goHabits() : navTo(route)}>{body}</Panel>

  // One-line "what to do right now" bar.
  const nextUp = !routineDone
    ? { label: h >= 10 ? 'Morning routine still pending — do it, then lock in' : 'Start your morning routine', cta: 'Begin', color: D.amb, go: () => router.push('/morning') }
    : isEveningReady
    ? { label: 'Time to wind down — evening routine', cta: 'Begin', color: D.vio, go: () => router.push('/evening') }
    : topTask
    ? { label: topTask.title, cta: topTaskIsPipeline ? 'Start focus' : 'Open', color: D.grn, go: () => { if (topTaskIsPipeline) { setPendingFocusItem(topTask.id); handleFocusClick() } else navToItem('tasks', topTask.id) } }
    : null

  const chip = (text: string, color: string) => (
    <span style={{ fontSize:10, fontWeight:700, color, border:'1px solid '+color+'55', background:color+'14', borderRadius:9999, padding:'2px 9px' }}>{text}</span>
  )
  const wrap = (children: ReactNode, key?: string) => (
    <div key={key} style={{ position:'relative', zIndex:1, borderTop:'1px solid '+C.border }}>
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'1rem 1rem' }}>{children}</div>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:D.fg, fontFamily:MONO, overflowX:'clip' }}>
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'14px 16px 18px' }}>

        {/* Top bar: greeting, status chips, actions */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.text, letterSpacing:'-0.01em' }}>{greeting}</div>
            <div style={{ fontSize:11, color:D.mut }}>{dateLabel}</div>
          </div>
          <LiveClock />
          {!loading && (routineDone ? chip('✓ morning', D.teal) : h >= 6 ? chip('morning pending', D.amb) : null)}
          {!loading && h >= 20 && (eveningDone ? chip('✓ evening', D.teal) : chip('evening pending', D.vio))}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setShowAddTask(true)} title="Add task" style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:8, color:C.green, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
              <Plus size={13}/> Task
            </button>
            <button onClick={toggle} title={lang === 'en' ? 'Switch to Welsh' : 'Newid i Saesneg'} style={{ padding:'6px 12px', background: lang === 'cy' ? 'rgba(0,192,75,0.12)' : 'rgba(255,255,255,0.04)', border:'1px solid '+(lang === 'cy' ? 'rgba(0,192,75,0.3)' : C.border), borderRadius:8, color: lang === 'cy' ? '#00c04b' : C.muted, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
              {lang === 'en' ? 'CY' : 'EN'}
            </button>
            <SignOutButton />
          </div>
        </div>

        {showReminder && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', marginBottom:10, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:8, fontSize:12 }}>
            <span style={{ fontWeight:700, color:'#f97316' }}>{t('reminderTitle')}:</span>
            <span style={{ color:D.mut, flex:1 }}>{t('reminderMemes')} &bull; {t('reminderMewing')}</span>
            <button onClick={() => { try { localStorage.setItem('flowstate_reminder_dismissed', toDateStr(new Date())) } catch {}; setShowReminder(false) }} aria-label="Dismiss" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={14}/></button>
          </div>
        )}
        {pageVisitsErr && <div style={{ padding:'7px 12px', marginBottom:10, background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:8, color:'#ff4466', fontSize:12 }}>{pageVisitsErr}</div>}
        {focusError && <div style={{ padding:'7px 12px', marginBottom:10, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:8, color:C.amber, fontSize:12 }}>{focusError}</div>}
        {error && <div style={{ padding:'7px 12px', marginBottom:10, background:C.card, border:'1px solid '+C.border, borderRadius:8, color:C.amber, fontSize:12 }}>Supabase not connected — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.</div>}

        {!loading && (
          <>
            {/* What to do right now */}
            {nextUp && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', marginBottom:10, background:D.panel, border:'1px solid '+nextUp.color+'55', borderLeft:'3px solid '+nextUp.color, borderRadius:10 }}>
                <span style={{ fontSize:9, letterSpacing:'.16em', textTransform:'uppercase', color:nextUp.color, flexShrink:0 }}>Next up</span>
                <span style={{ flex:1, minWidth:0, fontSize:13, color:D.fg, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nextUp.label}</span>
                <button onClick={nextUp.go} style={{ padding:'5px 14px', background:nextUp.color, border:'none', borderRadius:7, color:'#06101a', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>{nextUp.cta} &rarr;</button>
              </div>
            )}

            {/* How much is left, per area */}
            <Grid min={140} gap={8} style={{ marginBottom:10 }}>
              {tile('Tasks', String(n('tasks')), n('tasks') === 1 ? 'to do' : 'to do', n('tasks') ? TOP5_COLOR.tasks : D.teal, () => navTo('tasks'))}
              {tile('YouTube', String(n('youtube')), 'in pipeline', n('youtube') ? TOP5_COLOR.youtube : D.teal, () => navTo('content'))}
              {tile('Etsy', String(n('etsy')), 'to do', n('etsy') ? TOP5_COLOR.etsy : D.teal, () => navTo('etsy'))}
              {tile('X / Social', String(n('x')), 'ideas to post', n('x') ? TOP5_COLOR.x : D.teal, () => navTo('x'))}
              {tile('Vault', String(n('vault')), 'to read', n('vault') ? TOP5_COLOR.vault : D.teal, () => navTo('vault'))}
              {tile('Site ideas', String(ideas.length), 'parked', D.vio, () => navTo('ideas'))}
              {tile('Consistency', consistencyPct !== null ? consistencyPct + '%' : '—', 'habits, 7 days', consistencyPct === null ? D.dim : consistencyPct >= 80 ? D.teal : consistencyPct >= 50 ? D.amb : D.red, goHabits)}
              {tile('Best streak', streaks[0] ? streaks[0].streak + 'd' : '—', streaks[0] ? streaks[0].title : 'none yet', D.amb, goHabits)}
            </Grid>

            {/* Top 3 in each */}
            <Grid min={250}>
              {panel('Tasks', TOP5_COLOR.tasks, n('tasks') + ' to do', 'tasks', renderList('tasks'))}
              {panel('YouTube', TOP5_COLOR.youtube, n('youtube') + ' in pipeline', 'content', renderList('youtube'))}
              {panel('Etsy', TOP5_COLOR.etsy, n('etsy') + ' to do', 'etsy', renderList('etsy'))}
              {panel('X / Social', TOP5_COLOR.x, n('x') + ' ideas', 'x', renderList('x'))}
              {panel('Vault', TOP5_COLOR.vault, n('vault') + ' to read', 'vault', renderList('vault'))}
              {panel('Site ideas', D.vio, ideas.length + ' parked', 'ideas',
                rows(ideas.slice(0, 3).map(i => ({ id: i.id, title: i.title })), D.vio, () => navTo('ideas')))}
              {panel('Streaks', D.amb, 'habits', 'habits',
                rows(streaks.slice(0, 3).map(s => ({ id: s.id, title: (s.emoji ? s.emoji + ' ' : '') + s.title, badge: s.streak + 'd' })), D.amb, goHabits))}
            </Grid>
          </>
        )}
      </div>

      {/* Below the fold: habits first, then detail */}
      {!loading && wrap(<HabitTracker />, 'habits')}
      {!loading && <TodaysPhysical />}
      {!loading && <FocusSessionsToday />}
      {!loading && wrap(<HomeDaysBoard refreshKey={taskRefresh} />, 'board')}
      {!loading && wrap(<>
        <p style={{ fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', color:D.mut, margin:'0 0 8px' }}>This week&apos;s targets</p>
        <WeeklyTargets />
      </>, 'targets')}

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onAdded={() => setTaskRefresh(k => k + 1)} />}
      {showFocusCheck && <FocusCheck onProceed={proceedToFocus} onClose={() => setShowFocusCheck(false)} />}

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </main>
  )
}
