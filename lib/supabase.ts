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
