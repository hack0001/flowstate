'use client'

import { useCallback } from 'react'

export function useCelebration() {
  const celebrate = useCallback(async (type: 'task' | 'stage' | 'workflow') => {
    try {
      const confetti = (await import('canvas-confetti')).default
      if (type === 'task') {
        confetti({ particleCount: 60, spread: 55, origin: { y: 0.7 }, colors: ['#00d4ff', '#00ff88', '#8b5cf6'] })
      } else if (type === 'stage') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#00d4ff', '#00ff88', '#8b5cf6', '#ffb800'] })
        setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { x: 0.1, y: 0.5 }, colors: ['#00d4ff', '#8b5cf6'] }), 200)
        setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { x: 0.9, y: 0.5 }, colors: ['#00ff88', '#ffb800'] }), 400)
      } else {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => confetti({ particleCount: 100, spread: 100, origin: { y: 0.5 } }), i * 300)
        }
      }
    } catch {}
  }, [])

  return { celebrate }
}
