'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, Target, ChevronRight, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask, uncompleteTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task, TaskCompletion } from '@/types'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'

export default function WorkflowPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [activeStageIdx, setActiveStageIdx] = useState(0)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { celebrate } = useCelebration()

  const completedIds = new Set(completions.map((c) => c.task_id))

  const allTasks = stages.flatMap((s) => s.tasks ?? [])
  const totalTasks = allTasks.length
  const totalCompleted = allTasks.filter((t) => completedIds.has(t.id)).length
  const overallProgress = totalTasks ? (totalCompleted / totalTasks) * 100 : 0

  const load = useCallback(async () => {
    try {
      const s = await getSession(sessionId)
      setSession(s)
      const st = await getStagesForWorkflow(s.workflow_type_id)
      setStages(st ?? [])
      const c = await getCompletions(sessionId)
      setCompletions(c ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  async function toggleTask(task: Task) {
    const isDone = completedIds.has(task.id)
    if (isDone) {
      sounds.playClick()
      await uncompleteTask(sessionId, task.id)
      setCompletions((prev) => prev.filter((c) => c.task_id !== task.id))
    } else {
      sounds.playTaskComplete()
      await completeTask(sessionId, task.id)
      setCompletions((prev) => [
        ...prev,
        { id: Date.now().toString(), session_id: sessionId, task_id: task.id, completed_at: new Date().toISOString(), pomodoros_used: 0 },
      ])
      // Check if stage complete
      const currentStageTasks = stages[activeStageIdx]?.tasks ?? []
      const newCompleted = [...completedIds, task.id]
      const stageComplete = currentStageTasks.every((t) => newCompleted.includes(t.id))
      if (stageComplete) {
        sounds.playStageComplete()
        celebrate('stage')
      }
    }
  }

  function stageCompletionPercent(stage: Stage) {
    const tasks = stage.tasks ?? []
    if (!tasks.length) return 0
    const done = tasks.filter((t) => completedIds.has(t.id)).length
    return Math.round((done / tasks.length) * 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cyan)', borderTopColor: 'transparent' }} />
          Loading...
        </div>
      </div>
    )
  }

  const activeStage = stages[activeStageIdx]
  const stageTasks = activeStage?.tasks ?? []

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-8">
      {/* Top nav */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => { sounds.playClick(); router.push('/') }}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
          Home
        </button>
        <button
          onClick={() => { sounds.playClick(); router.push(`/workflow/${sessionId}/focus`) }}
          className="btn btn-primary text-sm flex items-center gap-2"
        >
          <Zap size={14} />
          Focus Mode
        </button>
      </div>

      {/* Session header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{session?.workflow_type?.icon}</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {session?.workflow_type?.name}
          </span>
        </div>
        <h1 className="text-2xl font-black mb-4" style={{ color: 'var(--text-primary)' }}>
          {session?.title}
        </h1>

        {/* Overall progress */}
        <div className="flex items-center gap-3">
          <div className="progress-bar flex-1">
            <div
              className="progress-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--cyan)' }}>
            {totalCompleted}/{totalTasks}
          </span>
        </div>
      </motion.div>

      {/* Stage pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {stages.map((stage, idx) => {
          const pct = stageCompletionPercent(stage)
          const isComplete = pct === 100
          return (
            <button
              key={stage.id}
              onClick={() => { sounds.playClick(); setActiveStageIdx(idx) }}
              className={`stage-pill ${idx === activeStageIdx ? 'active' : ''} ${isComplete ? 'completed' : ''}`}
            >
              {isComplete ? <CheckCircle2 size={13} /> : <span>{stage.icon}</span>}
              {stage.name}
              {pct > 0 && !isComplete && (
                <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {pct}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Stage tasks */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStageIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeStage && (
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {activeStage.icon} {activeStage.name}
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {activeStage.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {stageTasks.filter((t) => completedIds.has(t.id)).length} / {stageTasks.length} done
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {stageTasks.map((task, taskIdx) => {
              const isDone = completedIds.has(task.id)
              const isExpanded = expandedTask === task.id

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: taskIdx * 0.04 }}
                  className="card overflow-hidden"
                  style={{
                    borderColor: isDone ? 'rgba(0,255,136,0.3)' : isExpanded ? 'var(--cyan)' : 'var(--border)',
                    background: isDone ? 'rgba(0,255,136,0.03)' : 'var(--card)',
                  }}
                >
                  {/* Task header row */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => {
                      sounds.playClick()
                      setExpandedTask(isExpanded ? null : task.id)
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className={`task-checkbox ${isDone ? 'checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTask(task)
                      }}
                    >
                      {isDone && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-sm"
                        style={{
                          color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {task.description}
                        {task.estimated_minutes && (
                          <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                            ~{task.estimated_minutes}m
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isDone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            sounds.playClick()
                            router.push(`/workflow/${sessionId}/focus?task=${task.id}`)
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                          style={{
                            background: 'rgba(0,212,255,0.1)',
                            color: 'var(--cyan)',
                            border: '1px solid rgba(0,212,255,0.2)',
                          }}
                        >
                          <Target size={11} />
                          Focus
                        </button>
                      )}
                      <ChevronRight
                        size={16}
                        style={{
                          color: 'var(--text-muted)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </div>
                  </div>

                  {/* Expanded instructions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className="px-4 pb-4 pt-1"
                          style={{ borderTop: '1px solid var(--border)' }}
                        >
                          <pre
                            className="text-sm whitespace-pre-wrap leading-relaxed"
                            style={{
                              color: 'var(--text-secondary)',
                              fontFamily: 'inherit',
                            }}
                          >
                            {task.instructions}
                          </pre>

                          <div className="flex gap-2 mt-4">
                            {task.has_prompt && task.prompt_text && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(task.prompt_text!)
                                  sounds.playClick()
                                }}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                                style={{
                                  background: 'rgba(139,92,246,0.1)',
                                  color: 'var(--purple)',
                                  border: '1px solid rgba(139,92,246,0.3)',
                                }}
                              >
                                <Copy size={11} />
                                Copy Claude Prompt
                              </button>
                            )}
                            {task.resource_url && (
                              <a
                                href={task.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                                style={{
                                  background: 'rgba(0,212,255,0.1)',
                                  color: 'var(--cyan)',
                                  border: '1px solid rgba(0,212,255,0.2)',
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLink size={11} />
                                Open Resource
                              </a>
                            )}
                            <button
                              onClick={() => toggleTask(task)}
                              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                              style={{
                                background: isDone ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.15)',
                                color: 'var(--green)',
                                border: '1px solid rgba(0,255,136,0.3)',
                              }}
                            >
                              <CheckCircle2 size={11} />
                              {isDone ? 'Mark Incomplete' : 'Mark Complete'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>

          {/* Stage navigation */}
          <div className="flex justify-between mt-6">
            <button
              disabled={activeStageIdx === 0}
              onClick={() => { sounds.playClick(); setActiveStageIdx((i) => i - 1) }}
              className="btn btn-ghost text-sm"
              style={{ opacity: activeStageIdx === 0 ? 0.3 : 1 }}
            >
              ← Previous Stage
            </button>
            <button
              disabled={activeStageIdx === stages.length - 1}
              onClick={() => { sounds.playClick(); setActiveStageIdx((i) => i + 1) }}
              className="btn btn-ghost text-sm"
              style={{ opacity: activeStageIdx === stages.length - 1 ? 0.3 : 1 }}
            >
              Next Stage →
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
