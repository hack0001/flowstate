// ============================================================
// Google Drive REST API client — SOUND MONEY HQ (admin@derivativemedia.co.uk)
//
// Authenticates as the "flowstate-drive" service account, which Tom shared
// SOUND MONEY HQ with directly (Editor access). Zero external dependencies:
// signs its own JWT with Node's built-in crypto module and exchanges it for
// a short-lived OAuth access token, then talks to the Drive v3 REST API
// with plain fetch. No googleapis package needed for this small a surface.
//
// SERVER-ONLY — imports process.env.GOOGLE_DRIVE_PRIVATE_KEY, so this must
// never be imported from a client component. All access to it goes through
// app/api/drive/* routes.
//
// Because the service account is only ever shared with SOUND MONEY HQ, it
// physically cannot see anything outside that folder tree — so accepting a
// folderId from the client in the API routes below is safe by construction,
// not something that needs its own allow-list.
// ============================================================

import crypto from 'crypto'

const SCOPE = 'https://www.googleapis.com/auth/drive'
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

let cachedToken: { token: string; expiresAt: number } | null = null

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY
  if (!clientEmail || !rawKey) {
    throw new Error('Google Drive not configured — missing GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY in .env.local')
  }
  const privateKey = rawKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = { iss: clientEmail, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 }
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claims))
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey)
  const jwt = unsigned + '.' + base64url(signature)

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!res.ok) throw new Error('Google auth failed: ' + (await res.text()))
  const data = await res.json()
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.token
}

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  iconLink?: string
  thumbnailLink?: string
  modifiedTime?: string
}

export function isDriveFolder(f: { mimeType: string }) { return f.mimeType === FOLDER_MIME }

async function driveFetch(path: string, opts: RequestInit = {}) {
  const token = await getAccessToken()
  const res = await fetch('https://www.googleapis.com/drive/v3' + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token },
  })
  if (!res.ok) throw new Error('Drive API error ' + res.status + ': ' + (await res.text()))
  return res.json()
}

// Immediate children (files + folders) of a Drive folder, folders first.
export async function listFolderChildren(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,modifiedTime)')
  const data = await driveFetch(`/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=200`)
  return data.files ?? []
}

export async function createFolder(name: string, parentId: string): Promise<DriveFile> {
  return driveFetch('/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
}

// Replicates the TEMPLATE_TO_COPY_001_XXX skeleton (01_SCRIPT..08_EXPORTS) as
// a fresh, title-named folder inside 07_PROJECTS/LONGFORM or /SHORTS.
export async function createProjectFolder(opts: {
  title: string
  parentId: string    // projects_longform_folder_id or projects_shorts_folder_id
  templateId: string  // project_template_folder_id
}): Promise<{ id: string; url: string }> {
  const safeName = opts.title.trim().slice(0, 120) || 'Untitled'
  const project = await createFolder(safeName, opts.parentId)
  const templateChildren = await listFolderChildren(opts.templateId)
  const subfolders = templateChildren.filter(isDriveFolder)
  await Promise.all(subfolders.map(sf => createFolder(sf.name, project.id)))
  return { id: project.id, url: project.webViewLink ?? `https://drive.google.com/drive/folders/${project.id}` }
}
