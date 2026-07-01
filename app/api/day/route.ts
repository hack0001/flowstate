import { NextResponse } from 'next/server'
import { getTasksForDate, getHabitsForDate, getIntention, getStreakInfo } from '@/lib/supabase-tasks'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  try {
    const [allTasks, intention, streak] = await Promise.all([
      getTasksForDate(date),
      getIntention(date),
      getStreakInfo(date),
    ])
    // habits are Habit urgency tasks; everything else is a task
    const habits = allTasks.filter(t => t.urgency === 'Habit')
    const tasks  = allTasks.filter(t => t.urgency !== 'Habit')
    return NextResponse.json({ tasks, habits, intention, streak, date })
  } catch (e) {
    return NextResponse.json(
      { error: String(e), tasks: [], habits: [], intention: null, streak: { current: 0, longest: 0, completedToday: false }, date },
      { status: 200 }
    )
  }
}
