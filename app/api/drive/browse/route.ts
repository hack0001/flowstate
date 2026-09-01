import { NextRequest, NextResponse } from 'next/server'
import { listFolderChildren } from '@/lib/googleDrive'

// Lists the immediate children of a Drive folder — powers the Brand Assets
// browser in the Scripting/Storyboard stages. folderId always comes from
// drive_folder_map or a folder the user has already navigated into, and the
// service account can only ever see SOUND MONEY HQ's own tree regardless of
// what's passed here (see lib/googleDrive.ts header comment).

export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get('folderId')
  if (!folderId) return NextResponse.json({ error: 'Missing folderId.' }, { status: 400 })
  try {
    const files = await listFolderChildren(folderId)
    return NextResponse.json({ files })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
