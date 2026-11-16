// Motion Studio data layer (table: motion_projects, migration 052).
import { supabase } from '@/lib/supabase'

export type MotionProject = {
  id: string
  name: string
  template: string
  content: unknown
  notes: string | null
  created_at: string
  updated_at: string
}

function explain(msg: string): string {
  if (/relation .*motion_projects.* does not exist|Could not find the table/i.test(msg))
    return 'The motion_projects table is missing. Run supabase/migrations/052_motion_projects.sql in the Supabase SQL editor.'
  return msg
}

export async function listMotionProjects(): Promise<{ projects: MotionProject[]; error: string | null }> {
  const { data, error } = await supabase.from('motion_projects').select('*').order('updated_at', { ascending: false })
  if (error) return { projects: [], error: explain(error.message) }
  return { projects: (data as MotionProject[]) ?? [], error: null }
}

export async function saveMotionProject(p: { id?: string; name: string; template: string; content: unknown }): Promise<{ project: MotionProject | null; error: string | null }> {
  const row = { name: p.name.trim() || 'Untitled', template: p.template, content: p.content, updated_at: new Date().toISOString() }
  const q = p.id
    ? supabase.from('motion_projects').update(row).eq('id', p.id).select().single()
    : supabase.from('motion_projects').insert(row).select().single()
  const { data, error } = await q
  if (error) return { project: null, error: explain(error.message) }
  return { project: data as MotionProject, error: null }
}

export async function deleteMotionProject(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('motion_projects').delete().eq('id', id)
  return { error: error ? explain(error.message) : null }
}
