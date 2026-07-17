'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Play, Pause, RefreshCw, SkipForward, Wind, Waves, VolumeX, Zap, Music2, ChevronRight } from 'lucide-react'
import { supabase, getActiveFocusVideos, type ActiveFocusVideo } from '@/lib/supabase'
import { STAGE_ADVANCE, sopForStage } from '@/lib/sops'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'
import FoodProgress from '@/components/FoodProgress'

// ============================================================
// YouTube-Pipeline-driven Focus Session
// Replaces the generic workflow_sessions source for the Home page's
// "Start focus session" button. Drives a focus session off up to 2
// content_items pinned in the Content Pipeline (is_active_focus = true),
// falling back to the item(s) that have sat longest in their current stage
// if fewer than 2 are pinned. Each video's current pipeline_stage maps to
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

export default function ContentFocusPage() {
  const router = useRouter()

  const [videos, setVideos] = useState<ActiveFocusVideo[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoIdx, setVideoIdx] = useState(0)
  const [stepDone, setStepDone] = useState<Record<string, Set<number>>>({})
  const [stageGoalMet, setStageGoalMet] = useState<Set<number>>(new Set())
  const [stageOverlay, setStageOverlay] = useState<StageOverlay | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

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
        if (item && sopForStage(item.pipeline_stage)?.id === row.sop_id) {
          if (!map[row.content_item_id]) map[row.content_item_id] = new Set()
          map[row.content_item_id].add(row.step_index)
        }
      })
      setStepDone(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

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
  const sop = item ? sopForStage(item.pipeline_stage) : null
  const steps = sop?.steps ?? []
  const doneSet = item ? (stepDone[item.id] ?? new Set<number>()) : new Set<number>()
  const allStepsDone = steps.length > 0 && doneSet.size === steps.length

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
    const toStage = STAGE_ADVANCE[fromStage]
    if (!toStage) return
    const idx = videoIdx
    sounds.playStageComplete()
    celebrate('stage')
    await supabase.from('content_items').update({ pipeline_stage: toStage }).eq('id', item.id)
    setVideos(prev => prev.map((v, i) => i === idx ? { ...v, pipeline_stage: toStage } : v))
    setStepDone(prev => ({ ...prev, [item.id]: new Set() }))

    const newGoalMet = new Set(stageGoalMet); newGoalMet.add(idx)
    setStageGoalMet(newGoalMet)

    const otherIdx = idx === 0 ? 1 : 0
    const otherPending = videos.length > otherIdx && !newGoalMet.has(otherIdx)

    setStageOverlay({
      title: item.title, from: fromStage, to: toStage,
      action: otherPending ? 'switch' : 'complete',
      nextIdx: otherPending ? otherIdx : idx,
    })
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
          <p style={{ fontSize:'0.85rem', maxWidth:'26rem', lineHeight:1.6 }}>Pin up to 2 videos or shorts as your active focus from the Content Pipeline, or add an idea to get started.</p>
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
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.875rem', background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:800, color:C.green }}>&#127919; Goal:</span>
            <span style={{ fontSize:'0.72rem', color:C.sec }}>
              complete 1 stage on {videos.length > 1 ? 'each of your 2 active videos' : 'your active video'}
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
              <button onClick={() => { setSessionComplete(false); setStageGoalMet(new Set()); load() }}
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
              {steps.length > 0 && (
                <span style={{ fontSize:'0.68rem', color:C.muted }}>{doneSet.size}/{steps.length} steps</span>
              )}
            </div>

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
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'0.5rem' }}>
                    {steps.map((step, i) => {
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
                    {STAGE_ADVANCE[item.pipeline_stage ?? '']
                      ? 'No SOP checklist is mapped to this exact stage — advance it manually when it’s ready.'
                      : 'This video is fully published — there’s nothing further in the pipeline for it. Swap it out from the Content Pipeline.'}
                  </p>
                </div>
              )}
            </div>

            {/* -- Action buttons -- */}
            <button onClick={advanceStage} disabled={!allStepsDone && !!sop}
              style={{
                width:'100%', padding:'1.0625rem', border:'none', borderRadius:'0.875rem',
                fontWeight:800, fontSize:'1.0625rem', cursor: (allStepsDone || !sop) ? 'pointer' : 'default',
                fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                background: (allStepsDone || (!sop && !!STAGE_ADVANCE[item.pipeline_stage ?? ''])) ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : C.surface,
                color: (allStepsDone || (!sop && !!STAGE_ADVANCE[item.pipeline_stage ?? ''])) ? '#000' : C.muted,
                opacity: (!sop && !STAGE_ADVANCE[item.pipeline_stage ?? '']) ? 0.4 : 1,
                letterSpacing:'-0.01em',
              }}>
              <CheckCircle2 size={18}/>
              {STAGE_ADVANCE[item.pipeline_stage ?? ''] ? `Advance to ${STAGE_ADVANCE[item.pipeline_stage ?? '']}` : 'Nothing further to advance'}
            </button>

            {videos.length > 1 && (
              <button onClick={() => setVideoIdx(videoIdx === 0 ? 1 : 0)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', padding:'0.6rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:600 }}>
                Switch to {videos[videoIdx===0?1:0].title.length>28 ? videos[videoIdx===0?1:0].title.slice(0,28)+'…' : videos[videoIdx===0?1:0].title} <ChevronRight size={13}/>
              </button>
            )}

            {/* Food progression */}
            <FoodProgress sessionMins={focusMins}/>
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
