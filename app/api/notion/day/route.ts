import { NextResponse } from 'next/server'
import { getTasksForDate } from '@/lib/notion'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  try {
    const tasks = await getTasksForDate(date)
    const habits = tasks.filter(t => t.urgency === 'Habit')
    const regular = tasks.filter(t => t.urgency !== 'Habit')
    return NextResponse.json({ tasks: regular, habits, date })
  } catch (e) {
    return NextResponse.json({ error: String(e), tasks: [], habits: [], date }, { status: 200 })
  }
}
