// Day planning: Supabase queries for tasks, intentions, streaks
import { supabase } from './supabase'

// ---- Types ----

// Task: rows in the central `tasks` table (synced from Notion or created in-app)
export type Task = {
  id: string
  notion_id: string | null
  title: string
  status: string              // 'Not started' | 'In progress' | 'Done'
  due_date: string | null
  task_type: string | null    // 'Flow' | 'Recurring' | 'Quick Task' | 'Admin' | 'Personal'
  urgency: string | null      // 'Urgent' | 'Habit' | 'Non Urgent'
  importance: string | null   // 'Moved the Needle' | 'Non Important' | 'Important'
  time_commitment: string | null
  is_frog: boolean
  priority: string | null
  why_note: string | null
  notion_url: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

// Legacy alias so existing code that imports DailyTask still works
export type DailyTask = Task

export type DailyIntention = {
  id: string
  intention_date: string
  intention_text: string
  locked: boolean
}

export type StreakInfo = {
  current: number
  longest: number
  completedToday: boolean
}

// ---- Tasks table CRUD ----

export async function getTasksForDate(date: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', date)
    .eq('archived', false)
    .neq('status', 'Done')
    .order('is_frog', { ascending: false })
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getHabitsForDate(date: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', date)
    .eq('archived', false)
    .eq('urgency', 'Habit')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getTodayTopTask(date: string): Promise<Task | null> {
  // Frog first, then Urgent+Important, then first task of day
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', date)
    .eq('archived', false)
    .neq('status', 'Done')
    .order('is_frog', { ascending: false })
    .order('created_at')
    .limit(10)
  if (!data || data.length === 0) return null
  const frog   = data.find((t: Task) => t.is_frog)
  const urgent = data.find((t: Task) => t.urgency === 'Urgent' && t.importance === 'Moved the Needle')
  return frog ?? urgent ?? data[0]
}

export async function createTask(task: {
  title: string
  due_date?: string | null
  urgency?: string | null
  importance?: string | null
  time_commitment?: string | null
  task_type?: string | null
  is_frog?: boolean
  why_note?: string | null
  priority?: string | null
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<Task, 'id' | 'notion_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  // Soft delete: set archived = true
  const { error } = await supabase.from('tasks').update({ archived: true }).eq('id', id)
  if (error) throw error
}

export async function rescheduleTasks(moves: { id: string; due_date: string }[]): Promise<void> {
  await Promise.all(
    moves.map(({ id, due_date }) =>
      supabase.from('tasks').update({ due_date }).eq('id', id)
    )
  )
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

  let current = 0
  const d = new Date(today + 'T00:00:00')
  while (true) {
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) { current++; d.setDate(d.getDate() - 1) } else break
  }

  const allDates = [...dates].sort()
  let longest = 0; let run = 0; let prev: string | null = null
  for (const dateStr of allDates) {
    if (prev) {
      const prevD = new Date(prev + 'T00:00:00')
      prevD.setDate(prevD.getDate() + 1)
      run = prevD.toISOString().split('T')[0] === dateStr ? run + 1 : 1
    } else { run = 1 }
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
  const { error } = await supabase.from('routine_completions').delete().eq('routine_date', date)
  if (error) throw error
}
