'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PomodoroPhase } from '@/types'

const DURATIONS: Record<PomodoroPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

interface UsePomodoroOptions {
  onWorkComplete?: () => void
  onBreakComplete?: () => void
}

export function usePomodoro({ onWorkComplete, onBreakComplete }: UsePomodoroOptions = {}) {
  const [phase, setPhase] = useState<PomodoroPhase>('work')
  const [timeLeft, setTimeLeft] = useState(DURATIONS.work)
  const [isRunning, setIsRunning] = useState(false)
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0)
  const onWorkRef = useRef(onWorkComplete)
  const onBreakRef = useRef(onBreakComplete)

  useEffect(() => { onWorkRef.current = onWorkComplete }, [onWorkComplete])
  useEffect(() => { onBreakRef.current = onBreakComplete }, [onBreakComplete])

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false)
          setPhase(cur => {
            const wasWork = cur === 'work'
            if (wasWork) {
              setPomodorosCompleted(n => {
                const next = n + 1
                const nextPhase = next % 4 === 0 ? 'longBreak' : 'shortBreak'
                setTimeLeft(DURATIONS[nextPhase])
                setPhase(nextPhase)
                setTimeout(() => onWorkRef.current?.(), 0)
                return next
              })
            } else {
              setTimeLeft(DURATIONS.work)
              setPhase('work')
              setTimeout(() => onBreakRef.current?.(), 0)
            }
            return cur
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec
  }

  const start = useCallback(() => setIsRunning(true), [])
  const pause = useCallback(() => setIsRunning(false), [])
  const reset = useCallback(() => { setIsRunning(false); setTimeLeft(DURATIONS[phase]) }, [phase])
  const skip = useCallback(() => {
    setIsRunning(false)
    setPhase(cur => {
      const wasWork = cur === 'work'
      if (wasWork) {
        setPomodorosCompleted(n => n + 1)
        const next = (pomodorosCompleted + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
        setTimeLeft(DURATIONS[next])
        return next
      } else {
        setTimeLeft(DURATIONS.work)
        return 'work'
      }
    })
  }, [pomodorosCompleted])

  return {
    phase, timeLeft, isRunning, pomodorosCompleted,
    start, pause, reset, skip,
    formattedTime: formatTime(timeLeft),
    progress: 1 - timeLeft / DURATIONS[phase],
    isBreak: phase !== 'work',
  }
}
