'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Play, RotateCcw, Brain, Zap, Moon, TrendingUp } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const BENEFITS = [
  {
    icon: <TrendingUp size={18} color={C.green}/>,
    title: 'Doubles learning retention',
    detail: 'A 2021 study found NSDR after a learning session nearly doubled skill retention. Your brain replays and consolidates what you just practised at a neurological level — making it ideal immediately after deep work.',
    color: C.green,
  },
  {
    icon: <Zap size={18} color={C.amber}/>,
    title: 'Restores dopamine',
    detail: 'Dopamine in the striatum — your motivation and reward system — drops after sustained effort. A 20-minute NSDR session measurably restores it. You come back to the next session genuinely re-energised, not just rested.',
    color: C.amber,
  },
  {
    icon: <Brain size={18} color={C.cyan}/>,
    title: 'No sleep inertia',
    detail: 'Unlike a nap, you don\'t wake up groggy. NSDR keeps you in a conscious but deeply relaxed state, so you come out alert and ready to work — not reaching for coffee.',
    color: C.cyan,
  },
  {
    icon: <Moon size={18} color={C.purple}/>,
    title: 'Reduces cortisol',
    detail: 'NSDR drops stress hormones in a similar way to sleep without requiring sleep. 20 minutes resets the nervous system — lowering cortisol and resetting emotional baseline mid-day.',
    color: C.purple,
  },
]

const TOTAL = 20 * 60 // 20 minutes in seconds

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function NSDRPage() {
  const router = useRouter()
  const [playing, setPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TOTAL)
  const [done, setDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (playing && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { setPlaying(false); setDone(true); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, timeLeft])

  function toggle() {
    if (done) return
    setPlaying(p => !p)
  }

  function reset() {
    setPlaying(false); setTimeLeft(TOTAL); setDone(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const pct = ((TOTAL - timeLeft) / TOTAL) * 100
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'0.875rem 2rem', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:'860px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'0.8rem', fontFamily:'inherit', padding:0 }}>
            <ChevronLeft size={15}/> Home
          </button>
          <span style={{ fontWeight:800, fontSize:'0.95rem', letterSpacing:'-0.01em' }}>NSDR &mdash; Non-Sleep Deep Rest</span>
          <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:C.muted }}>Andrew Huberman Protocol</span>
        </div>
      </div>

      <div style={{ maxWidth:'860px', margin:'0 auto', padding:'2rem' }}>

        {/* Intro */}
        <div style={{ marginBottom:'2rem' }}>
          <p style={{ fontSize:'1.05rem', color:C.sec, lineHeight:1.75, margin:0, maxWidth:'640px' }}>
            NSDR is a 20-minute guided relaxation protocol rooted in Yoga Nidra research. You lie still, follow the audio, and enter a deeply relaxed but conscious state. The science behind it is striking &mdash; it is one of the highest-leverage recovery tools available.
          </p>
        </div>

        {/* Two-col: video + timer */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'2rem', marginBottom:'2.5rem', alignItems:'start' }}>

          {/* YouTube embed */}
          <div style={{ borderRadius:'1rem', overflow:'hidden', border:'1px solid '+C.border, aspectRatio:'16/9', background:'#000' }}>
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/AKGrmY8OSHM"
              title="NSDR - Non-Sleep Deep Rest"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ display:'block', border:'none' }}
            />
          </div>

          {/* Timer */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', padding:'1.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', minWidth:'180px' }}>
            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.muted, margin:0 }}>Session timer</p>

            <div style={{ position:'relative', width:'128px', height:'128px' }}>
              <svg width="128" height="128" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="64" cy="64" r={r} fill="none" stroke={C.border} strokeWidth="6"/>
                <circle cx="64" cy="64" r={r} fill="none"
                  stroke={done ? C.green : C.purple} strokeWidth="6"
                  strokeDasharray={circ} strokeDashoffset={dash}
                  strokeLinecap="round"
                  style={{ transition:'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                {done ? (
                  <span style={{ fontSize:'1.5rem' }}>&#10003;</span>
                ) : (
                  <span style={{ fontSize:'1.35rem', fontWeight:900, fontFamily:'ui-monospace,monospace', color:playing ? C.purple : C.text }}>
                    {fmt(timeLeft)}
                  </span>
                )}
              </div>
            </div>

            {done ? (
              <p style={{ fontSize:'0.78rem', fontWeight:700, color:C.green, margin:0, textAlign:'center' }}>Session complete</p>
            ) : (
              <button onClick={toggle} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1.25rem', background:playing ? 'rgba(139,92,246,0.12)' : 'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:playing ? '1px solid '+C.purple : 'none', borderRadius:'9999px', color:playing ? C.purple : '#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit' }}>
                <Play size={13}/>{playing ? 'Pause' : 'Start'}
              </button>
            )}

            <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:'0.35rem', background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:0 }}>
              <RotateCcw size={11}/>Reset
            </button>

            <div style={{ width:'100%', padding:'0.75rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.18)', borderRadius:'0.625rem' }}>
              <p style={{ fontSize:'0.67rem', color:C.sec, margin:0, lineHeight:1.6, textAlign:'center' }}>
                Best used <strong style={{ color:C.text }}>after</strong> a 90-min deep work block. Lie down, press play on the video, start the timer.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits grid */}
        <div style={{ marginBottom:'2rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>Why it works</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:'0.875rem' }}>
            {BENEFITS.map((b, i) => (
              <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.375rem', borderLeft:'3px solid '+b.color }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.6rem' }}>
                  {b.icon}
                  <span style={{ fontWeight:800, fontSize:'0.88rem', color:b.color }}>{b.title}</span>
                </div>
                <p style={{ fontSize:'0.8rem', color:C.sec, margin:0, lineHeight:1.7 }}>{b.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How to use */}
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem 1.75rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>How to use it</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {[
              { step:'1', text:'Finish a deep work or learning session', color:C.cyan },
              { step:'2', text:'Find somewhere to lie flat — floor, sofa, bed', color:C.purple },
              { step:'3', text:'Press play on the video above, start the timer, close your eyes', color:C.amber },
              { step:'4', text:'Follow the audio. Do not try to sleep. Stay conscious but completely still.', color:C.green },
              { step:'5', text:'After 20 minutes, sit up slowly. Give yourself 2 minutes before going back to work.', color:C.orange },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.875rem' }}>
                <span style={{ width:'24px', height:'24px', borderRadius:'50%', background:item.color+'18', border:'1px solid '+item.color+'44', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.68rem', fontWeight:900, color:item.color, flexShrink:0 }}>{item.step}</span>
                <p style={{ fontSize:'0.85rem', color:C.text, margin:0, lineHeight:1.6, paddingTop:'2px' }}>{item.text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'1.25rem', padding:'0.875rem 1rem', background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.green, fontWeight:700, margin:'0 0 0.25rem' }}>Huberman&#39;s recommendation</p>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>
              After a 90-minute focus block, a 20-minute NSDR session is more restorative than a nap, coffee, or doom-scrolling &mdash; and it makes the next focus block significantly more productive. Aim for once per day, ideally mid-afternoon.
            </p>
          </div>
        </div>

      </div>
    </main>
  )
}
