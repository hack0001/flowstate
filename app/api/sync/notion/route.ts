import { NextResponse } from 'next/server'
import { getAllTasksForSync } from '@/lib/notion'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    const notionTasks = await getAllTasksForSync()

    if (notionTasks.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: 'No tasks found in Notion' })
    }

    // Map Notion shape -> tasks table columns
    const rows = notionTasks.map(t => ({
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

    const { error, data } = await supabase
      .from('tasks')
      .upsert(rows, { onConflict: 'notion_id' })
      .select('id')

    if (error) throw error

    return NextResponse.json({ ok: true, synced: data?.length ?? rows.length, total: notionTasks.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET: return current tasks table stats
export async function GET() {
  try {
    const { count: total } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('archived', false)

    const { count: active } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('archived', false)
      .neq('status', 'Done')

    return NextResponse.json({ total: total ?? 0, active: active ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
