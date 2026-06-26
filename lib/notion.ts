// Server-side Notion API client
// NOTION_TOKEN must be set in Vercel env vars
// Share each DB with your integration: open DB in Notion -> ... -> Connections

const NOTION_API = 'https://api.notion.com/v1'

export const NOTION_DB = {
  tasks:   '18aed686-b47d-8199-b3fc-000b35ee161d',
  events:  '18aed686-b47d-8180-acdf-000bddf631f2',
  content: 'afd3c664-639c-471f-9911-718b3d48d341',
}

export const NOTION_LINKS = {
  daily:   'https://app.notion.com/p/18aed686b47d817dbf68ee02b891bfe6',
  content: 'https://app.notion.com/p/0d954d1bafee4c48b365c65bc873bace',
}

function headers() {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN not configured')
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
}

type NotionProp = {
  title?: { plain_text: string }[]
  rich_text?: { plain_text: string }[]
  select?: { name: string }
  status?: { name: string }
  date?: { start: string }
  checkbox?: boolean
  url?: string
}

type NotionPage = {
  id: string
  url: string
  properties: Record<string, NotionProp>
}

async function queryDB(dbId: string, filter?: object): Promise<NotionPage[]> {
  const body: Record<string, unknown> = { page_size: 100 }
  if (filter) body.filter = filter
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.results as NotionPage[]
}

async function createPage(dbId: string, properties: object): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`)
  return res.json()
}

async function updatePage(pageId: string, properties: object): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`)
}

async function archivePage(pageId: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ archived: true }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`)
}

function titleText(p?: NotionProp) { return p?.title?.[0]?.plain_text ?? 'Untitled' }
function titleProp(text: string) { return { title: [{ text: { content: text } }] } }

// ---- Types ----

export type NotionTask = {
  id: string; url: string; type: 'task'
  title: string
  status: string  // 'Not done' | 'Missed' | 'Done'
  dueDate: string | null
}

export type NotionEvent = {
  id: string; url: string; type: 'event'
  title: string; date: string; category: string | null
}

export type NotionContent = {
  id: string; url: string; type: 'content'
  title: string; date: string | null; status: string; format: string | null
}

// ---- Tasks ----

export async function getTasksForDate(date: string): Promise<NotionTask[]> {
  const pages = await queryDB(NOTION_DB.tasks, {
    property: 'Due date', date: { equals: date }
  })
  return pages.map(p => ({
    id: p.id, url: p.url, type: 'task' as const,
    title: titleText(p.properties['Name']),
    status: p.properties['Status']?.status?.name ?? 'Not done',
    dueDate: p.properties['Due date']?.date?.start ?? null,
  }))
}

export async function createTask(title: string, dueDate: string): Promise<NotionTask> {
  const page = await createPage(NOTION_DB.tasks, {
    'Name': titleProp(title),
    'Due date': { date: { start: dueDate } },
    'Status': { status: { name: 'Not done' } },
  })
  return {
    id: page.id, url: page.url, type: 'task' as const,
    title, status: 'Not done', dueDate,
  }
}

export async function updateTask(pageId: string, data: { title?: string; status?: string; dueDate?: string }): Promise<void> {
  const props: Record<string, unknown> = {}
  if (data.title !== undefined) props['Name'] = titleProp(data.title)
  if (data.status !== undefined) props['Status'] = { status: { name: data.status } }
  if (data.dueDate !== undefined) props['Due date'] = { date: { start: data.dueDate } }
  await updatePage(pageId, props)
}

export async function deleteTask(pageId: string): Promise<void> {
  await archivePage(pageId)
}

// ---- Events ----

export async function getEventsForDate(date: string): Promise<NotionEvent[]> {
  const pages = await queryDB(NOTION_DB.events, {
    property: 'Date', date: { equals: date }
  })
  return pages.map(p => ({
    id: p.id, url: p.url, type: 'event' as const,
    title: titleText(p.properties['Name']),
    date: p.properties['Date']?.date?.start ?? date,
    category: p.properties['Category']?.select?.name ?? null,
  }))
}

export async function createEvent(title: string, date: string, category?: string): Promise<NotionEvent> {
  const props: Record<string, unknown> = {
    'Name': titleProp(title),
    'Date': { date: { start: date } },
  }
  if (category) props['Category'] = { select: { name: category } }
  const page = await createPage(NOTION_DB.events, props)
  return { id: page.id, url: page.url, type: 'event' as const, title, date, category: category ?? null }
}

export async function updateEvent(pageId: string, data: { title?: string; date?: string; category?: string }): Promise<void> {
  const props: Record<string, unknown> = {}
  if (data.title !== undefined) props['Name'] = titleProp(data.title)
  if (data.date !== undefined) props['Date'] = { date: { start: data.date } }
  if (data.category !== undefined) props['Category'] = { select: { name: data.category } }
  await updatePage(pageId, props)
}

export async function deleteEvent(pageId: string): Promise<void> {
  await archivePage(pageId)
}

// ---- Content (read-only) ----

export async function getContentForMonth(year: number, month: number): Promise<NotionContent[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const days = new Date(year, month, 0).getDate()
  const end = `${year}-${pad(month)}-${pad(days)}`
  const pages = await queryDB(NOTION_DB.content, {
    and: [
      { property: 'Publish Date', date: { on_or_after: start } },
      { property: 'Publish Date', date: { on_or_before: end } },
    ]
  })
  return pages.map(p => ({
    id: p.id, url: p.url, type: 'content' as const,
    title: titleText(p.properties['Video Title']),
    date: p.properties['Publish Date']?.date?.start ?? null,
    status: p.properties['Status']?.select?.name ?? 'Idea',
    format: p.properties['Format']?.select?.name ?? null,
  }))
}
