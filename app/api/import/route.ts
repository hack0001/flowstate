import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// RFC 4180-compliant CSV parser (handles quoted fields with commas and newlines)
function parseCSV(content: string): Record<string, string>[] {
  const result: Record<string, string>[] = []
  let pos = 0
  const len = content.length

  function parseField(): string {
    if (pos >= len || content[pos] === '\r' || content[pos] === '\n') return ''
    if (content[pos] === '"') {
      pos++ // skip opening quote
      let field = ''
      while (pos < len) {
        if (content[pos] === '"') {
          if (pos + 1 < len && content[pos + 1] === '"') {
            field += '"'; pos += 2
          } else {
            pos++; break
          }
        } else {
          field += content[pos]; pos++
        }
      }
      return field
    } else {
      let field = ''
      while (pos < len && content[pos] !== ',' && content[pos] !== '\r' && content[pos] !== '\n') {
        field += content[pos]; pos++
      }
      return field
    }
  }

  function parseRow(): string[] | null {
    while (pos < len && (content[pos] === '\r' || content[pos] === '\n')) pos++
    if (pos >= len) return null
    const fields: string[] = []
    while (true) {
      fields.push(parseField())
      if (pos >= len || content[pos] === '\r' || content[pos] === '\n') {
        if (pos < len && content[pos] === '\r') pos++
        if (pos < len && content[pos] === '\n') pos++
        break
      }
      if (content[pos] === ',') pos++
    }
    return fields
  }

  const headers = parseRow()
  if (!headers || headers.length === 0) return []

  while (pos < len) {
    const fields = parseRow()
    if (fields === null) break
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (fields[i] ?? '').trim() })
    result.push(row)
  }
  return result
}

function toDate(s: string): string | null {
  if (!s) return null
  const d = s.trim().replace('Z', '').split(' ')[0].split('T')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function toBool(s: string): boolean {
  return s?.toLowerCase() === 'true'
}

function orNull(s: string): string | null {
  return s && s.trim() ? s.trim() : null
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const out: Record<string, { imported: number; error?: string }> = {}

  // ── Tasks ───────────────────────────────────────────────────────────────────
  try {
    const csv = readFileSync(join(process.cwd(), 'notion-export', 'tasks.csv'), 'utf-8')
    const rows = parseCSV(csv)

    const tasks = rows
      .filter(r => r.notion_id && r.title)
      .map(r => ({
        notion_id:       r.notion_id,
        title:           r.title,
        status:          orNull(r.status) ?? 'Not started',
        due_date:        toDate(r.due_date),
        task_type:       orNull(r.task_type),
        urgency:         orNull(r.urgency),
        importance:      orNull(r.importance),
        time_commitment: orNull(r.time_commitment),
        is_frog:         toBool(r.is_frog),
        priority:        orNull(r.priority),
        notion_url:      orNull(r.notion_url),
        archived:        toBool(r.archived),
      }))

    // Upsert in batches of 50 to stay under payload limits
    const BATCH = 50
    let totalErr: string | undefined
    for (let i = 0; i < tasks.length; i += BATCH) {
      const { error } = await supabase
        .from('master_tasks')
        .upsert(tasks.slice(i, i + BATCH), { onConflict: 'notion_id' })
      if (error && !totalErr) totalErr = error.message
    }
    out.tasks = { imported: tasks.length, error: totalErr }
  } catch (e) {
    out.tasks = { imported: 0, error: String(e) }
  }

  // ── Vault items ─────────────────────────────────────────────────────────────
  try {
    const csv = readFileSync(join(process.cwd(), 'notion-export', 'vault_items.csv'), 'utf-8')
    const rows = parseCSV(csv)

    const items = rows
      .filter(r => r.notion_id && r.title)
      .map(r => ({
        notion_id:    r.notion_id,
        title:        r.title,
        category:     orNull(r.category),
        author_source:orNull(r.author_source),
        link:         orNull(r.link),
        key_takeaway: orNull(r.key_takeaway),
        notes:        orNull(r.notes),
        platform:     orNull(r.platform),
        tag:          orNull(r.tag),
        status:       orNull(r.status) ?? 'Not started',
        notion_url:   orNull(r.notion_url),
        archived:     toBool(r.archived),
      }))

    const BATCH = 50
    let totalErr: string | undefined
    for (let i = 0; i < items.length; i += BATCH) {
      const { error } = await supabase
        .from('vault_items')
        .upsert(items.slice(i, i + BATCH), { onConflict: 'notion_id' })
      if (error && !totalErr) totalErr = error.message
    }
    out.vault = { imported: items.length, error: totalErr }
  } catch (e) {
    out.vault = { imported: 0, error: String(e) }
  }

  return NextResponse.json(out)
}
