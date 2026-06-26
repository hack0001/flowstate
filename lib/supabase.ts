import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, key)

export async function getWorkflowTypes() {
  const { data, error } = await supabase.from('workflow_types').select('*')
  if (error) throw error
  return data
}
