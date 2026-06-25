'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PomodoroPhase } from '@/types'

export const DURATIONS: Record<PomodoroPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

interface PomodoroState {
  phase: PomodoroPhase
  timeLeft: number
  isRunning: boolean
  pomodorosCompleted: number
}

interface UsePomodoroOptions {
  onWorkComplete?: () => void
  onBreakComplete?: () => void
}

export function usePomodoro({ onWorkComplete, onBreakComplete }: UsePomodoroOptions = {}) {
  const [state, setState] = useState<PomodoroState>({
    phase: 'work',
    timeLeft: DURATIONS.work,
    isRunning: false,
    pomodorosCompleted: 0,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onWorkCompleteRef = useRef(onWorkComplete)
  const onBreakCompleteRef = useRef(onBreakComplete)

  useEffect(() => {
    onWorkCompleteRef.current = onWorkComplete
    onBreakCompleteRef.current = onBreakComplete
  }, [onWorkComplete, onBreakComplete])

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.timeLeft <= 1) {
        const wasWork = prev.phase === 'work'
        const newPomodoros = wasWork ? prev.pomodorosCompleted + 1 : prev.pomodorosCompleted

        let nextPhase: PomodoroPhase
        if (wasWork) {
          nextPhase = newPomodoros % 4 === 0 ? 'longBreak' : 'shortBreak'
          setTimeout(() => onWorkCompleteRef.current?.(), 0)
        } else {
          nextPhase = 'work'
          setTimeout(() => onBreakCompleteRef.current?.(), 0)
        }

        return {
          phase: nextPhase,
          timeLeft: DURATIONS[nextPhase],
          isRunning: false,
          pomodorosCompleted: newPomodoros,
        }
      }
      return { ...prev, timeLeft: prev.timeLeft - 1 }
    })
  }, [])

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.isRunning, tick])

  const start = useCallback(() => setState((p) => ({ ...p, isRunning: true })), [])
  const pause = useCallback(() => setState((p) => ({ ...p, isRunning: false })), [])

  const reset = useCallback(() =>
    setState((p) => ({ ...p, timeLeft: DURATIONS[p.phase], isRunning: false })), [])

  const skip = useCallback(() => {
    setState((prev) => {
      const wasWork = prev.phase === 'work'
      const newPomodoros = wasWork ? prev.pomodorosCompleted + 1 : prev.pomodorosCompleted
      let nextPhase: PomodoroPhase
      if (wasWork) {
        nextPhase = newPomodoros % 4 === 0 ? 'longBreak' : 'shortBreak'
      } else {
        nextPhase = 'work'
      }
      return {
        phase: nextPhase,
        timeLeft: DURATIONS[nextPhase],
        isRunning: false,
        pomodorosCompleted: newPomodoros,
      }
    })
  }, [])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return {
    ...state,
    start,
    pause,
    reset,
    skip,
    formattedTime: formatTime(state.timeLeft),
    progress: 1 - state.timeLeft / DURATIONS[state.phase],
    isBreak: state.phase !== 'work',
  }
}
