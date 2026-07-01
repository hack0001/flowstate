'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Star, Clock, Moon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const EVENING_HOUR = 20 // 8pm

const SLEEP_ITEMS = [
  { id:'mobility',  emoji:'&#129337;', label:'Mobility work',               note:'Stretches, hip flexors, shoulder rolls — 5-10 mins' },
  { id:'magnesium', emoji:'&#128138;', label:'Magnesium',                   note:'Take magnesium supplement with water' },
  { id:'oilpull',   emoji:'&#129379;', label:'Coco oil pull',               note:'1 tbsp coconut oil, swish for 10-20 mins' },
  { id:'collagen',  emoji:'&#129379;', label:'10g Collagen',                note:'10g collagen in water — mix and drink' },
  { id:'teeth',     emoji:'&#129463;', label:'Brush teeth',                 note:'Baking soda + coconut oil — no fluoride' },
  { id:'welsh',     emoji:'&#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;', label:'Talk / Read Welsh', note:'Duolingo, reading or practice conversation' },
  { id:'read',      emoji:'&#128218;', label:'Read / Listen 10 pages',      note:'Minimum 10 pages — book or Welsh learning' },
  { id:'nophone',   emoji:'&#128245;', label:'No phone',                    note:'Phone face-down in another room — no scrolling' },
]

type Task = {
  id: string
  title: string
  due_date: string | null
  is_frog: boolean
  urgency: string | null
  importance: string | null
  status: string
}

function toDateStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

// Phase 1: Most important task for tomorrow
function PhaseTomorrow({ onNext }: { onNext: () => void }) {
  const [mit, setMit] = useState('')
  const [suggestions, setSuggestions] = useState<Task[]>([])
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchSuggestions = useCallback(async () => {
    setLoadingSugg(true)
    const tomorrow = tomorrowStr()
    const { data } = await supabase
      .from('tasks')
      .select('id,title,due_date,is_frog,urgency,importance,status')
      .eq('archived', false)
      .neq('status', 'Done')
      .or('due_date.is.null,due_date.lte.' + tomorrow)
      .order('is_frog', { ascending: false })
      .order('created_at')
      .limit(5)
    setSuggestions(data ?? [])
    setLoadingSugg(false)
  }, [])

  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  function handleSave() {
    if (!mit.trim()) return
    try { localStorage.setItem('evening_mit_' + toDateStr(), mit.trim()) } catch {}
    setSaved(true)
    setTimeout(onNext, 600)
  }

  return (
    <div style={{ animation:'fadeInUp 0.35s ease both' }}>
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>&#127919;</div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:C.text, margin:'0 0 0.4rem', letterSpacing:'-0.02em' }}>
          What is the single most important task tomorrow?
        </h2>
        <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>
          Not the longest, or the most urgent — the one that would move the needle most.
        </p>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.5rem' }}>
            Suggestions from your task list
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
            {loadingSugg ? (
              <p style={{ fontSize:'0.8rem', color:C.muted }}>Loading...</p>
            ) : suggestions.map(t => (
              <button key={t.id} onClick={() => setMit(t.title)} style={{
                textAlign:'left', padding:'0.625rem 0.875rem',
                background: mit === t.title ? 'rgba(0,212,255,0.08)' : C.card,
                border: '1px solid '+(mit === t.title ? 'rgba(0,212,255,0.3)' : C.border),
                borderRadius:'0.75rem', cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', gap:'0.5rem', transition:'all 0.15s',
              }}>
                {t.is_frog && <span style={{ fontSize:'0.85rem' }}>&#128056;</span>}
                {t.urgency === 'Urgent' && <Star size={11} color={C.amber} fill={C.amber}/>}
                <span style={{ fontSize:'0.84rem', fontWeight:600, color:C.text, flex:1 }}>{t.title}</span>
                {mit === t.title && <CheckCircle2 size={14} color={C.cyan}/>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom input */}
      <div style={{ marginBottom:'1.5rem' }}>
        <label style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.4rem' }}>
          Or write it yourself
        </label>
        <textarea
          value={mit}
          onChange={e => setMit(e.target.value)}
          placeholder="e.g. Record and edit the intro for the YouTube video"
          rows={3}
          style={{
            width:'100%', padding:'0.75rem 1rem',
            background:C.card, border:'1px solid '+C.border,
            borderRadius:'0.875rem', color:C.text, fontFamily:'inherit',
            fontSize:'0.9rem', resize:'vertical', lineHeight:1.5,
            boxSizing:'border-box',
          }}
        />
      </div>

      <button onClick={handleSave} disabled={!mit.trim()} style={{
        width:'100%', padding:'0.95rem',
        background: mit.trim() ? (saved ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : 'linear-gradient(135deg,'+C.purple+',#6d28d9)') : C.card,
        border: '1px solid '+(mit.trim() ? 'transparent' : C.border),
        borderRadius:'1rem', cursor: mit.trim() ? 'pointer' : 'default',
        fontFamily:'inherit', fontWeight:800, fontSize:'0.95rem',
        color: mit.trim() ? (saved ? '#000' : '#fff') : C.muted,
        transition:'all 0.25s ease',
      }}>
        {saved ? '&#10003; Saved — moving to kitchen' : 'Lock it in →'}
      </button>
    </div>
  )
}

// Phase 2: Tidy kitchen
function PhaseKitchen({ onNext }: { onNext: () => void }) {
  const [done, setDone] = useState(false)
  const ITEMS = [
    'Dishes washed / in dishwasher',
    'Surfaces wiped down',
    'Bin emptied if needed',
    'Coffee / tea station ready for morning',
    'Tomorrow\'s breakfast prep (if needed)',
  ]
  const [checked, setChecked] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const allDone = checked.size === ITEMS.length

  function handleNext() {
    setDone(true)
    setTimeout(onNext, 400)
  }

  return (
    <div style={{ animation:'fadeInUp 0.35s ease both' }}>
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>&#127869;&#65039;</div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:C.text, margin:'0 0 0.4rem', letterSpacing:'-0.02em' }}>
          Tidy the kitchen
        </h2>
        <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>
          So you don&apos;t have to think about it in the morning.
        </p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.5rem' }}>
        {ITEMS.map((item, i) => {
          const isDone = checked.has(i)
          return (
            <button key={i} onClick={() => toggle(i)} style={{
              display:'flex', alignItems:'center', gap:'0.75rem',
              padding:'0.75rem 1rem', textAlign:'left',
              background: isDone ? 'rgba(0,255,136,0.05)' : C.card,
              border: '1px solid '+(isDone ? 'rgba(0,255,136,0.2)' : C.border),
              borderRadius:'0.75rem', cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.15s ease',
            }}>
              <div style={{
                width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
                border:'2px solid '+(isDone?C.green:'#4a4a6a'),
                background:isDone?C.green:'transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.15s',
              }}>
                {isDone && <span style={{ fontSize:'0.65rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
              </div>
              <span style={{ fontSize:'0.85rem', fontWeight:600, color:isDone?C.green:C.text, textDecoration:isDone?'line-through':'none', transition:'all 0.2s' }}>{item}</span>
            </button>
          )
        })}
      </div>

      <button onClick={handleNext} style={{
        width:'100%', padding:'0.95rem',
        background: done ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : allDone ? 'linear-gradient(135deg,'+C.purple+',#6d28d9)' : 'linear-gradient(135deg,'+C.purple+',#6d28d9)',
        border:'none', borderRadius:'1rem', cursor:'pointer',
        fontFamily:'inherit', fontWeight:800, fontSize:'0.95rem',
        color: done ? '#000' : '#fff',
      }}>
        {done ? '&#10003; Kitchen done' : allDone ? 'Kitchen sorted → Sleep routine' : 'Skip to sleep routine →'}
      </button>
    </div>
  )
}

// Phase 3: Sleep routine checklist
function PhaseSleep({ onComplete }: { onComplete: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const allDone = checked.size === SLEEP_ITEMS.length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleComplete() {
    // Save completion
    try { localStorage.setItem('evening_done_' + toDateStr(), '1') } catch {}
    onComplete()
  }

  return (
    <div style={{ animation:'fadeInUp 0.35s ease both' }}>
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>&#127769;</div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:C.text, margin:'0 0 0.4rem', letterSpacing:'-0.02em' }}>
          Sleep routine
        </h2>
        <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>
          Tick each one off. Order matters — start from the top.
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,'+C.purple+',#00d4ff)', width:(checked.size/SLEEP_ITEMS.length*100)+'%', transition:'width 0.3s ease', borderRadius:'2px' }}/>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem', marginBottom:'1.5rem' }}>
        {SLEEP_ITEMS.map((item) => {
          const done = checked.has(item.id)
          return (
            <button key={item.id} onClick={() => toggle(item.id)} style={{
              display:'flex', alignItems:'center', gap:'0.875rem',
              padding:'0.7rem 1rem', textAlign:'left',
              background: done ? 'rgba(0,255,136,0.04)' : C.card,
              border: '1px solid '+(done?'rgba(0,255,136,0.18)':C.border),
              borderRadius:'0.875rem', cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.15s ease',
            }}>
              <div style={{
                width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
                border:'2px solid '+(done?C.green:'#4a4a6a'),
                background:done?C.green:'transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.15s',
              }}>
                {done && <span style={{ fontSize:'0.65rem', color:'#000', fontWeight:900 }}>&#10003;</span>}
              </div>
              <span style={{ fontSize:'1.1rem', flexShrink:0 }} dangerouslySetInnerHTML={{ __html:item.emoji }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.84rem', fontWeight:700, color:done?C.green:C.text, margin:0, textDecoration:done?'line-through':'none', transition:'all 0.2s' }}>{item.label}</p>
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.35 }} dangerouslySetInnerHTML={{ __html:item.note }}/>
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={allDone ? handleComplete : undefined} style={{
        width:'100%', padding:'0.95rem',
        background: allDone ? 'linear-gradient(135deg,'+C.purple+',#6d28d9)' : C.card,
        border: '1px solid '+(allDone?'transparent':C.border),
        borderRadius:'1rem', cursor:allDone?'pointer':'default',
        fontFamily:'inherit', fontWeight:800, fontSize:'0.95rem',
        color: allDone ? '#fff' : C.muted,
        transition:'all 0.25s ease',
        boxShadow: allDone ? '0 4px 24px rgba(139,92,246,0.3)' : 'none',
      }}>
        {allDone ? '&#127769; Sleep well — great day' : checked.size + ' / ' + SLEEP_ITEMS.length + ' complete'}
      </button>
    </div>
  )
}

// ---- Steps nav ----
const PHASES = ['Tomorrow', 'Kitchen', 'Sleep']
const PHASE_ICONS = ['&#127919;', '&#127869;&#65039;', '&#127769;']

export default function EveningPage() {
  const router = useRouter()
  const [phase, setPhase] = useState(0)
  const [complete, setComplete] = useState(false)
  const [tooEarly, setTooEarly] = useState(false)
  const [override, setOverride] = useState(false)

  useEffect(() => {
    const h = new Date().getHours()
    if (h < EVENING_HOUR) setTooEarly(true)
    // Check if already done today
    try {
      if (localStorage.getItem('evening_done_' + toDateStr()) === '1') setComplete(true)
    } catch {}
  }, [])

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })

  if (complete) return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ textAlign:'center', maxWidth:'28rem' }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>&#127769;</div>
        <h1 style={{ fontSize:'1.75rem', fontWeight:900, color:C.text, margin:'0 0 0.5rem' }}>Evening routine complete</h1>
        <p style={{ fontSize:'0.9rem', color:C.sec, marginBottom:'2rem' }}>You&apos;ve set yourself up for a great tomorrow. Rest well.</p>
        <button onClick={() => router.push('/')} style={{ padding:'0.75rem 2rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'1rem', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Back to home
        </button>
      </div>
    </main>
  )

  if (tooEarly && !override) return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ textAlign:'center', maxWidth:'24rem' }}>
        <Clock size={36} color={C.purple} style={{ marginBottom:'1rem' }}/>
        <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:C.text, margin:'0 0 0.5rem' }}>Evening routine starts at 8pm</h1>
        <p style={{ fontSize:'0.85rem', color:C.sec, marginBottom:'1.5rem' }}>Come back when the day winds down. Finishing strong matters.</p>
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => router.push('/')} style={{ padding:'0.6rem 1.25rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Back home
          </button>
          <button onClick={() => setOverride(true)} style={{ padding:'0.6rem 1.25rem', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.75rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Do it now anyway
          </button>
        </div>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'600px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit' }}>
              <ChevronLeft size={14}/> Home
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <Moon size={14} color={C.purple}/>
              <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.purple, letterSpacing:'0.08em', textTransform:'uppercase' }}>Evening Routine</span>
            </div>
          </div>
          <p style={{ fontSize:'0.82rem', color:C.sec, margin:'0 0 1rem' }}>{dateLabel}</p>

          {/* Step indicators */}
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            {PHASES.map((name, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.4rem', flex:1 }}>
                <div style={{
                  width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                  background: i < phase ? C.green : i === phase ? C.purple : C.card,
                  border: '1px solid '+(i < phase ? C.green : i === phase ? C.purple : C.border),
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'0.7rem', transition:'all 0.3s',
                }}>
                  {i < phase
                    ? <span style={{ color:'#000', fontWeight:900, fontSize:'0.65rem' }}>&#10003;</span>
                    : <span dangerouslySetInnerHTML={{ __html: PHASE_ICONS[i] }} style={{ fontSize:'0.7rem' }}/>}
                </div>
                <span style={{ fontSize:'0.68rem', fontWeight: i===phase?700:500, color:i===phase?C.text:C.muted }}>{name}</span>
                {i < PHASES.length-1 && <ChevronRight size={10} color={C.muted} style={{ marginLeft:'auto' }}/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'2.5rem 2rem' }}>
        {phase === 0 && <PhaseTomorrow onNext={() => setPhase(1)} />}
        {phase === 1 && <PhaseKitchen onNext={() => setPhase(2)} />}
        {phase === 2 && <PhaseSleep onComplete={() => setComplete(true)} />}
      </div>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        textarea, input { outline:none; }
        textarea:focus, input:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
