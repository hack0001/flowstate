'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit3, Check, Flame, Sunrise, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
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

const DONE_QUOTES = [
  { q:'How you start your day is how you live your day.', a:'Louise Hay' },
  { q:'Win the morning, win the day.', a:'Tim Ferriss' },
  { q:'The secret of your future is hidden in your daily routine.', a:'Mike Murdock' },
  { q:'Motivation gets you started. Habit keeps you going.', a:'Jim Rohn' },
  { q:'Discipline is the bridge between goals and accomplishment.', a:'Jim Rohn' },
]

// Pre-defined scattered particles -- avoids Math.random() on each render
// f = float keyframe name, dur = float duration (s), a = animation delay (s)
const PARTICLES = [
  { x:7,  y:12, s:4, c:'#00d4ff', a:0,   f:'floatA', dur:18 },
  { x:18, y:38, s:3, c:'#8b5cf6', a:1.5, f:'floatB', dur:22 },
  { x:5,  y:62, s:5, c:'#ffb800', a:3,   f:'floatC', dur:26 },
  { x:25, y:85, s:3, c:'#00d4ff', a:0.5, f:'floatD', dur:20 },
  { x:38, y:8,  s:4, c:'#8b5cf6', a:2,   f:'floatE', dur:24 },
  { x:55, y:15, s:3, c:'#ffb800', a:4,   f:'floatF', dur:19 },
  { x:68, y:5,  s:4, c:'#00d4ff', a:1,   f:'floatA', dur:23 },
  { x:82, y:22, s:5, c:'#00ff88', a:2.5, f:'floatB', dur:17 },
  { x:91, y:48, s:3, c:'#8b5cf6', a:0.8, f:'floatC', dur:21 },
  { x:94, y:74, s:4, c:'#ffb800', a:3.5, f:'floatD', dur:25 },
  { x:75, y:90, s:3, c:'#00d4ff', a:1.2, f:'floatE', dur:18 },
  { x:46, y:94, s:5, c:'#8b5cf6', a:2.8, f:'floatF', dur:22 },
  { x:30, y:74, s:3, c:'#ffb800', a:0.3, f:'floatA', dur:20 },
  { x:63, y:78, s:4, c:'#00ff88', a:4.5, f:'floatB', dur:27 },
  { x:10, y:50, s:3, c:'#00d4ff', a:1.8, f:'floatC', dur:16 },
  { x:88, y:10, s:4, c:'#ffb800', a:0.7, f:'floatD', dur:24 },
  { x:20, y:20, s:4, c:'#00ff88', a:3.2, f:'floatE', dur:19 },
  { x:57, y:55, s:2, c:'#8b5cf6', a:5,   f:'floatF', dur:28 },
  { x:42, y:44, s:3, c:'#00d4ff', a:2.2, f:'floatA', dur:21 },
  { x:73, y:38, s:3, c:'#ffb800', a:1.6, f:'floatB', dur:23 },
]

const STORAGE_KEY = 'flowstate_routine_v2'

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
  const [items, setItems]         = useState<RoutineItem[]>(MORNING_ROUTINE)
  const [completed, setCompleted] = useState<string[]>([])
  const [streak, setStreak]       = useState(0)
  const [editing, setEditing]     = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const today = todayStr()

  useEffect(() => {
    const state = loadState()
    setItems(state.items)
    setCompleted(state.completed)
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

  const quote    = DONE_QUOTES[new Date().getDate() % DONE_QUOTES.length]
  const h        = new Date().getHours()
  const dayLabel = new Date().toLocaleDateString('en-GB', { weekday:'long' }).toUpperCase()
  const dateLabel = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const greetingWord = h<12 ? 'Good morning' : h<17 ? 'Good afternoon' : 'Good evening'

  if (!loaded) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid #00d4ff', borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>

      {/* ---- Floating particles ---- */}
      <div aria-hidden="true" style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        {PARTICLES.map((p,i) => (
          <div key={i} style={{
            position:'absolute', left:p.x+'%', top:p.y+'%',
            width:p.s+'px', height:p.s+'px', borderRadius:'50%',
            background:p.c, opacity:0.6,
            animation:p.f+' '+p.dur+'s '+p.a+'s ease-in-out infinite, particlePulse 5s '+p.a+'s ease-in-out infinite',
          }}/>
        ))}
      </div>

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
            <Edit3 size={11}/>Edit
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
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 2.5rem' }}>{doneCount} of {totalCount} complete</p>

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
                    {pending.slice(1,3).map((item,i) => (
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

      {editing && <EditPanel items={items} onClose={() => setEditing(false)} onSave={handleSaveItems}/>}

      <style>{`
        @keyframes floatA { 0%,100%{transform:translate(0,0)} 30%{transform:translate(14px,-20px)} 65%{transform:translate(-10px,-12px)} 85%{transform:translate(18px,6px)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-16px,14px)} 55%{transform:translate(10px,20px)} 80%{transform:translate(-12px,-8px)} }
        @keyframes floatC { 0%,100%{transform:translate(0,0)} 40%{transform:translate(22px,-10px)} 70%{transform:translate(-6px,18px)} }
        @keyframes floatD { 0%,100%{transform:translate(0,0)} 35%{transform:translate(-20px,-14px)} 65%{transform:translate(12px,22px)} }
        @keyframes floatE { 0%,100%{transform:translate(0,0)} 45%{transform:translate(18px,16px)} 75%{transform:translate(-14px,-6px)} }
        @keyframes floatF { 0%,100%{transform:translate(0,0)} 30%{transform:translate(-22px,10px)} 70%{transform:translate(14px,-18px)} }
        @keyframes particlePulse { 0%,100% { opacity:0.3 } 50% { opacity:0.8 } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </main>
  )
}
