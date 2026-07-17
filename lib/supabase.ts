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
