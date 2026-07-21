import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const supabase = createClient(url, key)

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

// ---- Per-stage AI-assist notes (Content Pipeline "Consult Claude") ----
// One row per (content_item, sop_id) so each stage keeps its own output as
// the video advances through the pipeline. Requires 020_daily_plan_and_stage_notes.sql.
export type StageNoteResult = { output: string | null; error: string | null }

function explainStageNoteError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('content_stage_notes')) {
    return 'Setup needed: run supabase/migrations/020_daily_plan_and_stage_notes.sql against your database first.'
  }
  return message ?? 'Unknown error loading stage notes.'
}

export async function getStageNote(contentItemId: string, sopId: string): Promise<StageNoteResult> {
  const { data, error } = await supabase
    .from('content_stage_notes')
    .select('output')
    .eq('content_item_id', contentItemId)
    .eq('sop_id', sopId)
    .maybeSingle()
  if (error) return { output: null, error: explainStageNoteError(error.message) }
  return { output: data?.output ?? null, error: null }
}

export async function saveStageNote(contentItemId: string, sopId: string, output: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('content_stage_notes')
    .upsert({ content_item_id: contentItemId, sop_id: sopId, output, updated_at: new Date().toISOString() }, { onConflict: 'content_item_id,sop_id' })
  if (error) return { error: explainStageNoteError(error.message) }
  return { error: null }
}

// ---- Morning routine (DB-backed checklist + per-item completion tracking) ----
// Used to live as a hardcoded array in lib/morningRoutine.ts with completion
// state in localStorage — only an all-or-nothing "finished the whole routine"
// row made it to Supabase (routine_completions, still used for the streak).
// Requires 022_morning_routine.sql. Items are editable at runtime (add /
// reorder / retire) and every completion is its own row, so per-item history
// is actually queryable instead of guessed.
export type MorningRoutineItem = {
  id: string
  title: string
  minutes: number
  note: string | null
  category: string | null
  sort_order: number
  active: boolean
}

function explainMorningRoutineError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('morning_routine')) {
    return 'Setup needed: run supabase/migrations/022_morning_routine.sql against your database first.'
  }
  return message ?? 'Unknown error loading the morning routine.'
}

export async function getMorningRoutineItems(): Promise<{ items: MorningRoutineItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('morning_routine_items')
    .select('id,title,minutes,note,category,sort_order,active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) return { items: [], error: explainMorningRoutineError(error.message) }
  return { items: (data ?? []) as MorningRoutineItem[], error: null }
}

export async function addMorningRoutineItem(item: { title: string; minutes: number; note: string | null; category: string | null; sort_order: number }): Promise<{ item: MorningRoutineItem | null; error: string | null }> {
  const id = 'custom-' + Date.now()
  const { data, error } = await supabase
    .from('morning_routine_items')
    .insert({ id, ...item })
    .select('id,title,minutes,note,category,sort_order,active')
    .single()
  if (error) return { item: null, error: explainMorningRoutineError(error.message) }
  return { item: data as MorningRoutineItem, error: null }
}

// Retiring (not deleting) keeps completion history intact for an item that's
// no longer on the checklist.
export async function retireMorningRoutineItem(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('morning_routine_items').update({ active: false }).eq('id', id)
  if (error) return { error: explainMorningRoutineError(error.message) }
  return { error: null }
}

export async function reorderMorningRoutineItems(orderedIds: string[]): Promise<{ error: string | null }> {
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from('morning_routine_items').update({ sort_order: i }).eq('id', id))
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: explainMorningRoutineError(failed.error.message) }
  return { error: null }
}

export async function getMorningCompletionsForDate(date: string): Promise<{ itemIds: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from('morning_routine_completions')
    .select('item_id')
    .eq('completed_date', date)
  if (error) return { itemIds: [], error: explainMorningRoutineError(error.message) }
  return { itemIds: (data ?? []).map((r: { item_id: string }) => r.item_id), error: null }
}

export async function markMorningItemComplete(itemId: string, date: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('morning_routine_completions')
    .upsert({ item_id: itemId, completed_date: date }, { onConflict: 'item_id,completed_date' })
  if (error) return { error: explainMorningRoutineError(error.message) }
  return { error: null }
}

// Per-item completion counts over the trailing `days` days — powers the
// completion-rate badges in the routine editor so individual items can
// actually be tracked, not just "did the whole routine happen".
export async function getMorningCompletionCounts(days: number): Promise<{ counts: Record<string, number>; error: string | null }> {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromStr = from.getFullYear() + '-' + String(from.getMonth() + 1).padStart(2, '0') + '-' + String(from.getDate()).padStart(2, '0')
  const { data, error } = await supabase
    .from('morning_routine_completions')
    .select('item_id')
    .gte('completed_date', fromStr)
  if (error) return { counts: {}, error: explainMorningRoutineError(error.message) }
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { item_id: string }[]) counts[row.item_id] = (counts[row.item_id] ?? 0) + 1
  return { counts, error: null }
}
