import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const supabase = createClient(url, key)

// ---- YouTube-Pipeline-driven focus session (Home "Start focus session") ----
// Up to getMaxFocusItems() content_items pinned via is_active_focus in the
// Content Pipeline (a configurable setting, default 2 — see
// content_focus_settings below), topped up with whichever item(s) have sat
// longest in their current stage if fewer than that are pinned. Shared by
// the Home page preview and app/content-focus/page.tsx (which runs the
// actual guided session).
export type ActiveFocusVideo = {
  id: string
  title: string
  pipeline_stage: string | null
  format: string | null
  is_active_focus: boolean
  updated_at: string | null
  // Added so the Focus Session can build the same rich Consult Claude
  // prompt (lib/stageDraftPrompt.ts) the Pipeline's Produce button uses,
  // now that per-stage AI drafting lives only in the focus session.
  video_type?: string | null
  unique_angle?: string | null
  notes?: string | null
  // Per-video Drive project folder — drive_url already existed
  // (022_video_links_and_stats.sql, "the video's asset folder in Google
  // Drive") and is what the "Create Drive project folder" action in the
  // Focus Session writes into; drive_folder_id (040_drive_integration.sql)
  // is the raw Drive id alongside it, for future API calls.
  drive_folder_id?: string | null
  drive_url?: string | null
  // Structured production-build fields (043_video_detail_fields.sql) — what
  // used to only ever get written into a paragraph of freeform stage notes.
  // hook/thumbnail_concept are decided in Holy Trifecta; thumbnail_url/
  // seo_description/seo_tags are finalised in Thumbnail & SEO.
  hook?: string | null
  thumbnail_concept?: string | null
  thumbnail_url?: string | null
  seo_description?: string | null
  seo_tags?: string | null
  // Slots 2 and 3 alongside title/thumbnail_concept/thumbnail_url (which
  // double as slot 1), so there are up to 3 of each ready for YouTube
  // Studio's native Test & Compare A/B tool (044_title_thumbnail_variants.sql).
  title_option_2?: string | null
  title_option_3?: string | null
  thumbnail_concept_2?: string | null
  thumbnail_concept_3?: string | null
  thumbnail_url_2?: string | null
  thumbnail_url_3?: string | null
}

// Fields the Focus Session lets Tom edit directly as he works through a
// video, rather than burying them in a freeform stage note. Generic partial
// update so the page doesn't need one function per field.
export async function updateContentItemFields(
  id: string,
  patch: Partial<Pick<ActiveFocusVideo,
    'title' | 'video_type' | 'unique_angle' | 'hook' | 'thumbnail_concept' | 'thumbnail_url' | 'seo_description' | 'seo_tags' |
    'title_option_2' | 'title_option_3' | 'thumbnail_concept_2' | 'thumbnail_concept_3' | 'thumbnail_url_2' | 'thumbnail_url_3'
  >>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_items').update(patch).eq('id', id)
  if (error) return { error: explainFocusError(error.message) }
  return { error: null }
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

// ---- Configurable focus-star cap (039_content_focus_settings.sql) ----
// How many content_items can be pinned (is_active_focus = true) at once.
// Used to be a hardcoded 2 everywhere; now a single-row settings table Tom
// can change from the Content Pipeline. Falls back to 2 if the migration
// hasn't been run yet, so nothing breaks on an older database.
export const DEFAULT_MAX_FOCUS_ITEMS = 2

// Was silently swallowing the error and just returning the default (2) --
// meant a missing 039_content_focus_settings.sql table looked identical to
// "you've deliberately capped it at 2", with zero indication anything needed
// fixing. Now returns the error too so callers can actually surface it.
export async function getMaxFocusItems(): Promise<{ maxItems: number; error: string | null }> {
  const { data, error } = await supabase.from('content_focus_settings').select('max_focus_items').eq('id', 1).maybeSingle()
  const maxItems = data?.max_focus_items ?? DEFAULT_MAX_FOCUS_ITEMS
  if (error) return { maxItems, error: "Setup needed: run supabase/migrations/039_content_focus_settings.sql against your database first — until then the focus-slot limit is stuck at the default of " + DEFAULT_MAX_FOCUS_ITEMS + "." }
  return { maxItems, error: null }
}

export async function setMaxFocusItems(n: number): Promise<{ error: string | null }> {
  const clamped = Math.max(1, Math.min(20, Math.round(n)))
  const { error } = await supabase.from('content_focus_settings')
    .upsert({ id: 1, max_focus_items: clamped, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return { error: "Setup needed: run supabase/migrations/039_content_focus_settings.sql against your database first." }
  return { error: null }
}

export async function getActiveFocusVideos(): Promise<ActiveFocusResult> {
  const { maxItems, error: maxErr } = await getMaxFocusItems()
  const { data: pinnedData, error: pinnedErr } = await supabase
    .from('content_items')
    .select('id,title,pipeline_stage,format,is_active_focus,updated_at,video_type,unique_angle,notes,drive_folder_id,drive_url,hook,thumbnail_concept,thumbnail_url,seo_description,seo_tags,title_option_2,title_option_3,thumbnail_concept_2,thumbnail_concept_3,thumbnail_url_2,thumbnail_url_3')
    .eq('is_active_focus', true)
    .neq('archived', true)

  if (pinnedErr) return { videos: [], error: explainFocusError(pinnedErr.message) }

  const pinned: ActiveFocusVideo[] = pinnedData ?? []
  let combined = pinned.slice(0, maxItems)
  if (combined.length < maxItems) {
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from('content_items')
      .select('id,title,pipeline_stage,format,is_active_focus,updated_at,video_type,unique_angle,notes,drive_folder_id,drive_url,hook,thumbnail_concept,thumbnail_url,seo_description,seo_tags,title_option_2,title_option_3,thumbnail_concept_2,thumbnail_concept_3,thumbnail_url_2,thumbnail_url_3')
      .eq('is_active_focus', false)
      .neq('archived', true)
      .not('pipeline_stage', 'is', null)
      .neq('pipeline_stage', '📊 Post-Published')
      .order('updated_at', { ascending: true })
      .limit(maxItems - combined.length)
    if (fallbackErr) return { videos: combined, error: explainFocusError(fallbackErr.message) }
    combined = [...combined, ...((fallbackData ?? []) as ActiveFocusVideo[])]
  }
  // Surface the max-focus-settings error too (e.g. 039 never run) so it's
  // visible wherever this list renders, not just when Tom tries the stepper.
  return { videos: combined, error: maxErr }
}

// Single-item lookup for the chunked focus session entry point (Content
// Pipeline card / Home priority card -> /content-focus?item=<id>). Ignores
// is_active_focus entirely -- clicking a specific item is its own signal to
// work on it right now, pinned or not.
export async function getContentItemById(id: string): Promise<{ video: ActiveFocusVideo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('content_items')
    .select('id,title,pipeline_stage,format,is_active_focus,updated_at,video_type,unique_angle,notes,drive_folder_id,drive_url,hook,thumbnail_concept,thumbnail_url,seo_description,seo_tags,title_option_2,title_option_3,thumbnail_concept_2,thumbnail_concept_3,thumbnail_url_2,thumbnail_url_3')
    .eq('id', id)
    .maybeSingle()
  if (error) return { video: null, error: explainFocusError(error.message) }
  return { video: data as ActiveFocusVideo | null, error: data ? null : 'Could not find that content item.' }
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

// Marks the seeded "Morning routine" row in the general Habit Tracker
// (habits/habit_completions from 006_habits.sql) complete for `date`, so
// finishing the Morning Routine flow automatically extends its streak on
// the Tracking page too, instead of requiring a second manual tick there.
// Upsert (not insert) so re-running it — e.g. the routine page reloading
// after the last item — never errors on the unique(habit_id, completed_date)
// constraint. Silently no-ops if the seed row was ever deleted/renamed.
export async function completeMorningRoutineHabit(date: string): Promise<{ error: string | null }> {
  // .limit(1) instead of .maybeSingle() -- if duplicate "Morning routine"
  // rows ever exist (see 036_dedupe_habits.sql for how that happened once
  // already), .maybeSingle() errors out on >1 row and this whole function
  // silently no-ops since its caller doesn't check the result. Picking the
  // oldest row deterministically keeps working either way.
  const { data: habitRows, error: findError } = await supabase
    .from('habits').select('id').eq('title', 'Morning routine').order('created_at', { ascending: true }).limit(1)
  if (findError) return { error: findError.message }
  const habit = habitRows?.[0]
  if (!habit) return { error: null }
  const { error } = await supabase
    .from('habit_completions')
    .upsert({ habit_id: habit.id, completed_date: date }, { onConflict: 'habit_id,completed_date' })
  return { error: error ? error.message : null }
}

// ---- Evening review (tomorrow's MIT + routine completion) ----
// Was evening_mit_<date> / evening_done_<date> in localStorage only.
// Requires 023_localstorage_to_db.sql.
export type EveningReview = { mit: string | null; completedAt: string | null }

function explainEveningError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('evening_reviews')) {
    return 'Setup needed: run supabase/migrations/023_localstorage_to_db.sql against your database first.'
  }
  return message ?? 'Unknown error loading the evening review.'
}

export async function getEveningReview(date: string): Promise<{ review: EveningReview | null; error: string | null }> {
  const { data, error } = await supabase
    .from('evening_reviews')
    .select('mit,completed_at')
    .eq('review_date', date)
    .maybeSingle()
  if (error) return { review: null, error: explainEveningError(error.message) }
  if (!data) return { review: null, error: null }
  return { review: { mit: data.mit as string | null, completedAt: data.completed_at as string | null }, error: null }
}

export async function saveEveningMit(date: string, mit: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('evening_reviews')
    .upsert({ review_date: date, mit }, { onConflict: 'review_date' })
  if (error) return { error: explainEveningError(error.message) }
  return { error: null }
}

export async function markEveningComplete(date: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('evening_reviews')
    .upsert({ review_date: date, completed_at: new Date().toISOString() }, { onConflict: 'review_date' })
  if (error) return { error: explainEveningError(error.message) }
  return { error: null }
}

// ---- Generic daily checklist completions ----
// Shared by any page with a "resets tomorrow" daily task list (Physical,
// Instagram, X Daily Workflow) — checklist_key distinguishes them. Was
// localStorage-only, date-keyed, with no history. Requires 023_localstorage_to_db.sql.
function explainDailyChecklistError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('daily_checklist_completions')) {
    return 'Setup needed: run supabase/migrations/023_localstorage_to_db.sql against your database first.'
  }
  return message ?? 'Unknown error loading the checklist.'
}

export async function getDailyChecklistState(checklistKey: string, date: string): Promise<{ state: Record<string, boolean>; error: string | null }> {
  const { data, error } = await supabase
    .from('daily_checklist_completions')
    .select('item_id')
    .eq('checklist_key', checklistKey)
    .eq('completed_date', date)
  if (error) return { state: {}, error: explainDailyChecklistError(error.message) }
  const state: Record<string, boolean> = {}
  for (const row of (data ?? []) as { item_id: string }[]) state[row.item_id] = true
  return { state, error: null }
}

export async function setDailyChecklistItem(checklistKey: string, itemId: string, date: string, done: boolean): Promise<{ error: string | null }> {
  if (done) {
    const { error } = await supabase
      .from('daily_checklist_completions')
      .upsert({ checklist_key: checklistKey, item_id: itemId, completed_date: date }, { onConflict: 'checklist_key,item_id,completed_date' })
    if (error) return { error: explainDailyChecklistError(error.message) }
    return { error: null }
  }
  const { error } = await supabase
    .from('daily_checklist_completions')
    .delete()
    .eq('checklist_key', checklistKey)
    .eq('item_id', itemId)
    .eq('completed_date', date)
  if (error) return { error: explainDailyChecklistError(error.message) }
  return { error: null }
}

// ---- Mobility program start date (Physical / Morning / Calendar) ----
// Single row keyed 'default' — the date the 4-week rotating mobility
// program began, used to work out which week's rotation is live today.
// Requires 026_mobility_program.sql.
function explainMobilityError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('mobility_program')) {
    return 'Setup needed: run supabase/migrations/026_mobility_program.sql against your database first.'
  }
  return message ?? 'Unknown error loading the mobility program.'
}

export async function getMobilityProgramStart(): Promise<{ startDate: string | null; error: string | null }> {
  const { data, error } = await supabase.from('mobility_program').select('start_date').eq('id', 'default').maybeSingle()
  if (error) return { startDate: null, error: explainMobilityError(error.message) }
  return { startDate: (data?.start_date as string | undefined) ?? null, error: null }
}

export async function setMobilityProgramStart(dateStr: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mobility_program').upsert({ id: 'default', start_date: dateStr }, { onConflict: 'id' })
  if (error) return { error: explainMobilityError(error.message) }
  return { error: null }
}

// ---- Tweet swipe file (X page "Tweet Models") ----
// Was flowstate_tweet_models in localStorage only — a real, growing content
// library with no backup. Requires 023_localstorage_to_db.sql.
export type TweetModelRow = {
  id: string
  source: 'seed' | 'manual' | 'generated'
  tweetUrl: string
  addedAt: string
  authorHandle: string
  authorName: string
  tweetText: string
  likes: number
  retweets: number
  followerEstimate: number
  engagementRatio: number
  category: string
  hookPattern: string
  formatType: string
  whyItWorked: string
  soundMoneyAlternative: string
}

function explainTweetModelError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('tweet_models')) {
    return 'Setup needed: run supabase/migrations/023_localstorage_to_db.sql against your database first.'
  }
  return message ?? 'Unknown error loading tweet models.'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tweetModelFromRow(r: any): TweetModelRow {
  return {
    id: r.id, source: r.source, tweetUrl: r.tweet_url ?? '', addedAt: r.added_at,
    authorHandle: r.author_handle ?? '', authorName: r.author_name ?? '', tweetText: r.tweet_text,
    likes: r.likes ?? 0, retweets: r.retweets ?? 0, followerEstimate: r.follower_estimate ?? 0,
    engagementRatio: r.engagement_ratio ?? 0, category: r.category ?? '', hookPattern: r.hook_pattern ?? '',
    formatType: r.format_type ?? '', whyItWorked: r.why_it_worked ?? '', soundMoneyAlternative: r.sound_money_alternative ?? '',
  }
}

function tweetModelToRow(m: TweetModelRow) {
  return {
    id: m.id, source: m.source, tweet_url: m.tweetUrl || null, added_at: m.addedAt,
    author_handle: m.authorHandle || null, author_name: m.authorName || null, tweet_text: m.tweetText,
    likes: m.likes, retweets: m.retweets, follower_estimate: m.followerEstimate, engagement_ratio: m.engagementRatio,
    category: m.category || null, hook_pattern: m.hookPattern || null, format_type: m.formatType || null,
    why_it_worked: m.whyItWorked || null, sound_money_alternative: m.soundMoneyAlternative || null,
  }
}

export async function getTweetModels(): Promise<{ models: TweetModelRow[]; error: string | null }> {
  const { data, error } = await supabase.from('tweet_models').select('*').order('created_at', { ascending: true })
  if (error) return { models: [], error: explainTweetModelError(error.message) }
  return { models: (data ?? []).map(tweetModelFromRow), error: null }
}

export async function addTweetModels(models: TweetModelRow[]): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tweet_models').insert(models.map(tweetModelToRow))
  if (error) return { error: explainTweetModelError(error.message) }
  return { error: null }
}

export async function deleteTweetModel(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tweet_models').delete().eq('id', id)
  if (error) return { error: explainTweetModelError(error.message) }
  return { error: null }
}

// ---- Etsy Knowledge Base overrides ----
// Tom's own edits to the Notion-sourced KB pages. Was flowstate_etsy_kb_*
// in localStorage only. Requires 023_localstorage_to_db.sql.
function explainEtsyKbError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('etsy_kb_overrides')) {
    return 'Setup needed: run supabase/migrations/023_localstorage_to_db.sql against your database first.'
  }
  return message ?? 'Unknown error loading Etsy KB overrides.'
}

export async function getEtsyKbOverrides(): Promise<{ overrides: Record<string, string>; error: string | null }> {
  const { data, error } = await supabase.from('etsy_kb_overrides').select('page_id,content')
  if (error) return { overrides: {}, error: explainEtsyKbError(error.message) }
  const overrides: Record<string, string> = {}
  for (const row of (data ?? []) as { page_id: string; content: string }[]) overrides[row.page_id] = row.content
  return { overrides, error: null }
}

export async function saveEtsyKbOverride(pageId: string, content: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('etsy_kb_overrides')
    .upsert({ page_id: pageId, content, updated_at: new Date().toISOString() }, { onConflict: 'page_id' })
  if (error) return { error: explainEtsyKbError(error.message) }
  return { error: null }
}

export async function resetEtsyKbOverride(pageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('etsy_kb_overrides').delete().eq('page_id', pageId)
  if (error) return { error: explainEtsyKbError(error.message) }
  return { error: null }
}

// ---- Error log (morning page "what went wrong" journal) ----
// Was flowstate_error_log in localStorage only — explicitly meant for
// spotting patterns over time, so it needs to actually persist.
// Requires 023_localstorage_to_db.sql.
export type ErrorLogEntry = { id: string; date: string; text: string }

function explainErrorLogError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('error_log')) {
    return 'Setup needed: run supabase/migrations/023_localstorage_to_db.sql against your database first.'
  }
  return message ?? 'Unknown error loading the error log.'
}

export async function getErrorLog(): Promise<{ entries: ErrorLogEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('error_log')
    .select('id,log_date,entry_text')
    .order('created_at', { ascending: false })
  if (error) return { entries: [], error: explainErrorLogError(error.message) }
  const entries = (data ?? []).map((r: { id: string; log_date: string; entry_text: string }) => ({ id: r.id, date: r.log_date, text: r.entry_text }))
  return { entries, error: null }
}

export async function addErrorLogEntry(date: string, text: string): Promise<{ entry: ErrorLogEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('error_log')
    .insert({ log_date: date, entry_text: text })
    .select('id,log_date,entry_text')
    .single()
  if (error) return { entry: null, error: explainErrorLogError(error.message) }
  return { entry: { id: data.id, date: data.log_date, text: data.entry_text }, error: null }
}

export async function deleteErrorLogEntry(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('error_log').delete().eq('id', id)
  if (error) return { error: explainErrorLogError(error.message) }
  return { error: null }
}

// ---- Page visits (Home page "haven't checked this in a while" badges) ----
// Was flowstate_last_visit_<route> in localStorage only — per-browser, so a
// fresh device or cleared cache made every pill look stale. Requires
// 024_page_visits.sql.
function explainPageVisitsError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('page_visits')) {
    return 'Setup needed: run supabase/migrations/024_page_visits.sql against your database first.'
  }
  return message ?? 'Unknown error loading page visits.'
}

export async function getPageVisits(): Promise<{ visits: Record<string, string>; error: string | null }> {
  const { data, error } = await supabase.from('page_visits').select('route,last_visited_at')
  if (error) return { visits: {}, error: explainPageVisitsError(error.message) }
  const visits: Record<string, string> = {}
  for (const row of (data ?? []) as { route: string; last_visited_at: string }[]) visits[row.route] = row.last_visited_at
  return { visits, error: null }
}

export async function recordPageVisit(route: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('page_visits')
    .upsert({ route, last_visited_at: new Date().toISOString() }, { onConflict: 'route' })
  if (error) return { error: explainPageVisitsError(error.message) }
  return { error: null }
}

// ---- Google Drive integration (SOUND MONEY HQ) ----
// drive_folder_map is a single-row config pointing at the key subfolders in
// Tom's Drive brand-assets/templates/projects folder, pre-filled with the
// real IDs when 040_drive_integration.sql was written. The actual Drive API
// calls happen server-side (app/api/drive/*, lib/googleDrive.ts) via a
// service account — this file only ever reads/writes folder IDs and links,
// never touches Drive directly.
// Requires 040_drive_integration.sql.
export type DriveFolderMap = {
  root_folder_id: string | null
  brand_folder_id: string | null
  asset_library_folder_id: string | null
  premiere_templates_folder_id: string | null
  projects_longform_folder_id: string | null
  projects_shorts_folder_id: string | null
  project_template_folder_id: string | null
}

function explainDriveError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('drive_folder_map')) {
    return 'Setup needed: run supabase/migrations/040_drive_integration.sql against your database first.'
  }
  return message ?? 'Unknown error loading Drive settings.'
}

export async function getDriveFolderMap(): Promise<{ map: DriveFolderMap | null; error: string | null }> {
  const { data, error } = await supabase
    .from('drive_folder_map')
    .select('root_folder_id,brand_folder_id,asset_library_folder_id,premiere_templates_folder_id,projects_longform_folder_id,projects_shorts_folder_id,project_template_folder_id')
    .eq('id', 1)
    .maybeSingle()
  if (error) return { map: null, error: explainDriveError(error.message) }
  return { map: (data as DriveFolderMap | null) ?? null, error: null }
}

// Persists the result of creating a per-video Drive project folder onto the
// content item (into the existing drive_url column — see ActiveFocusVideo
// above — so the link survives without re-hitting the Drive API, and shows
// up in the same Assets chip the Pipeline card and Full History already use).
export async function setContentItemDriveFolder(id: string, folderId: string, folderUrl: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('content_items')
    .update({ drive_folder_id: folderId, drive_url: folderUrl })
    .eq('id', id)
  if (error) return { error: explainDriveError(error.message) }
  return { error: null }
}

// ---- Channel watchlist (Content Pipeline > Ideas Bank) ----
// YouTube channels in Tom's niche or an adjacent one worth keeping an eye on
// for ideas/formats — separate from the Ideas Bank itself (which is his own
// video ideas). Requires 042_channel_watchlist_and_adobe_skills.sql.
export type ChannelWatch = {
  id: string
  name: string
  url: string
  niche: string | null
  notes: string | null
  created_at: string
}

function explainChannelWatchlistError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('channel_watchlist')) {
    return 'Setup needed: run supabase/migrations/042_channel_watchlist_and_adobe_skills.sql against your database first.'
  }
  return message ?? 'Unknown error loading the channel watchlist.'
}

export async function getChannelWatchlist(): Promise<{ channels: ChannelWatch[]; error: string | null }> {
  const { data, error } = await supabase.from('channel_watchlist').select('*').order('created_at', { ascending: false })
  if (error) return { channels: [], error: explainChannelWatchlistError(error.message) }
  return { channels: (data as ChannelWatch[]) ?? [], error: null }
}

export async function addChannelWatch(name: string, url: string, niche: string, notes: string): Promise<{ channel: ChannelWatch | null; error: string | null }> {
  const { data, error } = await supabase
    .from('channel_watchlist')
    .insert({ name: name.trim(), url: url.trim(), niche: niche.trim() || null, notes: notes.trim() || null })
    .select().single()
  if (error) return { channel: null, error: explainChannelWatchlistError(error.message) }
  return { channel: data as ChannelWatch, error: null }
}

export async function deleteChannelWatch(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('channel_watchlist').delete().eq('id', id)
  if (error) return { error: explainChannelWatchlistError(error.message) }
  return { error: null }
}

// ---- Adobe Skills library (Premiere Pro / After Effects / Illustrator) ----
// A running library of learning resources -- a website or YouTube video Tom
// names and describes -- with a simple to-learn/learned tracker. Its own
// dedicated section, app/adobe-skills/page.tsx. Requires
// 042_channel_watchlist_and_adobe_skills.sql.
export const ADOBE_TOOLS = ['Premiere Pro', 'After Effects', 'Illustrator', 'General'] as const
export type AdobeTool = typeof ADOBE_TOOLS[number]
export type AdobeSkillResource = {
  id: string
  tool: AdobeTool
  title: string
  url: string
  description: string | null
  status: 'To learn' | 'Learned'
  created_at: string
}

function explainAdobeSkillsError(message: string | undefined): string {
  if (message && message.toLowerCase().includes('adobe_skill_resources')) {
    return 'Setup needed: run supabase/migrations/042_channel_watchlist_and_adobe_skills.sql against your database first.'
  }
  return message ?? 'Unknown error loading Adobe Skills resources.'
}

export async function getAdobeSkillResources(): Promise<{ resources: AdobeSkillResource[]; error: string | null }> {
  const { data, error } = await supabase.from('adobe_skill_resources').select('*').order('created_at', { ascending: false })
  if (error) return { resources: [], error: explainAdobeSkillsError(error.message) }
  return { resources: (data as AdobeSkillResource[]) ?? [], error: null }
}

export async function addAdobeSkillResource(tool: AdobeTool, title: string, url: string, description: string): Promise<{ resource: AdobeSkillResource | null; error: string | null }> {
  const { data, error } = await supabase
    .from('adobe_skill_resources')
    .insert({ tool, title: title.trim(), url: url.trim(), description: description.trim() || null, status: 'To learn' })
    .select().single()
  if (error) return { resource: null, error: explainAdobeSkillsError(error.message) }
  return { resource: data as AdobeSkillResource, error: null }
}

export async function updateAdobeSkillResource(id: string, patch: Partial<Pick<AdobeSkillResource, 'tool' | 'title' | 'url' | 'description' | 'status'>>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('adobe_skill_resources').update(patch).eq('id', id)
  if (error) return { error: explainAdobeSkillsError(error.message) }
  return { error: null }
}

export async function deleteAdobeSkillResource(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('adobe_skill_resources').delete().eq('id', id)
  if (error) return { error: explainAdobeSkillsError(error.message) }
  return { error: null }
}
