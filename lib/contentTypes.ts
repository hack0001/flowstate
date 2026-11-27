import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { C } from '@/lib/theme'

// ── Aligned with Production SOPs + Shane Hummus Holy Trifecta ──────────────
export const PIPELINE_STAGES = [
  { key:'✅ Validated',        color:'#22c55e', bg:'rgba(34,197,94,0.08)',   tip:'Angle confirmed. One-line pitch written. Folder created.' },
  { key:'📚 Research',         color:'#8b5cf6', bg:'rgba(139,92,246,0.08)',  tip:'60-90 min deep dive. Wild stats + story arc found.' },
  { key:'🎯 Holy Trifecta',    color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  tip:'Title + Thumbnail concept + Hook decided BEFORE scripting.' },
  { key:'✍️ Script',           color:'#00d4ff', bg:'rgba(0,212,255,0.06)',   tip:'Full script written, read aloud, timed. [MEME] + [B-ROLL] tagged.' },
  { key:'🎨 Assets',           color:'#f97316', bg:'rgba(249,115,22,0.08)',  tip:'All memes, b-roll, charts gathered and organised in folders.' },
  { key:'🎙️ Voiceover',       color:'#10b981', bg:'rgba(16,185,129,0.08)',  tip:'VO recorded section-by-section. Files labelled. Re-recorded flats.' },
  { key:'✂️ Editing',          color:'#ec4899', bg:'rgba(236,72,153,0.08)', tip:'Full edit done. 2x-speed test passed. Music, SFX, captions added.' },
  { key:'🖼️ Thumbnail & SEO', color:'#f472b6', bg:'rgba(244,114,182,0.08)',tip:'Thumbnail passes 2-sec test. Title, description, tags all written.' },
  { key:'☁️ Scheduled',        color:'#00ff88', bg:'rgba(0,255,136,0.06)',   tip:'Uploaded private. End screens + cards added. Scheduled for peak time.' },
  { key:'📣 Live',             color:'#ff4466', bg:'rgba(255,68,102,0.1)',   tip:'Published. Community post done. Reddit seeded within 30 min.' },
  { key:'📊 Post-Published',   color:'#64748b', bg:'rgba(100,116,139,0.1)', tip:'Short clipped. 48hr analytics checked. CTR + retention logged.' },
]

export const IDEA_STAGE = { key:'💡 Idea', color:'#4a4a6a', bg:'rgba(74,74,106,0.12)' }
export const ALL_STAGES = [IDEA_STAGE, ...PIPELINE_STAGES]
export const STAGE_KEYS  = ALL_STAGES.map(s => s.key)

// ── Stage → SOP, by THEME (not advance-logic) ──────────────────────────────
// This is deliberately separate from lib/sops.ts's STAGE_TO_SOP /
// sopForStage(), which map a stage you're CURRENTLY sitting in to the SOP
// you work through to leave it (offset by one stage). This map is for a
// reference viewer: clicking "Research" should show the Research SOP, not
// the next one. Matched 1-for-1 against each SOP's own tagline/title in
// lib/sops.ts.
export const STAGE_SOP_ID: Record<string, string> = {
  '💡 Idea': '01',
  '✅ Validated': '01',
  '📚 Research': '02',
  '🎯 Holy Trifecta': '03',
  '✍️ Script': '04',
  '🎨 Assets': '05',
  '🎙️ Voiceover': '06',
  '✂️ Editing': '07',
  '🖼️ Thumbnail & SEO': '08',
  '☁️ Scheduled': '09',
  '📣 Live': '09',
  '📊 Post-Published': '10',
}

export const FORMATS = ['Long-form', 'Short', 'Both', 'Podcast clip']

// Which funnel role a video plays — from Dave Jeltema / Shane Hummus content-system videos:
// how-tos pull search traffic, listicles are passive top-of-funnel, case studies build
// authority, testimonials/interviews convert. Optional — leave blank if it doesn't apply.
export const VIDEO_TYPES = ['How-To', 'Listicle', 'Case Study', 'Explainer', 'Testimonial/Interview']

export type ContentItem = {
  id: string
  notion_id: string | null
  title: string
  pipeline_stage: string | null
  format: string | null
  yt_length: string | null
  tag: string | null
  due_date: string | null
  status: string
  link: string | null
  notes: string | null
  notion_url: string | null
  created_at?: string
  video_type: string | null
  unique_angle: string | null
  revenue_note: string | null
  is_active_focus: boolean
  script_url: string | null
  drive_url: string | null
  youtube_url: string | null
}

// Pull the video id out of any YouTube URL shape (watch?v=, youtu.be/, /shorts/)
export function extractYouTubeId(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export type YtStats = { views: number; likes: number; comments: number; publishedAt: string; title: string }

export type View = 'ideas' | 'pipeline' | 'list' | 'priority'

export function stageStyle(key: string | null) {
  return ALL_STAGES.find(s => s.key === key) ?? { color:C.muted, bg:'transparent' }
}

