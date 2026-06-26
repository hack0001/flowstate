import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const supabase = createClient(url, key)

export async function getWorkflowTypes() {
  const { data, error } = await supabase.from('workflow_types').select('*').order('name')
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

export async function completeTask(sessionId: string, taskId: string, pomodorosUsed = 0) {
  const { error } = await supabase
    .from('task_completions')
    .upsert({ session_id: sessionId, task_id: taskId, pomodoros_used: pomodorosUsed })
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
