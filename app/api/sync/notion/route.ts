import { NextResponse } from 'next/server'
import { getAllTasksForSync, getAllVaultForSync, getAllContentForSync, getAllProjectsForSync } from '@/lib/notion'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // Fetch all Notion data in parallel
    const [notionTasks, notionVault, notionContent, notionProjects] = await Promise.all([
      getAllTasksForSync(),
      getAllVaultForSync(),
      getAllContentForSync(),
      getAllProjectsForSync(),
    ])

    // ---- Upsert tasks ----
    const taskRows = notionTasks.map(t => ({
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
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .upsert(taskRows, { onConflict: 'notion_id' })
      .select('id')
    if (taskErr) throw new Error('tasks: ' + taskErr.message)

    // ---- Upsert vault items ----
    const vaultRows = notionVault.map(v => ({
      notion_id:    v.id,
      title:        v.title,
      category:     v.category ?? null,
      author_source:v.authorSource ?? null,
      link:         v.link ?? null,
      key_takeaway: v.keyTakeaway ?? null,
      notes:        v.notes ?? null,
      platform:     v.platform ?? null,
      tag:          v.tag ?? null,
      status:       v.status,
      notion_url:   v.url,
      updated_at:   new Date().toISOString(),
    }))
    const { data: vaultData, error: vaultErr } = await supabase
      .from('vault_items')
      .upsert(vaultRows, { onConflict: 'notion_id' })
      .select('id')
    if (vaultErr) throw new Error('vault_items: ' + vaultErr.message)

    // ---- Upsert content items ----
    const contentRows = notionContent.map(c => ({
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
    const { data: contentData, error: contentErr } = await supabase
      .from('content_items')
      .upsert(contentRows, { onConflict: 'notion_id' })
      .select('id')
    if (contentErr) throw new Error('content_items: ' + contentErr.message)

    // ---- Upsert projects ----
    const projectRows = notionProjects.map(p => ({
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
    const { data: projectData, error: projectErr } = await supabase
      .from('projects')
      .upsert(projectRows, { onConflict: 'notion_id' })
      .select('id')
    if (projectErr) throw new Error('projects: ' + projectErr.message)

    return NextResponse.json({
      ok: true,
      synced: {
        tasks:    taskData?.length ?? taskRows.length,
        vault:    vaultData?.length ?? vaultRows.length,
        content:  contentData?.length ?? contentRows.length,
        projects: projectData?.length ?? projectRows.length,
      },
      total: {
        tasks:    notionTasks.length,
        vault:    notionVault.length,
        content:  notionContent.length,
        projects: notionProjects.length,
      }
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET: stats across all synced tables
export async function GET() {
  try {
    const [tasks, vault, content, projects] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('archived', false),
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
