// Motion Reference Bank data layer (migration 060).
// Tables: motion_references, motion_reference_clips. Bucket: motion-references (private).
import * as tus from 'tus-js-client'
import { supabase } from '@/lib/supabase'

export const REF_BUCKET = 'motion-references'

// Fixed vocabulary so clips can be filtered and matched to scenes.
export const CLIP_TAGS = [
  'hook', 'transition', 'text', 'title card', 'data / chart', 'map', 'icons', 'counter',
  'camera move', 'colour', 'layout', 'b-roll', 'sound', 'outro',
] as const

export type MotionReference = {
  id: string
  title: string
  format: 'short' | 'long'
  source: 'upload' | 'youtube'
  storage_path: string | null
  youtube_id: string | null
  creator: string | null
  duration_s: number | null
  width: number | null
  height: number | null
  tags: string[]
  notes: string | null
  created_at: string
}

export type ReferenceClip = {
  id: string
  reference_id: string
  label: string
  start_s: number
  end_s: number
  tags: string[]
  notes: string | null
  still_path: string | null
  created_at: string
}

function explain(msg: string): string {
  if (/motion_reference|Could not find the table|does not exist/i.test(msg))
    return 'Reference Bank tables are missing. Run supabase/migrations/060_motion_references.sql in the Supabase SQL editor.'
  if (/Bucket not found/i.test(msg))
    return 'The motion-references storage bucket is missing. Run supabase/migrations/060_motion_references.sql.'
  if (/maximum allowed size|Payload too large|413/i.test(msg))
    return 'That file is over your Supabase upload limit (50 MB on the Free plan). Trim it to the part you need, or add it as a YouTube link.'
  return msg
}

/** Accepts youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID or a bare ID. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)
  return m ? m[1] : null
}

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60
  return `${m}:${r.toFixed(2).padStart(5, '0')}`
}

// ---------- references ----------

export async function listReferences() {
  const { data, error } = await supabase.from('motion_references').select('*').order('created_at', { ascending: false })
  return { references: (data as MotionReference[]) ?? [], error: error ? explain(error.message) : null }
}

export async function addReference(row: Omit<MotionReference, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('motion_references').insert(row).select().single()
  return { reference: data as MotionReference | null, error: error ? explain(error.message) : null }
}

export async function updateReference(id: string, patch: Partial<MotionReference>) {
  const { error } = await supabase.from('motion_references').update(patch).eq('id', id)
  return { error: error ? explain(error.message) : null }
}

export async function deleteReference(ref: MotionReference, clips: ReferenceClip[]) {
  const paths = [ref.storage_path, ...clips.map(c => c.still_path)].filter(Boolean) as string[]
  if (paths.length) await supabase.storage.from(REF_BUCKET).remove(paths)
  const { error } = await supabase.from('motion_references').delete().eq('id', ref.id)
  return { error: error ? explain(error.message) : null }
}

/**
 * Upload a video to the private bucket. Uses resumable (TUS) uploads in 6 MB
 * chunks, which Supabase recommends above 6 MB and which survives flaky Wi-Fi.
 */
export async function uploadReferenceFile(file: File, onProgress: (pct: number) => void): Promise<{ path: string | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { path: null, error: 'Not signed in.' }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const m = base.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)
  // Supabase recommends the direct storage hostname for large uploads.
  const endpoint = m ? `https://${m[1]}.storage.supabase.co/storage/v1/upload/resumable` : `${base}/storage/v1/upload/resumable`
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `videos/${crypto.randomUUID()}.${ext}`
  return new Promise(resolve => {
    const up = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: REF_BUCKET, objectName: path, contentType: file.type || 'video/mp4', cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: e => resolve({ path: null, error: explain(String((e as Error).message ?? e)) }),
      onProgress: (sent, total) => onProgress(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve({ path, error: null }),
    })
    up.findPreviousUploads().then(prev => { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start() })
  })
}

/** Signed URLs for private files (1 hour). Returns a path → url map. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter(Boolean)))
  if (!uniq.length) return {}
  const { data } = await supabase.storage.from(REF_BUCKET).createSignedUrls(uniq, 3600)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

// ---------- clips ----------

export async function listClips(referenceId?: string) {
  let q = supabase.from('motion_reference_clips').select('*').order('start_s', { ascending: true })
  if (referenceId) q = q.eq('reference_id', referenceId)
  const { data, error } = await q
  return { clips: (data as ReferenceClip[]) ?? [], error: error ? explain(error.message) : null }
}

export async function saveClip(row: Omit<ReferenceClip, 'id' | 'created_at' | 'still_path'> & { id?: string }, still?: Blob | null) {
  let still_path: string | undefined
  if (still) {
    const p = `stills/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(REF_BUCKET).upload(p, still, { contentType: 'image/jpeg' })
    if (!error) still_path = p
  }
  const body = { ...row, ...(still_path ? { still_path } : {}) }
  const { id, ...rest } = body
  const q = id
    ? supabase.from('motion_reference_clips').update(rest).eq('id', id).select().single()
    : supabase.from('motion_reference_clips').insert(rest).select().single()
  const { data, error } = await q
  return { clip: data as ReferenceClip | null, error: error ? explain(error.message) : null }
}

export async function deleteClip(clip: ReferenceClip) {
  if (clip.still_path) await supabase.storage.from(REF_BUCKET).remove([clip.still_path])
  const { error } = await supabase.from('motion_reference_clips').delete().eq('id', clip.id)
  return { error: error ? explain(error.message) : null }
}

/** Grab the current frame of a <video> as a JPEG (needs the video loaded with crossOrigin="anonymous"). */
export function captureStill(video: HTMLVideoElement, maxW = 640): Promise<Blob | null> {
  try {
    const scale = Math.min(1, maxW / (video.videoWidth || maxW))
    const c = document.createElement('canvas')
    c.width = Math.round((video.videoWidth || maxW) * scale)
    c.height = Math.round((video.videoHeight || maxW * 0.5625) * scale)
    c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
    return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.82))
  } catch { return Promise.resolve(null) }
}

/** Markdown brief describing clips attached to a scene — paste it to Claude to build the animation. */
export function recreationBrief(opts: {
  project: string; sceneKey: string; sceneName: string; sceneContent: unknown
  clips: (ReferenceClip & { ref?: MotionReference })[]
}): string {
  const lines = [
    `# Recreation brief — ${opts.project}`,
    ``,
    `Template: Kinetic Short · Scene ${opts.sceneKey.slice(1)} (${opts.sceneName})`,
    `Brand: SoundMoney (base #16181C, text #F0ECE2, one accent). Numbers, not adjectives. Original assets only — match the motion, not the artwork.`,
    ``,
    `## Reference clips`,
  ]
  for (const c of opts.clips) {
    const r = c.ref
    const where = r?.source === 'youtube' && r.youtube_id
      ? `https://youtu.be/${r.youtube_id}?t=${Math.floor(c.start_s)}`
      : `Reference Bank upload "${r?.title ?? ''}"`
    lines.push(
      `- **${c.label}** — ${r?.title ?? 'reference'}${r?.creator ? ` (${r.creator})` : ''}, ${fmtTime(c.start_s)}–${fmtTime(c.end_s)} (${(c.end_s - c.start_s).toFixed(2)} s)`,
      `  - Tags: ${c.tags.join(', ') || '—'}`,
      `  - Source: ${where}`,
      ...(c.notes ? [`  - What to take: ${c.notes}`] : []),
    )
  }
  lines.push(``, `## Current scene content`, '```json', JSON.stringify(opts.sceneContent, null, 2), '```')
  return lines.join('\n')
}
