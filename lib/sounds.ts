'use client'

class SoundSystem {
  private ctx: AudioContext | null = null
  private enabled = true
  private ambientSource: AudioBufferSourceNode | null = null
  private ambientLfo: OscillatorNode | null = null
  private ambientGain: GainNode | null = null
  private ambientMode: 'off' | 'whitenoise' | 'waves' = 'off'

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    return this.ctx
  }

  setEnabled(v: boolean) { this.enabled = v; if (!v) this.stopAmbient() }

  private tone(freq: number, dur: number, vol = 0.12, type: OscillatorType = 'sine', delay = 0) {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = type; osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(vol, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t); osc.stop(t + dur)
    } catch {}
  }

  playTaskComplete() {
    // C5 -> E5 -> G5 arpeggio
    this.tone(523.25, 0.18, 0.12, 'sine', 0)
    this.tone(659.25, 0.18, 0.12, 'sine', 0.1)
    this.tone(783.99, 0.28, 0.14, 'sine', 0.2)
  }

  playStageComplete() {
    // 4-note fanfare
    this.tone(523.25, 0.15, 0.13, 'sine', 0)
    this.tone(659.25, 0.15, 0.13, 'sine', 0.15)
    this.tone(783.99, 0.15, 0.13, 'sine', 0.30)
    this.tone(1046.5, 0.40, 0.15, 'sine', 0.45)
  }

  playTimerEnd() {
    this.tone(440, 0.15, 0.13, 'sine', 0)
    this.tone(550, 0.15, 0.13, 'sine', 0.18)
    this.tone(660, 0.35, 0.14, 'sine', 0.36)
  }

  playBreakStart() {
    this.tone(660, 0.25, 0.10, 'sine', 0)
    this.tone(440, 0.35, 0.08, 'sine', 0.28)
  }

  // ---- Ambient (synthesised sea waves / white noise) ----

  startAmbient(mode: 'whitenoise' | 'waves') {
    if (this.ambientMode === mode) return
    this.stopAmbient()
    this.ambientMode = mode
    try {
      const ctx = this.getCtx()
      const sampleRate = ctx.sampleRate
      const bufLen = sampleRate * 3
      const buf = ctx.createBuffer(1, bufLen, sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true

      const filter = ctx.createBiquadFilter()
      if (mode === 'waves') {
        filter.type = 'lowpass'; filter.frequency.value = 350; filter.Q.value = 0.8
      } else {
        filter.type = 'lowpass'; filter.frequency.value = 3000; filter.Q.value = 0.5
      }

      const masterGain = ctx.createGain()
      masterGain.gain.value = mode === 'waves' ? 0.18 : 0.08

      if (mode === 'waves') {
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.type = 'sine'; lfo.frequency.value = 0.12
        lfoGain.gain.value = 0.08
        lfo.connect(lfoGain); lfoGain.connect(masterGain.gain)
        lfo.start()
        this.ambientLfo = lfo

        // Second slower LFO for depth
        const lfo2 = ctx.createOscillator()
        const lfo2Gain = ctx.createGain()
        lfo2.type = 'sine'; lfo2.frequency.value = 0.05
        lfo2Gain.gain.value = 0.04
        lfo2.connect(lfo2Gain); lfo2Gain.connect(filter.frequency)
        lfo2.start()
      }

      src.connect(filter); filter.connect(masterGain); masterGain.connect(ctx.destination)
      src.start()
      this.ambientSource = src
      this.ambientGain = masterGain
    } catch {}
  }

  stopAmbient() {
    try { this.ambientSource?.stop(); this.ambientLfo?.stop() } catch {}
    this.ambientSource = null; this.ambientLfo = null; this.ambientGain = null
    this.ambientMode = 'off'
  }

  setAmbientVolume(v: number) {
    if (this.ambientGain) this.ambientGain.gain.value = v
  }

  getAmbientMode() { return this.ambientMode }
}

export const sounds = new SoundSystem()
