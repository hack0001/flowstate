'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, ChevronDown, ChevronUp, Play, Pause, SkipForward, RefreshCw, Wind, Waves, VolumeX, Zap } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task } from '@/types'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'

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
  "Income seldom exceeds personal development.",
  "Don't join an easy crowd. You won't grow. Go where it's right, not where it's easy.",
  "If you really want to do something, you'll find a way. If you don't, you'll find an excuse.",
  "Success is not to be pursued. It is to be attracted by the person you become.",
  "Every day, stand guard at the door of your mind.",
  "Your life does not get better by chance. It gets better by change.",
  "Let others lead small lives, but not you. Let others argue over small things, but not you.",
  "For things to change, you have to change. For things to get better, you have to get better.",
  "Don't let your learning lead to knowledge. Let your learning lead to action.",
  "Take care of your body. It's the only place you have to live.",
  "Time is more valuable than money. You can get more money, but you cannot get more time.",
  "Formal education will make you a living. Self-education will make you a fortune.",
  "Start from wherever you are and with whatever you've got.",
  "The major reason for setting a goal is for what it makes of you to accomplish it.",
  "Happiness is not something you postpone for the future. It is something you design for the present.",
  "You are the average of the five people you spend the most time with.",
  "Learn to be happy with what you have while you pursue all that you want.",
  "The worst thing one can do is not to try, to be aware of what one wants and not give in to it.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "Don't spend most of your time on the voices that don't count.",
  "Set a goal to achieve something that is so big, so exhilarating, that it excites and scares you at the same time.",
  "You don't get paid for the hour. You get paid for the value you bring to the hour.",
  "One of the greatest gifts you can give to anyone is the gift of your attention.",
]

type AmbientMode = 'off' | 'whitenoise' | 'waves'

export default function FocusPage() {
  const router = useRouter()
  const { id: sid } = useParams() as { id: string }
  const sp = useSearchParams()
  const initTask = sp.get('task')

  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [taskIdx, setTaskIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [stageOverlay, setStageOverlay] = useState<{ name: string; quote: string } | null>(null)
  const [rohnIdx, setRohnIdx] = useState(() => Math.floor(Math.random() * ROHN.length))
  const [affirmKey, setAffirmKey] = useState(0)
  const [ambient, setAmbient] = useState<AmbientMode>('off')
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [cardKey, setCardKey] = useState(0)
  const taskStartRef = useRef<number>(Date.now())
  const { celebrate } = useCelebration()

  const allTasks: Task[] = stages.flatMap(s => s.tasks ?? [])
  const task = allTasks[taskIdx] ?? null
  const curStage = task ? stages.find(s => s.tasks?.some(t => t.id === task.id)) : null
  const isDone = task ? doneIds.has(task.id) : false
  const totalDone = allTasks.filter(t => doneIds.has(t.id)).length
  const prog = allTasks.length ? totalDone / allTasks.length : 0
  const allComplete = allTasks.length > 0 && totalDone >= allTasks.length

  const stageTasksDone = (curStage?.tasks ?? []).filter(t => doneIds.has(t.id)).length
  const stageTasksTotal = (curStage?.tasks ?? []).length
  const stageProg = stageTasksTotal ? stageTasksDone / stageTasksTotal : 0

  const onWork = useCallback(() => { sounds.playTimerEnd(); celebrate('task') }, [celebrate])
  const onBreak = useCallback(() => { sounds.playBreakStart() }, [])
  const pom = usePomodoro({ onWorkComplete: onWork, onBreakComplete: onBreak })

  // Rotate affirmation every 25 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setRohnIdx(i => (i + 1) % ROHN.length)
      setAffirmKey(k => k + 1)
    }, 25000)
    return () => clearInterval(id)
  }, [])

  // Reset on task change
  useEffect(() => {
    taskStartRef.current = Date.now()
    setShowInstructions(false)
    setCelebrating(false)
    setCardKey(k => k + 1)
  }, [taskIdx])

  useEffect(() => () => { sounds.stopAmbient() }, [])

  function toggleAmbient(mode: AmbientMode) {
    if (ambient === mode) { sounds.stopAmbient(); setAmbient('off') }
    else { sounds.startAmbient(mode === 'off' ? 'whitenoise' : mode as 'whitenoise' | 'waves'); setAmbient(mode) }
  }

  useEffect(() => {
    async function load() {
      try {
        const s = await getSession(sid)
        setSession(s)
        const st = await getStagesForWorkflow(s.workflow_type_id)
        const validSt = st ?? []
        setStages(validSt)
        const c = await getCompletions(sid)
        const ids = new Set((c ?? []).map((x: { task_id: string }) => x.task_id))
        setDoneIds(ids)
        const flat: Task[] = validSt.flatMap((stage: Stage) => stage.tasks ?? [])
        const target = initTask ? flat.findIndex(t => t.id === initTask) : flat.findIndex(t => !ids.has(t.id))
        if (target >= 0) setTaskIdx(target)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [sid, initTask])

  async function markDone() {
    if (!task || isDone) return
    const timeSpent = Math.round((Date.now() - taskStartRef.current) / 1000)
    sounds.playTaskComplete()
    setCelebrating(true)
    setTimeout(() => setCelebrating(false), 900)

    const next = new Set([...Array.from(doneIds), task.id])
    setDoneIds(next)
    await completeTask(sid, task.id, pom.pomodorosCompleted, timeSpent)

    const stageDone = (curStage?.tasks ?? []).every(t => next.has(t.id))
    if (stageDone && curStage) {
      sounds.playStageComplete()
      celebrate('stage')
      const q = ROHN[Math.floor(Math.random() * ROHN.length)]
      setTimeout(() => setStageOverlay({ name: curStage.name, quote: q }), 700)
    } else {
      celebrate('task')
    }
  }

  function advanceToNext() {
    setStageOverlay(null)
    const next = allTasks.findIndex((t, i) => i > taskIdx && !doneIds.has(t.id))
    if (next >= 0) setTaskIdx(next)
  }

  const phaseColor = pom.phase === 'work' ? C.cyan : pom.phase === 'shortBreak' ? C.green : C.purple
  const phaseLabel = pom.phase === 'work' ? 'Focus' : pom.phase === 'shortBreak' ? 'Break' : 'Long Break'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.sec, gap: '0.75rem' }}>
      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: '2px solid ' + C.cyan, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      Loading...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, position: 'relative' }}>

      {/* -- Top progress bar -- */}
      <div style={{ height: '3px', background: C.border, flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: (prog * 100) + '%', background: 'linear-gradient(90deg,' + C.cyan + ',' + C.purple + ')', transition: 'width 0.8s ease' }} />
      </div>

      {/* -- Header -- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
        <button onClick={() => { sounds.stopAmbient(); router.push('/workflow/' + sid) }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>
          <ArrowLeft size={14} />Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {(['waves', 'whitenoise', 'off'] as AmbientMode[]).map(mode => (
            <button key={mode} onClick={() => toggleAmbient(mode)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.65rem', fontWeight: 600, border: '1px solid ' + (ambient === mode ? C.cyan : C.border), background: ambient === mode ? 'rgba(0,212,255,0.1)' : 'transparent', color: ambient === mode ? C.cyan : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
              {mode === 'waves' ? <Waves size={10} /> : mode === 'whitenoise' ? <Wind size={10} /> : <VolumeX size={10} />}
              {mode === 'whitenoise' ? 'Noise' : mode === 'waves' ? 'Waves' : 'Off'}
            </button>
          ))}
          <button onClick={() => setShowPomodoro(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.625rem', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 700, border: '1px solid ' + (showPomodoro ? C.amber : C.border), background: showPomodoro ? 'rgba(255,184,0,0.1)' : 'transparent', color: showPomodoro ? C.amber : C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Zap size={10} />{showPomodoro ? pom.formattedTime : 'Timer'}
          </button>
          <span style={{ fontSize: '0.7rem', color: C.muted, paddingLeft: '0.25rem' }}>{totalDone}/{allTasks.length} done</span>
        </div>
      </div>

      {/* -- Pomodoro panel (collapsed by default) -- */}
      {showPomodoro && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '0.625rem 1.5rem', borderBottom: '1px solid ' + C.border, background: C.surface, flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: phaseColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{phaseLabel}</span>
          <span style={{ fontSize: '1.375rem', fontWeight: 900, fontFamily: 'monospace', color: C.text }}>{pom.formattedTime}</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: i < (pom.pomodorosCompleted % 4) ? phaseColor : C.border }} />)}
          </div>
          <button onClick={() => pom.isRunning ? pom.pause() : pom.start()}
            style={{ padding: '0.3rem 0.75rem', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', border: 'none', borderRadius: '0.5rem', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {pom.isRunning ? <Pause size={11} /> : <Play size={11} />}{pom.isRunning ? 'Pause' : 'Start'}
          </button>
          <button onClick={() => pom.reset()} style={{ padding: '0.3rem 0.5rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.5rem', color: C.sec, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><RefreshCw size={11} /></button>
          <button onClick={() => pom.skip()} style={{ padding: '0.3rem 0.5rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.5rem', color: C.sec, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><SkipForward size={11} /></button>
        </div>
      )}

      {/* -- Jim Rohn affirmation -- */}
      <div style={{ textAlign: 'center', padding: '1.5rem 2rem 0.25rem', flexShrink: 0 }}>
        <p key={affirmKey} style={{ fontSize: '0.8rem', color: C.sec, fontStyle: 'italic', maxWidth: '540px', margin: '0 auto', lineHeight: 1.65, animation: 'fadeUp 0.7s ease forwards' }}>
          &ldquo;{ROHN[rohnIdx]}&rdquo;
          <span style={{ display: 'block', fontSize: '0.63rem', color: C.muted, marginTop: '0.3rem', fontStyle: 'normal', letterSpacing: '0.05em' }}>&mdash; Jim Rohn</span>
        </p>
      </div>

      {/* -- Main content -- */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.5rem 2.5rem' }}>

        {allComplete ? (
          <div style={{ textAlign: 'center', maxWidth: '480px', animation: 'fadeUp 0.6s ease' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>[done]</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: C.green, marginBottom: '0.75rem' }}>Workflow Complete!</h1>
            <p style={{ fontSize: '0.95rem', color: C.sec, fontStyle: 'italic', lineHeight: 1.7, marginBottom: '0.375rem' }}>
              &ldquo;Success is not to be pursued. It is to be attracted by the person you become.&rdquo;
            </p>
            <p style={{ fontSize: '0.7rem', color: C.muted, marginBottom: '2rem' }}>&mdash; Jim Rohn</p>
            <button onClick={() => router.push('/workflow/' + sid)}
              style={{ padding: '0.875rem 2.5rem', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', border: 'none', borderRadius: '0.875rem', color: '#000', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Back to Overview
            </button>
          </div>

        ) : task ? (
          <div style={{ width: '100%', maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

            {/* Stage + counter row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cyan }}>{curStage?.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '0.68rem', color: C.muted }}>Task {taskIdx + 1} of {allTasks.length}</span>
                <div style={{ width: '56px', height: '3px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (stageProg * 100) + '%', background: C.cyan, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: '0.63rem', color: C.muted }}>{stageTasksDone}/{stageTasksTotal}</span>
              </div>
            </div>

            {/* -- Task card -- */}
            <div style={{ position: 'relative' }} key={cardKey}>
              {/* Celebration burst */}
              {celebrating && (
                <div style={{ position: 'absolute', inset: '-10px', borderRadius: '1.5rem', background: 'radial-gradient(circle, rgba(0,255,136,0.35) 0%, rgba(0,212,255,0.15) 40%, transparent 70%)', animation: 'burst 0.9s ease-out forwards', pointerEvents: 'none', zIndex: 10 }} />
              )}
              {/* Sparkle particles on celebrate */}
              {celebrating && [0,1,2,3,4,5].map(i => (
                <div key={i} style={{ position: 'absolute', width: '6px', height: '6px', borderRadius: '50%', background: i % 3 === 0 ? C.cyan : i % 3 === 1 ? C.green : C.amber, top: (20 + i * 12) + '%', left: (8 + i * 15) + '%', animation: `particle${i % 3} 0.8s ease-out forwards`, pointerEvents: 'none', zIndex: 11 }} />
              ))}

              <div key={'card-' + task.id} style={{
                background: isDone ? 'rgba(0,255,136,0.03)' : C.card,
                borderRadius: '1.375rem',
                padding: '2rem 2.25rem',
                border: '1px solid transparent',
                animation: isDone ? 'none' : 'glowCycle 4s ease-in-out infinite, slideIn 0.35s ease',
                boxShadow: isDone ? '0 0 0 1px rgba(0,255,136,0.35), 0 0 30px rgba(0,255,136,0.1)' : undefined,
                transition: 'box-shadow 0.5s ease',
                position: 'relative',
              }}>
                {/* Complete badge */}
                {isDone && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.25)' }}>
                    <CheckCircle2 size={13} color={C.green} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.green }}>Complete</span>
                  </div>
                )}

                {/* Title */}
                <h1 style={{ fontSize: 'clamp(1.25rem,3vw,1.875rem)', fontWeight: 900, color: isDone ? C.sec : C.text, lineHeight: 1.2, marginBottom: '0.875rem', letterSpacing: '-0.02em' }}>
                  {task.title}
                </h1>

                {/* Description */}
                <p style={{ fontSize: '1rem', color: C.sec, lineHeight: 1.75, marginBottom: '1.375rem' }}>
                  {task.description}
                </p>

                {/* Meta + action pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: task.instructions ? '1.25rem' : 0 }}>
                  <span style={{ fontSize: '0.72rem', color: C.muted, padding: '0.25rem 0.625rem', background: C.surface, borderRadius: '9999px', border: '1px solid ' + C.border }}>
                    ~{task.estimated_minutes ?? 10} min
                  </span>
                  {task.has_prompt && task.prompt_text && (
                    <button onClick={() => { navigator.clipboard.writeText(task.prompt_text!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: copied ? 'rgba(0,255,136,0.12)' : 'rgba(139,92,246,0.1)', color: copied ? C.green : C.purple, border: '1px solid ' + (copied ? 'rgba(0,255,136,0.25)' : 'rgba(139,92,246,0.25)'), cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.2s' }}>
                      <Copy size={10} />{copied ? 'Copied!' : 'Copy Prompt'}
                    </button>
                  )}
                  {task.resource_url && (
                    <a href={task.resource_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(0,212,255,0.08)', color: C.cyan, border: '1px solid rgba(0,212,255,0.18)', textDecoration: 'none', fontWeight: 600 }}>
                      <ExternalLink size={10} />Resource
                    </a>
                  )}
                </div>

                {/* Instructions toggle */}
                {task.instructions && (
                  <div>
                    <button onClick={() => setShowInstructions(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: showInstructions ? C.sec : C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0.25rem 0', fontWeight: 600, transition: 'color 0.2s' }}>
                      {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {showInstructions ? 'Hide instructions' : 'Show how to do this'}
                    </button>
                    {showInstructions && (
                      <div style={{ marginTop: '0.75rem', padding: '1.125rem', background: C.surface, borderRadius: '0.875rem', border: '1px solid ' + C.border, animation: 'slideDown 0.22s ease' }}>
                        <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.75, color: C.sec, fontFamily: 'inherit', margin: 0 }}>{task.instructions}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* -- Action buttons -- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => setTaskIdx(i => Math.max(0, i - 1))} disabled={taskIdx === 0}
                style={{ padding: '0.75rem 1.125rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.875rem', color: C.sec, cursor: taskIdx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: taskIdx === 0 ? 0.3 : 1, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
                &larr; Prev
              </button>

              {isDone ? (
                <button onClick={advanceToNext}
                  style={{ flex: 1, padding: '1.0625rem', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1.0625rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', color: '#000', animation: 'pulseBtn 2s ease-in-out infinite', letterSpacing: '-0.01em' }}>
                  Next Task &rarr;
                </button>
              ) : (
                <button onClick={markDone}
                  style={{ flex: 1, padding: '1.0625rem', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1.0625rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg,' + C.green + ',#00cc6a)', color: '#000', boxShadow: '0 4px 24px rgba(0,255,136,0.28)', letterSpacing: '-0.01em' }}>
                  <CheckCircle2 size={18} />Mark Complete
                </button>
              )}

              <button onClick={() => setTaskIdx(i => Math.min(allTasks.length - 1, i + 1))} disabled={taskIdx === allTasks.length - 1}
                style={{ padding: '0.75rem 1.125rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.875rem', color: C.sec, cursor: taskIdx === allTasks.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: taskIdx === allTasks.length - 1 ? 0.3 : 1, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
                Skip &rarr;
              </button>
            </div>

            {/* Session name */}
            <p style={{ textAlign: 'center', fontSize: '0.65rem', color: C.muted, marginTop: '-0.25rem' }}>{session?.title}</p>
          </div>
        ) : null}
      </div>

      {/* Stage complete overlay */}
      {stageOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.4s ease', padding: '2rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '540px', animation: 'slideUp 0.5s ease' }}>
            <div style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>&#9889;</div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.cyan, marginBottom: '0.625rem' }}>Stage Complete</p>
            <h2 style={{ fontSize: 'clamp(2rem,5vw,2.75rem)', fontWeight: 900, color: C.text, marginBottom: '2rem', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{stageOverlay.name}</h2>
            <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '1.0625rem', color: C.sec, fontStyle: 'italic', lineHeight: 1.75, marginBottom: '0.625rem' }}>
                &ldquo;{stageOverlay.quote}&rdquo;
              </p>
              <p style={{ fontSize: '0.7rem', color: C.muted }}>&mdash; Jim Rohn</p>
            </div>
            <button onClick={advanceToNext}
              style={{ padding: '1rem 2.75rem', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', border: 'none', borderRadius: '1rem', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 0 40px rgba(0,212,255,0.35)', letterSpacing: '-0.01em' }}>
              Continue &rarr;
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes burst {
          0%   { opacity: 1; transform: scale(0.85) }
          60%  { opacity: 0.6 }
          100% { opacity: 0; transform: scale(1.8) }
        }
        @keyframes pulseBtn {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,212,255,0.3) }
          50%       { box-shadow: 0 4px 40px rgba(0,212,255,0.65), 0 0 60px rgba(0,212,255,0.18) }
        }
        @keyframes glowCycle {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(0,212,255,0.55), 0 0 28px rgba(0,212,255,0.22), 0 0 56px rgba(0,212,255,0.07);
            border-color: rgba(0,212,255,0.55);
          }
          33% {
            box-shadow: 0 0 0 1px rgba(255,184,0,0.55), 0 0 28px rgba(255,184,0,0.22), 0 0 56px rgba(255,184,0,0.07);
            border-color: rgba(255,184,0,0.55);
          }
          66% {
            box-shadow: 0 0 0 1px rgba(139,92,246,0.55), 0 0 28px rgba(139,92,246,0.22), 0 0 56px rgba(139,92,246,0.07);
            border-color: rgba(139,92,246,0.55);
          }
        }
        @keyframes particle0 {
          0%   { opacity: 1; transform: translate(0,0) scale(1) }
          100% { opacity: 0; transform: translate(-30px,-40px) scale(0.3) }
        }
        @keyframes particle1 {
          0%   { opacity: 1; transform: translate(0,0) scale(1) }
          100% { opacity: 0; transform: translate(40px,-30px) scale(0.3) }
        }
        @keyframes particle2 {
          0%   { opacity: 1; transform: translate(0,0) scale(1) }
          100% { opacity: 0; transform: translate(20px,40px) scale(0.3) }
        }
      `}</style>
    </main>
  )
}
