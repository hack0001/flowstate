'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { ContentItem, YtStats, stageStyle } from '@/lib/contentTypes'
import { AUTO_DRAFT_STAGES } from '@/lib/contentIdeas'

// ── Focus pin star ──────────────────────────────────────────────────────────
// Pins up to `max` items as the Home page's "active focus" videos/shorts —
// max is Tom's own setting now (content_focus_settings, default 2), not a
// hardcoded cap. See toggleFocus in the main page component below.
export function FocusStar({ active, atCap, max, onToggle }: { active:boolean; atCap:boolean; max:number; onToggle:()=>void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      disabled={!active && atCap}
      title={active ? 'Unpin from Home focus' : atCap ? `Already ${max} pinned — unpin one first, or raise the limit above the board` : 'Pin as active focus on Home'}
      style={{
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        width:'1.375rem', height:'1.375rem', borderRadius:'0.4rem',
        background: active ? 'rgba(255,184,0,0.14)' : 'transparent',
        border:'1px solid '+(active ? 'rgba(255,184,0,0.4)' : C.border),
        color: active ? C.amber : C.muted,
        cursor: (!active && atCap) ? 'not-allowed' : 'pointer',
        opacity: (!active && atCap) ? 0.4 : 1,
        padding:0,
      }}>
      <Star size={11} fill={active ? 'currentColor' : 'none'}/>
    </button>
  )
}

// ── Pipeline card ───────────────────────────────────────────────────────────
// Deliberately slim: attributes, links, stats, and a small action row. All
// per-stage work — the SOP checklist, Consult Claude, the stage note, Yap
// Session and Storyboard — lives one click away in the Focus Session
// (Start Focus Session below), not inline here. Cramming all of that into
// every card in the Kanban made the board unreadable; the Focus Session is
// already built to hold exactly this per-stage detail one item at a time.
export function PipelineCard({ item, stats, onMove, onSaveRevenue, onToggleFocus, focusAtCap, focusMax, onShowDetail }: { item:ContentItem; stats?: YtStats; onMove:()=>void; onSaveRevenue:(note:string)=>void; onToggleFocus:()=>void; focusAtCap:boolean; focusMax:number; onShowDetail:()=>void }) {
  const router = useRouter()
  const s = stageStyle(item.pipeline_stage)
  const [revenue, setRevenue] = useState(item.revenue_note ?? '')
  const isPostPublished = item.pipeline_stage === '📊 Post-Published'
  const sop = sopForStage(item.pipeline_stage, item.format)

  // ── One-click production pack ─────────────────────────────────────────────
  // Runs the whole AI-draftable chain (Research → Trifecta → Script → Assets
  // → Thumbnail & SEO) in one go, each stage building on the ones before it.
  // Stages that already have a saved note are kept and used as context, never
  // overwritten — so re-running after edits only fills what's still empty.
  // The drafts land in each stage's note (and the focus session), leaving the
  // creator to review, rewrite in their own voice, record and edit.
  const [autoStage, setAutoStage] = useState<string | null>(null)
  const [autoDone, setAutoDone] = useState<string[]>([])
  const [autoMsg, setAutoMsg] = useState<string | null>(null)

  async function autoDraftAll() {
    setAutoMsg(null)
    setAutoDone([])
    const prior: { title: string; output: string }[] = []
    const stagesToRunIds = productionSopIdsFor(item.format, AUTO_DRAFT_STAGES.map(s => s.sopId))
    const stagesToRun = AUTO_DRAFT_STAGES.filter(s => stagesToRunIds.includes(s.sopId))
    try {
      for (const { sopId, label } of stagesToRun) {
        const stageSop = SOPS.find(sp => sp.id === sopId)
        if (!stageSop) continue
        setAutoStage(label)
        const { output: existing } = await getStageNote(item.id, sopId)
        if (existing?.trim()) {
          prior.push({ title: stageSop.title, output: existing })
          setAutoDone(d => [...d, label + ' ✓ (kept your version)'])
          continue
        }
        const { systemPrompt, userPrompt } = buildStageDraftPrompt(item, stageSop, { priorStages: prior })
        const res = await fetch('/api/content/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Research gets live web search for real stats/sources; the rest
          // build on it. Sonnet for quality — this chain is the video.
          body: JSON.stringify({ systemPrompt, userPrompt, model: 'claude-sonnet-5', webSearch: sopId === '02' }),
        })
        const data = await res.json()
        if (data?.error) { setAutoMsg(`Stopped at ${label}: ` + JSON.stringify(data.error)); return }
        const raw = (data?.content ?? [])
          .filter((b: { type: string; text?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text ?? '')
          .join('\n').trim()
        if (!raw) { setAutoMsg(`Stopped at ${label}: empty response.`); return }
        const { error } = await saveStageNote(item.id, sopId, raw)
        if (error) { setAutoMsg(`Stopped at ${label}: ` + error); return }
        prior.push({ title: stageSop.title, output: raw })
        setAutoDone(d => [...d, label + ' ✓'])
      }
      setAutoMsg('Production pack ready — open each stage, edit into your voice, tick the checklist, then record.')
    } catch (e) {
      setAutoMsg('Auto-draft failed: ' + String(e))
    } finally {
      setAutoStage(null)
    }
  }

  return (
    <div style={{ background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.875rem', padding:'0.75rem', marginBottom:'0.4rem' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', marginBottom:'0.4rem' }}>
        <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, lineHeight:1.35, flex:1 }}>{item.title}</p>
        <FocusStar active={item.is_active_focus} atCap={focusAtCap} max={focusMax} onToggle={onToggleFocus}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap' as const, marginBottom:'0.4rem' }}>
        {item.format && <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.format}</span>}
        {item.video_type && <span style={{ fontSize:'0.6rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.video_type}</span>}
        {item.tag && <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>}
        {item.script_url && <a href={item.script_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#128221; Script</a>}
        {item.drive_url && <a href={item.drive_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#128193; Assets</a>}
        {item.youtube_url && <a href={item.youtube_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.red, background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#9654; Watch</a>}
      </div>
      {stats && (
        <p style={{ fontSize:'0.66rem', color:C.sec, margin:'0 0 0.4rem', fontWeight:600 }}>
          &#128200; {stats.views.toLocaleString()} views &middot; {stats.likes.toLocaleString()} likes &middot; {stats.comments.toLocaleString()} comments
        </p>
      )}
      {item.unique_angle && <p style={{ fontSize:'0.65rem', color:C.purple, margin:'0 0 0.3rem', lineHeight:1.4 }}>&#9889; {item.unique_angle.slice(0,90)}{item.unique_angle.length>90?'…':''}</p>}
      {item.notes && <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.45, fontStyle:'italic' }}>{item.notes.slice(0,80)}{item.notes.length>80?'…':''}</p>}
      {isPostPublished && (
        <div style={{ marginBottom:'0.4rem' }}>
          <label style={{ display:'block', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, marginBottom:'0.2rem' }}>Revenue attribution</label>
          <input
            value={revenue} onChange={e => setRevenue(e.target.value)} onBlur={() => onSaveRevenue(revenue)}
            placeholder="e.g. $210 AdSense in 30d, or link clicks from UTM"
            style={{ width:'100%', padding:'0.35rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.68rem', outline:'none', boxSizing:'border-box' as const }}
          />
        </div>
      )}
      <div style={{ display:'flex', gap:'0.3rem' }}>
        <button onClick={onShowDetail} title="Full history — attributes, every stage note, links" style={{ padding:'0.3rem 0.5rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
          <FileText size={10}/>
        </button>
        <button onClick={onMove} style={{ flex:1, padding:'0.3rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
          Move stage <ChevronRight size={10}/>
        </button>
        {!isPostPublished && (
          <button
            onClick={autoDraftAll} disabled={!!autoStage}
            title="Draft the full production pack — Research, Trifecta, Script, Assets, Thumbnail & SEO — each stage building on the last. Stages you've already written are kept."
            style={{ padding:'0.3rem 0.5rem', background: autoStage ? C.surface : 'rgba(0,255,136,0.08)', border:'1px solid '+(autoStage ? C.border : 'rgba(0,255,136,0.3)'), borderRadius:'0.5rem', color: autoStage ? C.muted : C.green, cursor: autoStage ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.65rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
            <Zap size={10}/>{autoStage ? `Drafting ${autoStage}…` : 'Produce'}
          </button>
        )}
      </div>
      {sop && !isPostPublished && (
        <button
          onClick={() => router.push('/content-focus?item=' + item.id)}
          title="Open the SOP checklist, Consult Claude, Yap Session and Storyboard for this stage in a focused session"
          style={{ width:'100%', marginTop:'0.3rem', padding:'0.5rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.5rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem' }}>
          <Zap size={12}/>Start Focus Session
        </button>
      )}
      {(autoDone.length > 0 || autoMsg) && (
        <div style={{ marginTop:'0.4rem', padding:'0.4rem 0.5rem', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'0.5rem' }}>
          {autoDone.map((d, i) => <p key={i} style={{ fontSize:'0.62rem', color:C.sec, margin:0, lineHeight:1.5 }}>{d}</p>)}
          {autoMsg && <p style={{ fontSize:'0.62rem', color: autoMsg.startsWith('Stopped') || autoMsg.startsWith('Auto-draft failed') ? C.amber : C.green, margin: autoDone.length ? '0.2rem 0 0' : 0, lineHeight:1.5, fontWeight:600 }}>{autoMsg}</p>}
        </div>
      )}
    </div>
  )
}

