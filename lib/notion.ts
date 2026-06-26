// Server-side Notion API client
// Add NOTION_TOKEN to Vercel env vars:
//   1. Go to notion.so/my-integrations -> New integration
//   2. Copy the token
//   3. Share each database below with the integration (open DB in Notion -> ... -> Connections)
//   4. Add NOTION_TOKEN=secret_xxx to Vercel project settings

const NOTION_API = 'https://api.notion.com/v1'

// Database IDs (from your Notion workspace)
export const NOTION_DB = {
  tasks:   '18aed686-b47d-8199-b3fc-000b35ee161d',
  events:  '18aed686-b47d-8180-acdf-000bddf631f2',
  content: 'afd3c664-639c-471f-9911-718b3d48d341',
}

// Links to open in Notion
export const NOTION_LINKS = {
  daily:   'https://app.notion.com/p/18aed686b47d817dbf68ee02b891bfe6',
  content: 'https://app.notion.com/p/0d954d1bafee4c48b365c65bc873bace',
}

type NotionProp = {
  title?: { plain_text: string }[]
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
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN not configured')
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filter: filter ?? {}, page_size: 100 }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Notion ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.results as NotionPage[]
}

export type NotionTask = {
  id: string; url: string; type: 'task'
  title: string; priority: string; focus: string | null
  done: string; timeCommitment: string | null; category: string | null
}

export type NotionEvent = {
  id: string; url: string; type: 'event'
  title: string; date: string; category: string | null
}

export type NotionContent = {
  id: string; url: string; type: 'content'
  title: string; date: string | null; status: string; format: string | null
}

function titleText(p?: NotionProp) { return p?.title?.[0]?.plain_text ?? 'Untitled' }

export async function getTasksForDate(date: string): Promise<NotionTask[]> {
  const pages = await queryDB(NOTION_DB.tasks, {
    property: 'Do Date', date: { equals: date }
  })
  return pages.map(p => ({
    id: p.id, url: p.url, type: 'task' as const,
    title: titleText(p.properties['Task']),
    priority: p.properties['Priority']?.select?.name ?? 'Medium',
    focus: p.properties['Focus']?.select?.name ?? null,
    done: p.properties['Done']?.status?.name ?? 'Not started',
    timeCommitment: p.properties['Time Commitment']?.select?.name ?? null,
    category: p.properties['Category']?.select?.name ?? null,
  }))
}

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

export async function getContentForMonth(year: number, month: number): Promise<NotionContent[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const days = new Date(year, month, 0).getDate()
  const end = `${year}-${pad(month)}-${days}`
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
