'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { FORMATS, VIDEO_TYPES } from '@/lib/contentTypes'

// ── Add idea modal ──────────────────────────────────────────────────────────
export function AddIdeaModal({ onAdd, onClose }: { onAdd:(title:string,format:string,notes:string,videoType:string,uniqueAngle:string)=>Promise<void>; onClose:()=>void }) {
  const [title,  setTitle]  = useState('')
  const [format, setFormat] = useState('Long-form')
  const [notes,  setNotes]  = useState('')
  const [videoType, setVideoType] = useState('')
  const [uniqueAngle, setUniqueAngle] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title.trim(), format, notes.trim(), videoType, uniqueAngle.trim())
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'26rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Lightbulb size={16} color={C.amber}/> New idea
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Title / Working idea</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              autoFocus placeholder="e.g. Why the Cantillon Effect makes the rich richer"
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', boxSizing:'border-box' as const }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Format</label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{ padding:'0.35rem 0.75rem', background:format===f?'rgba(0,212,255,0.1)':C.card, border:'1px solid '+(format===f?C.cyan:C.border), borderRadius:'9999px', color:format===f?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Video type <span style={{ fontWeight:400 }}>(optional — which funnel role this plays)</span></label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {VIDEO_TYPES.map(v => (
                <button key={v} onClick={() => setVideoType(videoType===v?'':v)} style={{ padding:'0.35rem 0.75rem', background:videoType===v?'rgba(139,92,246,0.12)':C.card, border:'1px solid '+(videoType===v?C.purple:C.border), borderRadius:'9999px', color:videoType===v?C.purple:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Alpha check <span style={{ fontWeight:400 }}>— what does this have that a generic AI answer or the top existing videos don&apos;t?</span></label>
            <textarea
              value={uniqueAngle} onChange={e => setUniqueAngle(e.target.value)} rows={2}
              placeholder="e.g. original data pull, contrarian take, historical parallel nobody else has used, a real number nobody else calculated..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.35rem 0 0' }}>If you can&apos;t fill this in, the idea is probably a recipe &mdash; something AI or a search engine already answers well. Find the edge before you validate it.</p>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Notes / angle / hook idea <span style={{ fontWeight:400 }}>(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Any early thoughts on the angle, hook, or why this topic matters..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
          </div>

          <button onClick={submit} disabled={!title.trim() || saving} style={{
            width:'100%', padding:'0.75rem',
            background: title.trim() && !saving ? 'linear-gradient(135deg,'+C.amber+',#d97706)' : C.card,
            border:'none', borderRadius:'0.75rem', color: title.trim() && !saving ? '#000' : C.muted,
            fontWeight:800, fontSize:'0.9rem', cursor:title.trim() && !saving ? 'pointer' : 'not-allowed',
            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
          }}>
            <Plus size={15}/>{saving ? 'Saving...' : 'Add to ideas bank'}
          </button>
        </div>
      </div>
    </div>
  )
}

