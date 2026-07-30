// ============================================================
// lib/dailyPlan.ts — Weighted daily workflow plan
// Generates "what a given day should look like" by pulling the top
// not-done items off each section's existing priority list (Vault,
// Etsy, X), the active-focus signal (YouTube), or the undated backlog
// (Tasks) — filling each section's time budget (set in
// daily_plan_settings) until it runs out.
//
// Everything lands as ordinary master_tasks rows so the Calendar page
// (drag-to-reschedule, "Organise" overdue sweep, "Organise Week" type
// rebalancing) handles amending/moving them for free — there is no
// separate storage for the plan. Youtube/Etsy/X/Vault picks become new
// master_tasks tagged with source_section/source_id (so regenerating
// doesn't duplicate them); Tasks picks are existing undated tasks that
// simply get a due_date set.
// ============================================================
import { supabase, getActiveFocusVideos } from './supabase'
import { sopForStage } from './sops'
import { ETSY_TODOS } from './etsy-data'

export type DailyPlanSection = 'youtube' | 'etsy' | 'tasks' | 'x' | 'vault'

export type DailyPlanSettings = {
  total_minutes: number
  pct_youtube: number
  pct_etsy: number
  pct_tasks: number
  pct_x: number
  pct_vault: number
}

const DEFAULT_SETTINGS: DailyPlanSettings = {
  total_minutes: 360, pct_youtube: 50, pct_etsy: 20, pct_tasks: 15, pct_x: 10, pct_vault: 5,
}

export const SECTION_LABEL: Record<DailyPlanSection, string> = {
  youtube: 'YouTube', etsy: 'Etsy', tasks: 'Tasks', x: 'X / Social', vault: 'Vault',
}

export async function getDailyPlanSettings(): Promise<DailyPlanSettings> {
  const { data } = await supabase.from('daily_plan_settings').select('*').eq('id', 1).maybeSingle()
  if (!data) return DEFAULT_SETTINGS
  return {
    total_minutes: data.total_minutes ?? DEFAULT_SETTINGS.total_minutes,
    pct_youtube: data.pct_youtube ?? DEFAULT_SETTINGS.pct_youtube,
    pct_etsy: data.pct_etsy ?? DEFAULT_SETTINGS.pct_etsy,
    pct_tasks: data.pct_tasks ?? DEFAULT_SETTINGS.pct_tasks,
    pct_x: data.pct_x ?? DEFAULT_SETTINGS.pct_x,
    pct_vault: data.pct_vault ?? DEFAULT_SETTINGS.pct_vault,
  }
}

export async function saveDailyPlanSettings(s: DailyPlanSettings): Promise<void> {
  await supabase.from('daily_plan_settings').upsert({ id: 1, ...s, updated_at: new Date().toISOString() }, { onConflict: 'id' })
}

// ---- Section adapters — each returns ranked candidate blocks, not yet persisted ----

export type Draft = { section: DailyPlanSection; source_id: string | null; title: string; minutes: number }

async function pullYoutube(budget: number): Promise<Draft[]> {
  if (budget <= 0) return []
  const { videos } = await getActiveFocusVideos()
  if (videos.length === 0) return []
  const per = Math.max(30, Math.floor(budget / videos.length))
  return videos.map(v => {
    const sop = sopForStage(v.pipeline_stage)
    return {
      section: 'youtube' as const, source_id: v.id,
      title: sop ? sop.title + ' — ' + v.title : 'Advance "' + v.title + '"',
      minutes: per,
    }
  })
}

async function pullFromPriorityList(key: string, section: DailyPlanSection, budget: number, perItem: number, fetchItems: () => Promise<{ id: string; title: string; done: boolean }[]>): Promise<Draft[]> {
  if (budget <= 0) return []
  const { data: pl } = await supabase.from('priority_lists').select('ordered_ids').eq('key', key).maybeSingle()
  const order = (pl?.ordered_ids as string[] | undefined) ?? []
  const items = await fetchItems()
  const active = items.filter(i => !i.done)
  const byId = new Map(active.map(i => [i.id, i]))
  const ranked = [...order.filter(id => byId.has(id)), ...active.map(i => i.id).filter(id => !order.includes(id))]
  const out: Draft[] = []
  let used = 0
  for (const id of ranked) {
    const it = byId.get(id)
    if (!it) continue
    if (used >= budget) break
    out.push({ section, source_id: id, title: it.title, minutes: perItem })
    used += perItem
  }
  return out
}

// Tasks is special: the candidates ARE master_tasks rows already (the
// backlog — anything with no due_date yet), ranked by tasks_priority.
// generateDailyPlan sets their due_date directly rather than inserting
// a new row for them (see below).
async function pullTasks(budget: number): Promise<Draft[]> {
  return pullFromPriorityList('tasks_priority', 'tasks', budget, 30, async () => {
    const { data } = await supabase.from('master_tasks').select('id,title,status,due_date').is('due_date', null).neq('status', 'Done')
    return (data ?? []).map((t: { id: string; title: string }) => ({ id: t.id, title: t.title, done: false }))
  })
}

async function pullVault(budget: number): Promise<Draft[]> {
  return pullFromPriorityList('vault_priority', 'vault', budget, 20, async () => {
    const { data } = await supabase.from('vault_items').select('id,title,status').neq('archived', true)
    return (data ?? []).map((v: { id: string; title: string; status: string | null }) => ({ id: v.id, title: v.title, done: v.status === 'Done' || v.status === 'Read' }))
  })
}

async function pullX(budget: number): Promise<Draft[]> {
  return pullFromPriorityList('x_priority', 'x', budget, 20, async () => {
    const { data } = await supabase.from('x_ideas').select('id,text,status').eq('archived', false)
    return (data ?? []).map((i: { id: string; text: string; status: string }) => ({ id: i.id, title: i.text, done: i.status === 'done' }))
  })
}

async function pullEtsy(budget: number): Promise<Draft[]> {
  if (budget <= 0) return []
  const { data: pl } = await supabase.from('priority_lists').select('ordered_ids').eq('key', 'etsy_todos_priority').maybeSingle()
  const order = (pl?.ordered_ids as string[] | undefined) ?? []
  const { data: cs } = await supabase.from('checklist_state').select('state').eq('key', 'etsy_checklists').maybeSingle()
  const checked = (cs?.state as Record<string, boolean> | undefined) ?? {}
  const items = ETSY_TODOS.map(td => ({ id: td.notion_url || td.name, title: td.name, done: !!checked[td.notion_url || td.name] }))
  const active = items.filter(i => !i.done)
  const byId = new Map(active.map(i => [i.id, i]))
  const ranked = [...order.filter(id => byId.has(id)), ...active.map(i => i.id).filter(id => !order.includes(id))]
  const out: Draft[] = []
  let used = 0
  const perItem = 25
  for (const id of ranked) {
    const it = byId.get(id)
    if (!it) continue
    if (used >= budget) break
    out.push({ section: 'etsy', source_id: id, title: it.title, minutes: perItem })
    used += perItem
  }
  return out
}

// ---- Generation ----

export type GeneratePlanResult = { created: number; scheduled: number }

// A single reviewable recommendation — same shape as the internal Draft,
// plus a stable key (source_id isn't always present) so the review UI can
// track checked/unchecked state per candidate.
export type PlanCandidate = Draft & { key: string }

// Gathers the weighted candidate list for `date` WITHOUT writing anything —
// used by the "Recommend for Tomorrow" review step so the person can see
// and uncheck items before anything lands on the calendar.
export async function getDailyPlanCandidates(date: string): Promise<PlanCandidate[]> {
  void date // budgets/ranking are day-agnostic today; kept for a future per-weekday tune
  const settings = await getDailyPlanSettings()
  const budgets: Record<DailyPlanSection, number> = {
    youtube: Math.round(settings.total_minutes * settings.pct_youtube / 100),
    etsy: Math.round(settings.total_minutes * settings.pct_etsy / 100),
    tasks: Math.round(settings.total_minutes * settings.pct_tasks / 100),
    x: Math.round(settings.total_minutes * settings.pct_x / 100),
    vault: Math.round(settings.total_minutes * settings.pct_vault / 100),
  }
  const [youtube, etsy, tasks, x, vault] = await Promise.all([
    pullYoutube(budgets.youtube),
    pullEtsy(budgets.etsy),
    pullTasks(budgets.tasks),
    pullX(budgets.x),
    pullVault(budgets.vault),
  ])
  const all = [...youtube, ...etsy, ...tasks, ...x, ...vault]
  return all.map((d, i) => ({ ...d, key: d.section + ':' + (d.source_id ?? i) }))
}

// Writes only the SELECTED candidates for `date` into master_tasks:
//  - Tasks picks: existing backlog tasks get due_date = date (update)
//  - Everything else: new master_tasks rows tagged source_section/source_id
//    (skipped if an active task for that source_id already exists, so
//    re-running doesn't duplicate)
// Returns the ids of every task affected so the caller can time-block them.
export async function commitDailyPlan(date: string, selected: PlanCandidate[]): Promise<GeneratePlanResult & { taskIds: string[] }> {
  const tasks = selected.filter(d => d.section === 'tasks')
  const others = selected.filter(d => d.section !== 'tasks')
  const taskIds: string[] = []

  let scheduled = 0
  for (const t of tasks) {
    if (!t.source_id) continue
    const { error } = await supabase.from('master_tasks').update({ due_date: date }).eq('id', t.source_id)
    if (!error) { scheduled++; taskIds.push(t.source_id) }
  }

  let created = 0
  if (others.length > 0) {
    const ids = others.map(d => d.source_id).filter(Boolean) as string[]
    const existingIds = new Set<string | null>()
    if (ids.length > 0) {
      const { data: existing } = await supabase
        .from('master_tasks').select('source_id').in('source_id', ids).neq('status', 'Done')
      for (const r of (existing ?? []) as { source_id: string | null }[]) existingIds.add(r.source_id)
    }
    const rows = others
      .filter(d => !d.source_id || !existingIds.has(d.source_id))
      .map(d => ({
        title: d.title, due_date: date, status: 'Not started', task_type: 'Flow',
        source_section: d.section, source_id: d.source_id,
      }))
    if (rows.length > 0) {
      const { data, error } = await supabase.from('master_tasks').insert(rows).select('id')
      if (error) throw error
      created = data?.length ?? 0
      for (const r of (data ?? []) as { id: string }[]) taskIds.push(r.id)
    }
  }

  return { created, scheduled, taskIds }
}

// Convenience wrapper for the older "Weighted Plan" flow — gathers and
// commits every candidate in one call, no review step.
export async function generateDailyPlan(date: string): Promise<GeneratePlanResult> {
  const candidates = await getDailyPlanCandidates(date)
  const { created, scheduled } = await commitDailyPlan(date, candidates)
  return { created, scheduled }
}
