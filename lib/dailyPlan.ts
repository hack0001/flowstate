// ============================================================
// lib/dailyPlan.ts — Weighted daily workflow plan
// Generates "what tomorrow should look like" by pulling the top
// not-done items off each section's existing priority list (Vault,
// Tasks, Etsy, X) or active-focus signal (YouTube), and filling each
// section's time budget (set in daily_plan_settings) until it runs out.
// Used by the Evening page (generate + edit) and the Home page (read).
// ============================================================
import { supabase, getActiveFocusVideos } from './supabase'
import { sopForStage } from './sops'
import { ETSY_TODOS } from './etsy-data'

export type DailyPlanSection = 'youtube' | 'etsy' | 'tasks' | 'x' | 'vault'
export type DailyPlanStatus = 'planned' | 'done' | 'skipped' | 'rescheduled'

export type DailyPlanItem = {
  id: string
  plan_date: string
  section: DailyPlanSection
  source_id: string | null
  title: string
  minutes: number
  order_index: number
  status: DailyPlanStatus
}

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

const SECTION_ORDER: DailyPlanSection[] = ['youtube', 'etsy', 'tasks', 'x', 'vault']
const SECTION_LABEL: Record<DailyPlanSection, string> = {
  youtube: 'YouTube', etsy: 'Etsy', tasks: 'Tasks', x: 'X / Social', vault: 'Vault',
}
export { SECTION_ORDER, SECTION_LABEL }

export function toDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
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

export async function getDailyPlan(date: string): Promise<DailyPlanItem[]> {
  const { data } = await supabase.from('daily_plans').select('*').eq('plan_date', date).order('order_index')
  return (data ?? []) as DailyPlanItem[]
}

// Removes every row for a date except ones already rescheduled away or
// marked done — used before regenerating so a re-run doesn't duplicate.
export async function clearDailyPlan(date: string): Promise<void> {
  await supabase.from('daily_plans').delete().eq('plan_date', date).in('status', ['planned', 'skipped'])
}

// ---- Section adapters — each returns ranked candidate blocks, not yet persisted ----

type Draft = { section: DailyPlanSection; source_id: string | null; title: string; minutes: number }

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

async function pullTasks(budget: number): Promise<Draft[]> {
  return pullFromPriorityList('tasks_priority', 'tasks', budget, 30, async () => {
    const { data } = await supabase.from('master_tasks').select('id,title,status').neq('status', 'Done')
    return (data ?? []).map((t: { id: string; title: string; status: string }) => ({ id: t.id, title: t.title, done: false }))
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

export async function generateDailyPlan(date: string): Promise<DailyPlanItem[]> {
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

  const bySection: Record<DailyPlanSection, Draft[]> = { youtube, etsy, tasks, x, vault }
  const rows = SECTION_ORDER.flatMap(section => bySection[section]).map((d, i) => ({
    plan_date: date, section: d.section, source_id: d.source_id, title: d.title,
    minutes: d.minutes, order_index: i, status: 'planned' as DailyPlanStatus,
  }))

  if (rows.length === 0) return []

  const { data, error } = await supabase.from('daily_plans').insert(rows).select()
  if (error) throw error
  return (data ?? []) as DailyPlanItem[]
}

// ---- Editing ----

export async function updatePlanItem(id: string, patch: Partial<Pick<DailyPlanItem, 'minutes' | 'order_index' | 'status' | 'title'>>): Promise<void> {
  await supabase.from('daily_plans').update(patch).eq('id', id)
}

export async function reorderPlan(items: DailyPlanItem[]): Promise<void> {
  await Promise.all(items.map((it, i) => it.order_index === i ? Promise.resolve() : supabase.from('daily_plans').update({ order_index: i }).eq('id', it.id)))
}

// Reschedule an item to a later date (default: tomorrow relative to its
// current plan_date) and mark the original as 'rescheduled' rather than
// deleting it, so the evening review keeps a record of what got pushed.
export async function rescheduleItem(item: DailyPlanItem, toDate: string): Promise<void> {
  await supabase.from('daily_plans').update({ status: 'rescheduled' }).eq('id', item.id)
  await supabase.from('daily_plans').insert({
    plan_date: toDate, section: item.section, source_id: item.source_id,
    title: item.title, minutes: item.minutes, order_index: 999, status: 'planned',
  })
}
