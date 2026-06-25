import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Workflow Types ──────────────────────────────────────────────
export async function getWorkflowTypes() {
  const { data, error } = await supabase
    .from('workflow_types')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

// ── Sessions ───────────────────────────────────────────────────
export async function getSessions() {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .select('*, workflow_type:workflow_types(*)')
    .eq('is_active', true)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPrioritySession() {
  const { data, error } = await supabase
    .from('workflow_sessions')
    .select('*, workflow_type:workflow_types(*)')
    .eq('is_priority', true)
    .eq('is_active', true)
    .single()
  if (error && error.code !== 'PGRST116') throw error
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
    .insert({ workflow_type_id: workflowTypeId, title, is_active: true, is_priority: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setPrioritySession(sessionId: string) {
  // Clear existing priority
  await supabase
    .from('workflow_sessions')
    .update({ is_priority: false })
    .eq('is_priority', true)
  // Set new priority
  const { data, error } = await supabase
    .from('workflow_sessions')
    .update({ is_priority: true })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSessionTask(sessionId: string, taskId: string, stageId: string) {
  const { error } = await supabase
    .from('workflow_sessions')
    .update({ current_task_id: taskId, current_stage_id: stageId })
    .eq('id', sessionId)
  if (error) throw error
}

// ── Stages & Tasks ─────────────────────────────────────────────
export async function getStagesForWorkflow(workflowTypeId: string) {
  const { data, error } = await supabase
    .from('stages')
    .select('*, tasks(*)')
    .eq('workflow_type_id', workflowTypeId)
    .order('order_index')
  if (error) throw error
  return data?.map((s) => ({
    ...s,
    tasks: s.tasks?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index),
  }))
}

// ── Completions ────────────────────────────────────────────────
export async function getCompletions(sessionId: string) {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data
}

export async function completeTask(sessionId: string, taskId: string, pomodorosUsed = 0) {
  const { data, error } = await supabase
    .from('task_completions')
    .upsert({ session_id: sessionId, task_id: taskId, pomodoros_used: pomodorosUsed })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uncompleteTask(sessionId: string, taskId: string) {
  const { error } = await supabase
    .from('task_completions')
    .delete()
    .eq('session_id', sessionId)
    .eq('task_id', taskId)
  if (error) throw error
}
