'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  green:'#00ff88', purple:'#8b5cf6', red:'#ff4466',
  text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const VOCAB: { en:string; cy:string }[] = [
  { en:'hello',            cy:'shwmae' },
  { en:'good morning',     cy:'bore da' },
  { en:'good afternoon',   cy:'prynhawn da' },
  { en:'good evening',     cy:'noswaith dda' },
  { en:'good night',       cy:'nos da' },
  { en:'thank you',        cy:'diolch' },
  { en:'please',           cy:'os gwelwch yn dda' },
  { en:'welcome',          cy:'croeso' },
  { en:'yes',              cy:'ie' },
  { en:'no',               cy:'na' },
  { en:'one',              cy:'un' },
  { en:'two',              cy:'dau' },
  { en:'three',            cy:'tri' },
  { en:'four',             cy:'pedwar' },
  { en:'five',             cy:'pump' },
  { en:'six',              cy:'chwech' },
  { en:'seven',            cy:'saith' },
  { en:'eight',            cy:'wyth' },
  { en:'nine',             cy:'naw' },
  { en:'ten',              cy:'deg' },
  { en:'Monday',           cy:'Dydd Llun' },
  { en:'Tuesday',          cy:'Dydd Mawrth' },
  { en:'Wednesday',        cy:'Dydd Mercher' },
  { en:'Thursday',         cy:'Dydd Iau' },
  { en:'Friday',           cy:'Dydd Gwener' },
  { en:'Saturday',         cy:'Dydd Sadwrn' },
  { en:'Sunday',           cy:'Dydd Sul' },
  { en:'water',            cy:'dwr' },
  { en:'food',             cy:'bwyd' },
  { en:'house',            cy:'ty' },
  { en:'work',             cy:'gwaith' },
  { en:'money',            cy:'arian' },
  { en:'cat',              cy:'cath' },
  { en:'dog',              cy:'ci' },
  { en:'Wales',            cy:'Cymru' },
  { en:'Welsh language',   cy:'Cymraeg' },
  { en:'sleep',            cy:'cysgu' },
  { en:'today',            cy:'heddiw' },
  { en:'tomorrow',         cy:'yfory' },
  { en:'friend',           cy:'ffrind' },
  { en:'school',           cy:'ysgol' },
  { en:'book',             cy:'llyfr' },
  { en:'shop',             cy:'siop' },
  { en:'red',              cy:'coch' },
  { en:'blue',             cy:'glas' },
  { en:'green',            cy:'gwyrdd' },
  { en:'white',            cy:'gwyn' },
  { en:'black',            cy:'du' },
]

const BEST_KEY   = 'flowstate_welsh_best'
const STREAK_KEY = 'flowstate_welsh_streak'
const LAST_KEY   = 'flowstate_welsh_last'
const TOTAL      = 10

type Direction = 'en-cy' | 'cy-en'
type Q = { word: string; answer: string; direction: Direction }

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function buildQuestions(): Q[] {
  const shuffled = [...VOCAB].sort(() => Math.random()-0.5).slice(0, TOTAL)
  return shuffled.map(v => {
    const dir: Direction = Math.random() > 0.5 ? 'en-cy' : 'cy-en'
    return dir === 'en-cy'
      ? { word: v.en, answer: v.cy, direction: dir }
      : { word: v.cy, answer: v.en, direction: dir }
  })
}

export default function WelshPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [questions, setQuestions] = useState<Q[]>(() => buildQuestions())
  const [current,   setCurrent]   = useState(0)
  const [input,     setInput]     = useState('')
  const [result,    setResult]    = useState<'correct'|'incorrect'|null>(null)
  const [score,     setScore]     = useState(0)
  const [done,      setDone]      = useState(false)
  const [best,      setBest]      = useState(0)
  const [streak,    setStreak]    = useState(0)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY) ?? 0))
      setStreak(Number(localStorage.getItem(STREAK_KEY) ?? 0))
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!result) inputRef.current?.focus()
  }, [result, current])

  const q      = questions[current]
  const isLast = current + 1 >= TOTAL

  function check() {
    if (!input.trim() || result) return
    const correct = input.trim().toLowerCase() === q.answer.toLowerCase()
    if (correct) setScore(s => s + 1)
    setResult(correct ? 'correct' : 'incorrect')
  }

  function advance() {
    if (isLast) {
      const finalScore = score + (result === 'correct' ? 0 : 0) // already set
      finishQuiz()
      return
    }
    setCurrent(c => c + 1)
    setInput('')
    setResult(null)
  }

  function finishQuiz() {
    const finalScore = result === 'correct' ? score : score
    try {
      const today = todayStr()
      const last  = localStorage.getItem(LAST_KEY)
      const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') })()
      const newStreak = last === yesterday ? streak + 1 : last === today ? streak : 1
      const newBest   = Math.max(best, score)
      localStorage.setItem(LAST_KEY,   today)
      localStorage.setItem(STREAK_KEY, String(newStreak))
      localStorage.setItem(BEST_KEY,   String(newBest))
      setStreak(newStreak)
      setBest(newBest)
    } catch {}
    setDone(true)
  }

  function restart() {
    setQuestions(buildQuestions())
    setCurrent(0)
    setInput('')
    setResult(null)
    setScore(0)
    setDone(false)
  }

  if (!mounted) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.purple, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>

      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'560px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit' }}>
            <ArrowLeft size={14}/> Home
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            {streak > 0 && (
              <span style={{ fontSize:'0.72rem', fontWeight:700, color:C.purple }}>
                &#128293; {streak} day streak
              </span>
            )}
            {best > 0 && (
              <span style={{ fontSize:'0.72rem', color:C.muted }}>
                Best: {best}/{TOTAL}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'3rem 2rem' }}>

        {done ? (
          /* ---- Score screen ---- */
          <div style={{ textAlign:'center', animation:'fadeInUp 0.4s ease both' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>
              &#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;
            </div>
            <h1 style={{ fontSize:'1.75rem', fontWeight:900, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>
              Cwis wedi gorffen!
            </h1>
            <p style={{ fontSize:'0.85rem', color:C.sec, margin:'0 0 2rem' }}>Quiz complete</p>

            <div style={{ display:'inline-flex', alignItems:'baseline', gap:'0.4rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'1.25rem', padding:'1.25rem 3rem', marginBottom:'0.75rem' }}>
              <span style={{ fontSize:'3.5rem', fontWeight:900, color:C.purple, lineHeight:1 }}>{score}</span>
              <span style={{ fontSize:'1.25rem', color:C.sec }}>/ {TOTAL}</span>
            </div>
            <p style={{ fontSize:'0.9rem', color: score >= 8 ? C.green : score >= 5 ? C.purple : C.muted, marginBottom:'2.5rem', fontWeight:700 }}>
              {score >= 8 ? 'Ardderchog! (Excellent!)' : score >= 5 ? 'Da iawn! (Well done!)' : 'Dal ati! (Keep going!)'}
            </p>

            {streak > 0 && (
              <p style={{ fontSize:'0.78rem', color:C.purple, marginBottom:'1.5rem' }}>
                &#128293; {streak} day{streak !== 1 ? 's' : ''} in a row
              </p>
            )}

            <button onClick={restart} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'9999px', color:'#fff', fontWeight:800, fontSize:'0.95rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 24px rgba(139,92,246,0.3)' }}>
              <RotateCcw size={15}/> Try again
            </button>
          </div>

        ) : (
          /* ---- Quiz ---- */
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>

            {/* Title */}
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>
                &#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;
              </div>
              <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.25rem', letterSpacing:'-0.02em' }}>Prawf Cymraeg</h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Daily Welsh vocab test</p>
            </div>

            {/* Progress bar */}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color:C.muted, fontWeight:700, marginBottom:'0.4rem' }}>
              <span>Question {current + 1} of {TOTAL}</span>
              <span style={{ color:C.green }}>{score} correct</span>
            </div>
            <div style={{ height:'4px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'2.5rem', overflow:'hidden' }}>
              <div style={{ height:'100%', width:((current / TOTAL) * 100) + '%', background:'linear-gradient(90deg,#8b5cf6,#a78bfa)', borderRadius:'2px', transition:'width 0.3s' }}/>
            </div>

            {/* Question card */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'2rem 1.75rem', marginBottom:'1.25rem', textAlign:'center' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.muted, margin:'0 0 1rem' }}>
                Translate to {q.direction === 'en-cy' ? 'Welsh (Cymraeg)' : 'English'}
              </p>
              <p style={{ fontSize:'2rem', fontWeight:900, margin:'0 0 1.75rem', letterSpacing:'-0.02em' }}>
                {q.word}
              </p>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') result ? advance() : check() }}
                placeholder={q.direction === 'en-cy' ? 'Type in Welsh...' : 'Type in English...'}
                disabled={!!result}
                style={{
                  width:'100%', padding:'0.875rem 1rem', boxSizing:'border-box',
                  background: result === 'correct' ? 'rgba(0,255,136,0.08)' : result === 'incorrect' ? 'rgba(255,68,102,0.08)' : C.surface,
                  border:'1px solid '+(result === 'correct' ? 'rgba(0,255,136,0.4)' : result === 'incorrect' ? 'rgba(255,68,102,0.4)' : C.border),
                  borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem',
                  textAlign:'center', transition:'all 0.2s', outline:'none',
                }}
              />
              {result && (
                <div style={{ marginTop:'1rem' }}>
                  <p style={{ fontSize:'1rem', fontWeight:800, color:result === 'correct' ? C.green : C.red, margin:'0 0 0.25rem' }}>
                    {result === 'correct' ? 'Cywir! (Correct!)' : 'Anghywir. (Incorrect)'}
                  </p>
                  {result === 'incorrect' && (
                    <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>
                      Answer: <strong style={{ color:C.text }}>{q.answer}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action button */}
            {!result ? (
              <button
                onClick={check}
                disabled={!input.trim()}
                style={{ width:'100%', padding:'0.95rem', background:input.trim() ? 'rgba(139,92,246,0.12)' : C.card,
                  border:'1px solid '+(input.trim() ? 'rgba(139,92,246,0.35)' : C.border),
                  borderRadius:'1rem', cursor:input.trim() ? 'pointer' : 'default',
                  fontFamily:'inherit', fontWeight:700, fontSize:'0.95rem',
                  color:input.trim() ? C.purple : C.muted, transition:'all 0.2s' }}
              >
                Check (Enter)
              </button>
            ) : (
              <button
                onClick={advance}
                style={{ width:'100%', padding:'0.95rem',
                  background:'linear-gradient(135deg,'+C.purple+',#6d28d9)',
                  border:'none', borderRadius:'1rem', cursor:'pointer',
                  fontFamily:'inherit', fontWeight:800, fontSize:'0.95rem', color:'#fff',
                  boxShadow:'0 4px 20px rgba(139,92,246,0.3)' }}
              >
                {isLast ? 'See score' : 'Next word ->'}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        input:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
