import { NextResponse } from 'next/server'
import { getStreakInfo, markRoutineComplete, unmarkRoutineComplete } from '@/lib/supabase-tasks'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  try {
    const streak = await getStreakInfo(date)
    return NextResponse.json({ streak })
  } catch (e) {
    return NextResponse.json({ error: String(e), streak: { current: 0, longest: 0, completedToday: false } }, { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const { date, complete } = await request.json()
    if (complete) {
      await markRoutineComplete(date)
    } else {
      await unmarkRoutineComplete(date)
    }
    const streak = await getStreakInfo(date)
    return NextResponse.json({ streak })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
