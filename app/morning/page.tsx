'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit3, Check, Flame, Sunrise, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { MORNING_ROUTINE } from '@/lib/morningRoutine'
import type { RoutineItem } from '@/lib/morningRoutine'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'rgba(18,18,26,0.8)', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a', red:'#ff4444',
}

const CAT_COLORS: Record<string,string> = {
  Movement: C.cyan, Health: C.green, Fuel: C.amber, Mind: C.purple,
}

const MORNING_TIPS = [
  { icon:'&#128640;', tip:'Take action within 5 seconds. If you have the impulse, count 5-4-3-2-1 and move. Your brain kills ideas after 5 seconds of hesitation.' },
  { icon:'&#128203;', tip:'Write tomorrow\'s 3 priorities tonight. Decisions made by a rested brain remove all morning friction. Takes 3 minutes.' },
  { icon:'&#128337;', tip:'Replace "work on X" with "write 3 paragraphs in the next 25 minutes." Time-boxing converts intention into action 73% more often.' },
  { icon:'&#128064;', tip:'Close every tab before switching tasks. Context switching costs 23 minutes of focus recovery per interruption.' },
  { icon:'&#128170;', tip:'Habit stacking: "After I [existing habit], I will [new habit]." The trigger already exists — no willpower needed.' },
  { icon:'&#9749;', tip:'Make the next action frictionless. Reduce activation energy to near zero for the behaviours you want most.' },
  { icon:'&#128200;', tip:'Write the outcome, not the action. "Get sign-off from John on Phase 2" beats "email John about project".' },
  { icon:'&#128336;', tip:'Guard the first 90 minutes. Your brain peaks in this window. No meetings, no email, no Slack — just deep work.' },
  { icon:'&#128169;', tip:'Eat the frog first. Do your hardest task before anything else. Elite performers act first, not last.' },
  { icon:'&#127968;', tip:'Better sleep = measurable performance gains. Dark room, consistent time, cooler temperature. British Cycling hired a sleep coach for this.' },
  { icon:'&#128293;', tip:'Win the morning by completing the first item in your routine before checking your phone. Context is set in the first 10 minutes.' },
  { icon:'&#127775;', tip:'Reply to 3 posts in your niche this morning before you create anything. Distribution compounds before content does.' },
]

const _doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
const DAILY_TIP = MORNING_TIPS[_doy % MORNING_TIPS.length]

const DONE_QUOTES = [
  { q:'How you start your day is how you live your day.', a:'Louise Hay' },
  { q:'Win the morning, win the day.', a:'Tim Ferriss' },
  { q:'The secret of your future is hidden in your daily routine.', a:'Mike Murdock' },
  { q:'Motivation gets you started. Habit keeps you going.', a:'Jim Rohn' },
  { q:'Discipline is the bridge between goals and accomplishment.', a:'Jim Rohn' },
]

// Particle config: rx/ry = relative position (0-1), s = radius, phase/speed for orbit
const PARTICLE_CFG = [
  { rx:0.07, ry:0.12, s:4, hex:'#00d4ff', phase:0,   speed:0.8 },
  { rx:0.18, ry:0.38, s:3, hex:'#8b5cf6', phase:1.5, speed:0.6 },
  { rx:0.05, ry:0.62, s:5, hex:'#ffb800', phase:3,   speed:0.5 },
  { rx:0.25, ry:0.85, s:3, hex:'#00d4ff', phase:0.5, speed:0.7 },
  { rx:0.38, ry:0.08, s:4, hex:'#8b5cf6', phase:2,   speed:0.9 },
  { rx:0.55, ry:0.15, s:3, hex:'#ffb800', phase:4,   speed:0.6 },
  { rx:0.68, ry:0.05, s:4, hex:'#00d4ff', phase:1,   speed:0.7 },
  { rx:0.82, ry:0.22, s:5, hex:'#00ff88', phase:2.5, speed:0.5 },
  { rx:0.91, ry:0.48, s:3, hex:'#8b5cf6', phase:0.8, speed:0.8 },
  { rx:0.94, ry:0.74, s:4, hex:'#ffb800', phase:3.5, speed:0.6 },
  { rx:0.75, ry:0.90, s:3, hex:'#00d4ff', phase:1.2, speed:0.7 },
  { rx:0.46, ry:0.94, s:5, hex:'#8b5cf6', phase:2.8, speed:0.5 },
  { rx:0.30, ry:0.74, s:3, hex:'#ffb800', phase:0.3, speed:0.9 },
  { rx:0.63, ry:0.78, s:4, hex:'#00ff88', phase:4.5, speed:0.6 },
  { rx:0.10, ry:0.50, s:3, hex:'#00d4ff', phase:1.8, speed:0.7 },
  { rx:0.88, ry:0.10, s:4, hex:'#ffb800', phase:0.7, speed:0.8 },
  { rx:0.20, ry:0.20, s:4, hex:'#00ff88', phase:3.2, speed:0.5 },
  { rx:0.57, ry:0.55, s:2, hex:'#8b5cf6', phase:5,   speed:0.6 },
  { rx:0.42, ry:0.44, s:3, hex:'#00d4ff', phase:2.2, speed:0.7 },
  { rx:0.73, ry:0.38, s:3, hex:'#ffb800', phase:1.6, speed:0.9 },
]

// Convert hex to "r,g,b" string once
const PARTICLE_RGB = PARTICLE_CFG.map(p => {
  const r = parseInt(p.hex.slice(1,3),16)
  const g = parseInt(p.hex.slice(3,5),16)
  const b = parseInt(p.hex.slice(5,7),16)
  return `${r},${g},${b}`
})

// Canvas particle system -- uses requestAnimationFrame for smooth organic motion
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const rawCtx = canvas.getContext('2d')
    if (!rawCtx) return
    const ctx = rawCtx
    let w = window.innerWidth
    let h = window.innerHeight
    canvas.width = w; canvas.height = h
    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight
      canvas.width = w; canvas.height = h
    }
    window.addEventListener('resize', onResize)
    let t = 0
    let animId: number
    function draw() {
      ctx.clearRect(0, 0, w, h)
      t += 0.006
      for (let i = 0; i < PARTICLE_CFG.length; i++) {
        const p = PARTICLE_CFG[i]
        const cx = p.rx * w + Math.sin(t * p.speed + p.phase) * 42
        const cy = p.ry * h + Math.cos(t * p.speed * 0.73 + p.phase + 1.2) * 32
        const alpha = 0.28 + Math.sin(t * 0.38 + p.phase) * 0.22 + 0.12
        ctx.beginPath()
        ctx.arc(cx, cy, p.s, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${PARTICLE_RGB[i]},${alpha})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return <canvas ref={ref} aria-hidden="true" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, width:'100%', height:'100%' }} />
}

const STORAGE_KEY   = 'flowstate_routine_v2'
const ERROR_LOG_KEY = 'flowstate_error_log'

type ErrorEntry = { id: string; date: string; text: string }

function loadErrors(): ErrorEntry[] {
  try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) ?? '[]') } catch { return [] }
}
function saveErrors(entries: ErrorEntry[]) {
  try { localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(entries)) } catch {}
}

function todayStr() {
  const d = new Date()
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}

function loadState(): { items:RoutineItem[]; completed:string[]; date:string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p.date === todayStr()) return p
      return { items: p.items ?? MORNING_ROUTINE, completed:[], date:todayStr() }
    }
  } catch {}
  return { items:MORNING_ROUTINE, completed:[], date:todayStr() }
}

function saveState(items:RoutineItem[], completed:string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, completed, date:todayStr() })) } catch {}
}

// ---- Edit modal ----
function EditPanel({ items, onClose, onSave }:{ items:RoutineItem[]; onClose:()=>void; onSave:(i:RoutineItem[])=>void }) {
  const [list, setList] = useState<RoutineItem[]>(items)
  const [newTitle, setNewTitle] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newCat, setNewCat] = useState('Movement')

  function addItem() {
    if (!newTitle.trim()) return
    setList(l => [...l, { id:'custom-'+Date.now(), title:newTitle.trim(), minutes:5, note:newNote.trim()||undefined, category:newCat }])
    setNewTitle(''); setNewNote('')
  }
  function remove(id:string) { setList(l => l.filter(x => x.id!==id)) }
  function move(id:string, dir:-1|1) {
    setList(l => {
      const i = l.findIndex(x => x.id===id); if (i<0) return l
      const j = i+dir; if (j<0||j>=l.length) return l
      const n=[...l];[n[i],n[j]]=[n[j],n[i]]; return n
    })
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
      <div style={{ background:'#1a1a26', border:'1px solid #2a2a3a', borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'30rem', maxHeight:'85vh', overflow:'auto', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16}/></button>
        <h2 style={{ margin:'0 0 1rem', fontSize:'0.95rem', fontWeight:800, color:C.text }}>Edit Morning Routine</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', marginBottom:'1rem' }}>
          {list.map((item,i) => (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:C.surface, border:'1px solid #2a2a3a', borderRadius:'0.5rem' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:CAT_COLORS[item.category??'']??C.muted, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</p>
                {item.note&&<p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{item.note}</p>}
              </div>
              <button onClick={()=>move(item.id,-1)} disabled={i===0} style={{ background:'none', border:'none', color:i===0?C.muted:C.sec, cursor:i===0?'default':'pointer', padding:'2px' }}><ChevronUp size={13}/></button>
              <button onClick={()=>move(item.id,1)} disabled={i===list.length-1} style={{ background:'none', border:'none', color:i===list.length-1?C.muted:C.sec, cursor:i===list.length-1?'default':'pointer', padding:'2px' }}><ChevronDown size={13}/></button>
              <button onClick={()=>remove(item.id)} style={{ background:'none', border:'none', color:C.red, cursor:'pointer', padding:'2px' }}><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
        <div style={{ padding:'0.75rem', background:C.surface, border:'1px solid #2a2a3a', borderRadius:'0.75rem', marginBottom:'1rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan, margin:'0 0 0.5rem' }}>Add item</p>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Task title" onKeyDown={e=>e.key==='Enter'&&addItem()}
            style={{ width:'100%', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.5rem', padding:'0.4rem 0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }}/>
          <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Note (optional)"
            style={{ width:'100%', background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.5rem', padding:'0.4rem 0.6rem', color:C.sec, fontFamily:'inherit', fontSize:'0.75rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:'0.3rem', marginBottom:'0.5rem' }}>
            {Object.keys(CAT_COLORS).map(cat=>(
              <button key={cat} onClick={()=>setNewCat(cat)} style={{ fontSize:'0.6rem', padding:'0.15rem 0.4rem', borderRadius:'0.25rem', border:'1px solid '+(newCat===cat?CAT_COLORS[cat]:'#2a2a3a'), background:newCat===cat?'rgba(255,255,255,0.05)':'transparent', color:newCat===cat?CAT_COLORS[cat]:C.muted, cursor:'pointer', fontFamily:'inherit' }}>{cat}</button>
            ))}
          </div>
          <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.7rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
            <Plus size={12}/>Add
          </button>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid #2a2a3a', borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
          <button onClick={()=>{onSave(list);onClose()}} style={{ padding:'0.5rem 1.25rem', background:C.cyan, border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function MorningPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [items, setItems]         = useState<RoutineItem[]>(MORNING_ROUTINE)
  const [completed, setCompleted] = useState<string[]>([])
  const [streak, setStreak]       = useState(0)
  const [editing, setEditing]     = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [errors, setErrors]       = useState<ErrorEntry[]>([])
  const [errInput, setErrInput]   = useState('')
  const [errOpen, setErrOpen]     = useState(false)
  const today = todayStr()

  useEffect(() => {
    const state = loadState()
    setItems(state.items)
    setCompleted(state.completed)
    setErrors(loadErrors())
    setLoaded(true)

    supabase.from('routine_completions').select('routine_date').eq('routine_date', today).maybeSingle()
      .then(({ data }) => { if (data) setCelebrating(true) })

    const from = new Date(); from.setDate(from.getDate()-60)
    const fromStr = from.getFullYear()+'-'+String(from.getMonth()+1).padStart(2,'0')+'-'+String(from.getDate()).padStart(2,'0')
    supabase.from('routine_completions').select('routine_date').gte('routine_date', fromStr).lte('routine_date', today)
      .then(({ data }) => {
        if (!data) return
        const dates = new Set(data.map((r:{ routine_date:string })=>r.routine_date))
        let s=0; const d=new Date()
        while (true) {
          const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
          if (dates.has(k)) { s++; d.setDate(d.getDate()-1) } else break
        }
        setStreak(s)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending   = items.filter(i => !completed.includes(i.id))
  const current   = pending[0] ?? null
  const doneCount = completed.length
  const totalCount = items.length
  const catColor  = current ? (CAT_COLORS[current.category??'']??C.muted) : C.cyan

  async function markComplete(id:string) {
    const next = [...completed, id]
    setCompleted(next)
    saveState(items, next)
    if (next.length >= items.length) {
      await supabase.from('routine_completions').upsert({ routine_date:today }, { onConflict:'routine_date' })
      try { localStorage.setItem('flowstate_routine_done', today) } catch {}
      setCelebrating(true)
    }
  }

  function skip(id:string) { markComplete(id) }

  function handleSaveItems(newItems:RoutineItem[]) {
    setItems(newItems)
    saveState(newItems, completed)
  }

  function addError() {
    if (!errInput.trim()) return
    const entry: ErrorEntry = { id: Date.now().toString(), date: todayStr(), text: errInput.trim() }
    const next = [entry, ...errors]
    setErrors(next); saveErrors(next); setErrInput('')
  }
  function removeError(id: string) {
    const next = errors.filter(e => e.id !== id)
    setErrors(next); saveErrors(next)
  }

  const quote    = DONE_QUOTES[new Date().getDate() % DONE_QUOTES.length]
  const h        = new Date().getHours()
  const dayLabel = new Date().toLocaleDateString('en-GB', { weekday:'long' }).toUpperCase()
  const dateLabel = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const greetingWord = h<12 ? t('goodMorning') : h<17 ? t('goodAfternoon') : t('goodEvening')

  if (!loaded) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid #00d4ff', borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>

      {/* Canvas particle system */}
      <ParticleCanvas />

      {/* ---- Floating nav ---- */}
      <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.75rem' }}>
        <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:600 }}>
          <ArrowLeft size={14}/> FlowState
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          {streak > 0 && (
            <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.78rem', fontWeight:700, color:C.amber }}>
              <Flame size={13} color={C.amber}/>{streak} day streak
            </span>
          )}
          <button onClick={() => setEditing(true)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.75rem', background:'transparent', border:'1px solid #2a2a3a', borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem' }}>
            <Edit3 size={11}/>{t('edit')}
          </button>
        </div>
      </div>

      {/* ---- Main content ---- */}
      <div style={{ flex:1, position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1rem 1.5rem 3rem', textAlign:'center' }}>

        {celebrating ? (
          /* ---- Celebration ---- */
          <div style={{ maxWidth:'26rem', width:'100%', animation:'fadeInUp 0.5s ease both' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>&#127881;</div>
            <h2 style={{ fontSize:'clamp(1.8rem,5vw,2.5rem)', fontWeight:900, color:C.green, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>Routine complete!</h2>
            {streak > 0 && (
              <p style={{ fontSize:'0.95rem', color:C.amber, margin:'0 0 2rem' }}>&#128293; {streak} day{streak!==1?'s':''} in a row</p>
            )}
            <div style={{ padding:'1.5rem', background:'rgba(18,18,26,0.85)', border:'1px solid #2a2a3a', borderRadius:'1.25rem', backdropFilter:'blur(12px)', marginBottom:'2rem' }}>
              <p style={{ fontSize:'1rem', color:C.text, fontStyle:'italic', lineHeight:1.65, margin:'0 0 0.5rem' }}>"{quote.q}"</p>
              {quote.a && <p style={{ fontSize:'0.75rem', color:C.muted, margin:0 }}>-- {quote.a}</p>}
            </div>
            <button onClick={() => router.push('/')} style={{ display:'inline-flex', alignItems:'center', gap:'0.6rem', padding:'0.9rem 2.5rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'9999px', color:'#000', fontWeight:900, cursor:'pointer', fontFamily:'inherit', fontSize:'1rem', boxShadow:'0 4px 24px rgba(0,255,136,0.3)' }}>
              Start focus work &#8594;
            </button>
          </div>
        ) : (
          <>
            {/* Progress dots */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', marginBottom:'2rem' }}>
              {items.map(item => {
                const done   = completed.includes(item.id)
                const active = current?.id === item.id
                return (
                  <div key={item.id} style={{
                    height:'8px', borderRadius:'4px',
                    width:active?'26px':'8px',
                    background:done ? C.green : active ? C.cyan : '#2a2a3a',
                    transition:'all 0.4s ease',
                    flexShrink:0,
                  }}/>
                )
              })}
            </div>

            {/* Sunrise icon */}
            <div style={{
              width:'68px', height:'68px', borderRadius:'50%',
              background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginBottom:'1.5rem',
              boxShadow:'0 0 32px rgba(255,184,0,0.08)',
            }}>
              <Sunrise size={30} color={C.amber}/>
            </div>

            {/* Day label */}
            <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.16em', color:C.amber, margin:'0 0 0.75rem', textTransform:'uppercase' }}>{dayLabel}</p>

            {/* Greeting */}
            <h1 style={{ fontSize:'clamp(2.2rem,6vw,3.75rem)', fontWeight:900, color:C.text, lineHeight:1.1, letterSpacing:'-0.03em', margin:'0 0 0.5rem' }}>
              {greetingWord},<br/>
              <span style={{ color:C.cyan }}>Tom.</span>
            </h1>

            {/* Date + progress */}
            <p style={{ fontSize:'0.9rem', color:C.sec, margin:'0 0 0.25rem' }}>{dateLabel}</p>
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 1.5rem' }}>{doneCount} of {totalCount} complete</p>

            {/* 1% daily tip */}
            <div style={{ maxWidth:'24rem', width:'100%', marginBottom:'1.75rem' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', padding:'0.7rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.875rem', backdropFilter:'blur(8px)', textAlign:'left' }}>
                <span style={{ fontSize:'0.85rem', flexShrink:0, marginTop:'1px' }} dangerouslySetInnerHTML={{ __html: DAILY_TIP.icon }}/>
                <div>
                  <p style={{ fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.amber, margin:'0 0 0.2rem' }}>1% today</p>
                  <p style={{ fontSize:'0.74rem', color:C.sec, margin:0, lineHeight:1.55 }}>{DAILY_TIP.tip}</p>
                </div>
              </div>
            </div>

            {/* Task card */}
            {current ? (
              <div style={{ width:'100%', maxWidth:'26rem', animation:'fadeInUp 0.35s ease both' }}>
                <div style={{
                  background:'rgba(18,18,26,0.75)', border:'1px solid #2a2a3a',
                  borderRadius:'1.25rem', padding:'1.5rem 1.5rem 1.25rem',
                  backdropFilter:'blur(16px)',
                  boxShadow:'0 8px 40px rgba(0,0,0,0.4)',
                  borderTop:'1px solid '+catColor+'44',
                  marginBottom:'1.75rem',
                }}>
                  {/* Category row */}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.875rem' }}>
                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:catColor, flexShrink:0 }}/>
                    <span style={{ fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.15em', textTransform:'uppercase', color:catColor }}>
                      {current.category ?? 'Routine'}
                    </span>
                  </div>

                  {/* Task title */}
                  <p style={{ fontSize:'clamp(1rem,2.5vw,1.25rem)', fontWeight:800, color:C.text, lineHeight:1.35, margin:'0 0 0.625rem', textAlign:'left' }}>
                    {current.title}
                  </p>

                  {current.note && (
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.375rem', fontStyle:'italic', textAlign:'left' }}>{current.note}</p>
                  )}
                  {current.minutes && (
                    <p style={{ fontSize:'0.68rem', color:C.muted, margin:0, textAlign:'left' }}>~{current.minutes} min</p>
                  )}
                </div>

                {/* Up next preview */}
                {pending.length > 1 && (
                  <div style={{ display:'flex', alignItems:'center', gap:'1rem', justifyContent:'center', marginBottom:'1.75rem' }}>
                    <span style={{ fontSize:'0.62rem', fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em' }}>Up next:</span>
                    {pending.slice(1,3).map((item) => (
                      <span key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', color:C.sec }}>
                        <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:CAT_COLORS[item.category??'']??C.muted }}/>
                        {item.title.length > 22 ? item.title.slice(0,22)+'...' : item.title}
                      </span>
                    ))}
                    {pending.length > 3 && <span style={{ fontSize:'0.7rem', color:C.muted }}>+{pending.length-3} more</span>}
                  </div>
                )}

                {/* Controls */}
                <button onClick={() => markComplete(current.id)} style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                  width:'100%', padding:'0.9rem',
                  background:'linear-gradient(135deg,'+catColor+','+catColor+'cc)',
                  border:'none', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontWeight:900, fontSize:'1rem', color:'#000',
                  boxShadow:'0 4px 24px '+catColor+'44',
                  transition:'transform 0.15s',
                }}>
                  <Check size={19} strokeWidth={3}/>Done
                </button>

                <div style={{ marginTop:'0.875rem' }}>
                  <button onClick={() => skip(current.id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', textDecoration:'underline' }}>
                    Skip for today
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center' }}>
                <p style={{ color:C.sec }}>All tasks complete for today.</p>
                <button onClick={() => router.push('/')} style={{ marginTop:'1rem', padding:'0.75rem 2rem', background:C.cyan, border:'none', borderRadius:'9999px', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Go home</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- Error Log ---- */}
      <div style={{ position:'relative', zIndex:2, padding:'0 1.75rem 2.5rem' }}>
        <div style={{ maxWidth:'26rem', margin:'0 auto' }}>
          <button
            onClick={() => setErrOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
              background:'transparent', border:'1px solid #2a2a3a', borderRadius:'0.75rem',
              color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem',
              fontWeight:700, padding:'0.65rem 1rem' }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:C.red, display:'inline-block', flexShrink:0 }}/>
              Error Log
              {errors.length > 0 && (
                <span style={{ fontSize:'0.62rem', fontWeight:700, background:'rgba(255,68,68,0.15)', color:C.red, borderRadius:'0.3rem', padding:'0.05rem 0.35rem' }}>
                  {errors.length}
                </span>
              )}
            </span>
            {errOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </button>

          {errOpen && (
            <div style={{ marginTop:'0.4rem', background:'rgba(18,18,26,0.88)', border:'1px solid #2a2a3a',
              borderRadius:'0.75rem', padding:'1rem', backdropFilter:'blur(12px)' }}>
              <p style={{ fontSize:'0.65rem', color:C.muted, margin:'0 0 0.75rem', lineHeight:1.6 }}>
                What went wrong yesterday? Log it here and review periodically to spot patterns worth fixing.
              </p>
              <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
                <textarea
                  value={errInput}
                  onChange={e => setErrInput(e.target.value)}
                  placeholder="Be specific — what failed, what did you do, what was the result?"
                  rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addError() } }}
                  style={{ flex:1, background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.5rem',
                    padding:'0.5rem 0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem',
                    outline:'none', resize:'none', lineHeight:1.5 }}
                />
                <button
                  onClick={addError}
                  style={{ alignSelf:'flex-end', padding:'0.45rem 0.65rem', background:'rgba(255,68,68,0.1)',
                    border:'1px solid rgba(255,68,68,0.25)', borderRadius:'0.5rem', color:C.red,
                    cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center' }}
                >
                  <Plus size={14}/>
                </button>
              </div>

              {errors.length === 0 ? (
                <p style={{ fontSize:'0.72rem', color:C.muted, textAlign:'center', padding:'0.5rem 0' }}>
                  No errors logged yet.
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', maxHeight:'16rem', overflowY:'auto' }}>
                  {errors.map(e => (
                    <div key={e.id} style={{ display:'flex', gap:'0.5rem', padding:'0.5rem 0.6rem',
                      background:'#12121a', borderRadius:'0.5rem', border:'1px solid #2a2a3a' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'0.6rem', color:C.muted, margin:'0 0 0.2rem', fontWeight:600 }}>{e.date}</p>
                        <p style={{ fontSize:'0.78rem', color:C.text, margin:0, lineHeight:1.5, wordBreak:'break-word' }}>{e.text}</p>
                      </div>
                      <button onClick={() => removeError(e.id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', flexShrink:0, alignSelf:'flex-start', padding:'1px' }}>
                        <X size={11}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && <EditPanel items={items} onClose={() => setEditing(false)} onSave={handleSaveItems}/>}

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </main>
  )
}
