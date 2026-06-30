// Day planning: Supabase queries replacing Notion for daily tasks, intentions, streaks
import { supabase } from './supabase'

// ---- Types ----

export type DailyTask = {
  id: string
  title: string
  due_date: string | null
  status: string
  urgency: string | null
  importance: string | null
  time_commitment: string | null
  task_type: string | null
  is_frog: boolean
  why_note: string | null
  notion_id: string | null
  created_at: string
  updated_at: string
}

export type DailyIntention = {
  id: string
  intention_date: string
  intention_text: string
  locked: boolean
}

export type StreakInfo = {
  current: number    // consecutive days ending yesterday or today
  longest: number
  completedToday: boolean
}

// ---- Daily Tasks ----

export async function getTasksForDate(date: string): Promise<DailyTask[]> {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('due_date', date)
    .neq('status', 'Done')
    .order('is_frog', { ascending: false })
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getHabitsForDate(date: string): Promise<DailyTask[]> {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('due_date', date)
    .eq('urgency', 'Habit')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createTask(task: {
  title: string
  due_date?: string
  urgency?: string
  importance?: string
  time_commitment?: string
  task_type?: string
  is_frog?: boolean
  why_note?: string
}): Promise<DailyTask> {
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, patch: Partial<Omit<DailyTask, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('daily_tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id)
  if (error) throw error
}

// Reschedule multiple tasks at once (used by Organise Day)
export async function rescheduleTasks(moves: { id: string; due_date: string }[]): Promise<void> {
  await Promise.all(moves.map(({ id, due_date }) =>
    supabase.from('daily_tasks').update({ due_date }).eq('id', id)
  ))
}

// ---- Daily Intentions ----

export async function getIntention(date: string): Promise<DailyIntention | null> {
  const { data } = await supabase
    .from('daily_intentions')
    .select('*')
    .eq('intention_date', date)
    .maybeSingle()
  return data ?? null
}

export async function upsertIntention(date: string, text: string): Promise<DailyIntention> {
  const { data, error } = await supabase
    .from('daily_intentions')
    .upsert({ intention_date: date, intention_text: text }, { onConflict: 'intention_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleLock(date: string, locked: boolean): Promise<void> {
  const { error } = await supabase
    .from('daily_intentions')
    .upsert({ intention_date: date, locked }, { onConflict: 'intention_date' })
  if (error) throw error
}

// ---- Routine Streak ----

export async function getStreakInfo(today: string): Promise<StreakInfo> {
  // Fetch last 90 days of completions to calculate streak
  const from = new Date(today)
  from.setDate(from.getDate() - 90)
  const fromStr = from.toISOString().split('T')[0]

  const { data } = await supabase
    .from('routine_completions')
    .select('routine_date')
    .gte('routine_date', fromStr)
    .lte('routine_date', today)
    .order('routine_date', { ascending: false })

  const dates = new Set((data ?? []).map((r: { routine_date: string }) => r.routine_date))
  const completedToday = dates.has(today)

  // Calculate current streak (working backwards from today)
  let current = 0
  const d = new Date(today + 'T00:00:00')
  while (true) {
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) {
      current++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  // Calculate longest streak in the fetched window
  const allDates = [...dates].sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const dateStr of allDates) {
    if (prev) {
      const prevD: Date = new Date(prev + 'T00:00:00')
      prevD.setDate(prevD.getDate() + 1)
      if (prevD.toISOString().split('T')[0] === dateStr) {
        run++
      } else {
        run = 1
      }
    } else {
      run = 1
    }
    if (run > longest) longest = run
    prev = dateStr
  }

  return { current, longest, completedToday }
}

export async function markRoutineComplete(date: string): Promise<void> {
  const { error } = await supabase
    .from('routine_completions')
    .upsert({ routine_date: date }, { onConflict: 'routine_date' })
  if (error) throw error
}

export async function unmarkRoutineComplete(date: string): Promise<void> {
  const { error } = await supabase
    .from('routine_completions')
    .delete()
    .eq('routine_date', date)
  if (error) throw error
}
