import { NextResponse } from 'next/server'
import { getIntention, upsertIntention, toggleLock } from '@/lib/supabase-tasks'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  try {
    const intention = await getIntention(date)
    return NextResponse.json({ intention })
  } catch (e) {
    return NextResponse.json({ error: String(e), intention: null }, { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const { date, text } = await request.json()
    const intention = await upsertIntention(date, text)
    return NextResponse.json({ intention })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { date, locked } = await request.json()
    await toggleLock(date, locked)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
