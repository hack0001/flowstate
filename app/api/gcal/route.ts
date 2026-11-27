import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabaseServer'
import { listEvents, upsertTaskEvent, deleteEvent } from '@/lib/googleCalendar'

// Google Calendar sync endpoints for the Calendar page.
//   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD       -> Google events in range (read-only blocks)
//   POST { action:'push',   taskId }          -> create/update the Google event for a timed task
//   POST { action:'remove', taskId }          -> delete that task's Google event (task done/deleted/untimed)
export const maxDuration = 30
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const from = req.nextUrl.searchParams.get('from') ?? '', to = req.nextUrl.searchParams.get('to') ?? ''
  if (!DATE.test(from) || !DATE.test(to)) return NextResponse.json({ error: 'Bad date range.' }, { status: 400 })
  try {
    return NextResponse.json({ events: await listEvents(from, to) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google Calendar error' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({})) as { action?: string; taskId?: string }
  if (!body.taskId) return NextResponse.json({ error: 'Missing taskId.' }, { status: 400 })
  const db = auth.supabase
  try {
    const { data: task } = await db.from('master_tasks')
      .select('id,title,due_date,start_time,duration_min,status,google_event_id').eq('id', body.taskId).maybeSingle()
    if (!task) return NextResponse.json({ ok: true, skipped: 'task not found' })

    const shouldExist = body.action === 'push' && task.status !== 'Done' && !!task.start_time && !!task.due_date
    if (shouldExist) {
      const id = await upsertTaskEvent(task)
      if (id && id !== task.google_event_id) await db.from('master_tasks').update({ google_event_id: id }).eq('id', task.id)
      return NextResponse.json({ ok: true, eventId: id })
    }
    if (task.google_event_id) {
      await deleteEvent(task.google_event_id)
      await db.from('master_tasks').update({ google_event_id: null }).eq('id', task.id)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google Calendar error' }, { status: 502 })
  }
}
