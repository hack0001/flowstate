import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export type SavedTab = {
  id: string
  url: string
  title: string
  favicon: string
  group: string
  notes: string
  addedAt: string
  status: 'active' | 'archived'
  source: 'manual' | 'bookmarklet'
}

const STORE_PATH = path.join(process.cwd(), 'data', 'tabs.json')

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readTabs(): SavedTab[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return []
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
  } catch { return [] }
}

function writeTabs(tabs: SavedTab[]) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(tabs, null, 2))
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// GET — list all tabs
export async function GET() {
  return NextResponse.json(readTabs(), { headers: CORS })
}

// POST — add a tab (from manual entry or bookmarklet)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tabs = readTabs()

    // Skip exact URL duplicates that are still active
    if (tabs.find(t => t.url === body.url && t.status === 'active')) {
      return new NextResponse(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let hostname = ''
    try { hostname = new URL(body.url).hostname } catch {}

    const tab: SavedTab = {
      id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: body.url || '',
      title: body.title || hostname || 'Untitled',
      favicon: body.favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
      group: body.group || '',
      notes: body.notes || '',
      addedAt: new Date().toISOString(),
      status: 'active',
      source: body.source || 'manual',
    }

    tabs.unshift(tab)
    writeTabs(tabs)

    return new NextResponse(JSON.stringify({ ok: true, id: tab.id }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e) {
    return new NextResponse(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
}

// PATCH — update a tab (archive/restore, change group, add notes)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    const tabs = readTabs()
    const idx = tabs.findIndex(t => t.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS })
    tabs[idx] = { ...tabs[idx], ...updates }
    writeTabs(tabs)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// DELETE — remove a tab permanently
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS })
    writeTabs(readTabs().filter(t => t.id !== id))
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// OPTIONS — CORS preflight (needed so bookmarklet can POST from any HTTPS site)
export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
