'use client'
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Play, Pause, RefreshCw, SkipForward, Wind, Waves, VolumeX, Zap, Music2, ChevronRight, Sparkles, Clapperboard, FolderOpen } from 'lucide-react'
import { supabase, getActiveFocusVideos, getContentItemById, getStageNote, saveStageNote, updateContentItemFields, type ActiveFocusVideo } from '@/lib/supabase'
import { stageAdvance, sopForStage, nextSessionChunk, allSessionChunks } from '@/lib/sops'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'
import FoodProgress from '@/components/FoodProgress'
import MemeSuggestions from '@/components/MemeSuggestions'
import ContentItemDetail from '@/components/ContentItemDetail'
import YapSession from '@/components/YapSession'
import Storyboard from '@/components/Storyboard'
import BrandAssets from '@/components/BrandAssets'

// ============================================================
// YouTube-Pipeline-driven Focus Session
// Replaces the generic workflow_sessions source for the Home page's
// "Start focus session" button. Drives a focus session off however many
// content_items are pinned in the Content Pipeline (is_active_focus =
// true) — the cap is Tom's own setting (content_focus_settings, see
// lib/supabase.ts getMaxFocusItems), not a hardcoded 2 — falling back to
// the item(s) that have sat longest in their current stage if fewer than
// the cap are pinned. Each video's current pipeline_stage maps to
// an SOP checklist (lib/sops.ts) — ticking every step advances the item to
// its next pipeline stage. Session goal: complete 1 stage on each pinned
// video. Reuses the same focus-mode shell (pomodoro, ambient sound,
// distraction tracker, Rohn affirmations, food progress) that the old
// generic workflow_sessions/stages/tasks system used, re-pointed at
// Pipeline + SOP data (that legacy system has since been removed).
// ============================================================

const C = {
  bg: '#0a0a0f', surface: '#12121a', card: '#1a1a26', border: '#2a2a3a',
  cyan: '#00d4ff', green: '#00ff88', amber: '#ffb800', purple: '#8b5cf6',
  text: '#f0f0ff', sec: '#8888aa', muted: '#4a4a6a',
}

// Kept in sync with app/content/page.tsx's own VIDEO_TYPES list.
const VIDEO_TYPES = ['How-To', 'Listicle', 'Case Study', 'Explainer', 'Testimonial/Interview']

const ROHN = [
  "Either you run the day or the day runs you.",
  "Discipline is the bridge between goals and accomplishment.",
  "Don't wish it was easier. Wish you were better.",
  "Success is nothing more than a few simple disciplines, practiced every day.",
  "We must all suffer one of two things: the pain of discipline or the pain of regret.",
  "You cannot change your destination overnight, but you can change your direction overnight.",
  "Work harder on yourself than you do on your job.",
  "Only do something you want after doing something you need.",
  "If you really want to do something, you'll find a way. If you don't, you'll find an excuse.",
  "Every day, stand guard at the door of your mind.",
  "For things to change, you have to change. For things to get better, you have to get better.",
  "Start from wherever you are and with whatever you've got.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "You don't get paid for the hour. You get paid for the value you bring to the hour.",
]

type AmbientMode = 'off' | 'whitenoise' | 'waves'

type StageOverlay = { title: string; from: string; to: string; action: 'switch' | 'complete'; nextIdx: number }

function ContentFocusPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [videos, setVideos] = useState<ActiveFocusVideo[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoIdx, setVideoIdx] = useState(0)
  const [stepDone, setStepDone] = useState<Record<string, Set<number>>>({})
  const [stageGoalMet, setStageGoalMet] = useState<Set<number>>(new Set())
  const [stageOverlay, setStageOverlay] = useState<StageOverlay | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

  // ── Chunked session mode (?item=<id>) ──────────────────────────────────
  // Entered by clicking a specific item on the Content Pipeline or a Home
  // priority card. Locks to that one item, works only the next 3-4
  // uncompleted steps (lib/sops.ts nextSessionChunk) instead of the whole
  // stage checklist, auto-starts a countdown sized to those steps'
  // estimated minutes, and logs the sitting to content_focus_sessions so
  // Home can show "N focus sessions today". The default (no ?item=) flow
  // above is left completely alone — still the pinned-videos, full-stage
  // checklist, manual-pomodoro experience.
  //
  // Chunk-to-chunk transitions are seamless by design: finishing a chunk's
  // tasks rolls straight into the next one (new steps, fresh timer, no
  // modal, no reload) so the session never breaks focus. The one place that
  // DOES stop and wait for you is the end of the whole stage — advancing a
  // video to its next pipeline stage is a real decision, so that gets an
  // explicit "Move to next stage" button instead of happening automatically.
  // The countdown is a soft pacing target, not a hard cutoff: running past
  // zero doesn't interrupt anything, it just turns red.
  const chunkItemParam = searchParams.get('item')
  const [chunkMode, setChunkMode] = useState(false)
  const [chunkStepIndices, setChunkStepIndices] = useState<number[]>([])
  const [chunkTotalMins, setChunkTotalMins] = useState(0)
  const [chunkSecondsLeft, setChunkSecondsLeft] = useState(0)
  const [chunkSessionId, setChunkSessionId] = useState<string | null>(null)
  const advancingChunkRef = useRef(false)
  // True once every step in the whole stage (not just this chunk) is
  // checked — the one deliberate stop in an otherwise seamless session, so
  // advancing the video to its next pipeline stage is always a conscious
  // click (see advanceStageSeamless below), never automatic.
  const [stageReadyToAdvance, setStageReadyToAdvance] = useState(false)

  const [ambient, setAmbient] = useState<AmbientMode>('off')
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [ytTrack, setYtTrack] = useState<0|1|2|3|4|5>(0)
  const [rohnIdx, setRohnIdx] = useState(() => Math.floor(Math.random() * ROHN.length))
  const [affirmKey, setAffirmKey] = useState(0)
  const [focusMins, setFocusMins] = useState(0)
  const [isDistracted, setIsDistracted] = useState(false)
  const [distractedMins, setDistractedMins] = useState(0)
  const focusStartRef = useRef<number>(Date.now())
  const distractedMsRef = useRef(0)
  const distractedSinceRef = useRef<number | null>(null)
  const { celebrate } = useCelebration()

  const onWork = useCallback(() => { sounds.playTimerEnd(); celebrate('task') }, [celebrate])
  const onBreak = useCallback(() => { sounds.playBreakStart() }, [])
  const pom = usePomodoro({ onWorkComplete: onWork, onBreakComplete: onBreak })

  // ---- Load pinned videos (+ fallback fill) and their checklist progress ----
  const load = useCallback(async () => {
    setLoading(true)
    const { videos: combined, error } = await getActiveFocusVideos()
    setVideos(combined)
    setLoadError(error)

    if (combined.length > 0) {
      const { data: completions } = await supabase
        .from('content_step_completions')
        .select('content_item_id,sop_id,step_index')
        .in('content_item_id', combined.map(v => v.id))
      const map: Record<string, Set<number>> = {}
      ;(completions ?? []).forEach((row: { content_item_id: string; sop_id: string; step_index: number }) => {
        const item = combined.find(v => v.id === row.content_item_id)
        // Only restore ticks that belong to the item's CURRENT sop — stale
        // ticks from a stage the item has already moved past are ignored.
        if (item && sopForStage(item.pipeline_stage, item.format)?.id === row.sop_id) {
          if (!map[row.content_item_id]) map[row.content_item_id] = new Set()
          map[row.content_item_id].add(row.step_index)
        }
      })
      setStepDone(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (!chunkItemParam) load() }, [load, chunkItemParam])

  // ── Chunked session load ────────────────────────────────────────────
  const loadChunkItem = useCallback(async (id: string, keepSessionId?: boolean) => {
    setLoading(true)
    setStageReadyToAdvance(false)
    const { video, error } = await getContentItemById(id)
    if (!video) {
      setLoadError(error)
      setVideos([])
      setLoading(false)
      return
    }
    setLoadError(null)
    setVideos([video])
    setVideoIdx(0)
    setChunkMode(true)

    const sopObj = sopForStage(video.pipeline_stage, video.format)
    let doneIdx = new Set<number>()
    if (sopObj) {
      const { data: completions } = await supabase
        .from('content_step_completions')
        .select('step_index')
        .eq('content_item_id', id).eq('sop_id', sopObj.id)
      doneIdx = new Set((completions ?? []).map((r: { step_index: number }) => r.step_index))
    }
    setStepDone({ [id]: doneIdx })

    if (sopObj) {
      const chunk = nextSessionChunk(sopObj, doneIdx)
      if (chunk) {
        setChunkStepIndices(chunk.stepIndices)
        setChunkTotalMins(chunk.totalMins)
        setChunkSecondsLeft(chunk.totalMins * 60)
        if (!keepSessionId) {
          const { data: sess } = await supabase.from('content_focus_sessions')
            .insert({ content_item_id: id, sop_id: sopObj.id, step_indices: chunk.stepIndices, estimated_mins: chunk.totalMins, status: 'in_progress' })
            .select('id').single()
          setChunkSessionId((sess as { id: string } | null)?.id ?? null)
        }
      } else {
        setChunkStepIndices([])
        setChunkTotalMins(0)
        setChunkSecondsLeft(0)
      }
    }
    resetFocusSession()
    setLoading(false)
  }, [])

  useEffect(() => { if (chunkItemParam) loadChunkItem(chunkItemParam) }, [chunkItemParam, loadChunkItem])

  // Countdown ticks once a second while a chunk session is active. Allowed
  // to run past zero into negative territory (rendered as a red "+overrun"
  // readout) instead of stopping anything -- it's a soft pacing target, not
  // a hard cutoff that would interrupt the session.
  useEffect(() => {
    if (!chunkMode || stageReadyToAdvance) return
    const id = setInterval(() => setChunkSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [chunkMode, stageReadyToAdvance])

  // Called when a chunk's own steps are all checked but the wider stage
  // still has steps left for next time -- closes out this chunk's session
  // row and rolls straight into the next chunk. No modal, no reload: the
  // checklist card just swaps its contents under the user.
  async function advanceToNextChunk() {
    if (!item || !sop) return
    const curDone = stepDone[item.id] ?? new Set<number>()
    if (chunkSessionId) {
      await supabase.from('content_focus_sessions').update({
        ended_at: new Date().toISOString(),
        actual_mins: focusMins,
        tasks_completed: chunkStepIndices.filter(i => curDone.has(i)).length,
        status: 'completed',
      }).eq('id', chunkSessionId)
    }
    sounds.playTaskComplete()
    celebrate('task')
    const chunk = nextSessionChunk(sop, curDone)
    if (!chunk) return // allStepsDone should have caught this -- guards against a race
    setChunkStepIndices(chunk.stepIndices)
    setChunkTotalMins(chunk.totalMins)
    setChunkSecondsLeft(chunk.totalMins * 60)
    const { data: sess } = await supabase.from('content_focus_sessions')
      .insert({ content_item_id: item.id, sop_id: sop.id, step_indices: chunk.stepIndices, estimated_mins: chunk.totalMins, status: 'in_progress' })
      .select('id').single()
    setChunkSessionId((sess as { id: string } | null)?.id ?? null)
    // focusMins/distractedMins deliberately NOT reset here -- the whole
    // stage is one continuous sitting; chunks just pace out the checklist.
  }

  // Called once every step in the WHOLE stage (not just this chunk) is
  // checked -- closes out the session row and surfaces the explicit "Move
  // to next stage" button (see advanceStageSeamless) instead of advancing
  // automatically, since that's a real decision worth a deliberate click.
  async function completeStageSession() {
    if (chunkSessionId) {
      const curDone = item ? (stepDone[item.id] ?? new Set<number>()) : new Set<number>()
      await supabase.from('content_focus_sessions').update({
        ended_at: new Date().toISOString(),
        actual_mins: focusMins,
        tasks_completed: chunkStepIndices.filter(i => curDone.has(i)).length,
        status: 'completed',
      }).eq('id', chunkSessionId)
    }
    sounds.playStageComplete()
    celebrate('stage')
    setStageReadyToAdvance(true)
  }

  // Watches for a chunk's steps all being ticked and reacts seamlessly --
  // either the whole stage is done (stop and wait for the explicit advance
  // button) or there's more of the stage left (roll into the next chunk).
  useEffect(() => {
    if (!chunkMode || stageReadyToAdvance || chunkStepIndices.length === 0 || advancingChunkRef.current) return
    const curDone = item ? (stepDone[item.id] ?? new Set<number>()) : new Set<number>()
    if (!chunkStepIndices.every(i => curDone.has(i))) return
    advancingChunkRef.current = true
    ;(async () => {
      if (allStepsDone) await completeStageSession()
      else await advanceToNextChunk()
      advancingChunkRef.current = false
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepDone])

  // Rotate affirmation every 25 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setRohnIdx(i => (i + 1) % ROHN.length)
      setAffirmKey(k => k + 1)
    }, 25000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => { sounds.stopAmbient() }, [])

  // Track focus minutes — increments every 30s
  useEffect(() => {
    focusStartRef.current = Date.now()
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - focusStartRef.current) / 60000)
      setFocusMins(elapsed)
      if (distractedSinceRef.current !== null) {
        const current = distractedMsRef.current + (Date.now() - distractedSinceRef.current)
        setDistractedMins(Math.floor(current / 60000))
      }
    }, 30000)
    return () => clearInterval(id)
  }, [])

  function resetFocusSession() {
    focusStartRef.current = Date.now()
    distractedMsRef.current = 0
    distractedSinceRef.current = null
    setFocusMins(0)
    setDistractedMins(0)
    setIsDistracted(false)
  }

  function toggleDistraction() {
    if (!isDistracted) {
      distractedSinceRef.current = Date.now()
      setIsDistracted(true)
    } else {
      if (distractedSinceRef.current !== null) {
        distractedMsRef.current += Date.now() - distractedSinceRef.current
        distractedSinceRef.current = null
      }
      setDistractedMins(Math.floor(distractedMsRef.current / 60000))
      setIsDistracted(false)
    }
  }

  function toggleYT(track: 1|2|3|4|5) { setYtTrack(prev => prev === track ? 0 : track) }
  function toggleAmbient(mode: AmbientMode) {
    if (ambient === mode) { sounds.stopAmbient(); setAmbient('off') }
    else { sounds.startAmbient(mode === 'off' ? 'whitenoise' : mode as 'whitenoise' | 'waves'); setAmbient(mode) }
  }

  const item = videos[videoIdx] ?? null
  const sop = item ? sopForStage(item.pipeline_stage, item.format) : null
  const nextStage = item ? stageAdvance(item.pipeline_stage ?? '', item.format) : undefined
  const steps = sop?.steps ?? []
  const doneSet = item ? (stepDone[item.id] ?? new Set<number>()) : new Set<number>()
  const allStepsDone = steps.length > 0 && doneSet.size === steps.length

  // Full deterministic chunk sequence for this stage, purely to answer
  // "chunk N of how many" for the progress indicator -- recomputed from the
  // SOP each render rather than persisted, so it can never drift from what
  // steps actually got ticked.
  const allChunks = useMemo(() => (chunkMode && sop) ? allSessionChunks(sop) : [], [chunkMode, sop])
  const currentChunkNumber = allChunks.findIndex(c =>
    c.stepIndices.length === chunkStepIndices.length && c.stepIndices.every((v, i) => v === chunkStepIndices[i])
  ) + 1
  const totalChunks = allChunks.length

  // ── Stage draft (content_stage_notes) ─────────────────────────────────────
  // The same note the Pipeline card's Produce / Consult Claude writes — shown
  // here so a focus session starts with the AI draft in front of you and your
  // edits flow straight back to the pipeline. Reloads when the video or its
  // stage changes.
  const [stageNote, setStageNote] = useState('')
  const [stageNoteKey, setStageNoteKey] = useState('')
  const [showStageNote, setShowStageNote] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [consulting, setConsulting] = useState(false)
  const [consultMsg, setConsultMsg] = useState<string | null>(null)
  const [showYap, setShowYap] = useState(false)
  const [showStoryboard, setShowStoryboard] = useState(false)
  const [showBrandAssets, setShowBrandAssets] = useState(false)
  const itemId = item?.id ?? null
  const sopId = sop?.id ?? null
  useEffect(() => {
    const key = itemId && sopId ? itemId + ':' + sopId : ''
    if (!key || key === stageNoteKey) return
    setStageNoteKey(key)
    setStageNote('')
    getStageNote(itemId!, sopId!).then(({ output }) => setStageNote(output ?? ''))
  }, [itemId, sopId, stageNoteKey])

  function saveCurrentStageNote() {
    if (itemId && sopId) saveStageNote(itemId, sopId, stageNote)
  }

  // ── Video Details (structured, not freeform) ────────────────────────────
  // Title/type/angle already existed as columns but were only ever set once
  // at Idea stage and never surfaced again; hook/thumbnail concept/thumbnail
  // link/SEO description/tags (043_video_detail_fields.sql) are brand new —
  // before this the only place any of it could go was buried inside a
  // paragraph of freeform stage notes. Synced from the item once per item id
  // (not every render) so in-progress typing never gets clobbered.
  const [videoDetailsKey, setVideoDetailsKey] = useState('')
  const [showVideoDetails, setShowVideoDetails] = useState(true)
  const [editTitle, setEditTitle] = useState('')
  const [editVideoType, setEditVideoType] = useState('')
  const [editUniqueAngle, setEditUniqueAngle] = useState('')
  const [editHook, setEditHook] = useState('')
  const [editThumbConcept, setEditThumbConcept] = useState('')
  const [editThumbUrl, setEditThumbUrl] = useState('')
  const [editSeoDescription, setEditSeoDescription] = useState('')
  const [editSeoTags, setEditSeoTags] = useState('')

  useEffect(() => {
    if (!itemId || itemId === videoDetailsKey) return
    setVideoDetailsKey(itemId)
    setEditTitle(item?.title ?? '')
    setEditVideoType(item?.video_type ?? '')
    setEditUniqueAngle(item?.unique_angle ?? '')
    setEditHook(item?.hook ?? '')
    setEditThumbConcept(item?.thumbnail_concept ?? '')
    setEditThumbUrl(item?.thumbnail_url ?? '')
    setEditSeoDescription(item?.seo_description ?? '')
    setEditSeoTags(item?.seo_tags ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, videoDetailsKey])

  type VideoFieldPatch = Parameters<typeof updateContentItemFields>[1]
  async function saveVideoField(field: keyof VideoFieldPatch, value: string, allowEmpty = true) {
    if (!itemId) return
    const trimmed = value.trim()
    if (!allowEmpty && !trimmed) { setEditTitle(item?.title ?? ''); return } // never allow blanking the title
    const patchValue = trimmed || null
    await updateContentItemFields(itemId, { [field]: patchValue } as VideoFieldPatch)
    setVideos(prev => prev.map(v => v.id === itemId ? ({ ...v, [field]: patchValue } as ActiveFocusVideo) : v))
  }

  // Consult Claude for the current stage — moved here from the Pipeline
  // card (see app/content/page.tsx PipelineCard) so all per-stage AI work
  // lives in one place: the focus session you're already sitting in.
  async function consultClaude() {
    if (!item || !sop) return
    setConsulting(true)
    setConsultMsg(null)
    const { systemPrompt, userPrompt } = buildStageDraftPrompt(item, sop, { existingNote: stageNote })
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt }),
      })
      const data = await res.json()
      if (data?.error) { setConsultMsg('API error: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      if (!raw) { setConsultMsg('Empty response from Claude.'); return }
      setStageNote(raw)
      setShowStageNote(true)
      if (itemId && sopId) await saveStageNote(itemId, sopId, raw)
    } catch (e) {
      setConsultMsg('Consult failed: ' + String(e))
    } finally {
      setConsulting(false)
    }
  }

  async function toggleStep(idx: number) {
    if (!item || !sop) return
    const cur = stepDone[item.id] ?? new Set<number>()
    const already = cur.has(idx)
    const next = new Set(cur)
    if (already) next.delete(idx); else next.add(idx)
    setStepDone(prev => ({ ...prev, [item.id]: next }))
    if (already) {
      await supabase.from('content_step_completions').delete()
        .eq('content_item_id', item.id).eq('sop_id', sop.id).eq('step_index', idx)
    } else {
      sounds.playTaskComplete()
      await supabase.from('content_step_completions')
        .upsert({ content_item_id: item.id, sop_id: sop.id, step_index: idx }, { onConflict: 'content_item_id,sop_id,step_index' })
    }
  }

  async function advanceStage() {
    if (!item) return
    const fromStage = item.pipeline_stage ?? ''
    const toStage = stageAdvance(fromStage, item.format)
    if (!toStage) return
    const idx = videoIdx
    sounds.playStageComplete()
    celebrate('stage')
    await supabase.from('content_items').update({ pipeline_stage: toStage }).eq('id', item.id)
    setVideos(prev => prev.map((v, i) => i === idx ? { ...v, pipeline_stage: toStage } : v))
    setStepDone(prev => ({ ...prev, [item.id]: new Set() }))

    const newGoalMet = new Set(stageGoalMet); newGoalMet.add(idx)
    setStageGoalMet(newGoalMet)

    // Find the next pinned video (in order, wrapping around) that hasn't hit
    // its goal yet — generalised from a hardcoded 2-video toggle now that
    // the focus-star cap (content_focus_settings) can be any number.
    let nextPendingIdx = -1
    for (let step = 1; step <= videos.length; step++) {
      const candidate = (idx + step) % videos.length
      if (candidate === idx) break
      if (!newGoalMet.has(candidate)) { nextPendingIdx = candidate; break }
    }
    const otherPending = nextPendingIdx !== -1

    setStageOverlay({
      title: item.title, from: fromStage, to: toStage,
      action: otherPending ? 'switch' : 'complete',
      nextIdx: otherPending ? nextPendingIdx : idx,
    })
  }

  // Chunk-mode's own stage-advance. Unlike advanceStage() (used by the
  // default multi-video flow, with its switch-video/overlay/session-complete
  // chain) this stays inline and rolls straight into the new stage's first
  // chunk -- the one deliberate stop in a chunk session is a single click,
  // not a chain of screens to click through.
  async function advanceStageSeamless() {
    if (!item) return
    const fromStage = item.pipeline_stage ?? ''
    const toStage = stageAdvance(fromStage, item.format)
    sounds.playStageComplete()
    celebrate('stage')
    if (!toStage) {
      // Nothing further in the pipeline for this video -- end the session.
      setStageReadyToAdvance(false)
      setSessionComplete(true)
      return
    }
    await supabase.from('content_items').update({ pipeline_stage: toStage }).eq('id', item.id)
    setVideos(prev => prev.map((v, i) => i === videoIdx ? { ...v, pipeline_stage: toStage } : v))
    setStepDone(prev => ({ ...prev, [item.id]: new Set() }))
    setStageReadyToAdvance(false)
    await loadChunkItem(item.id)
  }

  function continueAfterOverlay() {
    if (!stageOverlay) return
    if (stageOverlay.action === 'switch') { setVideoIdx(stageOverlay.nextIdx); setStageOverlay(null) }
    else { setStageOverlay(null); setSessionComplete(true) }
  }

  const phaseColor = pom.phase === 'work' ? C.cyan : pom.phase === 'shortBreak' ? C.green : C.purple
  const phaseLabel = pom.phase === 'work' ? 'Focus' : pom.phase === 'shortBreak' ? 'Break' : 'Long Break'

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg, color:C.sec, gap:'0.75rem' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
      Loading...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (videos.length === 0) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:C.bg, color:C.sec, gap:'1rem', padding:'2rem', textAlign:'center' }}>
      {loadError ? (
        <>
          <p style={{ fontSize:'1.1rem', fontWeight:800, color:C.amber }}>Setup needed</p>
          <p style={{ fontSize:'0.85rem', maxWidth:'28rem', lineHeight:1.6, color:C.sec }}>{loadError}</p>
        </>
      ) : (
        <>
          <p style={{ fontSize:'1.1rem', fontWeight:800, color:C.text }}>No active videos yet</p>
          <p style={{ fontSize:'0.85rem', maxWidth:'26rem', lineHeight:1.6 }}>Pin videos or shorts as your active focus from the Content Pipeline (adjust how many under &ldquo;Focus slots&rdquo; on the Pipeline board), or add an idea to get started.</p>
        </>
      )}
      <button onClick={() => router.push('/content')} style={{ padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        Go to Content Pipeline
      </button>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg, position:'relative' }}>

      {/* -- Header -- */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.5rem', borderBottom:'1px solid '+C.border, flexShrink:0, flexWrap:'wrap', gap:'0.5rem' }}>
        <button onClick={() => { sounds.stopAmbient(); router.push('/') }}
          style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}>
          <ArrowLeft size={14}/>Home
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
          {(['waves', 'whitenoise', 'off'] as AmbientMode[]).map(mode => (
            <button key={mode} onClick={() => toggleAmbient(mode)}
              style={{ display:'flex', alignItems:'center', gap:'0.2rem', padding:'0.25rem 0.5rem', borderRadius:'0.4rem', fontSize:'0.65rem', fontWeight:600, border:'1px solid '+(ambient===mode?C.cyan:C.border), background:ambient===mode?'rgba(0,212,255,0.1)':'transparent', color:ambient===mode?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
              {mode === 'waves' ? <Waves size={10}/> : mode === 'whitenoise' ? <Wind size={10}/> : <VolumeX size={10}/>}
              {mode === 'whitenoise' ? 'Noise' : mode === 'waves' ? 'Waves' : 'Off'}
            </button>
          ))}
          {([1,2,3,4,5] as const).map(track => (
            <button key={track} onClick={() => toggleYT(track)}
              style={{ display:'flex', alignItems:'center', gap:'0.2rem', padding:'0.25rem 0.5rem', borderRadius:'0.4rem', fontSize:'0.65rem', fontWeight:600, border:'1px solid '+(ytTrack===track?'#8b5cf6':C.border), background:ytTrack===track?'rgba(139,92,246,0.1)':'transparent', color:ytTrack===track?'#8b5cf6':C.muted, cursor:'pointer', fontFamily:'inherit' }}>
              <Music2 size={10}/>{track===1?'Lo-Fi':track===2?'Rain':track===3?'Jazz':track===4?'Motivate':'NSDR'}
            </button>
          ))}
          <button onClick={() => setShowPomodoro(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', padding:'0.25rem 0.625rem', borderRadius:'0.4rem', fontSize:'0.7rem', fontWeight:700, border:'1px solid '+(showPomodoro?C.amber:C.border), background:showPomodoro?'rgba(255,184,0,0.1)':'transparent', color:showPomodoro?C.amber:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
            <Zap size={10}/>{showPomodoro ? pom.formattedTime : 'Timer'}
          </button>
        </div>
      </div>

      {/* Focus World — big centered house progression, above the per-item content. Click to restart this session. */}
      <div style={{ display:'flex', justifyContent:'center', padding:'1.25rem 1.5rem 0', flexShrink:0 }}>
        <FoodProgress sessionMins={focusMins} large onClick={resetFocusSession}/>
      </div>

      {showPomodoro && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'1rem', padding:'0.625rem 1.5rem', borderBottom:'1px solid '+C.border, background:C.surface, flexShrink:0 }}>
          <span style={{ fontSize:'0.65rem', fontWeight:700, color:phaseColor, letterSpacing:'0.1em', textTransform:'uppercase' }}>{phaseLabel}</span>
          <span style={{ fontSize:'1.375rem', fontWeight:900, fontFamily:'monospace', color:C.text }}>{pom.formattedTime}</span>
          <div style={{ display:'flex', gap:'3px' }}>
            {[0,1,2,3].map(i => <div key={i} style={{ width:'5px', height:'5px', borderRadius:'50%', background:i<(pom.pomodorosCompleted%4)?phaseColor:C.border }}/>)}
          </div>
          <button onClick={() => pom.isRunning ? pom.pause() : pom.start()}
            style={{ padding:'0.3rem 0.75rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', display:'flex', alignItems:'center', gap:'0.25rem' }}>
            {pom.isRunning ? <Pause size={11}/> : <Play size={11}/>}{pom.isRunning ? 'Pause' : 'Start'}
          </button>
          <button onClick={() => pom.reset()} style={{ padding:'0.3rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center' }}><RefreshCw size={11}/></button>
          <button onClick={() => pom.skip()} style={{ padding:'0.3rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center' }}><SkipForward size={11}/></button>
        </div>
      )}

      {/* Hidden YouTube audio iframes */}
      {ytTrack === 1 && <iframe key="yt1" src="https://www.youtube.com/embed/bn9F19Hi1Lk?autoplay=1&start=38279&loop=1&playlist=bn9F19Hi1Lk&controls=0" allow="autoplay" title="Lo-Fi focus music" style={{ display:'none' }}/>}
      {ytTrack === 2 && <iframe key="yt2" src="https://www.youtube.com/embed/8F1-1j_ZDgc?autoplay=1&loop=1&playlist=8F1-1j_ZDgc&controls=0" allow="autoplay" title="Rain ambient sound" style={{ display:'none' }}/>}
      {ytTrack === 3 && <iframe key="yt3" src="https://www.youtube.com/embed/iXv92OgO4yY?autoplay=1&start=450&loop=1&playlist=iXv92OgO4yY&controls=0" allow="autoplay" title="Jazz focus music" style={{ display:'none' }}/>}
      {ytTrack === 4 && <iframe key="yt4" src="https://www.youtube.com/embed/etSMOKrNXEQ?autoplay=1&controls=0" allow="autoplay" title="Motivational video" style={{ display:'none' }}/>}
      {ytTrack === 5 && <iframe key="yt5" src="https://www.youtube.com/embed/AKGrmY8OSHM?autoplay=1&controls=0" allow="autoplay" title="NSDR" style={{ display:'none' }}/>}

      {/* -- Session goal banner -- */}
      <div style={{ padding:'0.875rem 1.5rem 0', flexShrink:0 }}>
        <div style={{ maxWidth:'620px', margin:'0 auto' }}>
          {chunkMode ? (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.875rem', background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'0.875rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:800, color:C.cyan }}>&#9203; Focus chunk:</span>
              <span style={{ fontSize:'0.72rem', color:C.sec }}>
                {totalChunks > 0 ? `Chunk ${currentChunkNumber} of ${totalChunks}` : `${chunkStepIndices.length} task${chunkStepIndices.length === 1 ? '' : 's'} this session`}
              </span>
              {!stageReadyToAdvance && chunkTotalMins > 0 && (
                <span style={{ marginLeft:'auto', fontSize:'0.85rem', fontWeight:800, fontFamily:'ui-monospace,monospace', color: chunkSecondsLeft < 60 ? '#ff4466' : C.cyan }}>
                  {chunkSecondsLeft < 0 ? '+' : ''}{String(Math.floor(Math.abs(chunkSecondsLeft) / 60)).padStart(2, '0')}:{String(Math.abs(chunkSecondsLeft) % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.875rem', background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:800, color:C.green }}>&#127919; Goal:</span>
              <span style={{ fontSize:'0.72rem', color:C.sec }}>
                complete 1 stage on {videos.length > 1 ? `each of your ${videos.length} active videos` : 'your active video'}
              </span>
              <div style={{ display:'flex', gap:'0.4rem', marginLeft:'auto' }}>
                {videos.map((v, i) => (
                  <button key={v.id} onClick={() => setVideoIdx(i)}
                    style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.2rem 0.6rem', borderRadius:'9999px', fontSize:'0.66rem', fontWeight:700, border:'1px solid '+(i===videoIdx?C.cyan:C.border), background:i===videoIdx?'rgba(0,212,255,0.1)':'transparent', color:i===videoIdx?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit' }}>
                    {stageGoalMet.has(i) && <CheckCircle2 size={10} color={C.green}/>}
                    {v.title.length > 18 ? v.title.slice(0,18)+'…' : v.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* -- 20-minute focus rule + distraction tracker -- */}
      <div style={{ padding:'0 2rem', flexShrink:0 }}>
        <div style={{ maxWidth:'540px', margin:'0 auto', display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.45rem 0.875rem', background:isDistracted?'rgba(255,68,102,0.12)':'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:'9999px' }}>
            <span style={{ fontSize:'0.7rem', color:'#ff4466' }}>&#9889;</span>
            <p style={{ fontSize:'0.7rem', color:'#ff4466', margin:0, fontWeight:600 }}>
              {isDistracted ? <><strong>Distracted</strong> &mdash; stop, breathe, come back</> : <>Every time you lose focus it takes <strong>20 minutes</strong> to regain.</>}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
            {focusMins > 0 && (
              <span style={{ fontSize:'0.65rem', color:distractedMins>0?C.sec:C.muted, fontFamily:'ui-monospace,monospace', whiteSpace:'nowrap' }}>
                &#9679; {focusMins - distractedMins}m focus{distractedMins > 0 ? ` / ${distractedMins}m lost` : ''}
              </span>
            )}
            <button onClick={toggleDistraction}
              style={{ padding:'0.3rem 0.7rem', background:isDistracted?'linear-gradient(135deg,'+C.green+',#00cc6a)':'rgba(255,68,102,0.12)', border:isDistracted?'none':'1px solid rgba(255,68,102,0.35)', borderRadius:'9999px', color:isDistracted?'#000':'#ff4466', fontWeight:700, fontSize:'0.68rem', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {isDistracted ? '▶ Back in focus' : 'Lost focus'}
            </button>
          </div>
        </div>
      </div>

      {/* -- Rohn affirmation -- */}
      <div style={{ textAlign:'center', padding:'0.75rem 2rem 0.25rem', flexShrink:0 }}>
        <p key={affirmKey} style={{ fontSize:'0.8rem', color:C.sec, fontStyle:'italic', maxWidth:'540px', margin:'0 auto', lineHeight:1.65, animation:'fadeUp 0.7s ease forwards' }}>
          &ldquo;{ROHN[rohnIdx]}&rdquo;
          <span style={{ display:'block', fontSize:'0.63rem', color:C.muted, marginTop:'0.3rem', fontStyle:'normal', letterSpacing:'0.05em' }}>&mdash; Jim Rohn</span>
        </p>
      </div>

      {/* -- Main content -- */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem 1.5rem 2.5rem' }}>

        {sessionComplete ? (
          <div style={{ textAlign:'center', maxWidth:'480px', animation:'fadeUp 0.6s ease' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>[done]</div>
            <h1 style={{ fontSize:'2.25rem', fontWeight:900, color:C.green, marginBottom:'0.75rem' }}>Session Complete!</h1>
            <p style={{ fontSize:'0.95rem', color:C.sec, fontStyle:'italic', lineHeight:1.7, marginBottom:'0.375rem' }}>
              &ldquo;Success is not to be pursued. It is to be attracted by the person you become.&rdquo;
            </p>
            <p style={{ fontSize:'0.7rem', color:C.muted, marginBottom:'2rem' }}>&mdash; Jim Rohn</p>
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => { setSessionComplete(false); if (chunkMode && item) { loadChunkItem(item.id) } else { setStageGoalMet(new Set()); load() } }}
                style={{ padding:'0.875rem 2rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.875rem', color:C.cyan, fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}>
                Keep going
              </button>
              <button onClick={() => router.push('/')}
                style={{ padding:'0.875rem 2.5rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>
                Back to Home
              </button>
            </div>
          </div>

        ) : item ? (
          <div style={{ width:'100%', maxWidth:'640px', display:'flex', flexDirection:'column', gap:'1.125rem' }}>

            {/* Video + stage row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem' }}>
              <div>
                <span style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan }}>{item.pipeline_stage ?? '—'}</span>
                {item.format && <span style={{ fontSize:'0.65rem', color:C.muted, marginLeft:'0.6rem' }}>{item.format}</span>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                {steps.length > 0 && (
                  <span style={{ fontSize:'0.68rem', color:C.muted }}>
                    {chunkMode
                      ? `${chunkStepIndices.filter(i => doneSet.has(i)).length}/${chunkStepIndices.length} this chunk`
                      : `${doneSet.size}/${steps.length} steps`}
                  </span>
                )}
                <button onClick={() => setShowDetail(true)} title="Full history — attributes, every stage note, links"
                  style={{ padding:'0.25rem 0.6rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'9999px', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  Full history
                </button>
              </div>
            </div>

            {/* -- Video Details -- structured fields for what this video actually
                is, instead of everything living in one freeform Claude note.
                Title/type/angle always shown; hook/thumbnail concept show up
                once you reach Holy Trifecta, thumbnail link + SEO once you
                reach Thumbnail & SEO -- so the fields you need appear exactly
                when the stage you're on needs them. */}
            <div style={{ background:C.card, borderRadius:'1.375rem', padding:'1.25rem 1.5rem', border:'1px solid '+C.border }}>
              <button onClick={() => setShowVideoDetails(v => !v)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', width:'100%', background:'none', border:'none', padding:0, marginBottom: showVideoDetails ? '0.875rem' : 0, color:C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                <ChevronRight size={12} style={{ transform: showVideoDetails ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}/>
                Video Details
              </button>

              {showVideoDetails && (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Title</label>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => saveVideoField('title', editTitle, false)}
                      placeholder="Working title"
                      style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', fontWeight:700, outline:'none', boxSizing:'border-box' as const }}
                    />
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Video type</label>
                      <select
                        value={editVideoType}
                        onChange={e => { setEditVideoType(e.target.value); saveVideoField('video_type', e.target.value) }}
                        style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.625rem', color:editVideoType ? C.text : C.muted, fontFamily:'inherit', fontSize:'0.78rem', outline:'none', cursor:'pointer', boxSizing:'border-box' as const }}>
                        <option value="">Not set</option>
                        {VIDEO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Format</label>
                      <div style={{ padding:'0.55rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.625rem', color: item.format ? C.text : C.muted, fontSize:'0.78rem' }}>
                        {item.format ?? 'Not set'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Unique angle &mdash; the alpha check</label>
                    <textarea
                      value={editUniqueAngle}
                      onChange={e => setEditUniqueAngle(e.target.value)}
                      onBlur={() => saveVideoField('unique_angle', editUniqueAngle)}
                      placeholder="What does this video have that a 5-minute Google search or ChatGPT answer doesn't?"
                      rows={2}
                      style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.55, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                    />
                  </div>

                  {sopId === '03' && (
                    <>
                      <div style={{ borderTop:'1px solid '+C.border, paddingTop:'0.875rem' }}>
                        <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.amber, textTransform:'uppercase' as const, letterSpacing:'0.08em', margin:'0 0 0.7rem' }}>&#127919; Holy Trifecta &mdash; lock these three</p>
                        <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Hook</label>
                        <textarea
                          value={editHook}
                          onChange={e => setEditHook(e.target.value)}
                          onBlur={() => saveVideoField('hook', editHook)}
                          placeholder="First 15 seconds (long form) or first 3 (Short) — the wildest stat, boldest claim, or question that makes stopping feel impossible"
                          rows={2}
                          style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,184,0,0.03)', border:'1px solid '+(editHook ? 'rgba(255,184,0,0.3)' : C.border), borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.55, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Thumbnail concept</label>
                        <textarea
                          value={editThumbConcept}
                          onChange={e => setEditThumbConcept(e.target.value)}
                          onBlur={() => saveVideoField('thumbnail_concept', editThumbConcept)}
                          placeholder="Which type-combo (scale, comparison, blur/reveal, big number) + what's actually in frame + the brand accent colour"
                          rows={2}
                          style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,184,0,0.03)', border:'1px solid '+(editThumbConcept ? 'rgba(255,184,0,0.3)' : C.border), borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.55, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                    </>
                  )}

                  {sopId === '08' && (
                    <>
                      <div style={{ borderTop:'1px solid '+C.border, paddingTop:'0.875rem' }}>
                        <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.amber, textTransform:'uppercase' as const, letterSpacing:'0.08em', margin:'0 0 0.7rem' }}>&#128444; Thumbnail & SEO &mdash; finalise these</p>
                        <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Thumbnail file link</label>
                        <input
                          value={editThumbUrl}
                          onChange={e => setEditThumbUrl(e.target.value)}
                          onBlur={() => saveVideoField('thumbnail_url', editThumbUrl)}
                          placeholder="Link to the finished thumbnail image (Drive/Canva/local)"
                          style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,184,0,0.03)', border:'1px solid '+(editThumbUrl ? 'rgba(255,184,0,0.3)' : C.border), borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>SEO description</label>
                        <textarea
                          value={editSeoDescription}
                          onChange={e => setEditSeoDescription(e.target.value)}
                          onBlur={() => saveVideoField('seo_description', editSeoDescription)}
                          placeholder='First 2 lines matter most — hook sentence + primary keyword before "show more"'
                          rows={3}
                          style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,184,0,0.03)', border:'1px solid '+(editSeoDescription ? 'rgba(255,184,0,0.3)' : C.border), borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.55, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Tags</label>
                        <input
                          value={editSeoTags}
                          onChange={e => setEditSeoTags(e.target.value)}
                          onBlur={() => saveVideoField('seo_tags', editSeoTags)}
                          placeholder="3 broad, 5 niche, 5 long-tail — comma separated"
                          style={{ width:'100%', padding:'0.55rem 0.75rem', background:'rgba(255,184,0,0.03)', border:'1px solid '+(editSeoTags ? 'rgba(255,184,0,0.3)' : C.border), borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <MemeSuggestions topic={item.title} />

            {/* -- SOP checklist card -- */}
            <div key={item.id + '-' + (sop?.id ?? 'none')} style={{
              background:C.card, borderRadius:'1.375rem', padding:'1.75rem 2rem',
              border:'1px solid transparent',
              animation: allStepsDone ? 'none' : 'glowCycle 4s ease-in-out infinite, slideIn 0.35s ease',
              boxShadow: allStepsDone ? '0 0 0 1px rgba(0,255,136,0.35), 0 0 30px rgba(0,255,136,0.1)' : undefined,
            }}>
              <h1 style={{ fontSize:'clamp(1.15rem,2.8vw,1.6rem)', fontWeight:900, color:C.text, lineHeight:1.25, marginBottom:'0.5rem', letterSpacing:'-0.02em' }}>
                {item.title}
              </h1>

              {sop ? (
                <>
                  <p style={{ fontSize:'0.78rem', color:C.cyan, fontStyle:'italic', margin:'0 0 1.25rem', lineHeight:1.55 }}>
                    SOP {sop.id} &middot; {sop.title} &mdash; {sop.tagline}
                  </p>

                  {/* Stage draft — the Produce/Consult output for this stage */}
                  <div style={{ marginBottom:'1rem' }}>
                    <button onClick={() => setShowStageNote(v => !v)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', background:'none', border:'none', padding:0, marginBottom:'0.4rem', color: stageNote ? C.green : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                      <ChevronRight size={11} style={{ transform: showStageNote ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}/>
                      Stage draft {stageNote ? '· ready' : '· empty'}
                    </button>
                    {showStageNote && (
                      <>
                        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' as const }}>
                          <button onClick={consultClaude} disabled={consulting}
                            style={{ flex:'1 1 9rem', padding:'0.5rem', background: consulting ? C.surface : 'rgba(0,212,255,0.1)', border:'1px solid '+(consulting ? C.border : 'rgba(0,212,255,0.3)'), borderRadius:'0.625rem', color: consulting ? C.muted : C.cyan, fontWeight:700, cursor: consulting ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                            <Sparkles size={12}/>{consulting ? 'Consulting Claude…' : 'Consult Claude'}
                          </button>
                          {sop.id === '04' && (
                            <>
                              <button onClick={() => setShowYap(true)}
                                style={{ flex:'1 1 9rem', padding:'0.5rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:'#8b5cf6', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                                <Sparkles size={12}/>Yap Session
                              </button>
                              <button onClick={() => setShowStoryboard(true)}
                                style={{ flex:'1 1 9rem', padding:'0.5rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.625rem', color:C.cyan, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                                <Clapperboard size={12}/>Storyboard
                              </button>
                              <button onClick={() => setShowBrandAssets(true)}
                                style={{ flex:'1 1 9rem', padding:'0.5rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.625rem', color:C.amber, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                                <FolderOpen size={12}/>Brand Assets
                              </button>
                            </>
                          )}
                        </div>
                        {consultMsg && <p style={{ fontSize:'0.66rem', color:C.amber, margin:'0 0 0.5rem', lineHeight:1.4 }}>{consultMsg}</p>}
                        <textarea
                          value={stageNote}
                          onChange={e => setStageNote(e.target.value)}
                          onBlur={saveCurrentStageNote}
                          placeholder="No draft yet — hit Consult Claude above, Produce on this video's card in the Content Pipeline, or write here directly."
                          rows={stageNote ? 10 : 3}
                          style={{ width:'100%', padding:'0.7rem 0.875rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+(stageNote ? 'rgba(0,255,136,0.2)' : C.border), borderRadius:'0.75rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.6, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                        />
                      </>
                    )}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'0.5rem' }}>
                    {(chunkMode ? chunkStepIndices : steps.map((_, i) => i)).map(i => {
                      const step = steps[i]
                      const checked = doneSet.has(i)
                      return (
                        <button key={i} onClick={() => toggleStep(i)} style={{
                          display:'flex', alignItems:'flex-start', gap:'0.75rem', width:'100%',
                          padding:'0.7rem 0.875rem', textAlign:'left',
                          background: checked ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.02)',
                          border:'1px solid '+(checked ? 'rgba(0,255,136,0.2)' : C.border),
                          borderRadius:'0.75rem', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s ease',
                        }}>
                          <div style={{ flexShrink:0, marginTop:'1px', color: checked ? C.green : C.muted }}>
                            {checked ? <CheckCircle2 size={16}/> : <Circle size={16}/>}
                          </div>
                          <p style={{ fontSize:'0.8rem', margin:0, lineHeight:1.55, color: checked ? C.green : C.sec, textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.8 : 1 }}
                            dangerouslySetInnerHTML={{ __html: step }}/>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding:'1rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                  <p style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6, margin:0 }}>
                    {nextStage
                      ? 'No SOP checklist is mapped to this exact stage — advance it manually when it’s ready.'
                      : 'This video is fully published — there’s nothing further in the pipeline for it. Swap it out from the Content Pipeline.'}
                  </p>
                </div>
              )}
            </div>

            {/* -- Action buttons -- */}
            <button onClick={chunkMode ? advanceStageSeamless : advanceStage}
              disabled={chunkMode ? !stageReadyToAdvance : (!allStepsDone && !!sop)}
              style={{
                width:'100%', padding:'1.0625rem', border:'none', borderRadius:'0.875rem',
                fontWeight:800, fontSize:'1.0625rem',
                cursor: (chunkMode ? stageReadyToAdvance : (allStepsDone || !sop)) ? 'pointer' : 'default',
                fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                background: (chunkMode ? stageReadyToAdvance : (allStepsDone || (!sop && !!nextStage))) ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : C.surface,
                color: (chunkMode ? stageReadyToAdvance : (allStepsDone || (!sop && !!nextStage))) ? '#000' : C.muted,
                opacity: (!sop && !nextStage) ? 0.4 : 1,
                letterSpacing:'-0.01em',
              }}>
              <CheckCircle2 size={18}/>
              {chunkMode
                ? (stageReadyToAdvance
                    ? (nextStage ? `Move to ${nextStage} →` : 'Finish session →')
                    : `${chunkStepIndices.filter(i => doneSet.has(i)).length}/${chunkStepIndices.length} this chunk checked`)
                : (nextStage ? `Advance to ${nextStage}` : 'Nothing further to advance')}
            </button>

            {videos.length > 1 && (() => {
              const nextIdx = (videoIdx + 1) % videos.length
              const nextTitle = videos[nextIdx].title
              return (
                <button onClick={() => setVideoIdx(nextIdx)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', padding:'0.6rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:600 }}>
                  Switch to {nextTitle.length>28 ? nextTitle.slice(0,28)+'…' : nextTitle} <ChevronRight size={13}/>
                </button>
              )
            })()}

          </div>
        ) : null}
      </div>

      {/* Stage complete overlay */}
      {stageOverlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,10,15,0.96)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:200, animation:'fadeIn 0.4s ease', padding:'2rem' }}>
          <div style={{ textAlign:'center', maxWidth:'540px', animation:'slideUp 0.5s ease' }}>
            <div style={{ fontSize:'2.75rem', marginBottom:'1rem' }}>&#9889;</div>
            <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.cyan, marginBottom:'0.625rem' }}>Stage Complete</p>
            <h2 style={{ fontSize:'clamp(1.6rem,4.5vw,2.25rem)', fontWeight:900, color:C.text, marginBottom:'0.5rem', lineHeight:1.15, letterSpacing:'-0.02em' }}>{stageOverlay.title}</h2>
            <p style={{ fontSize:'0.85rem', color:C.sec, marginBottom:'2rem' }}>{stageOverlay.from} &rarr; <span style={{ color:C.green, fontWeight:700 }}>{stageOverlay.to}</span></p>
            <button onClick={continueAfterOverlay}
              style={{ padding:'1rem 2.75rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'1rem', color:'#000', fontWeight:800, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 0 40px rgba(0,212,255,0.35)', letterSpacing:'-0.01em' }}>
              {stageOverlay.action === 'switch' ? 'Continue to next video →' : 'Finish session →'}
            </button>
          </div>
        </div>
      )}

      {showDetail && item && <ContentItemDetail itemId={item.id} onClose={() => setShowDetail(false)}/>}

      {showYap && item && (
        <YapSession
          itemId={item.id}
          itemTitle={item.title}
          itemContext={item.unique_angle ?? item.notes ?? undefined}
          onClose={() => setShowYap(false)}
          onSaved={outline => { setStageNote(outline); setShowStageNote(true); setShowYap(false) }}
        />
      )}
      {showStoryboard && item && (
        <Storyboard
          itemId={item.id}
          itemTitle={item.title}
          itemFormat={item.format}
          driveFolderUrl={item.drive_url}
          onFolderCreated={url => setVideos(prev => prev.map((v, i) => i === videoIdx ? { ...v, drive_url: url } : v))}
          onClose={() => setShowStoryboard(false)}
        />
      )}
      {showBrandAssets && item && (
        <BrandAssets
          itemId={item.id}
          itemTitle={item.title}
          itemFormat={item.format}
          driveFolderUrl={item.drive_url}
          onFolderCreated={url => setVideos(prev => prev.map((v, i) => i === videoIdx ? { ...v, drive_url: url } : v))}
          onClose={() => setShowBrandAssets(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes glowCycle {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,212,255,0.55), 0 0 28px rgba(0,212,255,0.22), 0 0 56px rgba(0,212,255,0.07); border-color: rgba(0,212,255,0.55); }
          33% { box-shadow: 0 0 0 1px rgba(255,184,0,0.55), 0 0 28px rgba(255,184,0,0.22), 0 0 56px rgba(255,184,0,0.07); border-color: rgba(255,184,0,0.55); }
          66% { box-shadow: 0 0 0 1px rgba(139,92,246,0.55), 0 0 28px rgba(139,92,246,0.22), 0 0 56px rgba(139,92,246,0.07); border-color: rgba(139,92,246,0.55); }
        }
      `}</style>
    </main>
  )
}

export default function ContentFocusPage() {
  return (
    <Suspense fallback={null}>
      <ContentFocusPageInner />
    </Suspense>
  )
}
