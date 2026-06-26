import { NextResponse } from 'next/server'
import { getContentForMonth } from '@/lib/notion'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  try {
    const content = await getContentForMonth(year, month)
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({ error: String(e), content: [] }, { status: 200 })
  }
}
