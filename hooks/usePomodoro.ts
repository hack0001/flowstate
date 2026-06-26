'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { PomodoroPhase } from '@/types'

const DUR: Record<PomodoroPhase, number> = { work: 1500, shortBreak: 300, longBreak: 900 }

export function usePomodoro(opts: { onWorkComplete?: () => void; onBreakComplete?: () => void } = {}) {
  const [phase, setPhase] = useState<PomodoroPhase>('work')
  const [timeLeft, setTimeLeft] = useState(DUR.work)
  const [isRunning, setIsRunning] = useState(false)
  const [pomsDone, setPomsDone] = useState(0)
  const workCb = useRef(opts.onWorkComplete)
  const breakCb = useRef(opts.onBreakComplete)
  useEffect(() => { workCb.current = opts.onWorkComplete }, [opts.onWorkComplete])
  useEffect(() => { breakCb.current = opts.onBreakComplete }, [opts.onBreakComplete])

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t > 1) return t - 1
        setIsRunning(false)
        setPhase(cur => {
          if (cur === 'work') {
            setPomsDone(n => n + 1)
            const next: PomodoroPhase = (pomsDone + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
            setTimeLeft(DUR[next])
            setTimeout(() => workCb.current?.(), 0)
            return next
          } else {
            setTimeLeft(DUR.work)
            setTimeout(() => breakCb.current?.(), 0)
            return 'work'
          }
        })
        return 0
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning, pomsDone])

  const fmt = (s: number) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  return {
    phase, timeLeft, isRunning, pomodorosCompleted: pomsDone,
    start: useCallback(() => setIsRunning(true), []),
    pause: useCallback(() => setIsRunning(false), []),
    reset: useCallback(() => { setIsRunning(false); setTimeLeft(DUR[phase]) }, [phase]),
    skip: useCallback(() => {
      setIsRunning(false)
      setPhase(cur => {
        const next: PomodoroPhase = cur === 'work'
          ? ((pomsDone+1)%4===0 ? 'longBreak' : 'shortBreak')
          : 'work'
        setTimeLeft(DUR[next])
        return next
      })
    }, [pomsDone]),
    formattedTime: fmt(timeLeft),
    progress: 1 - timeLeft / DUR[phase],
    isBreak: phase !== 'work',
  }
}
