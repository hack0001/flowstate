import { NextResponse } from 'next/server'
import { getAllTasksForSync, getAllVaultForSync, getAllContentForSync, getAllProjectsForSync } from '@/lib/notion'
import { supabase } from '@/lib/supabase'

type SyncResult = { synced: number; total: number; error?: string }

async function syncTasks(): Promise<SyncResult> {
  try {
    const items = await getAllTasksForSync()
    if (items.length === 0) return { synced: 0, total: 0 }
    const rows = items.map(t => ({
      notion_id:       t.id,
      title:           t.title,
      status:          t.status,
      due_date:        t.dueDate ?? null,
      task_type:       t.taskType ?? null,
      urgency:         t.urgency ?? null,
      importance:      t.importance ?? null,
      time_commitment: t.timeCommitment ?? null,
      is_frog:         t.isFrog,
      priority:        t.priority ?? null,
      notion_url:      t.url,
      updated_at:      new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('master_tasks').upsert(rows, { onConflict: 'notion_id' }).select('id')
    if (error) return { synced: 0, total: items.length, error: error.message }
    return { synced: data?.length ?? rows.length, total: items.length }
  } catch (e) {
    return { synced: 0, total: 0, error: String(e) }
  }
}

async function syncVault(): Promise<SyncResult> {
  try {
    const items = await getAllVaultForSync()
    if (items.length === 0) return { synced: 0, total: 0 }
    const rows = items.map(v => ({
      notion_id:     v.id,
      title:         v.title,
      category:      v.category ?? null,
      author_source: v.authorSource ?? null,
      link:          v.link ?? null,
      key_takeaway:  v.keyTakeaway ?? null,
      notes:         v.notes ?? null,
      platform:      v.platform ?? null,
      tag:           v.tag ?? null,
      status:        v.status,
      notion_url:    v.url,
      updated_at:    new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('vault_items').upsert(rows, { onConflict: 'notion_id' }).select('id')
    if (error) return { synced: 0, total: items.length, error: error.message }
    return { synced: data?.length ?? rows.length, total: items.length }
  } catch (e) {
    return { synced: 0, total: 0, error: String(e) }
  }
}

async function syncContent(): Promise<SyncResult> {
  try {
    const items = await getAllContentForSync()
    if (items.length === 0) return { synced: 0, total: 0 }
    const rows = items.map(c => ({
      notion_id:      c.id,
      title:          c.title,
      pipeline_stage: c.pipelineStage ?? null,
      format:         c.format ?? null,
      yt_length:      c.ytLength ?? null,
      tag:            c.tag ?? null,
      due_date:       c.dueDate ?? null,
      status:         c.status,
      link:           c.link ?? null,
      notes:          c.notes ?? null,
      notion_url:     c.url,
      updated_at:     new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('content_items').upsert(rows, { onConflict: 'notion_id' }).select('id')
    if (error) return { synced: 0, total: items.length, error: error.message }
    return { synced: data?.length ?? rows.length, total: items.length }
  } catch (e) {
    return { synced: 0, total: 0, error: String(e) }
  }
}

async function syncProjects(): Promise<SyncResult> {
  try {
    const items = await getAllProjectsForSync()
    if (items.length === 0) return { synced: 0, total: 0 }
    const rows = items.map(p => ({
      notion_id:   p.id,
      title:       p.title,
      status:      p.status,
      priority:    p.priority ?? null,
      deadline:    p.deadline ?? null,
      goal:        p.goal ?? null,
      next_action: p.nextAction ?? null,
      notes:       p.notes ?? null,
      notion_url:  p.url,
      updated_at:  new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('projects').upsert(rows, { onConflict: 'notion_id' }).select('id')
    if (error) return { synced: 0, total: items.length, error: error.message }
    return { synced: data?.length ?? rows.length, total: items.length }
  } catch (e) {
    return { synced: 0, total: 0, error: String(e) }
  }
}

export async function POST() {
  // Run all syncs independently — one failure does NOT abort the others
  const [tasks, vault, content, projects] = await Promise.all([
    syncTasks(),
    syncVault(),
    syncContent(),
    syncProjects(),
  ])

  const hasError = [tasks, vault, content, projects].some(r => r.error)

  return NextResponse.json({
    ok: !hasError || tasks.synced > 0, // success if at least tasks synced
    synced: {
      tasks:    tasks.synced,
      vault:    vault.synced,
      content:  content.synced,
      projects: projects.synced,
    },
    total: {
      tasks:    tasks.total,
      vault:    vault.total,
      content:  content.total,
      projects: projects.total,
    },
    errors: {
      ...(tasks.error    ? { tasks:    tasks.error    } : {}),
      ...(vault.error    ? { vault:    vault.error    } : {}),
      ...(content.error  ? { content:  content.error  } : {}),
      ...(projects.error ? { projects: projects.error } : {}),
    },
  })
}

// GET: stats across all synced tables
export async function GET() {
  try {
    const [tasks, vault, content, projects] = await Promise.all([
      supabase.from('master_tasks').select('id', { count: 'exact', head: true }).eq('archived', false),
      supabase.from('vault_items').select('id', { count: 'exact', head: true }).eq('archived', false),
      supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('archived', false),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('archived', false),
    ])
    return NextResponse.json({
      tasks:    tasks.count ?? 0,
      vault:    vault.count ?? 0,
      content:  content.count ?? 0,
      projects: projects.count ?? 0,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
