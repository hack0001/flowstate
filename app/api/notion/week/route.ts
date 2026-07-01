import { NextResponse } from 'next/server'
import { getTasksForWeek } from '@/lib/notion'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  }
  try {
    const tasks = await getTasksForWeek(start, end)
    return NextResponse.json({ tasks })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
