import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createProjectFolder } from '@/lib/googleDrive'

// Creates a fresh, title-named project folder under 07_PROJECTS/LONGFORM or
// /SHORTS (replicating the TEMPLATE_TO_COPY_001_XXX subfolder skeleton), and
// persists the resulting link onto the content item in one round trip.
//
// Runs server-side with its own Supabase client (not lib/supabase.ts, which
// is client-safe but has no reason to import next/server) — same anon key +
// allow-all RLS policy as the rest of the app, just instantiated locally so
// this route has no client-component import chain.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { contentItemId, title, format } = body as { contentItemId?: string; title?: string; format?: string | null }
    if (!contentItemId || !title) {
      return NextResponse.json({ error: 'Missing contentItemId or title.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    )
    const { data: map, error: mapErr } = await supabase
      .from('drive_folder_map')
      .select('projects_longform_folder_id,projects_shorts_folder_id,project_template_folder_id')
      .eq('id', 1)
      .maybeSingle()
    if (mapErr) return NextResponse.json({ error: 'Setup needed: run supabase/migrations/040_drive_integration.sql first.' }, { status: 400 })
    if (!map?.project_template_folder_id) return NextResponse.json({ error: 'Drive folder map is not configured.' }, { status: 400 })

    const parentId = format === 'Short' ? map.projects_shorts_folder_id : map.projects_longform_folder_id
    if (!parentId) return NextResponse.json({ error: 'Missing LONGFORM/SHORTS project folder id in drive_folder_map.' }, { status: 400 })

    const { id, url } = await createProjectFolder({ title, parentId, templateId: map.project_template_folder_id })

    const { error: updateErr } = await supabase
      .from('content_items')
      .update({ drive_folder_id: id, drive_url: url })
      .eq('id', contentItemId)
    if (updateErr) return NextResponse.json({ error: 'Folder created but failed to save link: ' + updateErr.message }, { status: 500 })

    return NextResponse.json({ id, url })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
