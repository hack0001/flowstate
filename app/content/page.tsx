'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import ContentItemDetail from '@/components/ContentItemDetail'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { PIPELINE_STAGES, ALL_STAGES, STAGE_KEYS, ContentItem, extractYouTubeId, YtStats, View } from '@/lib/contentTypes'
import { IDEA_VALIDATION_SOP_ID, IDEA_LOG_SOP_ID, IdeaLog, ValidationAlternative, ValidationResult, buildValidationPrompt, FoundIdea, ScannedOutlier, TopComment, parseModelJson, buildFindIdeasPrompt } from '@/lib/contentIdeas'
import { MoveModal, SopViewerModal } from '@/components/content/StageUi'
import { IdeaDetailModal } from '@/components/content/IdeaDetailModal'
import { AddIdeaModal } from '@/components/content/AddIdeaModal'
import { FindIdeasModal } from '@/components/content/FindIdeasModal'
import { FocusStar, PipelineCard } from '@/components/content/PipelineCard'


import { C } from '@/lib/theme'

// Shared small-form input style — used by the Channels to Watch add form.
const CH_INPUT: React.CSSProperties = {
  padding:'0.5rem 0.7rem', background:C.bg, border:'1px solid '+C.border,
  borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', outline:'none',
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ContentPage() {
  const router = useRouter()
  const [items,      setItems]      = useState<ContentItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<View>('pipeline')
  // Two boards, one kanban component — Shorts drops the Thumbnail & SEO
  // column entirely (see isShortsOnly in lib/sops.ts) since a pure Short
  // never needs a custom thumbnail or real SEO metadata. Everything else
  // (Long-form, Both, Podcast clip, or unset) is treated as the long-form
  // board's territory — 'Both' items live there since the short cut is a
  // downstream clip made at Post-Publish, not a separate top-to-bottom run.
  const [pipelineFormat, setPipelineFormat] = useState<'long' | 'shorts'>('long')
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null)
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null)
  const [sopStageKey, setSopStageKey] = useState<string | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [showFindIdeas, setShowFindIdeas] = useState(false)
  const [focusMsg,   setFocusMsg]   = useState<string | null>(null)
  const [validatingItem, setValidatingItem] = useState<ContentItem | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [ideaLog, setIdeaLog] = useState<IdeaLog | null>(null)
  const [ideaLogMsg, setIdeaLogMsg] = useState<string | null>(null)
  const [weeklyTargets, setWeeklyTargets] = useState<{ id:string; label:string; tracking:string }[]>([])
  const [weeklyPicks, setWeeklyPicks] = useState<Record<string, string>>({}) // target_id -> content_item_id
  // How many items can be starred as active focus at once — used to be a
  // hardcoded 2, now Tom's own setting (039_content_focus_settings.sql).
  const [maxFocusItems, setMaxFocusItemsLocal] = useState(DEFAULT_MAX_FOCUS_ITEMS)
  const [maxFocusMsg, setMaxFocusMsg] = useState<string | null>(null)

  // Channels to Watch — YouTube channels in Tom's niche or an adjacent one
  // worth keeping an eye on for formats/angles/outliers. Lives in the Ideas
  // Bank view, separate from the Ideas Bank itself (his own video ideas).
  const [channels, setChannels] = useState<ChannelWatch[]>([])
  const [channelsMsg, setChannelsMsg] = useState<string | null>(null)
  const [showChannelsPanel, setShowChannelsPanel] = useState(false)
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [channelDraft, setChannelDraft] = useState({ name:'', url:'', niche:'', notes:'' })
  const [savingChannel, setSavingChannel] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getMaxFocusItems().then(({ maxItems, error }) => {
      setMaxFocusItemsLocal(maxItems)
      if (error) setMaxFocusMsg(error) // surfaced on load now, not just when you try to change it
    })
  }, [])
  useEffect(() => {
    getChannelWatchlist().then(({ channels, error }) => {
      setChannels(channels)
      if (error) setChannelsMsg(error)
    })
  }, [])

  async function submitChannel() {
    if (!channelDraft.name.trim() || !channelDraft.url.trim()) return
    setSavingChannel(true)
    const { channel, error } = await addChannelWatch(channelDraft.name, channelDraft.url, channelDraft.niche, channelDraft.notes)
    setSavingChannel(false)
    if (error) { setChannelsMsg(error); return }
    if (channel) setChannels(prev => [channel, ...prev])
    setChannelDraft({ name:'', url:'', niche:'', notes:'' })
    setShowChannelForm(false)
    setChannelsMsg(null)
  }

  async function removeChannel(id: string) {
    setChannels(prev => prev.filter(c => c.id !== id)) // optimistic
    const { error } = await deleteChannelWatch(id)
    if (error) setChannelsMsg(error)
  }

  async function updateMaxFocusItems(n: number) {
    setMaxFocusItemsLocal(n) // optimistic — feels instant on the +/- buttons
    const { error } = await setMaxFocusItems(n)
    if (error) setMaxFocusMsg(error)
    else setMaxFocusMsg(null)
  }

  // ── This week's Long-form / Short pick ─────────────────────────────────────
  // Companion to the home page's auto-counted Weekly Targets (Shorts/Long-form
  // count published-this-week already). This lets you SELECT which specific
  // pipeline item you're actually committing to ship this week, so the home
  // page can show a title, not just a bare count.
  function weekStartStr(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const r = new Date(d)
    r.setDate(r.getDate() + diff)
    return r.getFullYear() + '-' + String(r.getMonth()+1).padStart(2,'0') + '-' + String(r.getDate()).padStart(2,'0')
  }
  const weekStart = weekStartStr()

  useEffect(() => {
    (async () => {
      const { data: targets } = await supabase.from('weekly_targets')
        .select('id,label,tracking').eq('active', true).in('tracking', ['auto_shorts', 'auto_longform'])
      setWeeklyTargets(targets ?? [])
      if (targets && targets.length > 0) {
        const { data: picks } = await supabase.from('weekly_target_picks')
          .select('target_id,content_item_id').eq('week_start', weekStart).in('target_id', targets.map(t => t.id))
        const map: Record<string, string> = {}
        for (const p of (picks ?? []) as { target_id:string; content_item_id:string|null }[]) if (p.content_item_id) map[p.target_id] = p.content_item_id
        setWeeklyPicks(map)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function setWeeklyPick(targetId: string, contentItemId: string) {
    setWeeklyPicks(prev => ({ ...prev, [targetId]: contentItemId }))
    await supabase.from('weekly_target_picks').upsert(
      { target_id: targetId, week_start: weekStart, content_item_id: contentItemId || null, updated_at: new Date().toISOString() },
      { onConflict: 'target_id,week_start' }
    )
  }

  // ── Priority order (drag-rankable) ─────────────────────────────────────────
  // Same pattern as Vault/Tasks/Etsy/X/Personal: cached in localStorage first,
  // authoritative copy in priority_lists (key 'youtube_pipeline_priority'),
  // synced on every reorder. Covers the whole pipeline (ideas through
  // pre-Live) — Live/Post-Published items don't need ranking so they're
  // excluded from the pool.
  const CONTENT_PRIORITY_KEY = 'youtube_pipeline_priority'
  const [cPriorityOrder, setCPriorityOrder] = useState<string[]>([])
  const [cDragId, setCDragId]     = useState<string|null>(null)
  const [cDragOver, setCDragOver] = useState<string|null>(null)
  const [cDragFrom, setCDragFrom] = useState<'unassigned'|'priority'|null>(null)

  useEffect(() => {
    let cLsLoaded = false
    let cLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_content')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setCPriorityOrder(ids); cLsLoaded = true; cLocalIds = ids } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', CONTENT_PRIORITY_KEY).single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setCPriorityOrder(ids)
        try { localStorage.setItem('fs_p_content', JSON.stringify(ids)) } catch {}
      } else if (cLsLoaded) {
        supabase.from('priority_lists').upsert({ key: CONTENT_PRIORITY_KEY, ordered_ids: cLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
  }, [])

  function saveContentPriority(order: string[]) {
    const y = window.scrollY
    setCPriorityOrder(order)
    try { localStorage.setItem('fs_p_content', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: CONTENT_PRIORITY_KEY, ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  // ── Live YouTube stats for published items ────────────────────────────────
  // One batched videos.list call (1 quota unit) for every item with a
  // youtube_url — keeps views/likes/comments visible on the cards without
  // opening Studio. Refreshes on page load.
  const [ytStats, setYtStats] = useState<Record<string, YtStats>>({})
  useEffect(() => {
    const ids = [...new Set(items.map(i => extractYouTubeId(i.youtube_url)).filter((v): v is string => !!v))]
    if (ids.length === 0) return
    fetch('/api/content/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: ids }),
    })
      .then(r => r.json())
      .then(data => { if (data?.stats) setYtStats(data.stats) })
      .catch(() => { /* stats are a nice-to-have — never block the page on them */ })
  }, [items])

  async function moveStage(item: ContentItem, stage: string) {
    setMoveTarget(null)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, pipeline_stage: stage } : i))
    await supabase.from('content_items').update({ pipeline_stage: stage }).eq('id', item.id)
  }

  async function addIdea(title: string, format: string, notes: string, videoType: string, uniqueAngle: string) {
    const { data } = await supabase
      .from('content_items')
      .insert({ title, pipeline_stage:'💡 Idea', format, notes: notes || null, video_type: videoType || null, unique_angle: uniqueAngle || null, status:'active', archived: false })
      .select()
      .single()
    if (data) setItems(prev => [data, ...prev])
    setShowAdd(false)
  }

  // Turns one of Claude's validation alternatives into its own idea in the
  // Ideas Bank — inherits format/video type from the idea it was suggested
  // under, "why" becomes the description, "evidence" becomes the alpha check
  // (it's exactly the kind of edge that field is for).
  async function addIdeaFromAlternative(parent: ContentItem, alt: ValidationAlternative): Promise<boolean> {
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: alt.title,
        pipeline_stage: '💡 Idea',
        format: parent.format,
        notes: alt.why || null,
        video_type: parent.video_type,
        unique_angle: alt.evidence || null,
        status: 'active',
        archived: false,
      })
      .select()
      .single()
    if (error || !data) return false
    setItems(prev => [data, ...prev])
    return true
  }

  // Generates new ideas from scratch — same checklist + research requirement
  // as validation, just run before an idea exists rather than after.
  async function runFindIdeas(model: string, webSearch: boolean, count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[], commentInsights?: Record<string, TopComment[]>): Promise<{ ideas: FoundIdea[] } | { error: string }> {
    const existingTitles = items.map(i => i.title).slice(0, 60)
    const { systemPrompt, userPrompt } = buildFindIdeasPrompt(existingTitles, count, scannedOutliers, scannedVelocity, commentInsights)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model, webSearch }),
      })
      const data = await res.json()
      if (data?.error) return { error: 'API error: ' + JSON.stringify(data.error) }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n')
        .trim()
      if (!raw) return { error: 'Empty response from Claude.' }
      const parsed = parseModelJson<{ ideas: FoundIdea[] }>(raw)
      return { ideas: (parsed.ideas ?? []).filter(i => i?.title) }
    } catch (e) {
      return { error: 'Generation failed: ' + String(e) }
    }
  }

  async function addFoundIdea(idea: FoundIdea): Promise<boolean> {
    // ContentItem has no dedicated outlier field, so fold the opportunity
    // breakdown into unique_angle — it's exactly the "why this has an edge"
    // evidence that field is for, and keeps it visible once the idea is a
    // normal Ideas Bank row.
    const outlierNote = idea.outlier
      ? `${idea.outlier.signal_type === 'velocity' ? 'Velocity signal' : 'Outlier'}: "${idea.outlier.video_title}" (${idea.outlier.channel}) — ${idea.outlier.views} on a ${idea.outlier.subscribers} channel (${idea.outlier.view_to_sub_ratio} view:sub)${idea.outlier.recency ? ', ' + idea.outlier.recency : ''}. Packaging gap: ${idea.outlier.packaging_gap}${idea.outlier.velocity_note ? ' Caveat: ' + idea.outlier.velocity_note : ''}`
      : null
    const patternNote = idea.pattern ? `Pattern: ${idea.pattern}` : null
    const gapNote = idea.comment_gap ? `Comment gap: ${idea.comment_gap}` : null
    const whyNowNote = idea.why_now ? `Why now: ${idea.why_now}` : null
    const uniqueAngle = [idea.unique_angle, patternNote, outlierNote, gapNote, whyNowNote].filter(Boolean).join('\n\n') || null
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: idea.title,
        pipeline_stage: '💡 Idea',
        format: idea.format || 'Long-form',
        notes: idea.description || null,
        video_type: idea.video_type || null,
        unique_angle: uniqueAngle,
        status: 'active',
        archived: false,
      })
      .select()
      .single()
    if (error || !data) return false
    setItems(prev => [data, ...prev])
    return true
  }

  async function saveRevenueNote(item: ContentItem, note: string) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, revenue_note: note } : i))
    await supabase.from('content_items').update({ revenue_note: note || null }).eq('id', item.id)
  }

  const focusCount = items.filter(i => i.is_active_focus).length

  async function toggleFocus(item: ContentItem) {
    if (!item.is_active_focus && focusCount >= maxFocusItems) return // capped in the UI too, this is a safety net
    const next = !item.is_active_focus
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: next } : i))
    const { error } = await supabase.from('content_items').update({ is_active_focus: next }).eq('id', item.id)
    if (error) {
      // Revert the optimistic update — most likely cause is migration
      // 018_content_focus.sql not having been run yet (is_active_focus
      // column doesn't exist), so surface that clearly instead of failing silently.
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: !next } : i))
      setFocusMsg(
        error.message?.toLowerCase().includes('is_active_focus')
          ? "Setup needed: run supabase/migrations/018_content_focus.sql against your database before pinning works."
          : 'Could not save — ' + error.message
      )
    }
  }

  async function promoteToValidated(item: ContentItem) {
    await moveStage(item, '✅ Validated')
  }

  async function saveIdeaField(item: ContentItem, patch: Partial<Pick<ContentItem, 'title' | 'notes' | 'format' | 'video_type' | 'unique_angle'>>) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))
    setValidatingItem(prev => prev && prev.id === item.id ? { ...prev, ...patch } : prev)
    await supabase.from('content_items').update(patch).eq('id', item.id)
  }

  async function openValidate(item: ContentItem) {
    setValidatingItem(item)
    setValidationResult(null)
    setValidationMsg(null)
    setIdeaLog(null)
    setIdeaLogMsg(null)
    const { output, error } = await getStageNote(item.id, IDEA_VALIDATION_SOP_ID)
    if (error) { setValidationMsg(error) } else if (output) {
      try { setValidationResult(JSON.parse(output) as ValidationResult) } catch { /* stale/invalid — ignore, user can re-run */ }
    }
    const { output: logOutput, error: logError } = await getStageNote(item.id, IDEA_LOG_SOP_ID)
    if (logError) { setIdeaLogMsg(logError); return }
    if (logOutput) {
      try { setIdeaLog(JSON.parse(logOutput) as IdeaLog) } catch { /* stale/invalid — ignore */ }
    }
  }

  async function saveIdeaLog(item: ContentItem, reply: string, nextSteps: string) {
    const log: IdeaLog = { reply, nextSteps, loggedAt: new Date().toISOString() }
    const { error } = await saveStageNote(item.id, IDEA_LOG_SOP_ID, JSON.stringify(log))
    if (error) { setIdeaLogMsg(error); return }
    setIdeaLog(log)
    setIdeaLogMsg(null)
  }

  async function runValidation(item: ContentItem, model: string, webSearch: boolean) {
    setValidationLoading(true)
    setValidationMsg(null)
    const { systemPrompt, userPrompt } = buildValidationPrompt(item)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model, webSearch }),
      })
      const data = await res.json()
      if (data?.error) { setValidationMsg('API error: ' + JSON.stringify(data.error)); return }
      // With web search enabled, Claude's response can include tool_use /
      // web_search_tool_result blocks alongside the text — concatenate every
      // text block rather than assuming the answer is in content[0].
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n')
        .trim()
      if (!raw) { setValidationMsg('Empty response from Claude.'); return }
      const parsed = parseModelJson<ValidationResult>(raw)
      const result: ValidationResult = { ...parsed, model }
      setValidationResult(result)
      await saveStageNote(item.id, IDEA_VALIDATION_SOP_ID, JSON.stringify(result))
    } catch (e) {
      setValidationMsg('Validation failed: ' + String(e))
    } finally {
      setValidationLoading(false)
    }
  }

  // Ideas Bank follows the Priority tab's ranking (cPriorityOrder) — reorder
  // there and the bank re-sorts to match. Ideas with no rank yet fall in
  // after the ranked ones, keeping their normal created_at-desc order.
  const ideas    = items
    .filter(i => i.pipeline_stage === '💡 Idea' || !i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))
    .sort((a, b) => {
      const ai = cPriorityOrder.indexOf(a.id), bi = cPriorityOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  const pipeline = items.filter(i => i.pipeline_stage && STAGE_KEYS.includes(i.pipeline_stage) && i.pipeline_stage !== '💡 Idea')
  const liveCount = items.filter(i => i.pipeline_stage === '📣 Live').length

  const boardItems = pipeline.filter(i => pipelineFormat === 'shorts' ? isShortsOnly(i.format) : !isShortsOnly(i.format))
  const boardStages = pipelineFormat === 'shorts' ? PIPELINE_STAGES.filter(s => !isStageSkippedForShorts(s.key, 'Short')) : PIPELINE_STAGES
  const byStage = boardStages.map(s => ({
    ...s,
    items: boardItems.filter(i => i.pipeline_stage === s.key),
  }))

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(255,107,53,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.5rem', padding:0 }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.3rem,3vw,1.75rem)', fontWeight:900, margin:'0 0 0.15rem', letterSpacing:'-0.02em' }}>
                &#127909; YouTube Pipeline
              </h1>
              <p style={{ fontSize:'0.8rem', color:C.sec, margin:0 }}>
                {ideas.length} ideas &bull; {pipeline.length} in production &bull; {liveCount} live
              </p>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' as const }}>
              {/* View switcher */}
              <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', overflow:'hidden' }}>
                {([
                  { v:'ideas',    icon:<Lightbulb size={12}/>,  label:'Ideas' },
                  { v:'pipeline', icon:<LayoutGrid size={12}/>, label:'Pipeline' },
                  { v:'priority', icon:<ArrowUpDown size={12}/>,label:'Priority' },
                  { v:'list',     icon:<List size={12}/>,       label:'All' },
                ] as const).map(({ v, icon, label }) => (
                  <button key={v} onClick={() => setView(v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.8rem', background:view===v?C.surface:'transparent', border:'none', color:view===v?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                    {icon}{label}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'linear-gradient(135deg,'+C.amber+',#d97706)', border:'none', borderRadius:'0.625rem', color:'#000', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:800 }}>
                <Plus size={14}/>New idea
              </button>
            </div>
          </div>

          {/* Pipeline stage legend */}
          {view === 'pipeline' && (
            <div style={{ marginTop:'0.875rem', display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              {PIPELINE_STAGES.map(s => (
                <button key={s.key} title={s.tip + ' — click to view SOP'} onClick={() => setSopStageKey(s.key)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.62rem', color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', cursor:'pointer', fontFamily:'inherit' }}>
                  {s.key}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'1.5rem 2rem', maxWidth:'1400px', margin:'0 auto' }}>
        {focusMsg && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.amber, margin:0, lineHeight:1.5, flex:1 }}>{focusMsg}</p>
            <button onClick={() => setFocusMsg(null)} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </div>
        )}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:C.muted, padding:'2rem 0' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.orange, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            Loading pipeline...
          </div>
        ) : view === 'ideas' ? (

          /* ── IDEAS BANK ── */
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, margin:'0 0 0.2rem' }}>&#128161; Ideas Bank</h2>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0 }}>{ideas.length} ideas &mdash; validate before moving to production</p>
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setShowFindIdeas(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                  <Sparkles size={13}/>Find ideas
                </button>
                <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.625rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                  <Plus size={13}/>Add idea
                </button>
              </div>
            </div>

            <div style={{ padding:'0.75rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.75rem', marginBottom:'1.25rem' }}>
              <p style={{ fontSize:'0.72rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                <strong style={{ color:C.amber }}>Idea technique:</strong> combine two popular subjects together and ask what the overlap looks like &mdash; e.g. <em>gold standard</em> + <em>money</em> &rarr; &ldquo;What is the gold standard, and how to create money?&rdquo; Two proven topics collide into one angle nobody else has made.
              </p>
            </div>

            {/* -- Channels to Watch -- */}
            <div style={{ marginBottom:'1.5rem' }}>
              <button onClick={() => setShowChannelsPanel(v => !v)} style={{ display:'flex', alignItems:'center', gap:'0.5rem', width:'100%', padding:'0.75rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:800 }}>
                <Tv size={14} color={C.cyan}/> Channels to Watch
                <span style={{ fontSize:'0.68rem', color:C.muted, fontWeight:600 }}>({channels.length})</span>
                <ChevronDown size={14} style={{ marginLeft:'auto', transform: showChannelsPanel ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
              </button>

              {showChannelsPanel && (
                <div style={{ marginTop:'0.5rem', padding:'1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:'0 0 0.875rem', lineHeight:1.5 }}>
                    YouTube channels in your niche or an adjacent one worth keeping an eye on &mdash; for formats, angles, and outlier ideas.
                  </p>
                  {channelsMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0 0 0.75rem', lineHeight:1.4 }}>{channelsMsg}</p>}

                  {channels.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem', marginBottom:'0.875rem' }}>
                      {channels.map(c => (
                        <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' as const }}>
                              <span style={{ fontSize:'0.8rem', fontWeight:700, color:C.text }}>{c.name}</span>
                              {c.niche && (
                                <span style={{ fontSize:'0.62rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'9999px', padding:'0.1rem 0.5rem', fontWeight:700 }}>{c.niche}</span>
                              )}
                            </div>
                            {c.notes && <p style={{ fontSize:'0.72rem', color:C.sec, margin:'0.25rem 0 0', lineHeight:1.45 }}>{c.notes}</p>}
                          </div>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color:C.cyan, display:'flex', flexShrink:0, marginTop:'0.15rem' }} title="Open channel">
                            <ExternalLink size={14}/>
                          </a>
                          <button onClick={() => removeChannel(c.id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', flexShrink:0, padding:'0.15rem', marginTop:'0.15rem' }} title="Remove">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showChannelForm ? (
                    <div style={{ padding:'0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'0.6rem' }}>
                        <input value={channelDraft.name} onChange={e => setChannelDraft(d => ({ ...d, name:e.target.value }))} placeholder="Channel name" style={CH_INPUT} autoFocus/>
                        <input value={channelDraft.niche} onChange={e => setChannelDraft(d => ({ ...d, niche:e.target.value }))} placeholder="Niche (optional)" style={CH_INPUT}/>
                      </div>
                      <input value={channelDraft.url} onChange={e => setChannelDraft(d => ({ ...d, url:e.target.value }))} placeholder="https://youtube.com/@..." style={{ ...CH_INPUT, width:'100%', marginBottom:'0.6rem', boxSizing:'border-box' as const }}/>
                      <textarea value={channelDraft.notes} onChange={e => setChannelDraft(d => ({ ...d, notes:e.target.value }))} placeholder="Why watch them / what's interesting about their videos..." rows={2} style={{ ...CH_INPUT, width:'100%', marginBottom:'0.75rem', boxSizing:'border-box' as const, resize:'vertical' as const }}/>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <button onClick={submitChannel} disabled={savingChannel || !channelDraft.name.trim() || !channelDraft.url.trim()}
                          style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', opacity: savingChannel || !channelDraft.name.trim() || !channelDraft.url.trim() ? 0.5 : 1 }}>
                          {savingChannel ? 'Adding…' : 'Add channel'}
                        </button>
                        <button onClick={() => { setShowChannelForm(false); setChannelDraft({ name:'', url:'', niche:'', notes:'' }) }}
                          style={{ padding:'0.5rem 1rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowChannelForm(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.875rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                      <Plus size={13}/> Add channel
                    </button>
                  )}
                </div>
              )}
            </div>

            {ideas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem 1rem', color:C.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.5rem', opacity:0.4 }}>&#128161;</div>
                <p style={{ margin:0, fontSize:'0.85rem' }}>No ideas yet. Add the first one.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' as const }}>
                <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:'0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid '+C.border }}>
                      {['#','Focus','Title','Type','Format','Alpha (unique angle)','Notes / Angle','Added','Actions'].map(h => (
                        <th key={h} style={{ padding:'0.5rem 0.875rem', textAlign:'left' as const, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.muted, whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map(item => {
                      const rank = cPriorityOrder.indexOf(item.id)
                      return (
                      <tr key={item.id} style={{ borderBottom:'1px solid '+C.border+'60' }}>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {rank === -1
                            ? <span style={{ fontSize:'0.7rem', color:C.muted }}>&mdash;</span>
                            : <span style={{ fontSize:'0.7rem', fontWeight:800, color:C.orange }}>{rank + 1}</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          <FocusStar active={item.is_active_focus} atCap={focusCount >= maxFocusItems} max={maxFocusItems} onToggle={() => toggleFocus(item)}/>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', fontWeight:700, color:C.text, maxWidth:'240px' }}>
                          <div
                            onClick={() => openValidate(item)}
                            title="Open idea — view/edit and validate"
                            style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', cursor:'pointer' }}
                          >
                            <span style={{ lineHeight:1.4, textDecoration:'underline', textDecorationColor:'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecorationColor = C.muted)}
                              onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                            >{item.title}</span>
                          </div>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.video_type
                            ? <span style={{ fontSize:'0.65rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.video_type}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.format
                            ? <span style={{ fontSize:'0.68rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.format}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.purple, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.unique_angle || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.sec, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.notes || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.muted, whiteSpace:'nowrap' as const, fontSize:'0.72rem' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—'}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                            <button onClick={() => openValidate(item)} title="Open the idea-validation checklist" style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.65rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                              <Sparkles size={11}/>Validate
                            </button>
                            <button onClick={() => setMoveTarget(item)} style={{ padding:'0.3rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem' }}>
                              Move
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : view === 'pipeline' ? (

          /* ── PIPELINE KANBAN ── */
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.6rem', marginBottom:'0.75rem' }}>
              <p style={{ fontSize:'0.75rem', color:C.muted, margin:0 }}>
                Hover a stage chip to see the SOP checklist for that step. {boardItems.length} in this board.
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap' as const }}>
                <div title="How many items can be starred as active focus on Home at once" style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', padding:'0.3rem 0.5rem' }}>
                  <Star size={11} color={C.amber}/>
                  <span style={{ fontSize:'0.68rem', color:C.sec, whiteSpace:'nowrap' as const }}>Focus slots</span>
                  <button onClick={() => updateMaxFocusItems(maxFocusItems - 1)} disabled={maxFocusItems <= 1}
                    style={{ width:'1.1rem', height:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.3rem', color: maxFocusItems <= 1 ? C.muted : C.sec, cursor: maxFocusItems <= 1 ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.7rem', lineHeight:1, padding:0 }}>&minus;</button>
                  <span style={{ fontSize:'0.75rem', fontWeight:800, color:C.text, width:'1.1rem', textAlign:'center' }}>{maxFocusItems}</span>
                  <button onClick={() => updateMaxFocusItems(maxFocusItems + 1)} disabled={maxFocusItems >= 20}
                    style={{ width:'1.1rem', height:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.3rem', color: maxFocusItems >= 20 ? C.muted : C.sec, cursor: maxFocusItems >= 20 ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.7rem', lineHeight:1, padding:0 }}>+</button>
                </div>
                <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', overflow:'hidden' }}>
                  {([
                    { v:'long' as const,   label:'Long-form',    count: pipeline.filter(i => !isShortsOnly(i.format)).length },
                    { v:'shorts' as const, label:'Shorts',       count: pipeline.filter(i => isShortsOnly(i.format)).length },
                  ]).map(b => (
                    <button key={b.v} onClick={() => setPipelineFormat(b.v)} style={{ padding:'0.4rem 0.75rem', background:pipelineFormat===b.v?'rgba(0,212,255,0.12)':'transparent', border:'none', borderRight: b.v==='long' ? '1px solid '+C.border : 'none', color:pipelineFormat===b.v?C.cyan:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                      {b.label} <span style={{ opacity:0.7 }}>({b.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {maxFocusMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0 0 0.75rem', lineHeight:1.4 }}>{maxFocusMsg}</p>}
            {pipelineFormat === 'shorts' && (
              <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0 0 1rem', fontStyle:'italic' }}>
                Shorts board — Thumbnail &amp; SEO is skipped entirely; Editing advances straight to Scheduled.
              </p>
            )}

            {weeklyTargets.length > 0 && (
              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.cyan, margin:0, alignSelf:'center', flexShrink:0 }}>This week&apos;s pick:</p>
                {weeklyTargets.map(t => {
                  const wantsShort = t.tracking === 'auto_shorts'
                  const candidates = items.filter(i =>
                    (wantsShort ? (i.format === 'Short' || i.format === 'Both') : (i.format === 'Long-form' || i.format === 'Both')) &&
                    i.pipeline_stage !== '📣 Live' && i.pipeline_stage !== '📊 Post-Published'
                  )
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <span style={{ fontSize:'0.72rem', color:C.sec, flexShrink:0 }}>{t.label}:</span>
                      <select value={weeklyPicks[t.id] ?? ''} onChange={e => setWeeklyPick(t.id, e.target.value)}
                        style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.75rem', padding:'0.3rem 0.5rem', maxWidth:'220px' }}>
                        <option value="">&mdash; none picked &mdash;</option>
                        {candidates.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:'0.625rem', alignItems:'start' }}>
              {byStage.map(stage => (
                <div key={stage.key} style={{ background:stage.bg, border:'1px solid '+stage.color+'28', borderRadius:'1rem', padding:'0.875rem' }}>
                  <button onClick={() => setSopStageKey(stage.key)} title="View SOP for this stage" style={{
                    display:'block', width:'100%', textAlign:'left', background:'none', border:'none',
                    padding:0, marginBottom:'0.75rem', cursor:'pointer', fontFamily:'inherit',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:800, color:stage.color, display:'flex', alignItems:'center', gap:'0.3rem' }}>
                        {stage.key}
                        <FileText size={10} style={{ opacity:0.55, flexShrink:0 }}/>
                      </span>
                      <span style={{ fontSize:'0.62rem', color:stage.color, background:stage.color+'18', borderRadius:'9999px', padding:'0.1rem 0.375rem', fontWeight:700 }}>{stage.items.length}</span>
                    </div>
                    <p style={{ fontSize:'0.6rem', color:C.muted, margin:0, lineHeight:1.45 }}>{stage.tip}</p>
                  </button>
                  {stage.items.length === 0 ? (
                    <p style={{ fontSize:'0.65rem', color:C.muted, textAlign:'center', padding:'0.75rem 0', margin:0 }}>empty</p>
                  ) : (
                    stage.items.map(item => <PipelineCard key={item.id} item={item} stats={ytStats[extractYouTubeId(item.youtube_url) ?? ''] } onMove={() => setMoveTarget(item)} onSaveRevenue={note => saveRevenueNote(item, note)} onToggleFocus={() => toggleFocus(item)} focusAtCap={focusCount >= maxFocusItems} focusMax={maxFocusItems} onShowDetail={() => setDetailItem(item)}/>)
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : view === 'priority' ? (() => {

          /* ── PRIORITY (drag to rank) ── */
          const poolItems = items.filter(i => i.pipeline_stage !== '📣 Live' && i.pipeline_stage !== '📊 Post-Published')
          const cValid = cPriorityOrder.filter(id => poolItems.some(i => i.id === id))
          const cAssigned = new Set(cValid)
          const cUnassigned = poolItems.filter(i => !cAssigned.has(i.id))
          return (
            <div>
              <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.25rem' }}>
                Drag ideas/pipeline items into rank order &mdash; this is what the home page&apos;s YouTube priority card reads from. Live and Post-Published items aren&apos;t included; they don&apos;t need ranking anymore.
              </p>

              {/* Unassigned zone */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                  {cUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{cUnassigned.length}</span>}
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into priority list to rank</p>
                </div>
                {cUnassigned.length === 0 ? (
                  <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                    <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All items assigned</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                    onDragOver={e => { e.preventDefault(); setCDragOver('unassigned-zone') }}
                    onDrop={e => {
                      e.preventDefault()
                      if (cDragFrom === 'priority' && cDragId) saveContentPriority(cValid.filter(i => i !== cDragId))
                      setCDragId(null); setCDragOver(null); setCDragFrom(null)
                    }}>
                    {cUnassigned.map(item => (
                      <div key={item.id} draggable
                        onDragStart={() => { setCDragId(item.id); setCDragFrom('unassigned') }}
                        onDragEnd={() => { setCDragId(null); setCDragOver(null); setCDragFrom(null) }}
                        style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', cursor:'grab', opacity: cDragId===item.id ? 0.4 : 1 }}>
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.title}</span>
                        {item.format && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                        <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{item.pipeline_stage ?? '💡 Idea'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority list */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.orange, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{cValid.length} items ranked</p>
                </div>
                {cValid.length === 0 ? (
                  <div style={{ padding:'2.5rem 1.5rem', textAlign:'center', border:'2px dashed '+(cDragOver==='c-priority-empty' ? C.orange : C.border), borderRadius:'0.875rem', background: cDragOver==='c-priority-empty' ? 'rgba(249,115,22,0.05)' : 'transparent', transition:'all 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setCDragOver('c-priority-empty') }}
                    onDrop={e => { e.preventDefault(); if (cDragFrom==='unassigned'&&cDragId) saveContentPriority([cDragId]); setCDragId(null); setCDragOver(null); setCDragFrom(null) }}>
                    <p style={{ fontSize:'0.82rem', color:C.muted, margin:0 }}>Drag items here to start ranking</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                    {cValid.map((id, idx) => {
                      const item = poolItems.find(i => i.id === id)
                      if (!item) return null
                      return (
                        <div key={id} draggable
                          onDragStart={() => { setCDragId(id); setCDragFrom('priority') }}
                          onDragEnd={() => { setCDragId(null); setCDragOver(null); setCDragFrom(null) }}
                          onDragOver={e => { e.preventDefault(); setCDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && cDragOver===id) setCDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (cDragFrom==='unassigned'&&cDragId) { const o=[...cValid]; o.splice(idx,0,cDragId); saveContentPriority(o) }
                            else if (cDragFrom==='priority'&&cDragId&&cDragId!==id) { const w=cValid.filter(i=>i!==cDragId); w.splice(w.indexOf(id),0,cDragId); saveContentPriority(w) }
                            setCDragId(null); setCDragOver(null); setCDragFrom(null)
                          }}
                          style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background: cDragOver===id ? 'rgba(249,115,22,0.07)' : C.surface, border:'1px solid '+(cDragOver===id ? C.orange : C.border), borderRadius:'0.75rem', cursor:'grab', opacity: cDragId===id ? 0.4 : 1, transition:'background 0.1s, border-color 0.1s' }}>
                          <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:700, minWidth:'1.25rem', userSelect:'none' as const }}>{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.title}</span>
                          {item.format && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                          <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{item.pipeline_stage ?? '💡 Idea'}</span>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveContentPriority([id, ...cValid.filter(i=>i!==id)]) }} style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:C.orange, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveContentPriority([...cValid.filter(i=>i!==id), id]) }} style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:C.orange, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button type="button" draggable={false} onClick={e => { e.stopPropagation(); saveContentPriority(cValid.filter(i=>i!==id)) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}>x</button>
                        </div>
                      )
                    })}
                    {/* Drop on bottom */}
                    <div style={{ height:'2rem', borderRadius:'0.75rem', border:'2px dashed '+(cDragOver==='__c_bottom__' ? C.orange : 'transparent'), background: cDragOver==='__c_bottom__' ? 'rgba(249,115,22,0.05)' : 'transparent', transition:'all 0.15s', marginTop:'0.25rem' }}
                      onDragOver={e => { e.preventDefault(); setCDragOver('__c_bottom__') }}
                      onDrop={e => {
                        e.preventDefault()
                        if (cDragFrom==='unassigned'&&cDragId) saveContentPriority([...cValid,cDragId])
                        else if (cDragFrom==='priority'&&cDragId) saveContentPriority([...cValid.filter(i=>i!==cDragId),cDragId])
                        setCDragId(null); setCDragOver(null); setCDragFrom(null)
                      }} />
                  </div>
                )}
              </div>
            </div>
          )
        })() : (

          /* ── ALL / LIST ── */
          <div>
            <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1rem' }}>{items.length} total videos across all stages</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              {ALL_STAGES.map(stage => {
                const group = items.filter(i => i.pipeline_stage === stage.key || (stage.key === '💡 Idea' && (!i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))))
                if (group.length === 0) return null
                return (
                  <div key={stage.key} style={{ marginBottom:'0.5rem' }}>
                    <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:stage.color, margin:'0 0 0.35rem' }}>
                      {stage.key} <span style={{ fontWeight:500, color:C.muted }}>({group.length})</span>
                    </p>
                    {group.map(item => (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 0.875rem', background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.75rem', marginBottom:'0.25rem' }}>
                        <FocusStar active={item.is_active_focus} atCap={focusCount >= maxFocusItems} max={maxFocusItems} onToggle={() => toggleFocus(item)}/>
                        <p style={{ flex:1, fontSize:'0.83rem', fontWeight:600, color:C.text, margin:0 }}>{item.title}</p>
                        {item.format && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                        {item.due_date && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.due_date}</span>}
                        <button onClick={() => setMoveTarget(item)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', padding:'0.2rem 0.5rem', flexShrink:0 }}>Move</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {moveTarget && <MoveModal item={moveTarget} onMove={s => moveStage(moveTarget, s)} onClose={() => setMoveTarget(null)}/>}
      {detailItem && <ContentItemDetail itemId={detailItem.id} onClose={() => setDetailItem(null)}/>}
      {sopStageKey && <SopViewerModal stageKey={sopStageKey} onClose={() => setSopStageKey(null)}/>}
      {showAdd    && <AddIdeaModal onAdd={addIdea} onClose={() => setShowAdd(false)}/>}
      {showFindIdeas && (
        <FindIdeasModal
          onGenerate={runFindIdeas}
          onAdd={addFoundIdea}
          onClose={() => setShowFindIdeas(false)}
        />
      )}
      {validatingItem && (
        <IdeaDetailModal
          item={validatingItem}
          result={validationResult}
          loading={validationLoading}
          msg={validationMsg}
          ideaLog={ideaLog}
          ideaLogMsg={ideaLogMsg}
          onSaveField={patch => saveIdeaField(validatingItem, patch)}
          onSaveLog={(reply, nextSteps) => saveIdeaLog(validatingItem, reply, nextSteps)}
          onCreateIdeaFromAlternative={alt => addIdeaFromAlternative(validatingItem, alt)}
          onRun={(model, webSearch) => runValidation(validatingItem, model, webSearch)}
          onPromote={() => { promoteToValidated(validatingItem); setValidatingItem(null) }}
          onClose={() => setValidatingItem(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}
