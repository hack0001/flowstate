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
      return { name, id, status: 'OK', rows: body.results?.length ?? 0, has_more: body.has_more }
    }
    return { name, id, status: 'ERROR', code: res.status, message: body.message ?? body.code }
  } catch (e) {
    return { name, id, status: 'FETCH_ERROR', message: String(e) }
  }
}

type NotionSamplePage = {
  id: string
  properties: Record<string, {
    title?: Array<{ plain_text: string }>
    date?: { start: string }
    select?: { name: string }
  }>
}

async function testFilter(label: string, dbId: string, token: string, filter: object) {
  try {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, page_size: 5 }),
      cache: 'no-store',
    })
    const body = await res.json()
    if (res.ok) {
      return {
        label,
        status: 'OK',
        count: body.results?.length ?? 0,
        sample: body.results?.slice(0, 2).map((p: NotionSamplePage) => ({
          id: p.id,
          name: p.properties['Name']?.title?.[0]?.plain_text ?? '(untitled)',
          dueDate: p.properties['Due Date']?.date?.start ?? null,
          taskVault: p.properties['task/vault']?.select?.name ?? null,
        })),
      }
    }
    return { label, status: 'FILTER_ERROR', code: res.status, message: body.message ?? body.code }
  } catch (e) {
    return { label, status: 'FETCH_ERROR', message: String(e) }
  }
}

export async function GET() {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    return NextResponse.json({
      token: 'MISSING',
      message: 'NOTION_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel -> your project -> Settings -> Environment Variables -> add NOTION_TOKEN',
    })
  }

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
      fix: 'Go to notion.so/my-integrations -> copy Internal Integration Secret -> update NOTION_TOKEN in Vercel.',
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const master = await testDB('master DB', NOTION_DB.tasks, token)

  const [tasksFilter, eventsFilter, contentFilter] = await Promise.all([
    testFilter('tasks (task/vault=task)', NOTION_DB.tasks, token, {
      and: [
        { property: 'task/vault', select: { equals: 'task' } },
        { property: 'Due Date', date: { on_or_after: today } },
      ],
    }),
    testFilter('events (task/vault=event)', NOTION_DB.events, token, {
      property: 'task/vault', select: { equals: 'event' },
    }),
    testFilter('content (YT Pipeline Stage set)', NOTION_DB.content, token, {
      property: 'YT Pipeline Stage', select: { is_not_empty: true },
    }),
  ])

  const allOk = master.status === 'OK'

  return NextResponse.json({
    token: 'VALID',
    integration: me.name ?? me.bot?.owner?.user?.name ?? 'Connected',
    today,
    databases: { master },
    filters: { tasksFilter, eventsFilter, contentFilter },
    allOk,
    fix: allOk
      ? null
      : 'Share the master DB with Toms Connection via Notion -> ... -> Connections.',
  })
}
