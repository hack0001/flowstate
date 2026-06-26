import { NextResponse } from 'next/server'
import { NOTION_DB } from '@/lib/notion'

const NOTION_API = 'https://api.notion.com/v1'

async function testDB(name: string, id: string, token: string) {
  try {
    const res = await fetch(`${NOTION_API}/databases/${id}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 1 }),
      cache: 'no-store',
    })
    const body = await res.json()
    if (res.ok) {
      return { name, id, status: 'OK', rows: body.results?.length ?? 0, total: body.has_more ? '1+' : body.results?.length }
    }
    return { name, id, status: 'ERROR', code: res.status, message: body.message ?? body.code }
  } catch (e) {
    return { name, id, status: 'FETCH_ERROR', message: String(e) }
  }
}

export async function GET() {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    return NextResponse.json({
      token: 'MISSING',
      message: 'NOTION_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel → your project → Settings → Environment Variables → add NOTION_TOKEN = secret_xxx',
    })
  }

  // Test token is valid
  const meRes = await fetch(`${NOTION_API}/users/me`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
    cache: 'no-store',
  })
  const me = await meRes.json()
  if (!meRes.ok) {
    return NextResponse.json({
      token: 'INVALID',
      message: 'Token was found but Notion rejected it.',
      notionError: me.message,
      fix: 'Go to notion.so/my-integrations → check your integration → copy the Internal Integration Secret again → update NOTION_TOKEN in Vercel.',
    })
  }

  const [tasks, events, content] = await Promise.all([
    testDB('tasks', NOTION_DB.tasks, token),
    testDB('events', NOTION_DB.events, token),
    testDB('content', NOTION_DB.content, token),
  ])

  const allOk = [tasks, events, content].every(d => d.status === 'OK')

  return NextResponse.json({
    token: 'VALID',
    integration: me.name ?? me.bot?.owner?.user?.name ?? 'Connected',
    databases: { tasks, events, content },
    allOk,
    fix: allOk ? null : 'For any database showing ERROR: open that database in Notion → click ... top right → Connections → add your integration.',
  })
}
