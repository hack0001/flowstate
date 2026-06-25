'use client'

import { useCallback } from 'react'

let confetti: ((opts: Record<string, unknown>) => void) | null = null

async function loadConfetti() {
  if (!confetti && typeof window !== 'undefined') {
    const mod = await import('canvas-confetti')
    confetti = mod.default
  }
  return confetti
}

export function useCelebration() {
  const celebrate = useCallback(async (type: 'task' | 'stage' | 'workflow' = 'task') => {
    const fire = await loadConfetti()
    if (!fire) return

    if (type === 'task') {
      fire({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.7 },
        colors: ['#00d4ff', '#8b5cf6', '#00ff88', '#ffb800'],
        startVelocity: 25,
        gravity: 0.8,
        scalar: 0.8,
      })
    } else if (type === 'stage') {
      const burst = (originX: number) =>
        fire({
          particleCount: 80,
          spread: 70,
          origin: { x: originX, y: 0.6 },
          colors: ['#00d4ff', '#8b5cf6', '#00ff88', '#ffb800', '#ff6b6b'],
          startVelocity: 40,
          gravity: 0.7,
          scalar: 1,
        })
      burst(0.25)
      setTimeout(() => burst(0.75), 150)
    } else {
      // Full workflow complete — epic burst
      const count = 200
      const defaults = { origin: { y: 0.7 } }
      function burst(particleRatio: number, opts: Record<string, unknown>) {
        fire?.({ ...defaults, particleCount: Math.floor(count * particleRatio), ...opts })
      }
      burst(0.25, { spread: 26, startVelocity: 55 })
      burst(0.2, { spread: 60 })
      burst(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
      burst(0.1, { speed: 120, size: 0.2, decay: 0.92, scalar: 1.2 })
      burst(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    }
  }, [])

  return { celebrate }
}
