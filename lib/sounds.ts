'use client'

class SoundSystem {
  private ctx: AudioContext | null = null
  private enabled = true

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  setEnabled(v: boolean) {
    this.enabled = v
  }

  private tone(
    freq: number,
    startTime: number,
    duration: number,
    volume = 0.3,
    type: OscillatorType = 'sine'
  ) {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = type
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
  }

  /** Satisfying 3-note ascending ding for completing a task */
  playTaskComplete() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const now = ctx.currentTime
    // C5 → E5 → G5 (major chord arpeggio)
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone(freq, now + i * 0.12, 0.4, 0.25)
    })
  }

  /** Full celebration fanfare for completing a stage */
  playStageComplete() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const now = ctx.currentTime
    // C5 → E5 → G5 → C6 (triumphant)
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone(freq, now + i * 0.1, 0.7, 0.3)
    })
    // Extra flourish
    setTimeout(() => {
      const n = ctx.currentTime
      ;[783.99, 1046.5].forEach((freq, i) => {
        this.tone(freq, n + i * 0.15, 0.5, 0.2)
      })
    }, 600)
  }

  /** Soft click for button presses */
  playClick() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    this.tone(800, ctx.currentTime, 0.05, 0.08, 'sine')
  }

  /** Timer end bell */
  playTimerEnd() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const now = ctx.currentTime
    ;[440, 554.37, 659.25].forEach((freq, i) => {
      this.tone(freq, now + i * 0.25, 0.8, 0.25)
    })
  }

  /** Break start chime */
  playBreakStart() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const now = ctx.currentTime
    ;[659.25, 523.25].forEach((freq, i) => {
      this.tone(freq, now + i * 0.2, 0.6, 0.2)
    })
  }

  /** Streak milestone */
  playStreak() {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const now = ctx.currentTime
    ;[523.25, 587.33, 659.25, 698.46, 783.99, 880, 1046.5].forEach((freq, i) => {
      this.tone(freq, now + i * 0.07, 0.25, 0.2)
    })
  }
}

export const sounds = new SoundSystem()
