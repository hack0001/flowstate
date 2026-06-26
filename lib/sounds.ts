'use client'

class SoundSystem {
  private ctx: AudioContext | null = null
  private enabled = true

  setEnabled(v: boolean) { this.enabled = v }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  private tone(freq: number, start: number, dur: number, gain: number, ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + dur + 0.05)
  }

  playTaskComplete() {
    if (!this.enabled) return
    try { const c = this.getCtx(); this.tone(523,0,0.15,0.3,c); this.tone(659,0.1,0.15,0.3,c); this.tone(784,0.2,0.25,0.3,c) } catch {}
  }

  playStageComplete() {
    if (!this.enabled) return
    try { const c = this.getCtx(); [523,659,784,1047].forEach((f,i) => this.tone(f,i*0.12,0.2,0.25,c)) } catch {}
  }

  playClick() {
    if (!this.enabled) return
    try { this.tone(800,0,0.05,0.1,this.getCtx()) } catch {}
  }

  playTimerEnd() {
    if (!this.enabled) return
    try { const c = this.getCtx(); this.tone(880,0,0.4,0.3,c); this.tone(880,0.5,0.4,0.3,c); this.tone(1047,1.0,0.5,0.3,c) } catch {}
  }

  playBreakStart() {
    if (!this.enabled) return
    try { const c = this.getCtx(); this.tone(392,0,0.3,0.2,c); this.tone(330,0.3,0.4,0.2,c) } catch {}
  }
}

export const sounds = new SoundSystem()
