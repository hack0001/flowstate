'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Pause, SkipForward, Volume2, VolumeX, Sunrise, Zap } from 'lucide-react'
import type { NotionTask, NotionEvent, NotionContent } from '@/lib/notion'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800', red:'#ff4444', orange:'#ff8800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

const STAGES = ['greeting','focus','events','content','start'] as const
type Stage = typeof STAGES[number]
const STAGE_DURATION = 5000 // ms per stage auto-advance

function useAmbient() {
  const ctx = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const [on, setOn] = useState(false)

  const start = useCallback(() => {
    try {
      if (ctx.current) { ctx.current.close() }
      const ac = new AudioContext()
      ctx.current = ac
      const buf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i=0; i<ch.length; i++) ch[i] = Math.random()*2-1
      const src = ac.createBufferSource()
      src.buffer = buf; src.loop = true
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 280
      const g = ac.createGain(); g.gain.value = 0.06
      gainRef.current = g
      src.connect(lp); lp.connect(g); g.connect(ac.destination)
      // LFO for wave rhythm
      const lfo = ac.createOscillator()
      const lfoG = ac.createGain(); lfoG.gain.value = 50
      lfo.frequency.value = 0.12
      lfo.connect(lfoG); lfoG.connect(lp.frequency)
      src.start(); lfo.start()
      setOn(true)
    } catch {}
  }, [])

  const stop = useCallback(() => {
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(0, gainRef.current.context.currentTime, 0.3)
    }
    setTimeout(() => { ctx.current?.close(); ctx.current = null; gainRef.current = null }, 400)
    setOn(false)
  }, [])

  const toggle = useCallback(() => { on ? stop() : start() }, [on, start, stop])

  useEffect(() => () => { ctx.current?.close() }, [])
  return { on, toggle }
}

function Particle({ index }: { index: number }) {
  const size = 2 + (index % 4)
  const delay = (index * 137.5) % 5000
  const duration = 8000 + (index * 500) % 4000
  const x = (index * 137.5) % 100
  return (
    <div style={{
      position:'absolute', left:`${x}%`, bottom:'-10px',
      width:`${size}px`, height:`${size}px`, borderRadius:'50%',
      background: index % 3 === 0 ? C.cyan : index % 3 === 1 ? C.purple : C.amber,
      opacity:0.4,
      animation:`float ${duration}ms ${delay}ms ease-in infinite`,
      pointerEvents:'none',
    }}/>
  )
}

export default function MorningPage() {
  const router = useRouter()
  const { on: ambientOn, toggle: toggleAmbient } = useAmbient()
  const [stage, setStage] = useState<Stage>('greeting')
  const [paused, setPaused] = useState(false)
  const [tasks, setTasks] = useState<NotionTask[]>([])
  const [events, setEvents] = useState<NotionEvent[]>([])
  const [content, setContent] = useState<NotionContent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [fade, setFade] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dayName = today.toLocaleDateString('en-GB', { weekday:'long' })
  const dateName = today.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  useEffect(() => {
    Promise.all([
      fetch(`/api/notion/today?date=${dateStr}`).then(r=>r.json()).catch(()=>({ tasks:[], events:[] })),
      fetch(`/api/notion/content?year=${year}&month=${month}`).then(r=>r.json()).catch(()=>({ content:[] })),
    ]).then(([day, cont]) => {
      setTasks(day.tasks ?? [])
      setEvents(day.events ?? [])
      setContent((cont.content ?? []).filter((c: NotionContent) => c.date === dateStr))
      setLoaded(true)
    })
  }, [dateStr, year, month])

  const focusTasks = tasks.filter(t => t.status !== 'Done').slice(0,3)
  const todayEvents = events.slice(0,4)
  const todayContent = content.slice(0,3)

  const next = useCallback(() => {
    const idx = STAGES.indexOf(stage)
    if (idx < STAGES.length - 1) {
      setFade(false)
      setTimeout(() => { setStage(STAGES[idx+1]); setFade(true) }, 300)
    }
  }, [stage])

  const prev = useCallback(() => {
    const idx = STAGES.indexOf(stage)
    if (idx > 0) {
      setFade(false)
      setTimeout(() => { setStage(STAGES[idx-1]); setFade(true) }, 300)
    }
  }, [stage])

  // Auto-advance timer
  useEffect(() => {
    if (paused || stage === 'start') return
    timerRef.current = setTimeout(next, STAGE_DURATION)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [stage, paused, next])

  const stageIdx = STAGES.indexOf(stage)

  return (
    <main style={{ minHeight:'100vh', background:C.bg, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      {/* Ambient particles */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        {Array.from({ length: 25 }).map((_,i) => <Particle key={i} index={i} />)}
        <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width:'80vw', height:'80vw', maxWidth:'600px', maxHeight:'600px', background:'radial-gradient(circle,rgba(0,212,255,0.04) 0%,rgba(139,92,246,0.03) 40%,transparent 70%)', borderRadius:'50%', animation:'breathe 8s ease-in-out infinite' }}/>
      </div>

      {/* Top bar */}
      <div style={{ position:'fixed', top:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2rem', zIndex:10 }}>
        <button onClick={() => router.push('/')}
          style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, padding:'0.5rem 1rem', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600 }}>
          <Zap size={13} color={C.cyan}/>FlowState
        </button>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <button onClick={toggleAmbient}
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.875rem', background:ambientOn?'rgba(0,212,255,0.1)':'rgba(255,255,255,0.04)', border:'1px solid '+(ambientOn?C.cyan:C.border), borderRadius:'0.75rem', color:ambientOn?C.cyan:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600 }}>
            {ambientOn?<Volume2 size={12}/>:<VolumeX size={12}/>}
            {ambientOn?'Waves On':'Waves Off'}
          </button>
          <button onClick={() => router.push('/calendar')}
            style={{ padding:'0.5rem 0.875rem', background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:600 }}>
            Calendar
          </button>
        </div>
      </div>

      {/* Stage progress dots */}
      <div style={{ position:'fixed', top:'4.5rem', left:'50%', transform:'translateX(-50%)', display:'flex', gap:'0.5rem', zIndex:10 }}>
        {STAGES.map((s,i) => (
          <button key={s} onClick={() => { setFade(false); setTimeout(()=>{ setStage(s); setFade(true) },200) }}
            style={{ width:i===stageIdx?'1.5rem':'0.4rem', height:'0.4rem', borderRadius:'9999px', background:i<stageIdx?C.cyan:i===stageIdx?C.cyan:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', transition:'all 0.4s ease', padding:0 }}/>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'5rem 2rem 6rem', width:'100%', opacity:fade?1:0, transition:'opacity 0.3s ease' }}>
        {stage==='greeting' && (
          <div style={{ textAlign:'center', maxWidth:'600px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'5rem', height:'5rem', borderRadius:'50%', background:'rgba(255,184,0,0.1)', border:'2px solid rgba(255,184,0,0.3)', marginBottom:'2rem' }}>
              <Sunrise size={36} color={C.amber}/>
            </div>
            <p style={{ fontSize:'1rem', color:C.amber, fontWeight:600, letterSpacing:'0.05em', marginBottom:'0.5rem', textTransform:'uppercase' }}>{dayName}</p>
            <h1 style={{ fontSize:'clamp(2.5rem,6vw,4rem)', fontWeight:900, letterSpacing:'-0.03em', color:C.text, lineHeight:1.1, marginBottom:'0.75rem' }}>
              {greeting},<br/><span style={{ color:C.cyan }}>Tom.</span>
            </h1>
            <p style={{ fontSize:'1.1rem', color:C.sec, lineHeight:1.6 }}>{dateName}</p>
            <p style={{ marginTop:'1.5rem', fontSize:'0.9rem', color:C.muted }}>
              {loaded
                ? `${tasks.length} task${tasks.length!==1?'s':''} | ${events.length} event${events.length!==1?'s':''} today`
                : 'Loading your day...'
              }
            </p>
            <div style={{ marginTop:'2rem', padding:'1rem 1.5rem', background:'linear-gradient(135deg,rgba(0,212,255,0.06),rgba(139,92,246,0.06))', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'1rem', animation:'slideIn 0.6s ease both' }}>
              <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.cyan, marginBottom:'0.375rem' }}>Remember who you are</p>
              <p style={{ fontSize:'1rem', fontWeight:600, color:C.text, lineHeight:1.5 }}>
                You are building a media empire, one video at a time.
              </p>
            </div>
          </div>
        )}

        {stage==='focus' && (
          <div style={{ textAlign:'center', maxWidth:'640px', width:'100%' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.cyan, marginBottom:'1.5rem' }}>Top Focus Tasks</p>
            {focusTasks.length===0 && <p style={{ color:C.muted, fontSize:'1rem' }}>No deep work tasks scheduled for today.</p>}
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {focusTasks.map((t,i) => (
                <div key={t.id} style={{ background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'1.25rem', padding:'1.25rem 1.75rem', display:'flex', alignItems:'center', gap:'1.25rem', animation:`slideIn ${0.3+i*0.1}s ease both` }}>
                  <div style={{ width:'2.5rem', height:'2.5rem', borderRadius:'50%', background:`rgba(0,212,255,${0.15-i*0.04})`, border:'1px solid rgba(0,212,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem', fontWeight:900, color:C.cyan, flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ textAlign:'left', flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:'1.05rem', color:C.text }}>{t.title}</p>
                    <p style={{ fontSize:'0.75rem', color:C.sec, marginTop:'0.15rem' }}>
                      {t.dueDate ?? ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {tasks.length > focusTasks.length && (
              <p style={{ marginTop:'1.25rem', fontSize:'0.8rem', color:C.muted }}>+{tasks.length - focusTasks.length} more tasks today</p>
            )}
          </div>
        )}

        {stage==='events' && (
          <div style={{ textAlign:'center', maxWidth:'640px', width:'100%' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.amber, marginBottom:'1.5rem' }}>Today in Your Calendar</p>
            {todayEvents.length===0 && <p style={{ color:C.muted, fontSize:'1rem' }}>No events today. Heads-down day!</p>}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {todayEvents.map((ev,i) => (
                <div key={ev.id} style={{ background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.15)', borderRadius:'1rem', padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', animation:`slideIn ${0.3+i*0.1}s ease both` }}>
                  <div style={{ width:'0.375rem', height:'2rem', borderRadius:'3px', background:C.amber, flexShrink:0 }}/>
                  <div style={{ textAlign:'left', flex:1 }}>
                    <p style={{ fontWeight:600, fontSize:'0.95rem', color:C.text }}>{ev.title}</p>
                    {ev.category && <p style={{ fontSize:'0.7rem', color:C.sec, marginTop:'0.1rem' }}>{ev.category}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage==='content' && (
          <div style={{ textAlign:'center', maxWidth:'640px', width:'100%' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.purple, marginBottom:'1.5rem' }}>Content Scheduled Today</p>
            {todayContent.length===0 && (
              <div>
                <p style={{ color:C.muted, fontSize:'1rem', marginBottom:'0.5rem' }}>Nothing publishing today.</p>
                <p style={{ fontSize:'0.8rem', color:C.muted }}>Use the calendar to check upcoming publishes.</p>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {todayContent.map((c,i) => (
                <div key={c.id} style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'1rem', padding:'1rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', animation:`slideIn ${0.3+i*0.1}s ease both` }}>
                  <div style={{ width:'0.375rem', height:'2rem', borderRadius:'3px', background:C.purple, flexShrink:0 }}/>
                  <div style={{ textAlign:'left', flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.15rem' }}>
                      <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', color:c.status==='Live'?C.green:c.status==='Scheduled'?C.cyan:C.amber }}>{c.status}</span>
                      {c.format && <span style={{ fontSize:'0.65rem', color:C.muted }}>{c.format}</span>}
                    </div>
                    <p style={{ fontWeight:600, fontSize:'0.95rem', color:C.text }}>{c.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage==='start' && (
          <div style={{ textAlign:'center', maxWidth:'540px' }}>
            <div style={{ position:'relative', display:'inline-block', marginBottom:'2rem' }}>
              <div style={{ position:'absolute', inset:'-40px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,212,255,0.15) 0%,transparent 70%)', animation:'pulse 3s ease-in-out infinite' }}/>
              <div style={{ width:'7rem', height:'7rem', borderRadius:'50%', background:'linear-gradient(135deg,'+C.cyan+','+C.purple+')', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                <Zap size={36} color="#000" fill="#000"/>
              </div>
            </div>
            <h2 style={{ fontSize:'clamp(2rem,5vw,3rem)', fontWeight:900, letterSpacing:'-0.03em', color:C.text, lineHeight:1.15, marginBottom:'0.875rem' }}>
              You're ready.<br/><span style={{ color:C.cyan }}>Let's build.</span>
            </h2>
            <p style={{ color:C.sec, fontSize:'1rem', lineHeight:1.6, marginBottom:'2.5rem' }}>
              {focusTasks.length>0 ? `Start with "${focusTasks[0].title}" and own the morning.` : 'Tackle today with focus and intention.'}
            </p>
            <div style={{ display:'flex', gap:'0.875rem', justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => router.push('/')}
                style={{ padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.cyan+','+C.purple+')', border:'none', borderRadius:'1rem', color:'#000', fontWeight:800, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 20px rgba(0,212,255,0.3)' }}>
                Start My Day
              </button>
              <button onClick={() => router.push('/calendar')}
                style={{ padding:'0.875rem 2rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'1rem', color:C.sec, fontWeight:600, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>
                View Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'1.25rem 2rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.75rem', background:'linear-gradient(to top,'+C.bg+' 70%,transparent)' }}>
        <button onClick={prev} disabled={stageIdx===0}
          style={{ padding:'0.6rem', background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:stageIdx===0?'not-allowed':'pointer', fontFamily:'inherit', opacity:stageIdx===0?0.3:1 }}>
          <SkipForward size={14} style={{ transform:'scaleX(-1)' }}/>
        </button>
        <button onClick={() => setPaused(p=>!p)}
          style={{ padding:'0.6rem 1.25rem', display:'flex', alignItems:'center', gap:'0.4rem', background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600 }}>
          {paused ? <><Play size={12}/>Resume</> : <><Pause size={12}/>Pause</>}
        </button>
        <button onClick={next} disabled={stage==='start'}
          style={{ padding:'0.6rem', background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:stage==='start'?'not-allowed':'pointer', fontFamily:'inherit', opacity:stage==='start'?0.3:1 }}>
          <SkipForward size={14}/>
        </button>
      </div>

      <style>{`
        @keyframes float{0%{transform:translateY(0);opacity:0.4}50%{opacity:0.7}100%{transform:translateY(-100vh);opacity:0}}
        @keyframes breathe{0%,100%{transform:translateX(-50%) scale(1);opacity:0.6}50%{transform:translateX(-50%) scale(1.08);opacity:1}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.05);opacity:1}}
        @keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
      `}</style>
    </main>
  )
}
