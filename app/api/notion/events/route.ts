import { NextResponse } from 'next/server'
import { createEvent, updateEvent, deleteEvent } from '@/lib/notion'

export async function POST(request: Request) {
  try {
    const { title, date, category } = await request.json()
    const event = await createEvent(title, date, category)
    return NextResponse.json(event)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, title, date, category } = await request.json()
    await updateEvent(id, { title, date, category })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteEvent(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
