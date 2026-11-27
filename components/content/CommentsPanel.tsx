'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { TopComment } from '@/lib/contentIdeas'

// ── Comment analyser panel ──────────────────────────────────────────────────
// Inline readout of real top comments for one scanned video — filtered for
// substance and ranked by likes server-side, so what's shown here is already
// "insightful and lots of likes" by construction, not just a raw dump.
export function CommentsPanel({ state, onRetry }: {
  state: { loading?: boolean; comments?: TopComment[]; error?: string; disabled?: boolean }
  onRetry: () => void
}) {
  return (
    <div style={{ padding:'0.45rem 0.55rem', background:'rgba(0,212,255,0.03)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'0.4rem' }}>
      {state.loading ? (
        <p style={{ fontSize:'0.62rem', color:C.muted, margin:0 }}>Pulling top comments…</p>
      ) : state.error ? (
        <p style={{ fontSize:'0.62rem', color:C.red, margin:0 }}>
          {state.error}{' '}
          <button onClick={onRetry} style={{ background:'none', border:'none', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.62rem', textDecoration:'underline', padding:0 }}>retry</button>
        </p>
      ) : state.disabled ? (
        <p style={{ fontSize:'0.62rem', color:C.muted, margin:0 }}>Comments are disabled on this video.</p>
      ) : state.comments && state.comments.length > 0 ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
          {state.comments.slice(0, 8).map(c => (
            <p key={c.id} style={{ fontSize:'0.64rem', lineHeight:1.45, margin:0, color:C.sec }}>
              <span style={{ color:C.teal, fontWeight:700 }}>{c.likeCount} likes</span> — {c.text} <span style={{ color:C.muted }}>({c.author})</span>
            </p>
          ))}
        </div>
      ) : (
        <p style={{ fontSize:'0.62rem', color:C.muted, margin:0 }}>No substantial comments found — mostly short reactions on this one.</p>
      )}
    </div>
  )
}

