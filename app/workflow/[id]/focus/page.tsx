'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2,
  Copy, ExternalLink, Volume2, VolumeX, LayoutGrid,
  Play, Pause, SkipForward, RefreshCw
} from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task } from '@/types'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'

const FOCUS_TIPS = [
  { tip: "One task. One screen. One focus.", science: "Research shows task-switching costs 23 minutes of recovery time." },
  { tip: "The next 25 minutes are all that exist.", science: "Pomodoro technique improves focus by removing decision fatigue." },
  { tip: "Done beats perfect. Ship it.", science: "Perfectionism is procrastination with better PR." },
  { tip: "Momentum is a superpower.", science: "Completing small tasks triggers dopamine, fuelling the next one." },
  { tip: "Your phone can wait. This can't.", science: "Average attention recovery after phone distraction: 25 minutes." },
  { tip: "The hardest part is starting. You already did that.", science: "Zeigarnik effect: started tasks are easier to complete." },
  { tip: "Progress, not perfection.", science: "Teresa Amabile: small wins create the best creative momentum." },
  { tip: "Protect your deep work time fiercely.", science: "Cal Newport: 4 hours of deep work beats 10 hours of distracted work." },
]

function PomodoroRing({ progress, phase }: { progress: number; phase: string }) {
  const size = 120
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  const color = phase === 'work' ? '#00d4ff' : phase === 'shortBreak' ? '#00ff88' : '#8b5cf6'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2a2a3a" strokeWidth={stroke} />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="pomodoro-ring"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
    </svg>
  )
}

export default function FocusPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.id as string
  const initialTaskId = searchParams.get('task')

  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [justCompleted, setJustCompleted] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tipIdx, setTipIdx] = useState(0)

  const { celebrate } = useCelebration()

  const allTasks: Task[] = stages.flatMap((s) => s.tasks ?? [])
  const currentTask = allTasks[currentTaskIdx] ?? null
  const totalTasks = allTasks.length
  const totalCompleted = allTasks.filter((t) => completedIds.has(t.id)).length
  const progress = totalTasks ? totalCompleted / totalTasks : 0
  const currentStage = currentTask
    ? stages.find((s) => s.tasks?.some((t) => t.id === currentTask.id))
    : null

  const handlePomodoroWorkComplete = useCallback(() => {
    if (soundEnabled) sounds.playTimerEnd()
    celebrate('task')
  }, [soundEnabled, celebrate])

  const handlePomodoroBreakComplete = useCallback(() => {
    if (soundEnabled) sounds.playBreakStart()
  }, [soundEnabled])

  const pomodoro = usePomodoro({
    onWorkComplete: handlePomodoroWorkComplete,
    onBreakComplete: handlePomodoroBreakComplete,
  })

  useEffect(() => {
    sounds.setEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    async function load() {
      try {
        const s = await getSession(sessionId)
        setSession(s)
        const st = await getStagesForWorkflow(s.workflow_type_id)
        const validStages = st ?? []
        setStages(validStages)

        const completionData = await getCompletions(sessionId)
        const ids = new Set((completionData ?? []).map((c: { task_id: string }) => c.task_id))
        setCompletedIds(ids)

        // Find starting task
        if (initialTaskId) {
          const flat: Task[] = validStages.flatMap((stage) => stage.tasks ?? [])
          const idx = flat.findIndex((t) => t.id === initialTaskId)
          if (idx >= 0) setCurrentTaskIdx(idx)
        } else {
          // Find first incomplete task
          const flat: Task[] = validStages.flatMap((stage) => stage.tasks ?? [])
          const firstIncomplete = flat.findIndex((t) => !ids.has(t.id))
          if (firstIncomplete >= 0) setCurrentTaskIdx(firstIncomplete)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, initialTaskId])

  // Rotate tip every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIdx((i) => (i + 1) % FOCUS_TIPS.length)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function markComplete() {
    if (!currentTask || completedIds.has(currentTask.id)) return
    sounds.playTaskComplete()

    const newIds = new Set([...completedIds, currentTask.id])
    setCompletedIds(newIds)
    setJustCompleted(true)

    await completeTask(sessionId, currentTask.id, pomodoro.pomodorosCompleted)

    // Check if stage complete
    const stageTasks = currentStage?.tasks ?? []
    const stageComplete = stageTasks.every((t) => newIds.has(t.id))
    if (stageComplete) {
      setTimeout(() => {
        sounds.playStageComplete()
        celebrate('stage')
      }, 300)
    } else {
      setTimeout(() => celebrate('task'), 100)
    }

    setTimeout(() => {
      setJustCompleted(false)
      // Auto-advance to next incomplete task
      const nextIdx = allTasks.findIndex((t, i) => i > currentTaskIdx && !newIds.has(t.id))
      if (nextIdx >= 0) {
        setCurrentTaskIdx(nextIdx)
      }
    }, 1200)
  }

  function navigate(dir: 'prev' | 'next') {
    sounds.playClick()
    setCurrentTaskIdx((i) => {
      if (dir === 'prev') return Math.max(0, i - 1)
      return Math.min(allTasks.length - 1, i + 1)
    })
  }

  function copyPrompt() {
    if (currentTask?.prompt_text) {
      navigator.clipboard.writeText(currentTask.prompt_text)
      sounds.playClick()
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--cyan)', borderTopColor: 'transparent' }} />
          Loading focus session...
        </div>
      </div>
    )
  }

  const isDone = currentTask ? completedIds.has(currentTask.id) : false
  const tip = FOCUS_TIPS[tipIdx]

  const phaseLabel = {
    work: '🎯 Focus Time',
    shortBreak: '☕ Short Break',
    longBreak: '🌿 Long Break',
  }[pomodoro.phase]

  const phaseColor = {
    work: 'var(--cyan)',
    shortBreak: 'var(--green)',
    longBreak: 'var(--purple)',
  }[pomodoro.phase]

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { sounds.playClick(); router.push(`/workflow/${sessionId}`) }}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft size={15} />
            Overview
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {session?.workflow_type?.icon} {session?.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => { sounds.playClick(); router.push(`/workflow/${sessionId}`) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            title="Task list"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="px-6 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {currentStage?.icon} {currentStage?.name}
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--cyan)' }}>
            {totalCompleted}/{totalTasks} tasks
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Main focus area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-6 pb-6 min-h-0">

        {/* Task panel */}
        <div className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {currentTask ? (
              <motion.div
                key={currentTask.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-4 flex-1"
              >
                {/* Task header */}
                <div
                  className="card p-6"
                  style={{
                    borderColor: isDone
                      ? 'rgba(0,255,136,0.4)'
                      : justCompleted
                      ? 'rgba(0,255,136,0.6)'
                      : 'var(--border)',
                    background: isDone ? 'rgba(0,255,136,0.05)' : 'var(--card)',
                    transition: 'all 0.4s ease',
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold tracking-widest uppercase"
                          style={{ color: 'var(--text-muted)' }}>
                          Task {currentTaskIdx + 1} of {totalTasks}
                        </span>
                        {isDone && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--green)' }}>
                            <CheckCircle2 size={10} />
                            Complete
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {currentTask.title}
                      </h1>
                      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {currentTask.description}
                        {currentTask.estimated_minutes && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs"
                            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                            ~{currentTask.estimated_minutes}m
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="card p-6 flex-1 overflow-auto">
                  <h3 className="text-xs font-semibold tracking-widest uppercase mb-4"
                    style={{ color: 'var(--text-muted)' }}>
                    Instructions
                  </h3>
                  <pre
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                  >
                    {currentTask.instructions}
                  </pre>

                  {/* Resource links */}
                  {(currentTask.has_prompt || currentTask.resource_url) && (
                    <div className="flex gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      {currentTask.has_prompt && currentTask.prompt_text && (
                        <button
                          onClick={copyPrompt}
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl transition-all"
                          style={{
                            background: promptCopied ? 'rgba(0,255,136,0.15)' : 'rgba(139,92,246,0.1)',
                            color: promptCopied ? 'var(--green)' : 'var(--purple)',
                            border: promptCopied ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(139,92,246,0.3)',
                          }}
                        >
                          <Copy size={13} />
                          {promptCopied ? '✓ Copied!' : 'Copy Claude Prompt'}
                        </button>
                      )}
                      {currentTask.resource_url && (
                        <a
                          href={currentTask.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl transition-all"
                          style={{
                            background: 'rgba(0,212,255,0.1)',
                            color: 'var(--cyan)',
                            border: '1px solid rgba(0,212,255,0.2)',
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={13} />
                          Open Resource
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('prev')}
                    disabled={currentTaskIdx === 0}
                    className="btn btn-ghost p-3"
                    style={{ opacity: currentTaskIdx === 0 ? 0.3 : 1 }}
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    onClick={markComplete}
                    disabled={isDone || justCompleted}
                    className="btn flex-1 text-base font-bold py-4 transition-all duration-300"
                    style={{
                      background: isDone
                        ? 'rgba(0,255,136,0.15)'
                        : 'linear-gradient(135deg, var(--green), #00cc6a)',
                      color: isDone ? 'var(--green)' : '#000',
                      border: isDone ? '1px solid rgba(0,255,136,0.3)' : 'none',
                      boxShadow: isDone ? 'none' : '0 4px 20px rgba(0,255,136,0.3)',
                    }}
                  >
                    {isDone ? (
                      <><CheckCircle2 size={18} /> Done ✓</>
                    ) : justCompleted ? (
                      '🎉 Crushed it!'
                    ) : (
                      '✓ Mark Complete'
                    )}
                  </button>

                  <button
                    onClick={() => navigate('next')}
                    disabled={currentTaskIdx === allTasks.length - 1}
                    className="btn btn-ghost p-3"
                    style={{ opacity: currentTaskIdx === allTasks.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center card"
              >
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--green)' }}>
                    All tasks complete!
                  </h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    You crushed this workflow. Time to publish.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right sidebar: Pomodoro + tips */}
        <div className="lg:w-72 flex flex-col gap-4 flex-shrink-0">

          {/* Pomodoro timer */}
          <div className="card p-5 flex flex-col items-center">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: phaseColor }}>
              {phaseLabel}
            </p>

            <div className="relative mb-3">
              <PomodoroRing progress={pomodoro.progress} phase={pomodoro.phase} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                  {pomodoro.formattedTime}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  #{pomodoro.pomodorosCompleted + 1}
                </span>
              </div>
            </div>

            {/* Pomodoro dots (4 per cycle) */}
            <div className="flex gap-1.5 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i < (pomodoro.pomodorosCompleted % 4)
                      ? 'var(--cyan)'
                      : 'var(--border)',
                  }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  sounds.playClick()
                  pomodoro.isRunning ? pomodoro.pause() : pomodoro.start()
                }}
                className="btn btn-primary flex-1 py-2 text-sm"
              >
                {pomodoro.isRunning ? <Pause size={14} /> : <Play size={14} />}
                {pomodoro.isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => { sounds.playClick(); pomodoro.reset() }}
                className="btn btn-ghost p-2"
                title="Reset"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => { sounds.playClick(); pomodoro.skip() }}
                className="btn btn-ghost p-2"
                title="Skip phase"
              >
                <SkipForward size={14} />
              </button>
            </div>

            {pomodoro.isBreak && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-center mt-3"
                style={{ color: 'var(--green)' }}
              >
                {pomodoro.phase === 'shortBreak'
                  ? '☕ Step away. Breathe. Stretch.'
                  : '🌿 Longer break — well earned. Walk around.'}
              </motion.p>
            )}
          </div>

          {/* Focus tip */}
          <motion.div
            key={tipIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
          >
            <p className="text-xs font-semibold tracking-widest uppercase mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Focus Tip
            </p>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
              {tip.tip}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {tip.science}
            </p>
          </motion.div>

          {/* Stage mini-map */}
          <div className="card p-4">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Progress
            </p>
            <div className="flex flex-col gap-2">
              {stages.map((stage) => {
                const tasks = stage.tasks ?? []
                const done = tasks.filter((t) => completedIds.has(t.id)).length
                const pct = tasks.length ? (done / tasks.length) * 100 : 0
                const isActive = stage.id === currentStage?.id
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs"
                        style={{ color: isActive ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: isActive ? 600 : 400 }}
                      >
                        {stage.icon} {stage.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {done}/{tasks.length}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: '3px' }}>
                      <div
                        className="progress-fill"
                        style={{ width: `${pct}%`, height: '100%' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
