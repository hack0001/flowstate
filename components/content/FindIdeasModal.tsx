'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { CONSULT_MODELS, DEFAULT_CONSULT_MODEL, FoundIdea, ScannedOutlier, TopComment, parseModelJson, HookAnalysis, buildHookAnalysisPrompt } from '@/lib/contentIdeas'
import { CommentsPanel } from '@/components/content/CommentsPanel'

// ── Find Ideas modal ────────────────────────────────────────────────────────
// Generates new video ideas from scratch (rather than validating one you
// already have) — each one is checked against the same 7-step method before
// it's proposed, grounded in real search where possible, on-topic for the
// channel, and titled so YouTube can actually tell what it's about.
export function FindIdeasModal({ onGenerate, onAdd, onClose }: {
  onGenerate: (model: string, webSearch: boolean, count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[], commentInsights?: Record<string, TopComment[]>) => Promise<{ ideas: FoundIdea[] } | { error: string }>
  onAdd: (idea: FoundIdea) => Promise<boolean>
  onClose: () => void
}) {
  // Idea generation leans on stronger reasoning (weighing outlier evidence,
  // spotting a genuine alpha angle) than a quick validation check does, so
  // this defaults higher than DEFAULT_CONSULT_MODEL (Haiku) used elsewhere.
  const [modelKey, setModelKey] = useState<string>('claude-sonnet-5')
  const [webSearch, setWebSearch] = useState(true)
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<FoundIdea[] | null>(null)
  const [addStatus, setAddStatus] = useState<Record<number, 'adding' | 'added' | 'error'>>({})
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<ScannedOutlier[] | null>(null)
  const [scanVelocity, setScanVelocity] = useState<ScannedOutlier[] | null>(null)
  const [velocityAddStatus, setVelocityAddStatus] = useState<Record<string, 'adding' | 'added' | 'error'>>({})
  const [showQueries, setShowQueries] = useState(false)
  // Filters results to channels that declared "US" as their country in About
  // (channels.list snippet.country) and biases search ranking toward the US
  // region. It's the closest proxy the public API offers — YouTube doesn't
  // expose actual viewer geography for channels you don't own — so this will
  // also drop channels that never declared a country, not just non-US ones.
  const [usOnly, setUsOnly] = useState(false)
  // One query per line, editable per scan and remembered in this browser so a
  // tuned set survives reloads. Defaults come from the channel brief.
  const [queryText, setQueryText] = useState(OUTLIER_SEED_QUERIES.join('\n'))
  const [outlierAddStatus, setOutlierAddStatus] = useState<Record<string, 'adding' | 'added' | 'error'>>({})
  const [hookTopic, setHookTopic] = useState('')
  const [hookLoading, setHookLoading] = useState(false)
  const [hookMsg, setHookMsg] = useState<string | null>(null)
  const [hookResult, setHookResult] = useState<HookAnalysis | null>(null)

  // Comment analyser — per-video real top comments, keyed by videoId. Kept
  // here (not per-row local state) so both the inline panel AND the
  // add-to-ideas / full-generation flows can read whatever's been fetched.
  const [commentState, setCommentState] = useState<Record<string, { loading?: boolean; open?: boolean; comments?: TopComment[]; error?: string; disabled?: boolean }>>({})

  async function analyseComments(videoId: string) {
    setCommentState(prev => ({ ...prev, [videoId]: { ...prev[videoId], loading: true, open: true, error: undefined } }))
    try {
      const res = await fetch('/api/content/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
      const data = await res.json()
      if (data?.error) { setCommentState(prev => ({ ...prev, [videoId]: { open: true, error: String(data.error) } })); return }
      setCommentState(prev => ({ ...prev, [videoId]: { open: true, comments: data.comments ?? [], disabled: !!data.disabled } }))
    } catch (e) {
      setCommentState(prev => ({ ...prev, [videoId]: { open: true, error: String(e) } }))
    }
  }

  // Toggle open/closed without refetching if we already have the comments —
  // only hits the API the first time a video is expanded.
  function toggleComments(videoId: string) {
    const existing = commentState[videoId]
    if (existing?.comments || existing?.error || existing?.disabled) {
      setCommentState(prev => ({ ...prev, [videoId]: { ...prev[videoId], open: !prev[videoId]?.open } }))
    } else {
      analyseComments(videoId)
    }
  }

  // The map handed to onGenerate / folded into an added idea's comment_gap —
  // only videos that actually returned real comments.
  const commentInsights: Record<string, TopComment[]> = Object.fromEntries(
    Object.entries(commentState).filter(([, s]) => s.comments && s.comments.length > 0).map(([id, s]) => [id, s.comments!])
  )

  async function runHookAnalysis() {
    if (!scanResults || scanResults.length === 0) { setHookMsg('Scan for outliers first.'); return }
    setHookLoading(true)
    setHookMsg(null)
    const { systemPrompt, userPrompt } = buildHookAnalysisPrompt(scanResults, hookTopic)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model: 'claude-sonnet-5' }),
      })
      const data = await res.json()
      if (data?.error) { setHookMsg('API error: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      if (!raw) { setHookMsg('Empty response from Claude.'); return }
      setHookResult(parseModelJson<HookAnalysis>(raw))
    } catch (e) {
      setHookMsg('Hook analysis failed: ' + String(e))
    } finally {
      setHookLoading(false)
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('outlierSeedQueries')
      if (saved?.trim()) setQueryText(saved)
    } catch { /* private mode etc. — defaults are fine */ }
  }, [])

  function saveQueries(text: string) {
    setQueryText(text)
    try { localStorage.setItem('outlierSeedQueries', text) } catch { /* ignore */ }
  }

  const parsedQueries = queryText.split('\n').map(q => q.trim()).filter(Boolean)

  const [suggesting, setSuggesting] = useState(false)

  // Ask Claude for fresh search phrases that fit the channel brief — appended
  // to the topic list (deduped) rather than replacing what's already there.
  async function suggestTopics() {
    setSuggesting(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'You generate YouTube search phrases used to hunt for outlier videos.\n\n' + CHANNEL_BRIEF + '\n\nReturn ONLY valid JSON, no markdown fences, no commentary.',
          userPrompt: `Current seed topics:\n${parsedQueries.join('\n') || '(none)'}\n\nSuggest 10 NEW YouTube search phrases (2-5 words each, lowercase, no punctuation) likely to surface overperforming videos for this channel — spread across the launch focus (inflation/savings) and the secondary lanes (gold/hard assets, monetary history stories, how the money system works), mixing evergreen phrasings with timely angles. Do not repeat or trivially reword the current topics.\n\nReturn JSON exactly: {"topics":["...","..."]}`,
          model: 'claude-sonnet-5',
        }),
      })
      const data = await res.json()
      if (data?.error) { setScanMsg('Topic suggestion failed: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      const parsed = parseModelJson<{ topics: string[] }>(raw)
      const existing = new Set(parsedQueries.map(q => q.toLowerCase()))
      const fresh = (parsed.topics ?? []).map(t => t.trim()).filter(t => t && !existing.has(t.toLowerCase()))
      if (fresh.length === 0) { setScanMsg('No new topics suggested — try again.'); return }
      saveQueries([...parsedQueries, ...fresh].join('\n'))
      setShowQueries(true)
    } catch (e) {
      setScanMsg('Topic suggestion failed: ' + String(e))
    } finally {
      setSuggesting(false)
    }
  }

  // Pull real numbers from the YouTube Data API first (needs YOUTUBE_API_KEY)
  // — the resulting outlier list is handed to Claude as verified evidence so
  // ideas get built on exact view:sub ratios instead of search estimates.
  async function scan() {
    if (parsedQueries.length === 0) { setScanMsg('Add at least one search topic first.'); return }
    setScanning(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/content/outliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: parsedQueries.slice(0, 8), regionCode: 'US', countryFilter: usOnly ? 'US' : undefined }),
      })
      const data = await res.json()
      if (data?.error) { setScanMsg(String(data.error)); return }
      const rows = (data?.outliers ?? []) as ScannedOutlier[]
      const velocityRows = (data?.velocityOutliers ?? []) as ScannedOutlier[]
      setScanResults(rows)
      setScanVelocity(velocityRows)
      if (rows.length === 0 && velocityRows.length === 0) setScanMsg('Scan ran fine but found no qualifying outliers or velocity candidates — try different topics or loosen the thresholds in the API route.')
    } catch (e) {
      setScanMsg('Scan failed: ' + String(e))
    } finally {
      setScanning(false)
    }
  }

  // Send a verified outlier straight to the Ideas board — for when the topic
  // is obviously worth beating and you don't need Claude to package it first.
  // The idea keeps the outlier's real numbers as evidence; retitle it later.
  // Turns fetched real comments (if any were pulled for this video) into a
  // ready-made comment_gap note — actual audience quotes rather than a blank
  // field waiting for Claude to guess.
  function commentGapFor(videoId: string): string {
    const cs = commentState[videoId]?.comments
    if (!cs || cs.length === 0) return ''
    return 'Real audience comments: ' + cs.slice(0, 3).map(c => `"${c.text.slice(0, 140)}${c.text.length > 140 ? '…' : ''}" (${c.likeCount} likes)`).join(' / ')
  }

  async function addOutlierToIdeas(o: ScannedOutlier) {
    setOutlierAddStatus(prev => ({ ...prev, [o.videoId]: 'adding' }))
    const months = Math.max(0, Math.round((Date.now() - new Date(o.publishedAt).getTime()) / (30 * 24 * 3600 * 1000)))
    const idea: FoundIdea = {
      title: o.title,
      description: `Beat this verified outlier (found via "${o.query}"): ${o.url} — same proven topic, sharper SoundMoney version (better packaging + the prescriptive savings ending).`,
      video_type: '', format: 'Long-form', unique_angle: '', pattern: '', comment_gap: commentGapFor(o.videoId), why_now: '',
      rationale: 'Added directly from the YouTube Data API scan — numbers are real, packaging/angle still to be worked out.',
      researched: true,
      outlier: {
        video_title: o.title, channel: o.channel,
        views: o.views.toLocaleString() + ' views',
        subscribers: o.subscribers.toLocaleString() + ' subscribers',
        view_to_sub_ratio: `${o.ratio}:1`,
        recency: months <= 1 ? 'about a month ago' : `${months} months ago`,
        packaging_gap: '',
        channel_country: o.channelCountry ?? '',
      },
    }
    const ok = await onAdd(idea)
    setOutlierAddStatus(prev => ({ ...prev, [o.videoId]: ok ? 'added' : 'error' }))
  }

  // Same as addOutlierToIdeas but for a velocity candidate — the note is
  // explicit that this is a fast-growth signal on a channel of whatever
  // size it happened to be, not a small-channel ratio outlier, so the
  // caveat travels with the idea onto the board.
  async function addVelocityToIdeas(o: ScannedOutlier) {
    setVelocityAddStatus(prev => ({ ...prev, [o.videoId]: 'adding' }))
    const months = Math.max(0, Math.round((Date.now() - new Date(o.publishedAt).getTime()) / (30 * 24 * 3600 * 1000)))
    const idea: FoundIdea = {
      title: o.title,
      description: `Beat this verified velocity candidate (found via "${o.query}"): ${o.url} — gained ${o.views.toLocaleString()} views in ${o.ageDays} days (~${o.viewsPerDay.toLocaleString()}/day) on a ${o.subscribers.toLocaleString()}-subscriber channel. Same proven topic, sharper SoundMoney version.`,
      video_type: '', format: 'Long-form', unique_angle: '', pattern: '', comment_gap: commentGapFor(o.videoId), why_now: '',
      rationale: 'Added directly from the YouTube Data API scan — real numbers, but this is a velocity signal (big views fast, not a small-channel ratio outlier), so weigh replicability before committing.',
      researched: true,
      outlier: {
        video_title: o.title, channel: o.channel,
        views: o.views.toLocaleString() + ' views',
        subscribers: o.subscribers.toLocaleString() + ' subscribers',
        view_to_sub_ratio: `${o.ratio}:1`,
        recency: months <= 1 ? 'about a month ago' : `${months} months ago`,
        packaging_gap: '',
        signal_type: 'velocity',
        velocity_note: `${o.subscribers.toLocaleString()}-subscriber channel — some of this pull may be channel authority/algorithm reach rather than pure topic demand; check whether the topic shows up elsewhere too before betting on it.`,
        channel_country: o.channelCountry ?? '',
      },
    }
    const ok = await onAdd(idea)
    setVelocityAddStatus(prev => ({ ...prev, [o.videoId]: ok ? 'added' : 'error' }))
  }

  async function run() {
    setLoading(true)
    setMsg(null)
    const res = await onGenerate(
      modelKey, webSearch, count,
      scanResults && scanResults.length > 0 ? scanResults : undefined,
      scanVelocity && scanVelocity.length > 0 ? scanVelocity : undefined,
      Object.keys(commentInsights).length > 0 ? commentInsights : undefined,
    )
    if ('error' in res) setMsg(res.error)
    else setIdeas(res.ideas)
    setLoading(false)
  }

  async function addOne(idx: number, idea: FoundIdea) {
    setAddStatus(prev => ({ ...prev, [idx]: 'adding' }))
    const ok = await onAdd(idea)
    setAddStatus(prev => ({ ...prev, [idx]: ok ? 'added' : 'error' }))
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'34rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.4rem' }}><Sparkles size={14} color={C.cyan}/>Find Ideas</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.76rem', color:C.muted, margin:'0 0 1rem', lineHeight:1.5 }}>
          Generates new ideas that pass the full 7-step checklist, fit the channel&apos;s niche, and are titled so YouTube can tell what they&apos;re about — not just clever hooks with no clear topic. Grounded in real search where possible, checked against your existing ideas so it doesn&apos;t repeat them, and judged from the identity of someone who already owns a successful channel here — confident and decisive, not hedged.
        </p>

        <div style={{ display:'flex', gap:'0.6rem', marginBottom:'0.875rem', flexWrap:'wrap' as const }}>
          <div style={{ flex:'1 1 12rem' }}>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Model</label>
            <select
              value={modelKey} onChange={e => setModelKey(e.target.value)} disabled={loading}
              title={CONSULT_MODELS.find(m => m.value === modelKey)?.hint}
              style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600, outline:'none', boxSizing:'border-box' as const, cursor:loading?'not-allowed':'pointer' }}
            >
              {CONSULT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0.3rem 0 0', lineHeight:1.4 }}>
              Recommended: Sonnet or Opus for idea generation &mdash; weighing outlier evidence and finding a real alpha angle needs stronger reasoning than Haiku gives. Save Haiku for quick validation checks.
            </p>
          </div>
          <div style={{ width:'6rem' }}>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>How many</label>
            <select
              value={count} onChange={e => setCount(Number(e.target.value))} disabled={loading}
              style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600, outline:'none', boxSizing:'border-box' as const, cursor:loading?'not-allowed':'pointer' }}
            >
              {[3, 5, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', cursor:loading?'not-allowed':'pointer', fontSize:'0.76rem', color:C.sec }}>
          <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} disabled={loading} style={{ width:'0.9rem', height:'0.9rem' }}/>
          Search the web while generating (finds real outlier videos and comment gaps to ground each idea in)
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', cursor:scanning?'not-allowed':'pointer', fontSize:'0.76rem', color:C.sec }}>
          <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} disabled={scanning} style={{ width:'0.9rem', height:'0.9rem' }}/>
          US audience only when scanning &mdash; biases search toward the US region and keeps only channels that declared "US" as their country. Note: this also drops channels that never declared a country at all, since YouTube doesn&apos;t expose real viewer geography for channels you don&apos;t own.
        </label>

        {/* ── YouTube Data API scan — exact numbers before Claude judges ── */}
        <div style={{ padding:'0.75rem', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'0.75rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' as const }}>
            <p style={{ fontSize:'0.7rem', color:C.sec, margin:0, lineHeight:1.45, flex:'1 1 16rem' }}>
              <strong style={{ color:C.green }}>Scan YouTube first (recommended)</strong> — pulls real view counts and subscriber ratios from the YouTube Data API for the channel&apos;s seed topics. Surfaces two kinds of evidence: verified <strong style={{ color:C.text }}>ratio outliers</strong> (small channel, topic beat its own audience) and verified <strong style={{ color:C.text }}>velocity candidates</strong> (big views fast on any channel size, including large ones that wouldn&apos;t clear the ratio bar) — both get handed to Claude as real evidence instead of estimates.
            </p>
            <div style={{ display:'flex', gap:'0.35rem' }}>
              <button onClick={() => setShowQueries(v => !v)} disabled={scanning} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.7rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:showQueries?C.text:C.sec, cursor:scanning?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const }}>
                <ChevronDown size={11} style={{ transform: showQueries ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>Topics ({parsedQueries.length})
              </button>
              <button onClick={scan} disabled={scanning || loading} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.8rem', background:C.card, border:'1px solid rgba(0,255,136,0.3)', borderRadius:'0.5rem', color:C.green, cursor:(scanning||loading)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const, opacity:(scanning||loading)?0.5:1 }}>
                <Zap size={11}/>{scanning ? 'Scanning…' : scanResults ? 'Re-scan' : 'Scan YouTube'}
              </button>
            </div>
          </div>
          {showQueries && (
            <div style={{ marginTop:'0.6rem' }}>
              <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, marginBottom:'0.3rem' }}>
                Search topics — one per line, first 8 used per scan (each costs ~200 of the 10,000 daily API units). Saved in this browser.
              </label>
              <textarea
                value={queryText} onChange={e => saveQueries(e.target.value)} disabled={scanning}
                rows={6}
                style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', lineHeight:1.5, outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
              />
              <div style={{ display:'flex', gap:'0.35rem', marginTop:'0.3rem' }}>
                <button onClick={suggestTopics} disabled={scanning || suggesting} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.25rem 0.6rem', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.4rem', color:C.cyan, cursor:(scanning||suggesting)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.64rem', fontWeight:700, opacity:(scanning||suggesting)?0.5:1 }}>
                  <Sparkles size={10}/>{suggesting ? 'Suggesting…' : 'Suggest topics (AI)'}
                </button>
                <button onClick={() => saveQueries(OUTLIER_SEED_QUERIES.join('\n'))} disabled={scanning} style={{ padding:'0.25rem 0.6rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:scanning?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.64rem', fontWeight:600 }}>
                  Reset to channel defaults
                </button>
              </div>
            </div>
          )}
          {scanMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.5rem 0 0', lineHeight:1.4 }}>{scanMsg}</p>}
          {scanResults && scanResults.length > 0 && (
            <div style={{ marginTop:'0.6rem' }}>
              <p style={{ fontSize:'0.66rem', color:C.green, margin:'0 0 0.35rem', fontWeight:700 }}>
                {scanResults.length} verified outliers found — they&apos;ll be handed to Claude as evidence when you hit Find ideas, or add one straight to the board. Tap <MessageSquare size={9} style={{ display:'inline', verticalAlign:'-1px' }}/> on any row to pull its real top comments first — most-liked and substantial ones only.
              </p>
              <div style={{ maxHeight:'11rem', overflowY:'auto' as const, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {scanResults.map(o => {
                  const st = outlierAddStatus[o.videoId]
                  const cs = commentState[o.videoId]
                  return (
                    <div key={o.videoId} style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.25rem 0.4rem', background:C.card, borderRadius:'0.35rem', border:'1px solid '+C.border }}>
                        <a href={o.url} target="_blank" rel="noreferrer" style={{ flex:1, fontSize:'0.66rem', color:C.sec, textDecoration:'none', lineHeight:1.4 }}>
                          <span style={{ color:C.text, fontWeight:600 }}>{o.title}</span>
                          {' '}— {o.channel}{o.channelCountry && <span style={{ color:o.channelCountry==='US'?C.green:C.muted, fontWeight:700 }}> [{o.channelCountry}]</span>} · {o.views.toLocaleString()} views / {o.subscribers.toLocaleString()} subs · <span style={{ color:C.cyan, fontWeight:700 }}>{o.ratio}:1</span>
                        </a>
                        <button
                          onClick={() => toggleComments(o.videoId)}
                          disabled={cs?.loading}
                          title="Pull real top comments — filtered for substance, ranked by likes"
                          style={{ display:'flex', alignItems:'center', gap:'0.2rem', flexShrink:0, padding:'0.25rem 0.4rem', background: cs?.open ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)', border:'1px solid '+(cs?.open ? 'rgba(0,212,255,0.3)' : C.border), borderRadius:'0.35rem', color: cs?.open ? C.cyan : C.muted, cursor:cs?.loading?'wait':'pointer', fontFamily:'inherit', fontSize:'0.6rem', fontWeight:700 }}
                        >
                          <MessageSquare size={10}/>{cs?.comments ? cs.comments.length : ''}
                        </button>
                        <button
                          onClick={() => addOutlierToIdeas(o)}
                          disabled={st === 'adding' || st === 'added'}
                          title="Add this topic to the Ideas board with its verified numbers attached"
                          style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexShrink:0, padding:'0.25rem 0.5rem', background: st === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(st === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.35rem', color: st === 'added' ? '#22c55e' : C.amber, cursor:(st === 'adding' || st === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                        >
                          {st === 'added' ? <Check size={10}/> : <Plus size={10}/>}
                          {st === 'adding' ? 'Adding…' : st === 'added' ? 'Added' : 'Add'}
                        </button>
                        {st === 'error' && <span style={{ fontSize:'0.6rem', color:C.red }}>failed</span>}
                      </div>
                      {cs?.open && <CommentsPanel state={cs} onRetry={() => analyseComments(o.videoId)}/>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {scanVelocity && scanVelocity.length > 0 && (
            <div style={{ marginTop:'0.75rem', paddingTop:'0.65rem', borderTop:'1px solid '+C.border }}>
              <p style={{ fontSize:'0.66rem', color:C.amber, margin:'0 0 0.3rem', fontWeight:700 }}>
                {scanVelocity.length} velocity candidates — big views fast, any channel size
              </p>
              <p style={{ fontSize:'0.64rem', color:C.muted, margin:'0 0 0.35rem', lineHeight:1.4 }}>
                Didn&apos;t clear the view:sub ratio bar (often because the channel is large) but still gained a lot of views in a short window — worth investigating rather than dismissing, just weigh channel size before betting on it.
              </p>
              <div style={{ maxHeight:'11rem', overflowY:'auto' as const, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {scanVelocity.map(o => {
                  const st = velocityAddStatus[o.videoId]
                  const cs = commentState[o.videoId]
                  return (
                    <div key={o.videoId} style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.25rem 0.4rem', background:C.card, borderRadius:'0.35rem', border:'1px solid '+C.border }}>
                        <a href={o.url} target="_blank" rel="noreferrer" style={{ flex:1, fontSize:'0.66rem', color:C.sec, textDecoration:'none', lineHeight:1.4 }}>
                          <span style={{ color:C.text, fontWeight:600 }}>{o.title}</span>
                          {' '}— {o.channel}{o.channelCountry && <span style={{ color:o.channelCountry==='US'?C.green:C.muted, fontWeight:700 }}> [{o.channelCountry}]</span>} ({o.subscribers.toLocaleString()} subs) · {o.views.toLocaleString()} views in {o.ageDays}d · <span style={{ color:C.amber, fontWeight:700 }}>~{o.viewsPerDay.toLocaleString()}/day</span>
                        </a>
                        <button
                          onClick={() => toggleComments(o.videoId)}
                          disabled={cs?.loading}
                          title="Pull real top comments — filtered for substance, ranked by likes"
                          style={{ display:'flex', alignItems:'center', gap:'0.2rem', flexShrink:0, padding:'0.25rem 0.4rem', background: cs?.open ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)', border:'1px solid '+(cs?.open ? 'rgba(0,212,255,0.3)' : C.border), borderRadius:'0.35rem', color: cs?.open ? C.cyan : C.muted, cursor:cs?.loading?'wait':'pointer', fontFamily:'inherit', fontSize:'0.6rem', fontWeight:700 }}
                        >
                          <MessageSquare size={10}/>{cs?.comments ? cs.comments.length : ''}
                        </button>
                        <button
                          onClick={() => addVelocityToIdeas(o)}
                          disabled={st === 'adding' || st === 'added'}
                          title="Add this topic to the Ideas board — flagged as a velocity signal, not a ratio outlier"
                          style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexShrink:0, padding:'0.25rem 0.5rem', background: st === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(st === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.35rem', color: st === 'added' ? '#22c55e' : C.amber, cursor:(st === 'adding' || st === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                        >
                          {st === 'added' ? <Check size={10}/> : <Plus size={10}/>}
                          {st === 'adding' ? 'Adding…' : st === 'added' ? 'Added' : 'Add'}
                        </button>
                        {st === 'error' && <span style={{ fontSize:'0.6rem', color:C.red }}>failed</span>}
                      </div>
                      {cs?.open && <CommentsPanel state={cs} onRetry={() => analyseComments(o.videoId)}/>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Hook Lab — analyse the scanned outliers' hook patterns ── */}
        {scanResults && scanResults.length > 0 && (
          <div style={{ padding:'0.75rem', background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.18)', borderRadius:'0.75rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.7rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.45 }}>
              <strong style={{ color:C.orange }}>Hook Lab</strong> — read the winning hook patterns across the {scanResults.length} outliers, then generate hooks for your topic in those shapes. Optional topic below (leave blank for reusable templates).
            </p>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              <input
                value={hookTopic} onChange={e => setHookTopic(e.target.value)} disabled={hookLoading}
                placeholder="Your video topic, e.g. why the gold standard was killed"
                style={{ flex:'1 1 14rem', padding:'0.45rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', outline:'none', boxSizing:'border-box' as const }}
              />
              <button onClick={runHookAnalysis} disabled={hookLoading} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.85rem', background:C.card, border:'1px solid rgba(249,115,22,0.35)', borderRadius:'0.5rem', color:C.orange, cursor:hookLoading?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const, opacity:hookLoading?0.5:1 }}>
                <Zap size={11}/>{hookLoading ? 'Analysing…' : 'Analyse hooks'}
              </button>
            </div>
            {hookMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.5rem 0 0', lineHeight:1.4 }}>{hookMsg}</p>}
            {hookResult && (
              <div style={{ marginTop:'0.7rem', display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                <div>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.orange, margin:'0 0 0.35rem' }}>Recurring winning patterns</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {hookResult.patterns.map((p, i) => (
                      <div key={i} style={{ padding:'0.4rem 0.55rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.45rem' }}>
                        <p style={{ fontSize:'0.7rem', color:C.text, margin:0, fontWeight:700 }}>{p.pattern}</p>
                        <p style={{ fontSize:'0.66rem', color:C.sec, margin:'0.1rem 0 0', lineHeight:1.4 }}>{p.why_it_works}</p>
                        {p.example && <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0.15rem 0 0', fontStyle:'italic' }}>e.g. &ldquo;{p.example}&rdquo;</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.orange, margin:'0 0 0.35rem' }}>{hookTopic.trim() ? 'Hooks for your topic' : 'Reusable hook templates'}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {hookResult.hooks.map((h, i) => (
                      <div key={i} style={{ padding:'0.4rem 0.55rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.45rem' }}>
                        <p style={{ fontSize:'0.72rem', color:C.text, margin:0, lineHeight:1.4 }}>&ldquo;{h.hook}&rdquo;</p>
                        <div style={{ display:'flex', gap:'0.3rem', marginTop:'0.2rem', flexWrap:'wrap' as const }}>
                          {h.pattern && <span style={{ fontSize:'0.58rem', color:C.orange, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:'9999px', padding:'0.05rem 0.35rem' }}>{h.pattern}</span>}
                          {h.emotion && <span style={{ fontSize:'0.58rem', color:C.pink, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.2)', borderRadius:'9999px', padding:'0.05rem 0.35rem' }}>{h.emotion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {msg && <p style={{ fontSize:'0.72rem', color:C.amber, margin:'0 0 0.75rem', lineHeight:1.4 }}>{msg}</p>}

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', color:C.muted, padding:'1.5rem 0', justifyContent:'center' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.cyan, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            {webSearch ? 'Searching YouTube and drafting ideas…' : 'Drafting ideas…'}
          </div>
        )}

        {ideas && !loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1rem' }}>
            {ideas.map((idea, i) => {
              const status = addStatus[i]
              return (
                <div key={i} style={{ padding:'0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem', marginBottom:'0.3rem' }}>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, flex:1, lineHeight:1.4 }}>{idea.title}</p>
                    <button
                      onClick={() => addOne(i, idea)}
                      disabled={status === 'adding' || status === 'added'}
                      style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexShrink:0, padding:'0.3rem 0.6rem', background: status === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(status === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.4rem', color: status === 'added' ? '#22c55e' : C.amber, cursor: (status === 'adding' || status === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.66rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                    >
                      {status === 'added' ? <Check size={11}/> : <Plus size={11}/>}
                      {status === 'adding' ? 'Adding…' : status === 'added' ? 'Added' : 'Add to Ideas'}
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' as const, marginBottom:'0.35rem' }}>
                    {idea.pattern && <span style={{ fontSize:'0.6rem', color:C.orange, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:'9999px', padding:'0.1rem 0.4rem', fontWeight:700 }}>{idea.pattern}</span>}
                    {idea.video_type && <span style={{ fontSize:'0.6rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{idea.video_type}</span>}
                    {idea.format && <span style={{ fontSize:'0.6rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{idea.format}</span>}
                    {idea.researched
                      ? <span style={{ fontSize:'0.6rem', color:'#22c55e', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>searched</span>
                      : <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>pattern-based</span>}
                  </div>
                  <p style={{ fontSize:'0.74rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.4 }}>{idea.description}</p>

                  {/* Opportunity signal — the Hummus outlier breakdown: high views on a
                      low-subscriber channel with weak packaging is what makes this an
                      opportunity, not just a topic guess. Shown plainly so it's obvious
                      what evidence (or lack of it) each idea actually rests on. */}
                  <div style={{ padding:'0.55rem 0.65rem', background: idea.outlier ? (idea.outlier.signal_type === 'velocity' ? 'rgba(255,184,0,0.05)' : 'rgba(0,212,255,0.05)') : 'rgba(255,184,0,0.05)', border:'1px solid '+(idea.outlier ? (idea.outlier.signal_type === 'velocity' ? 'rgba(255,184,0,0.22)' : 'rgba(0,212,255,0.18)') : 'rgba(255,184,0,0.18)'), borderRadius:'0.5rem', marginBottom:'0.5rem' }}>
                    <p style={{ fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color: idea.outlier ? (idea.outlier.signal_type === 'velocity' ? C.amber : C.cyan) : C.amber, margin:'0 0 0.35rem' }}>
                      {idea.outlier?.signal_type === 'velocity' ? 'Opportunity signal — velocity (secondary)' : 'Opportunity signal'}
                    </p>
                    {idea.outlier ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                        <p style={{ fontSize:'0.72rem', color:C.text, margin:0, lineHeight:1.4 }}>
                          <strong>&#8220;{idea.outlier.video_title}&#8221;</strong> &mdash; {idea.outlier.channel}
                        </p>
                        <p style={{ fontSize:'0.68rem', color:C.sec, margin:0, lineHeight:1.4 }}>
                          {idea.outlier.views} on a {idea.outlier.subscribers} channel &nbsp;<span style={{ color: idea.outlier.signal_type === 'velocity' ? C.amber : C.cyan, fontWeight:700 }}>({idea.outlier.view_to_sub_ratio})</span>
                          {idea.outlier.recency && <span style={{ color:C.muted }}> &middot; {idea.outlier.recency}</span>}
                        </p>
                        {idea.outlier.signal_type === 'velocity' && idea.outlier.velocity_note && (
                          <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ fontWeight:700 }}>Caveat:</span> {idea.outlier.velocity_note}
                          </p>
                        )}
                        <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                          <span style={{ color:C.amber, fontWeight:700 }}>Packaging gap:</span> {idea.outlier.packaging_gap}
                        </p>
                        {idea.comment_gap && (
                          <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ color:C.teal, fontWeight:700 }}>Audience gap:</span> {idea.comment_gap}
                          </p>
                        )}
                        {idea.why_now && (
                          <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ color:C.green, fontWeight:700 }}>Why now:</span> {idea.why_now}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.4 }}>
                        No qualifying outlier found (high views + low subs + weak packaging) — this idea rests on pattern/judgment, not a confirmed precedent. Worth a closer manual check before committing.
                      </p>
                    )}
                  </div>

                  <p style={{ fontSize:'0.68rem', color:C.purple, margin:'0 0 0.3rem', lineHeight:1.4 }}>&#9889; {idea.unique_angle}</p>
                  <p style={{ fontSize:'0.66rem', color:C.muted, margin:0, lineHeight:1.4, fontStyle:'italic' }}>{idea.rationale}</p>
                  {status === 'error' && <p style={{ fontSize:'0.64rem', color:C.red, margin:'0.3rem 0 0' }}>Couldn&apos;t save — try again.</p>}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', flexWrap:'wrap' as const }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Close</button>
          <button onClick={run} disabled={loading} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.cyan, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, opacity:loading?0.5:1 }}>
            <Sparkles size={13}/>{ideas ? 'Find more' : 'Find ideas'}
          </button>
        </div>
      </div>
    </div>
  )
}

