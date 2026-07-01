'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, X, Check, Flame, Edit3 } from 'lucide-react'
import { MORNING_ROUTINE } from '@/lib/morningRoutine'
import type { RoutineItem } from '@/lib/morningRoutine'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a', red:'#ff4444',
}

const CAT_COLORS: Record<string, string> = {
  Movement: C.cyan, Health: C.green, Fuel: C.amber, Mind: C.purple,
}

const DONE_QUOTES = [
  { q:'How you start your day is how you live your day.', a:'Louise Hay' },
  { q:'Win the morning, win the day.', a:'Tim Ferriss' },
  { q:'The secret of your future is hidden in your daily routine.', a:'Mike Murdock' },
  { q:'Motivation gets you started. Habit keeps you going.', a:'Jim Rohn' },
  { q:'Discipline is the bridge between goals and accomplishment.', a:'Jim Rohn' },
]

const STORAGE_KEY = 'flowstate_routine_v2'

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function loadState(): { items: RoutineItem[]; completed: string[]; date: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === todayStr()) return parsed
      // New day: carry items forward, reset completed
      return { items: parsed.items ?? MORNING_ROUTINE, completed: [], date: todayStr() }
    }
  } catch {}
  return { items: MORNING_ROUTINE, completed: [], date: todayStr() }
}

function saveState(items: RoutineItem[], completed: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, completed, date: todayStr() })) } catch {}
}

// ---- Edit panel ----
function EditPanel({ items, onClose, onSave }: {
  items: RoutineItem[]
  onClose: () => void
  onSave: (items: RoutineItem[]) => void
}) {
  const [list, setList] = useState<RoutineItem[]>(items)
  const [newTitle, setNewTitle] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newCat, setNewCat] = useState('Movement')

  function addItem() {
    if (!newTitle.trim()) return
    const id = 'custom-' + Date.now()
    setList(l => [...l, { id, title: newTitle.trim(), minutes: 5, note: newNote.trim() || undefined, category: newCat }])
    setNewTitle(''); setNewNote('')
  }

  function remove(id: string) { setList(l => l.filter(x => x.id !== id)) }
  function move(id: string, dir: -1 | 1) {
    setList(l => {
      const i = l.findIndex(x => x.id === id)
      if (i < 0) return l
      const j = i + dir
      if (j < 0 || j >= l.length) return l
      const next = [...l]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
      <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', width:'90%', maxWidth:'32rem', maxHeight:'85vh', overflow:'auto', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={16}/></button>
        <h2 style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:800, color:C.text }}>Edit Morning Routine</h2>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginBottom:'1.25rem' }}>
          {list.map((item, i) => (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:CAT_COLORS[item.category ?? ''] ?? C.muted, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</p>
                {item.note && <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{item.note}</p>}
              </div>
              <button onClick={() => move(item.id, -1)} disabled={i===0} style={{ background:'none', border:'none', color:i===0?C.muted:C.sec, cursor:i===0?'default':'pointer', padding:'2px' }}><ChevronUp size={13}/></button>
              <button onClick={() => move(item.id, 1)} disabled={i===list.length-1} style={{ background:'none', border:'none', color:i===list.length-1?C.muted:C.sec, cursor:i===list.length-1?'default':'pointer', padding:'2px' }}><ChevronDown size={13}/></button>
              <button onClick={() => remove(item.id)} style={{ background:'none', border:'none', color:C.red, cursor:'pointer', padding:'2px' }}><Trash2 size={13}/></button>
            </div>
          ))}
        </div>

        <div style={{ padding:'0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', marginBottom:'1rem' }}>
          <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, margin:'0 0 0.5rem' }}>Add item</p>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title"
            onKeyDown={e => e.key==='Enter' && addItem()}
            style={{ width:'100%', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.45rem 0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }}/>
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note (optional)"
            style={{ width:'100%', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.45rem 0.625rem', color:C.sec, fontFamily:'inherit', fontSize:'0.75rem', outline:'none', marginBottom:'0.4rem', boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:'0.3rem', marginBottom:'0.5rem' }}>
            {Object.keys(CAT_COLORS).map(cat => (
              <button key={cat} onClick={() => setNewCat(cat)} style={{ fontSize:'0.6rem', padding:'0.15rem 0.4rem', borderRadius:'0.25rem', border:'1px solid '+(newCat===cat?CAT_COLORS[cat]:C.border), background:newCat===cat?'rgba(255,255,255,0.05)':'transparent', color:newCat===cat?CAT_COLORS[cat]:C.muted, cursor:'pointer', fontFamily:'inherit' }}>{cat}</button>
            ))}
          </div>
          <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.75rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
            <Plus size={12}/>Add
          </button>
        </div>

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Cancel</button>
          <button onClick={() => { onSave(list); onClose() }} style={{ padding:'0.5rem 1.25rem', background:C.cyan, border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function MorningPage() {
  const router = useRouter()
  const [items, setItems] = useState<RoutineItem[]>(MORNING_ROUTINE)
  const [completed, setCompleted] = useState<string[]>([])
  const [streak, setStreak] = useState(0)
  const [editing, setEditing] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const today = todayStr()

  useEffect(() => {
    const state = loadState()
    setItems(state.items)
    setCompleted(state.completed)
    setLoaded(true)

    // Check if already completed today
    supabase.from('routine_completions').select('routine_date').eq('routine_date', today).maybeSingle()
      .then(({ data }) => { if (data) setCelebrating(true) })

    // Streak
    const from = new Date(); from.setDate(from.getDate() - 60)
    const fromStr = from.getFullYear()+'-'+String(from.getMonth()+1).padStart(2,'0')+'-'+String(from.getDate()).padStart(2,'0')
    supabase.from('routine_completions').select('routine_date').gte('routine_date', fromStr).lte('routine_date', today)
      .then(({ data }) => {
        if (!data) return
        const dates = new Set(data.map((r: { routine_date: string }) => r.routine_date))
        let s = 0
        const d = new Date()
        while (true) {
          const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
          if (dates.has(k)) { s++; d.setDate(d.getDate()-1) } else break
        }
        setStreak(s)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Active = first incomplete item
  const pending = items.filter(i => !completed.includes(i.id))
  const current = pending[0] ?? null
  const doneCount = completed.length
  const totalCount = items.length
  const allDone = doneCount >= totalCount

  async function markComplete(id: string) {
    const next = [...completed, id]
    setCompleted(next)
    saveState(items, next)

    if (next.length >= items.length) {
      // Mark in Supabase
      await supabase.from('routine_completions').upsert({ routine_date: today }, { onConflict: 'routine_date' })
      setCelebrating(true)
    }
  }

  function skip(id: string) {
    // Move to end by completing without counting toward allDone logic
    // Simple: just push to completed so it moves past
    markComplete(id)
  }

  function handleSaveItems(newItems: RoutineItem[]) {
    setItems(newItems)
    saveState(newItems, completed)
  }

  const quote = DONE_QUOTES[new Date().getDate() % DONE_QUOTES.length]
  const catColor = current ? (CAT_COLORS[current.category ?? ''] ?? C.muted) : C.cyan

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })

  if (!loaded) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}>
            <ArrowLeft size={14}/>Home
          </button>
          <span style={{ color:C.border }}>|</span>
          <span style={{ fontWeight:800, color:C.text }}>Morning Routine</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          {streak > 0 && (
            <span style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.8rem', fontWeight:700, color:C.amber }}>
              <Flame size={14} color={C.amber}/>{streak} day streak
            </span>
          )}
          <button onClick={() => setEditing(true)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem' }}>
            <Edit3 size={12}/>Edit routine
          </button>
        </div>
      </div>

      {/* Date + progress */}
      <div style={{ padding:'1.25rem 1.5rem 0', textAlign:'center' }}>
        <p style={{ fontSize:'0.8rem', color:C.muted, margin:'0 0 1rem' }}>{dateLabel}</p>
        {/* Progress dots */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
          {items.map((item, i) => {
            const done = completed.includes(item.id)
            const active = !celebrating && current?.id === item.id
            return (
              <div key={item.id} style={{ width:active?'28px':'10px', height:'10px', borderRadius:'5px', background:done?C.green:active?C.cyan:C.border, transition:'all 0.3s', flexShrink:0 }}/>
            )
          })}
        </div>
        <p style={{ fontSize:'0.7rem', color:C.muted, margin:0 }}>{doneCount} of {totalCount} complete</p>
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>

        {celebrating ? (
          /* ---- Celebration ---- */
          <div style={{ textAlign:'center', maxWidth:'28rem', width:'100%' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>&#127881;</div>
            <h2 style={{ fontSize:'1.75rem', fontWeight:900, color:C.green, margin:'0 0 0.5rem', letterSpacing:'-0.02em' }}>Routine complete!</h2>
            {streak > 0 && <p style={{ fontSize:'0.9rem', color:C.amber, margin:'0 0 1.5rem' }}>&#128293; {streak} day{streak!==1?'s':''} in a row</p>}

            <div style={{ padding:'1.25rem 1.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', marginBottom:'2rem' }}>
              <p style={{ fontSize:'1rem', color:C.text, fontStyle:'italic', lineHeight:1.6, margin:'0 0 0.5rem' }}>"{quote.q}"</p>
              {quote.a && <p style={{ fontSize:'0.75rem', color:C.muted, margin:0 }}>-- {quote.a}</p>}
            </div>

            <button onClick={() => router.push('/')} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'1rem', color:'#000', fontWeight:900, cursor:'pointer', fontFamily:'inherit', fontSize:'1rem' }}>
              Start focus work &#8594;
            </button>

            <div style={{ marginTop:'1rem' }}>
              <button onClick={() => router.push('/morning')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', textDecoration:'underline' }}>View all items</button>
            </div>
          </div>
        ) : current ? (
          /* ---- Current task ---- */
          <div style={{ width:'100%', maxWidth:'30rem' }}>
            {/* Category label */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.75rem' }}>
              <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:catColor, background:'rgba(255,255,255,0.04)', border:'1px solid '+catColor+'44', borderRadius:'9999px', padding:'0.25rem 0.75rem' }}>
                {current.category ?? 'Routine'}
              </span>
            </div>

            {/* Task card */}
            <div style={{ padding:'2.5rem 2rem', background:C.card, border:'2px solid '+catColor+'33', borderRadius:'1.5rem', textAlign:'center', marginBottom:'1.5rem', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
              <h2 style={{ fontSize:'clamp(1.3rem,3vw,1.75rem)', fontWeight:900, color:C.text, margin:'0 0 0.75rem', lineHeight:1.25, letterSpacing:'-0.02em' }}>
                {current.title}
              </h2>
              {current.note && (
                <p style={{ fontSize:'0.8rem', color:C.sec, margin:'0 0 0.5rem', fontStyle:'italic' }}>{current.note}</p>
              )}
              {current.minutes && (
                <p style={{ fontSize:'0.7rem', color:C.muted, margin:0 }}>~{current.minutes} min</p>
              )}
            </div>

            {/* Complete button */}
            <button onClick={() => markComplete(current.id)} style={{ width:'100%', padding:'1rem', background:'linear-gradient(135deg,'+catColor+','+catColor+'bb)', border:'none', borderRadius:'1rem', color:'#000', fontWeight:900, cursor:'pointer', fontFamily:'inherit', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', boxShadow:'0 4px 20px '+catColor+'33' }}>
              <Check size={20} strokeWidth={3}/>Done
            </button>

            {/* Skip */}
            <div style={{ textAlign:'center', marginTop:'0.75rem' }}>
              <button onClick={() => skip(current.id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', textDecoration:'underline' }}>
                Skip for today
              </button>
            </div>

            {/* Upcoming */}
            {pending.length > 1 && (
              <div style={{ marginTop:'1.5rem', padding:'0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Up next</p>
                {pending.slice(1,3).map((item, i) => (
                  <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.375rem 0', borderTop:i>0?'1px solid '+C.border:'none' }}>
                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:CAT_COLORS[item.category??'']??C.muted, flexShrink:0 }}/>
                    <span style={{ fontSize:'0.78rem', color:C.sec }}>{item.title}</span>
                  </div>
                ))}
                {pending.length > 3 && <p style={{ fontSize:'0.65rem', color:C.muted, margin:'0.4rem 0 0' }}>+{pending.length-3} more</p>}
              </div>
            )}
          </div>
        ) : (
          /* Loaded but all skipped / edge case */
          <div style={{ textAlign:'center' }}>
            <p style={{ color:C.sec }}>All tasks complete for today.</p>
            <button onClick={() => router.push('/')} style={{ marginTop:'1rem', padding:'0.75rem 1.5rem', background:C.cyan, border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Go home</button>
          </div>
        )}
      </div>

      {editing && <EditPanel items={items} onClose={() => setEditing(false)} onSave={handleSaveItems}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
