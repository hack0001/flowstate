import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const supabase = createClient(url, key)

export async function getWorkflowTypes() {
  const { data, error } = await supabase.from('workflow_types').select('*').order('order_index')
  if (error) throw error
  return data
}

export async function getSessions() {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .select('*, workflow_type:workflow_types(*)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPrioritySession() {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .select('*, workflow_type:workflow_types(*)')
    .eq('is_priority', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getSession(id: string) {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .select('*, workflow_type:workflow_types(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createSession(workflowTypeId: string, title: string) {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .insert({ workflow_type_id: workflowTypeId, title, is_priority: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setPrioritySession(id: string) {
  await supabase.from('workflow_sessions').update({ is_priority: false }).neq('id', id)
  const { error } = await supabase.from('workflow_sessions').update({ is_priority: true }).eq('id', id)
  if (error) throw error
}

export async function getStagesForWorkflow(workflowTypeId: string) {
  const { data, error } = await supabase
    .from('stages')
    .select('*, tasks(*)')
    .eq('workflow_type_id', workflowTypeId)
    .order('order_index')
  if (error) throw error
  if (data) {
    for (const stage of data) {
      if (Array.isArray(stage.tasks)) {
        (stage.tasks as Array<{ order_index: number }>).sort((a, b) => a.order_index - b.order_index)
      }
    }
  }
  return data
}

export async function getCompletions(sessionId: string) {
  const { data, error } = await supabase
    .from('task_completions').select('*').eq('session_id', sessionId)
  if (error) throw error
  return data
}

export async function completeTask(sessionId: string, taskId: string, pomodorosUsed = 0, timeSpentSeconds = 0) {
  const { error } = await supabase
    .from('task_completions')
    .upsert({ session_id: sessionId, task_id: taskId, pomodoros_used: pomodorosUsed, time_spent_seconds: timeSpentSeconds })
  if (error) throw error
}

export async function uncompleteTask(sessionId: string, taskId: string) {
  const { error } = await supabase
    .from('task_completions')
    .delete()
    .eq('session_id', sessionId)
    .eq('task_id', taskId)
  if (error) throw error
}

export async function getSessionStats(sessionId: string) {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*, task:tasks(title, estimated_minutes, stage:stages(name))')
    .eq('session_id', sessionId)
    .order('completed_at')
  if (error) throw error
  return data
}

// ---- YouTube-Pipeline-driven focus session (Home "Start focus session") ----
// Up to 2 content_items pinned via is_active_focus in the Content Pipeline,
// topped up with whichever item(s) have sat longest in their current stage
// if fewer than 2 are pinned. Shared by the Home page preview and
// app/content-focus/page.tsx (which runs the actual guided session).
export type ActiveFocusVideo = {
  id: string
  title: string
  pipeline_stage: string | null
  format: string | null
  is_active_focus: boolean
  updated_at: string | null
}

export type ActiveFocusResult = { videos: ActiveFocusVideo[]; error: string | null }

// Friendly translation for the specific "column doesn't exist" error you get
// before 018_content_focus.sql has been run — this is by far the most likely
// failure mode here, since it's a brand-new column.
function explainFocusError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('is_active_focus')) {
    return "Setup needed: run supabase/migrations/018_content_focus.sql against your database — the is_active_focus column doesn't exist yet, so pinning can't be saved."
  }
  return message ?? 'Unknown error loading active focus videos.'
}

export async function getActiveFocusVideos(): Promise<ActiveFocusResult> {
  const { data: pinnedData, error: pinnedErr } = await supabase
    .from('content_items')
    .select('id,title,pipeline_stage,format,is_active_focus,updated_at')
    .eq('is_active_focus', true)
    .neq('archived', true)

  if (pinnedErr) return { videos: [], error: explainFocusError(pinnedErr.message) }

  const pinned: ActiveFocusVideo[] = pinnedData ?? []
  let combined = pinned.slice(0, 2)
  if (combined.length < 2) {
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from('content_items')
      .select('id,title,pipeline_stage,format,is_active_focus,updated_at')
      .eq('is_active_focus', false)
      .neq('archived', true)
      .not('pipeline_stage', 'is', null)
      .neq('pipeline_stage', '📊 Post-Published')
      .order('updated_at', { ascending: true })
      .limit(2 - combined.length)
    if (fallbackErr) return { videos: combined, error: explainFocusError(fallbackErr.message) }
    combined = [...combined, ...((fallbackData ?? []) as ActiveFocusVideo[])]
  }
  return { videos: combined, error: null }
}
