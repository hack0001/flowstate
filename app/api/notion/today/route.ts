import { NextResponse } from 'next/server'
import { getTasksForDate, getEventsForDate } from '@/lib/notion'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  try {
    const [tasks, events] = await Promise.all([
      getTasksForDate(date),
      getEventsForDate(date),
    ])
    return NextResponse.json({ tasks, events, date })
  } catch (e) {
    return NextResponse.json({ error: String(e), tasks: [], events: [] }, { status: 200 })
  }
}
