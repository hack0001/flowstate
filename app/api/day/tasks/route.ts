import { NextResponse } from 'next/server'
import { createTask, updateTask, deleteTask, rescheduleTasks } from '@/lib/supabase-tasks'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const task = await createTask(body)
    return NextResponse.json(task)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    // Batch reschedule: { moves: [{id, due_date}] }
    if (body.moves) {
      await rescheduleTasks(body.moves)
      return NextResponse.json({ ok: true })
    }
    // Single update: { id, ...patch }
    const { id, ...patch } = body
    await updateTask(id, patch)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteTask(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
