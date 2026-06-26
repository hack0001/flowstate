// Server-side Notion API client
// NOTION_TOKEN must be set in Vercel env vars
// Share each DB with your integration: open DB in Notion -> ... -> Connections

const NOTION_API = 'https://api.notion.com/v1'

export const NOTION_DB = {
  // "master" database on Dashboard — single DB for tasks + content
  // task/vault="task" = tasks, task/vault="vault" + YT Pipeline Stage = content
  tasks:   '35bed686-b47d-80ac-bbd6-000b3217e9d7',
  events:  '35bed686-b47d-80ac-bbd6-000b3217e9d7', // same master DB (no separate events DB)
  content: '35bed686-b47d-80ac-bbd6-000b3217e9d7', // same master DB
}

export const NOTION_LINKS = {
  daily:   'https://app.notion.com/p/351ed686b47d804caaeef2ab4effa270', // Master Tasks page
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
  status: string          // 'Not started' | 'In progress' | 'Done'
  dueDate: string | null
  priority: string | null // 'Low' | 'Medium' | 'High'
  taskType: string | null // 'Flow' | 'Recurring' | 'Quick Task' | 'Admin' | 'Personal'
  urgency: string | null  // 'Urgent' | 'Habit' | 'Non Urgent'
  importance: string | null // 'Moved the Needle' | 'Non Important' | 'Important'
  timeCommitment: string | null // '60 + mins' | '30 - 60 mins' | '15 - 30 mins' | '< 15mins'
  isFrog: boolean         // the frog checkbox = top priority task of day
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

function parseTask(p: NotionPage): NotionTask {
  return {
    id: p.id, url: p.url, type: 'task' as const,
    title: titleText(p.properties['Name']),
    status: p.properties['Status']?.status?.name ?? 'Not started',
    dueDate: p.properties['Due Date']?.date?.start ?? null,
    priority: p.properties['Priority ']?.status?.name ?? null,
    taskType: p.properties['Type']?.select?.name ?? null,
    urgency: p.properties['Urgency']?.select?.name ?? null,
    importance: p.properties['Importance']?.select?.name ?? null,
    timeCommitment: p.properties['Time Commitment']?.select?.name ?? null,
    isFrog: p.properties['🐸']?.checkbox ?? false,
  }
}

// Tasks for a specific date (filters task/vault=task AND due date)
export async function getTasksForDate(date: string): Promise<NotionTask[]> {
  const pages = await queryDB(NOTION_DB.tasks, {
    and: [
      { property: 'task/vault', select: { equals: 'task' } },
      { property: 'Due Date', date: { equals: date } },
    ]
  })
  return pages.map(parseTask)
}

// Active tasks for today (not done, task/vault=task)
export async function getActiveTasks(): Promise<NotionTask[]> {
  const pages = await queryDB(NOTION_DB.tasks, {
    and: [
      { property: 'task/vault', select: { equals: 'task' } },
      { property: 'Status', status: { does_not_equal: 'Done' } },
    ]
  })
  return pages.map(parseTask)
}

export async function createTask(title: string, dueDate: string): Promise<NotionTask> {
  const page = await createPage(NOTION_DB.tasks, {
    'Name': titleProp(title),
    'Due Date': { date: { start: dueDate } },
    'Status': { status: { name: 'Not started' } },
    'task/vault': { select: { name: 'task' } },
  })
  return {
    id: page.id, url: page.url, type: 'task' as const,
    title, status: 'Not started', dueDate,
    priority: null, taskType: null, urgency: null,
    importance: null, timeCommitment: null, isFrog: false,
  }
}

export async function updateTask(pageId: string, data: { title?: string; status?: string; dueDate?: string; isFrog?: boolean }): Promise<void> {
  const props: Record<string, unknown> = {}
  if (data.title !== undefined) props['Name'] = titleProp(data.title)
  if (data.status !== undefined) props['Status'] = { status: { name: data.status } }
  if (data.dueDate !== undefined) props['Due Date'] = { date: { start: data.dueDate } }
  if (data.isFrog !== undefined) props['🐸'] = { checkbox: data.isFrog }
  await updatePage(pageId, props)
}

export async function deleteTask(pageId: string): Promise<void> {
  await archivePage(pageId)
}

// ---- Events ----
// No separate events DB — events are tasks with Type set, shown by due date
// We return tasks-as-events for any task on the date that isn't in the master tasks filter

export async function getEventsForDate(date: string): Promise<NotionEvent[]> {
  // No separate events database; return empty (calendar shows tasks instead)
  return []
}

export async function creat