'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Copy, ExternalLink, Volume2, VolumeX, LayoutGrid, Play, Pause, SkipForward, RefreshCw } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task } from '@/types'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'

const C = {
  bg: '#0a0a0f', surface: '#12121a', card: '#1a1a26', border: '#2a2a3a',
  cyan: '#00d4ff', green: '#00ff88', purple: '#8b5cf6', amber: '#ffb800',
  text: '#f0f0ff', textSec: '#8888aa', textMut: '#4a4a6a',
}

const TIPS = [
  { tip: 'One task. One screen. One focus.', science: 'Task-switching costs 23 minutes of recovery time on average.' },
  { tip: 'The next 25 minutes are all that exist.', science: 'Pomodoro technique removes decision fatigue and sharpens focus.' },
  { tip: 'Done beats perfect. Ship it.', science: 'Perfectionism is procrastination with better PR.' },
  { tip: 'Momentum is a superpower.', science: 'Completing small tasks triggers dopamine, fuelling the next one.' },
  { tip: 'Your phone can wait. This cannot.', science: 'Average attention recovery after phone distraction: 25 minutes.' },
  { tip: 'The hardest part is starting. You already did that.', science: 'Zeigarnik effect: started tasks are easier to complete.' },
  { tip: 'Progress, not perfection.', science: 'Teresa Amabile: small wins create the best creative momentum.' },
  { tip: 'Protect your deep work time fiercely.', science: 'Cal Newport: 4hrs deep work beats 10hrs of distracted work.' },
]

function PomodoroRing({ progress, phase }: { progress: number; phase: string }) {
  const size = 120, stroke = 6, r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = phase === 'work' ? C.cyan : phase === 'shortBreak' ? C.green : C.purple
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 6px ${color}88)` }} />
    </svg>
  )
}

export default function FocusPage() {
  const router = useRouter()
  const { id: sessionId } = useParams() as { id: string }
  const searchParams = useSearchParams()
  const initialTaskId = searchParams.get('task')

  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [taskIdx, setTaskIdx] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [justDone, setJustDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tipIdx, setTipIdx] = useState(0)
  const { celebrate } = useCelebration()

  const allTasks: Task[] = stages.flatMap(s => s.tasks ?? [])
  const task = allTasks[taskIdx] ?? null
  const currentStage = task ? stages.find(s => s.tasks?.some(t => t.id === task.id)) : null
  const totalDone = allTasks.filter(t => completedIds.has(t.id)).length
  const progress = allTasks.length ? totalDone / allTasks.length : 0
  const isDone = task ? completedIds.has(task.id) : false

  const onWorkDone = useCallback(() => { if (soundOn) sounds.playTimerEnd(); celebrate('task') }, [soundOn, celebrate])
  const onBreakDone = useCallback(() => { if (soundOn) sounds.playBreakStart() }, [soundOn])
  const pom = usePomodoro({ onWorkComplete: onWorkDone, onBreakComplete: onBreakDone })

  useEffect(() => { sounds.setEnabled(soundOn) }, [soundOn])

  useEffect(() => {
    async function load() {
      try {
        const s = await getSession(sessionId)
        setSession(s)
        const st = await getStagesForWorkflow(s.workflow_type_id)
        const validSt = st ?? []
        setStages(validSt)
        const c = await getCompletions(sessionId)
        const ids = new Set((c ?? []).map((x: { task_id: string }) => x.task_id))
        setCompletedIds(ids)
        const flat: Task[] = validSt.flatMap((stage: Stage) => stage.tasks ?? [])
        if (initialTaskId) {
          const i = flat.findIndex(t => t.id === initialTaskId)
          if (i >= 0) setTaskIdx(i)
        } else {
          const i = flat.findIndex(t => !ids.has(t.id))
          if (i >= 0) setTaskIdx(i)
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [sessionId, initialTaskId])

  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  async function markComplete() {
    if (!task || isDone) return
    sounds.playTaskComplete()
    const newIds = new Set(Array.from(completedIds).concat(task.id))
    setCompletedIds(newIds)
    setJustDone(true)
    await completeTask(sessionId, task.id, pom.pomodorosCompleted)
    const stageDone = (currentStage?.tasks ?? []).every(t => newIds.has(t.id))
    if (stageDone) setTimeout(() => { sounds.playStageComplete(); celebrate('stage') }, 300)
    else setTimeout(() => celebrate('task'), 100)
    setTimeout(() => {
      setJustDone(false)
      const next = allTasks.findIndex((t, i) => i > taskIdx && !newIds.has(t.id))
      if (next >= 0) setTaskIdx(next)
    }, 1200)
  }

  const tip = TIPS[tipIdx]
  const phaseColor = pom.phase === 'work' ? C.cyan : pom.phase === 'shortBreak' ? C.green : C.purple
  const phaseLabel = pom.phase === 'work' ? '🎯 Focus Time' : pom.phase === 'shortBreak' ? '☕ Short Break' : '🌿 Long Break'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: '0.75rem', color: C.textSec }}>
      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: `2px solid ${C.cyan}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      Loading focus session...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => { sounds.playClick(); router.push(`/workflow/${sessionId}`) }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>
            <ArrowLeft size={15} />Overview
          </button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: '0.875rem', color: C.textSec }}>{session?.workflow_type?.icon} {session?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => setSoundOn(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMut, padding: '0.25rem' }}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={() => { sounds.playClick(); router.push(`/workflow/${sessionId}`) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMut, padding: '0.25rem' }}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.75rem', color: C.textMut }}>{currentStage?.icon} {currentStage?.name}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.cyan }}>{totalDone}/{allTasks.length} tasks</span>
        </div>
        <div style={{ height: '6px', background: C.border, borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`, borderRadius: '3px', transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Main layout: task + sidebar */}
      <div style={{ flex: 1, display: 'flex', gap: '1.5rem', padding: '0 1.5rem 1.5rem', minHeight: 0, flexWrap: 'wrap' }}>

        {/* Task panel */}
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {task ? (
            <>
              {/* Task header card */}
              <div style={{ background: isDone ? 'rgba(0,255,136,0.04)' : C.card, border: `1px solid ${isDone ? 'rgba(0,255,136,0.4)' : C.border}`, borderRadius: '1rem', padding: '1.5rem', transition: 'all 0.4s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMut }}>Task {taskIdx + 1} of {allTasks.length}</span>
                  {isDone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: 'rgba(0,255,136,0.15)', color: C.green }}><CheckCircle2 size={10} />Complete</span>}
                </div>
                <h1 style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)', fontWeight: 900, color: C.text, lineHeight: 1.25, marginBottom: '0.5rem' }}>{task.title}</h1>
                <p style={{ fontSize: '0.875rem', color: C.textSec }}>
                  {task.description}
                  {task.estimated_minutes && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', background: C.surface, color: C.textMut, fontSize: '0.75rem' }}>~{task.estimated_minutes}m</span>}
                </p>
              </div>

              {/* Instructions */}
              <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMut, marginBottom: '1rem' }}>Instructions</p>
                <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, color: C.textSec, fontFamily: 'inherit', flex: 1 }}>{task.instructions}</pre>
                {(task.has_prompt || task.resource_url) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                    {task.has_prompt && task.prompt_text && (
                      <button onClick={() => { navigator.clipboard.writeText(task.prompt_text!); sounds.playClick(); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', background: copied ? 'rgba(0,255,136,0.15)' : 'rgba(139,92,246,0.1)', color: copied ? C.green : C.purple, border: `1px solid ${copied ? 'rgba(0,255,136,0.3)' : 'rgba(139,92,246,0.3)'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                        <Copy size={13} />{copied ? '✓ Copied!' : 'Copy Claude Prompt'}
                      </button>
                    )}
                    {task.resource_url && (
                      <a href={task.resource_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', background: `${C.cyan}1a`, color: C.cyan, border: `1px solid ${C.cyan}33`, textDecoration: 'none' }}>
                        <ExternalLink size={13} />Open Resource
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={() => { sounds.playClick(); setTaskIdx(i => Math.max(0, i - 1)) }}
                  disabled={taskIdx === 0}
                  style={{ padding: '0.875rem', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '0.75rem', color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: taskIdx === 0 ? 0.3 : 1, transition: 'all 0.2s' }}>
                  <ChevronLeft size={20} />
                </button>
                <button onClick={markComplete} disabled={isDone || justDone}
                  style={{ flex: 1, padding: '1rem', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1rem', cursor: isDone ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.3s',
                    background: isDone ? 'rgba(0,255,136,0.15)' : `linear-gradient(135deg, ${C.green}, #00cc6a)`,
                    color: isDone ? C.green : '#000',
                    border: isDone ? `1px solid rgba(0,255,136,0.3)` : 'none',
                    boxShadow: isDone ? 'none' : `0 4px 20px rgba(0,255,136,0.3)` }}>
                  {isDone ? <><CheckCircle2 size={18} />Done ✓</> : justDone ? '🎉 Crushed it!' : '✓ Mark Complete'}
                </button>
                <button onClick={() => { sounds.playClick(); setTaskIdx(i => Math.min(allTasks.length - 1, i + 1)) }}
                  disabled={taskIdx === allTasks.length - 1}
                  style={{ padding: '0.875rem', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '0.75rem', color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: taskIdx === allTasks.length - 1 ? 0.3 : 1, transition: 'all 0.2s' }}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: C.green, marginBottom: '0.5rem' }}>All tasks complete!</h2>
                <p style={{ color: C.textSec }}>You crushed this workflow. Time to publish.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Pomodoro */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: phaseColor, marginBottom: '0.75rem' }}>{phaseLabel}</p>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <PomodoroRing progress={pom.progress} phase={pom.phase} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: C.text }}>{pom.formattedTime}</span>
                <span style={{ fontSize: '0.7rem', color: C.textMut }}>#{pom.pomodorosCompleted + 1}</span>
              </div>
            </div>
            {/* Dots */}
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: i < (pom.pomodorosCompleted % 4) ? C.cyan : C.border, transition: 'all 0.3s' }} />
              ))}
            </div>
            {/* Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <button onClick={() => { sounds.playClick(); pom.isRunning ? pom.pause() : pom.start() }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem', background: `linear-gradient(135deg, ${C.cyan}, #0099cc)`, border: 'none', borderRadius: '0.75rem', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}>
                {pom.isRunning ? <Pause size={14} /> : <Play size={14} />}
                {pom.isRunning ? 'Pause' : 'Start'}
              </button>
              <button onClick={() => { sounds.playClick(); pom.reset() }} style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '0.75rem', color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Reset"><RefreshCw size={14} /></button>
              <button onClick={() => { sounds.playClick(); pom.skip() }} style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '0.75rem', color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Skip"><SkipForward size={14} /></button>
            </div>
            {pom.isBreak && (
              <p style={{ fontSize: '0.75rem', textAlign: 'center', color: C.green, marginTop: '0.75rem' }}>
                {pom.phase === 'shortBreak' ? '☕ Step away. Breathe. Stretch.' : '🌿 Longer break — walk around.'}
              </p>
            )}
          </div>

          {/* Focus tip */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMut, marginBottom: '0.5rem' }}>Focus Tip</p>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: C.text, marginBottom: '0.375rem' }}>{tip.tip}</p>
            <p style={{ fontSize: '0.75rem', lineHeight: 1.5, color: C.textMut }}>{tip.science}</p>
          </div>

          {/* Stage mini-map */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMut, marginBottom: '0.75rem' }}>Progress</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {stages.map(stage => {
                const tasks = stage.tasks ?? []
                const done = tasks.filter(t => completedIds.has(t.id)).length
                const pct = tasks.length ? done / tasks.length * 100 : 0
                const active = stage.id === currentStage?.id
                return (
                  <div key={stage.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: active ? C.cyan : C.textMut, fontWeight: active ? 600 : 400 }}>{stage.icon} {stage.name}</span>
                      <span style={{ fontSize: '0.75rem', color: C.textMut }}>{done}/{tasks.length}</span>
                    </div>
                    <div style={{ height: '3px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     