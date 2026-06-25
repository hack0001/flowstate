'use client'

class SoundSystem {
  private ctx: AudioContext | null = null
  private enabled = true

  setEnabled(v: boolean) { this.enabled = v }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  private tone(freq: number, type: OscillatorType, start: number, dur: number, gain: number, ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    g.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + dur + 0.05)
  }

  playTaskComplete() {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      this.tone(523, 'sine', 0, 0.15, 0.3, ctx)
      this.tone(659, 'sine', 0.1, 0.15, 0.3, ctx)
      this.tone(784, 'sine', 0.2, 0.25, 0.3, ctx)
    } catch {}
  }

  playStageComplete() {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      const freqs = [523, 659, 784, 1047]
      freqs.forEach((f, i) => this.tone(f, 'sine', i * 0.12, 0.2, 0.25, ctx))
    } catch {}
  }

  playClick() {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      this.tone(800, 'sine', 0, 0.05, 0.1, ctx)
    } catch {}
  }

  playTimerEnd() {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      this.tone(880, 'sine', 0, 0.4, 0.3, ctx)
      this.tone(880, 'sine', 0.5, 0.4, 0.3, ctx)
      this.tone(1047, 'sine', 1.0, 0.5, 0.3, ctx)
    } catch {}
  }

  playBreakStart() {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      this.tone(392, 'sine', 0, 0.3, 0.2, ctx)
      this.tone(330, 'sine', 0.3, 0.4, 0.2, ctx)
    } catch {}
  }
}

export const sounds = new SoundSystem()
