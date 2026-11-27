'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { ALL_STAGES, STAGE_SOP_ID, ContentItem, stageStyle } from '@/lib/contentTypes'

export function StageChip({ stage }: { stage: string | null }) {
  const s = stageStyle(stage)
  if (!stage) return null
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', whiteSpace:'nowrap' as const }}>
      {stage}
    </span>
  )
}

// ── Move stage modal ────────────────────────────────────────────────────────
export function MoveModal({ item, onMove, onClose }: { item:ContentItem; onMove:(s:string)=>void; onClose:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'22rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Move to stage</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.4 }}>{item.title}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
          {ALL_STAGES.filter(s => !isStageSkippedForShorts(s.key, item.format)).map(s => (
            <button key={s.key} onClick={() => onMove(s.key)} style={{
              textAlign:'left', padding:'0.55rem 0.875rem',
              background: item.pipeline_stage === s.key ? s.bg : C.card,
              border: '1px solid ' + (item.pipeline_stage === s.key ? s.color+'55' : C.border),
              borderRadius:'0.625rem', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight:600, color: item.pipeline_stage === s.key ? s.color : C.sec,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span>{s.key}</span>
              {item.pipeline_stage === s.key && <span style={{ fontSize:'0.6rem', color:s.color }}>current</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Stage SOP viewer modal ──────────────────────────────────────────────────
// Opened by clicking a Kanban column header. Read-only reference view of the
// full production SOP for that stage — steps, tagline, icon — resolved via
// STAGE_SOP_ID (thematic map, see above), not the advance-logic STAGE_TO_SOP
// in lib/sops.ts.
export function SopViewerModal({ stageKey, onClose }: { stageKey: string; onClose: () => void }) {
  const sopId = STAGE_SOP_ID[stageKey]
  const sop = SOPS.find(s => s.id === sopId)
  const stageMeta = ALL_STAGES.find(s => s.key === stageKey)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'30rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.25rem' }}>
          <span style={{ fontSize:'0.72rem', fontWeight:800, color: stageMeta?.color ?? C.text }}>{stageKey}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        {!sop ? (
          <p style={{ fontSize:'0.8rem', color:C.muted, margin:'0.75rem 0 0' }}>No SOP is linked to this stage yet.</p>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', margin:'0.5rem 0 0.75rem' }}>
              <span style={{ fontSize:'1.3rem' }} dangerouslySetInnerHTML={{ __html: sop.icon }} />
              <h3 style={{ fontSize:'1rem', fontWeight:800, color:C.text, margin:0 }}>
                <span style={{ color:C.muted, fontSize:'0.65rem', fontWeight:500, marginRight:'0.4rem' }}>SOP {sop.id}</span>
                {sop.title}
              </h3>
            </div>
            <p style={{ fontSize:'0.75rem', color:C.cyan, fontStyle:'italic', margin:'0 0 1rem', lineHeight:1.5 }}>{sop.tagline}</p>
            <ol style={{ margin:0, padding:'0 0 0 1.25rem', display:'flex', flexDirection:'column', gap:'0.55rem' }}>
              {sop.steps.map((step, i) => (
                <li key={i} style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6 }}
                  dangerouslySetInnerHTML={{ __html: step }} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}

