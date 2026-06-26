import { NextResponse } from 'next/server'
import { createTask, updateTask, deleteTask } from '@/lib/notion'

export async function POST(request: Request) {
  try {
    const { title, dueDate } = await request.json()
    const task = await createTask(title, dueDate)
    return NextResponse.json(task)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, title, status, dueDate } = await request.json()
    await updateTask(id, { title, status, dueDate })
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
