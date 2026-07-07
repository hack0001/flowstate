'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, Plus, Trash2, CheckCircle2, SkipForward } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  green:'#00ff88', purple:'#8b5cf6', red:'#ff4466', amber:'#ffb800',
  cyan:'#00d4ff', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const VOCAB: { en:string; cy:string }[] = [
  // Greetings
  { en:'hello',              cy:'shwmae' },
  { en:'good morning',       cy:'bore da' },
  { en:'good afternoon',     cy:'prynhawn da' },
  { en:'good evening',       cy:'noswaith dda' },
  { en:'good night',         cy:'nos da' },
  { en:'goodbye',            cy:'hwyl fawr' },
  { en:'how are you?',       cy:'sut mae?' },
  { en:'thank you',          cy:'diolch' },
  { en:'please',             cy:'os gwelwch yn dda' },
  { en:'welcome',            cy:'croeso' },
  { en:'yes',                cy:'ie' },
  { en:'no',                 cy:'na' },
  // Numbers
  { en:'one',                cy:'un' },
  { en:'two',                cy:'dau' },
  { en:'three',              cy:'tri' },
  { en:'four',               cy:'pedwar' },
  { en:'five',               cy:'pump' },
  { en:'six',                cy:'chwech' },
  { en:'seven',              cy:'saith' },
  { en:'eight',              cy:'wyth' },
  { en:'nine',               cy:'naw' },
  { en:'ten',                cy:'deg' },
  // Days
  { en:'Monday',             cy:'Dydd Llun' },
  { en:'Tuesday',            cy:'Dydd Mawrth' },
  { en:'Wednesday',          cy:'Dydd Mercher' },
  { en:'Thursday',           cy:'Dydd Iau' },
  { en:'Friday',             cy:'Dydd Gwener' },
  { en:'Saturday',           cy:'Dydd Sadwrn' },
  { en:'Sunday',             cy:'Dydd Sul' },
  // Common words
  { en:'water',              cy:'dwr' },
  { en:'food',               cy:'bwyd' },
  { en:'house',              cy:'ty' },
  { en:'work',               cy:'gwaith' },
  { en:'money',              cy:'arian' },
  { en:'cat',                cy:'cath' },
  { en:'dog',                cy:'ci' },
  { en:'Wales',              cy:'Cymru' },
  { en:'Welsh language',     cy:'Cymraeg' },
  { en:'sleep',              cy:'cysgu' },
  { en:'today',              cy:'heddiw' },
  { en:'tomorrow',           cy:'yfory' },
  { en:'friend',             cy:'ffrind' },
  { en:'school',             cy:'ysgol' },
  { en:'book',               cy:'llyfr' },
  { en:'shop',               cy:'siop' },
  // Colours
  { en:'red',                cy:'coch' },
  { en:'blue',               cy:'glas' },
  { en:'green',              cy:'gwyrdd' },
  { en:'white',              cy:'gwyn' },
  { en:'black',              cy:'du' },
  // Family
  { en:'mother',             cy:'mam' },
  { en:'father',             cy:'tad' },
  { en:'brother',            cy:'brawd' },
  { en:'sister',             cy:'chwaer' },
  { en:'children',           cy:'plant' },
  // Verbs
  { en:'to go',              cy:'mynd' },
  { en:'to come',            cy:'dod' },
  { en:'to do / make',       cy:'gwneud' },
  { en:'to get / have',      cy:'cael' },
  { en:'to be',              cy:'bod' },
  { en:'to see',             cy:'gweld' },
  { en:'to say',             cy:'dweud' },
  { en:'to know',            cy:'gwybod' },
  // Adjectives
  { en:'big',                cy:'mawr' },
  { en:'small',              cy:'bach' },
  { en:'good',               cy:'da' },
  { en:'bad',                cy:'drwg' },
  { en:'new',                cy:'newydd' },
  { en:'old',                cy:'hen' },
  { en:'beautiful',          cy:'hardd' },
  // Time
  { en:'time',               cy:'amser' },
  { en:'now',                cy:'nawr' },
  { en:'morning',            cy:'bore' },
  { en:'afternoon',          cy:'prynhawn' },
  { en:'night',              cy:'nos' },
  { en:'year',               cy:'blwyddyn' },
  // Food & drink
  { en:'bread',              cy:'bara' },
  { en:'milk',               cy:'llaeth' },
  { en:'coffee',             cy:'coffi' },
  { en:'tea',                cy:'te' },
  { en:'apple',              cy:'afal' },
  // Places
  { en:'Cardiff',            cy:'Caerdydd' },
  { en:'Swansea',            cy:'Abertawe' },
  { en:'city',               cy:'dinas' },
  { en:'church',             cy:'eglwys' },
  // Extra vocabulary
  { en:'to use',             cy:'ddefnyddio' },
  { en:'to say',             cy:'ddweud' },
  { en:'to decide',          cy:'penderfynu' },
  { en:'museum',             cy:'amgueddfa' },
  { en:'encyclopedia',       cy:'gwyddoniadur' },
  { en:'event',              cy:'digwyddiad' },
  { en:'later',              cy:'nes ymlaen' },
  { en:'because',            cy:'oherwydd' },
  { en:'important',          cy:'pwysig' },
  { en:'or',                 cy:'neu' },
  { en:'heart',              cy:'calon' },
  { en:'until next time',    cy:'tan tro nesa' },
  // Phrases — sentence starters and patterns
  { en:'We went',                   cy:'Aethon ni' },
  { en:'What was',                  cy:'Beth oedd' },
  { en:'What did you do',           cy:'Beth wnest ti' },
  { en:'What did they do',          cy:'Beth wnaethon nhw' },
  { en:'What is',                   cy:'Beth ydy' },
  { en:'Where do you',              cy:"Ble dych chi'n" },
  { en:'Where are you',             cy:"Ble rwyt ti'n" },
  { en:'It will be',                cy:"Bydd hi'n" },
  { en:'He got',                    cy:'Cafodd' },
  { en:'They got',                  cy:'Cawsant' },
  { en:'You got',                   cy:'Gawsoch chi' },
  { en:'We had',                    cy:'Cawson ni' },
  { en:'I had',                     cy:'Ces i' },
  { en:'I did not',                 cy:'Ches i ddim' },
  { en:'Do you / are you',          cy:"Dach chi'n" },
  { en:'He came',                   cy:'Daeth e' },
  { en:'She came',                  cy:'Daeth hi' },
  { en:'The train came',            cy:'Daeth y tren' },
  { en:'They came',                 cy:'Daethon nhw' },
  { en:'We came',                   cy:'Daethon ni' },
  { en:'She does not have',         cy:'Does gynni hi ddim' },
  { en:'I am',                      cy:"Dw i'n" },
  { en:'We are',                    cy:"Dyn ni'n" },
  { en:'She does not',              cy:'Dyw hi' },
  { en:'I went',                    cy:'Es i' },
  { en:'May I',                     cy:'Ga i' },
  { en:'She did',                   cy:'Gwnaeth hi' },
  { en:'I did / I made',            cy:'Gwnes i' },
  { en:'Where is',                  cy:'Lle mae' },
  { en:'She is / it is',            cy:"Mae hi'n" },
  { en:'He is',                     cy:"Mae o'n" },
  { en:'They are',                  cy:"Maen nhw'n" },
  { en:'I got a',                   cy:'Mi ges i' },
  { en:'He was',                    cy:'Oedd e' },
  { en:'Is there',                  cy:'Oes' },
  { en:'When did they come',        cy:'Pryd daethon nhw' },
  { en:'Who are you',               cy:'Pwy dych chi' },
  { en:'I was',                     cy:"Ro'n i'n" },
  { en:'You were',                  cy:"Ro't ti'n" },
  { en:'The (something) was',       cy:'Roedd y' },
  { en:'How do you',                cy:"Sut dach chi'n" },
  { en:'Did you',                   cy:'Wnaethoch chi' },
  { en:'Did they',                  cy:'Wnaethon nhw' },
  { en:'Have you',                  cy:'Wyt ti wedi' },
  { en:'Are you / do you',          cy:"Wyt ti'n" },
  { en:'Are you going',             cy:"Wyt ti'n mynd" },
  { en:'Do you know',               cy:"Wyt ti'n nabod" },
  { en:'Is / Does / Yes',           cy:'Ydy' },
  { en:'Is it / Is she',            cy:"Ydy hi'n" },
  { en:'Do they',                   cy:"Ydy nhw'n" },
  { en:'Are they',                  cy:"Ydyn nhw'n" },
  { en:'Is my',                     cy:'Yw fy' },
  // Useful phrases
  { en:'See you later on',          cy:'Welwch ni hi nes ymlaen' },
  { en:'Be quiet',                  cy:'Byddwch yn dawel' },
  { en:'I have a',                  cy:'Mae gen i' },
  { en:'You have (formal)',         cy:'Mae gynnoch chi' },
  { en:'Have you seen',             cy:'Dych chi wedi gweld' },
  { en:'Have you met',              cy:'Wyt ti wedi cwrdd' },
  { en:'Do they have',              cy:'Oes gynnyn nhw' },
  { en:'She has',                   cy:'Mae gynni hi' },
  { en:'What colour',               cy:'Pa liw' },
  { en:'I saw',                     cy:'Welais i' },
  { en:"Who's there",               cy:"Pwy sy 'na" },
  // Future / will / may
  { en:'Will you',                  cy:'Wnei di' },
  { en:'Will you (formal)',         cy:'Wnewch chi' },
  { en:'I will',                    cy:'Gwna i' },
  { en:'I will / Yes (emphatic)',   cy:'Gwnaf' },
  { en:'May we',                    cy:'Gawn ni' },
  { en:'May he',                    cy:'Gaiff e' },
  { en:'We will',                   cy:'Gwnawn ni' },
  { en:'We will not',               cy:'Wnawn ni ddim' },
  { en:'May I have',                cy:'Ca i' },
  { en:'You may',                   cy:'Cei di' },
  { en:'You may have (formal)',     cy:'Cewch chi' },
  { en:'She will come',             cy:'Daw hi' },
  { en:'Will you come',             cy:'Ddoi di' },
]

// Welsh mutation reference table
const MUTATION_TABLE: {
  initial: string
  soft: string
  aspirate: string
  nasal: string
  example: string
  soft_ex: string
  meaning: string
}[] = [
  { initial:'p', soft:'b', aspirate:'ph', nasal:'mh', example:'pont', soft_ex:'bont', meaning:'bridge' },
  { initial:'t', soft:'d', aspirate:'th', nasal:'nh', example:'tad', soft_ex:'dad', meaning:'father' },
  { initial:'c', soft:'g', aspirate:'ch', nasal:'ngh', example:'cath', soft_ex:'gath', meaning:'cat' },
  { initial:'b', soft:'f', aspirate:'—', nasal:'m', example:'bach', soft_ex:'fach', meaning:'small' },
  { initial:'d', soft:'dd', aspirate:'—', nasal:'n', example:'da', soft_ex:'dda', meaning:'good' },
  { initial:'g', soft:'—', aspirate:'—', nasal:'ng', example:'gardd', soft_ex:'ardd', meaning:'garden' },
  { initial:'m', soft:'f', aspirate:'—', nasal:'—', example:'mawr', soft_ex:'fawr', meaning:'big' },
  { initial:'ll', soft:'l', aspirate:'—', nasal:'—', example:'llyfr', soft_ex:'lyfr', meaning:'book' },
  { initial:'rh', soft:'r', aspirate:'—', nasal:'—', example:'rhan', soft_ex:'ran', meaning:'part' },
  { initial:'ff', soft:'f', aspirate:'—', nasal:'—', example:'fferm', soft_ex:'ferm', meaning:'farm' },
]

const WHEN_SOFT = [
  'After "yn" (predicative): Mae hi\'n fach (She is small)',
  'After "am", "ar", "at", "dan", "dros", "heb", "i", "o", "tan", "wrth"',
  'Adjectives after feminine nouns: merch fach (small girl)',
  'After "dau" / "dwy" (two): dau fachgen (two boys)',
  'Direct objects of inflected verbs',
]

const WHEN_ASPIRATE = [
  'After "a" (and): coffi a the',
  'After "tua" (about): tua thair (about three)',
  'After "gyda" / "ag" (with)',
  'After "â" (as/with)',
]

const BEST_KEY   = 'flowstate_welsh_best'
const STREAK_KEY = 'flowstate_welsh_streak'
const LAST_KEY   = 'flowstate_welsh_last'
const CUSTOM_KEY = 'flowstate_welsh_custom'
const TOTAL      = 10

type Tab = 'quiz' | 'mutations' | 'mywords' | 'todos'
type TodoTask = { id: string; title: string }
type Direction = 'en-cy' | 'cy-en'
type Q = { word: string; answer: string; direction: Direction }
type CustomWord = { en: string; cy: string }

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function buildQuestions(extra: CustomWord[] = []): Q[] {
  const pool = [...VOCAB, ...extra]
  const count = Math.min(TOTAL, pool.length)
  const shuffled = [...pool].sort(() => Math.random()-0.5).slice(0, count)
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

  const [tab,      setTab]      = useState<Tab>('quiz')
  const [questions, setQuestions] = useState<Q[]>(() => buildQuestions())
  const [current,  setCurrent]  = useState(0)
  const [input,    setInput]    = useState('')
  const [result,   setResult]   = useState<'correct'|'incorrect'|null>(null)
  const [score,    setScore]    = useState(0)
  const [done,     setDone]     = useState(false)
  const [best,     setBest]     = useState(0)
  const [streak,   setStreak]   = useState(0)
  const [mounted,  setMounted]  = useState(false)

  // Custom words state
  const [customWords, setCustomWords] = useState<CustomWord[]>([])
  const [newEn, setNewEn] = useState('')
  const [newCy, setNewCy] = useState('')

  // Todos practice state
  const [todoTasks,   setTodoTasks]   = useState<TodoTask[]>([])
  const [todoLoading, setTodoLoading] = useState(false)
  const [todoIdx,     setTodoIdx]     = useState(0)
  const [todoCy,      setTodoCy]      = useState('')
  const [todoSavedIds, setTodoSavedIds] = useState<Set<string>>(new Set())
  const [todoFinished, setTodoFinished] = useState(false)

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY) ?? 0))
      setStreak(Number(localStorage.getItem(STREAK_KEY) ?? 0))
      const stored = localStorage.getItem(CUSTOM_KEY)
      if (stored) {
        const parsed: CustomWord[] = JSON.parse(stored)
        setCustomWords(parsed)
        // Regenerate questions to include custom words if quiz hasn't started
        if (parsed.length > 0) setQuestions(buildQuestions(parsed))
      }
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!result) inputRef.current?.focus()
  }, [result, current])

  // Load todos when that tab is first opened
  useEffect(() => {
    if (tab !== 'todos' || todoTasks.length > 0 || todoLoading) return
    setTodoLoading(true)
    supabase
      .from('master_tasks')
      .select('id,title')
      .eq('archived', false)
      .neq('status', 'Done')
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data }) => {
        setTodoTasks(data ?? [])
        setTodoLoading(false)
      })
  }, [tab, todoTasks.length, todoLoading])

  const q      = questions[current]
  const isLast = current + 1 >= questions.length

  function check() {
    if (!input.trim() || result) return
    const correct = input.trim().toLowerCase() === q.answer.toLowerCase()
    if (correct) setScore(s => s + 1)
    setResult(correct ? 'correct' : 'incorrect')
  }

  function advance() {
    if (isLast) { finishQuiz(); return }
    setCurrent(c => c + 1)
    setInput('')
    setResult(null)
  }

  function finishQuiz() {
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
    setQuestions(buildQuestions(customWords))
    setCurrent(0)
    setInput('')
    setResult(null)
    setScore(0)
    setDone(false)
  }

  function addCustomWord() {
    if (!newEn.trim() || !newCy.trim()) return
    const updated = [...customWords, { en: newEn.trim(), cy: newCy.trim() }]
    setCustomWords(updated)
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated)) } catch {}
    setNewEn('')
    setNewCy('')
  }

  function deleteCustomWord(i: number) {
    const updated = customWords.filter((_, idx) => idx !== i)
    setCustomWords(updated)
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated)) } catch {}
  }

  function todoSaveAndNext() {
    const task = todoTasks[todoIdx]
    if (!task || !todoCy.trim()) return
    // Save the pair to custom words
    const already = customWords.some(w => w.en.toLowerCase() === task.title.toLowerCase())
    if (!already) {
      const updated = [...customWords, { en: task.title, cy: todoCy.trim() }]
      setCustomWords(updated)
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated)) } catch {}
    }
    setTodoSavedIds(prev => new Set([...prev, task.id]))
    setTodoCy('')
    if (todoIdx + 1 >= todoTasks.length) { setTodoFinished(true) }
    else { setTodoIdx(i => i + 1) }
  }

  function todoSkip() {
    setTodoCy('')
    if (todoIdx + 1 >= todoTasks.length) { setTodoFinished(true) }
    else { setTodoIdx(i => i + 1) }
  }

  function todoRestart() {
    setTodoIdx(0)
    setTodoCy('')
    setTodoSavedIds(new Set())
    setTodoFinished(false)
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
      <div style={{ padding:'1.5rem 2rem 0', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'600px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit' }}>
              <ArrowLeft size={14}/> Home
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
              {streak > 0 && <span style={{ fontSize:'0.72rem', fontWeight:700, color:C.purple }}>&#128293; {streak} day streak</span>}
              {best > 0 && <span style={{ fontSize:'0.72rem', color:C.muted }}>Best: {best}/{TOTAL}</span>}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'0', overflowX:'auto' }}>
            {(['quiz','mutations','mywords','todos'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding:'0.6rem 1.1rem', background:'none', border:'none',
                  borderBottom: t === tab ? '2px solid '+C.purple : '2px solid transparent',
                  color: t === tab ? C.purple : C.muted,
                  fontWeight: t === tab ? 700 : 500, fontSize:'0.8rem',
                  cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
                  whiteSpace:'nowrap', flexShrink:0,
                }}>
                {t === 'mywords' ? 'My Words' + (customWords.length > 0 ? ' ('+customWords.length+')' : '')
                  : t === 'mutations' ? 'Mutations'
                  : t === 'todos' ? 'Todos'
                  : 'Quiz'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'2.5rem 2rem' }}>

        {/* ---- QUIZ TAB ---- */}
        {tab === 'quiz' && (
          done ? (
            <div style={{ textAlign:'center', animation:'fadeInUp 0.4s ease both' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>&#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;</div>
              <h1 style={{ fontSize:'1.75rem', fontWeight:900, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>Cwis wedi gorffen!</h1>
              <p style={{ fontSize:'0.85rem', color:C.sec, margin:'0 0 2rem' }}>Quiz complete</p>
              <div style={{ display:'inline-flex', alignItems:'baseline', gap:'0.4rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'1.25rem', padding:'1.25rem 3rem', marginBottom:'0.75rem' }}>
                <span style={{ fontSize:'3.5rem', fontWeight:900, color:C.purple, lineHeight:1 }}>{score}</span>
                <span style={{ fontSize:'1.25rem', color:C.sec }}>/ {questions.length}</span>
              </div>
              <p style={{ fontSize:'0.9rem', color: score >= 8 ? C.green : score >= 5 ? C.purple : C.muted, marginBottom:'2.5rem', fontWeight:700 }}>
                {score >= 8 ? 'Ardderchog! (Excellent!)' : score >= 5 ? 'Da iawn! (Well done!)' : 'Dal ati! (Keep going!)'}
              </p>
              {streak > 0 && <p style={{ fontSize:'0.78rem', color:C.purple, marginBottom:'1.5rem' }}>&#128293; {streak} day{streak !== 1 ? 's' : ''} in a row</p>}
              <button onClick={restart} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'9999px', color:'#fff', fontWeight:800, fontSize:'0.95rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 24px rgba(139,92,246,0.3)' }}>
                <RotateCcw size={15}/> Try again
              </button>
            </div>
          ) : (
            <div style={{ animation:'fadeInUp 0.3s ease both' }}>
              <div style={{ textAlign:'center', marginBottom:'2rem' }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>&#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;</div>
                <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.25rem', letterSpacing:'-0.02em' }}>Prawf Cymraeg</h1>
                <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Daily Welsh vocab test{customWords.length > 0 ? ' · includes your words' : ''}</p>
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color:C.muted, fontWeight:700, marginBottom:'0.4rem' }}>
                <span>Question {current + 1} of {questions.length}</span>
                <span style={{ color:C.green }}>{score} correct</span>
              </div>
              <div style={{ height:'4px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'2.5rem', overflow:'hidden' }}>
                <div style={{ height:'100%', width:((current / questions.length) * 100) + '%', background:'linear-gradient(90deg,#8b5cf6,#a78bfa)', borderRadius:'2px', transition:'width 0.3s' }}/>
              </div>

              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'2rem 1.75rem', marginBottom:'1.25rem', textAlign:'center' }}>
                <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.muted, margin:'0 0 1rem' }}>
                  Translate to {q.direction === 'en-cy' ? 'Welsh (Cymraeg)' : 'English'}
                </p>
                <p style={{ fontSize:'2rem', fontWeight:900, margin:'0 0 1.75rem', letterSpacing:'-0.02em' }}>{q.word}</p>
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
                    {result === 'incorrect' && <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>Answer: <strong style={{ color:C.text }}>{q.answer}</strong></p>}
                  </div>
                )}
              </div>

              {!result ? (
                <button onClick={check} disabled={!input.trim()} style={{ width:'100%', padding:'0.95rem', background:input.trim() ? 'rgba(139,92,246,0.12)' : C.card, border:'1px solid '+(input.trim() ? 'rgba(139,92,246,0.35)' : C.border), borderRadius:'1rem', cursor:input.trim() ? 'pointer' : 'default', fontFamily:'inherit', fontWeight:700, fontSize:'0.95rem', color:input.trim() ? C.purple : C.muted, transition:'all 0.2s' }}>
                  Check (Enter)
                </button>
              ) : (
                <button onClick={advance} style={{ width:'100%', padding:'0.95rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'1rem', cursor:'pointer', fontFamily:'inherit', fontWeight:800, fontSize:'0.95rem', color:'#fff', boxShadow:'0 4px 20px rgba(139,92,246,0.3)' }}>
                  {isLast ? 'See score' : 'Next word &#8594;'}
                </button>
              )}
            </div>
          )
        )}

        {/* ---- MUTATIONS TAB ---- */}
        {tab === 'mutations' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>Welsh Mutations</h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Treiglad — initial consonant changes in Welsh</p>
            </div>

            {/* Table */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', overflow:'hidden', marginBottom:'1.5rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr', padding:'0.75rem 1rem', background:C.surface, borderBottom:'1px solid '+C.border }}>
                {['Initial','Soft','Aspirate','Nasal','Example'].map(h => (
                  <span key={h} style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>{h}</span>
                ))}
              </div>
              {MUTATION_TABLE.map((row, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr', padding:'0.625rem 1rem', borderBottom: i < MUTATION_TABLE.length-1 ? '1px solid '+C.border : 'none', alignItems:'center' }}>
                  <span style={{ fontSize:'1rem', fontWeight:900, color:C.text }}>{row.initial}</span>
                  <span style={{ fontSize:'0.9rem', fontWeight:700, color:C.green }}>{row.soft}</span>
                  <span style={{ fontSize:'0.9rem', fontWeight:700, color:C.amber }}>{row.aspirate}</span>
                  <span style={{ fontSize:'0.9rem', fontWeight:700, color:C.cyan }}>{row.nasal}</span>
                  <span style={{ fontSize:'0.75rem', color:C.sec }}>
                    <strong style={{ color:C.text }}>{row.example}</strong>
                    {' '}&#8594;{' '}
                    <strong style={{ color:C.green }}>{row.soft_ex}</strong>
                    {' '}({row.meaning})
                  </span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
              {[
                { color:C.green, label:'Soft (Meddal)' },
                { color:C.amber, label:'Aspirate (Llaes)' },
                { color:C.cyan,  label:'Nasal (Trwynol)' },
              ].map(l => (
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.72rem', color:C.sec }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:l.color }}/>
                  {l.label}
                </div>
              ))}
            </div>

            {/* When to use soft mutation */}
            <div style={{ background:C.card, border:'1px solid rgba(0,255,136,0.18)', borderRadius:'1rem', padding:'1.25rem 1.5rem', marginBottom:'1rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.green, margin:'0 0 0.75rem' }}>When to use Soft Mutation</p>
              {WHEN_SOFT.map((rule, i) => (
                <p key={i} style={{ fontSize:'0.82rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.55 }}>&#8226; {rule}</p>
              ))}
            </div>

            {/* When to use aspirate mutation */}
            <div style={{ background:C.card, border:'1px solid rgba(255,184,0,0.18)', borderRadius:'1rem', padding:'1.25rem 1.5rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.amber, margin:'0 0 0.75rem' }}>When to use Aspirate Mutation</p>
              {WHEN_ASPIRATE.map((rule, i) => (
                <p key={i} style={{ fontSize:'0.82rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.55 }}>&#8226; {rule}</p>
              ))}
            </div>
          </div>
        )}

        {/* ---- MY WORDS TAB ---- */}
        {tab === 'mywords' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>My Words</h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Add your own translations — they are included in the quiz</p>
            </div>

            {/* Add new word form */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', marginBottom:'1.5rem' }}>
              <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.875rem' }}>Add a new word</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.625rem', marginBottom:'0.75rem' }}>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, display:'block', marginBottom:'0.3rem', letterSpacing:'0.08em', textTransform:'uppercase' }}>English</label>
                  <input
                    value={newEn}
                    onChange={e => setNewEn(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomWord() }}
                    placeholder="e.g. bridge"
                    style={{
                      width:'100%', padding:'0.625rem 0.75rem', boxSizing:'border-box',
                      background:C.surface, border:'1px solid '+C.border,
                      borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, display:'block', marginBottom:'0.3rem', letterSpacing:'0.08em', textTransform:'uppercase' }}>Welsh (Cymraeg)</label>
                  <input
                    value={newCy}
                    onChange={e => setNewCy(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomWord() }}
                    placeholder="e.g. pont"
                    style={{
                      width:'100%', padding:'0.625rem 0.75rem', boxSizing:'border-box',
                      background:C.surface, border:'1px solid '+C.border,
                      borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.875rem', outline:'none',
                    }}
                  />
                </div>
              </div>
              <button
                onClick={addCustomWord}
                disabled={!newEn.trim() || !newCy.trim()}
                style={{
                  width:'100%', padding:'0.75rem',
                  background: (newEn.trim() && newCy.trim()) ? 'linear-gradient(135deg,'+C.purple+',#6d28d9)' : C.surface,
                  border:'none', borderRadius:'0.75rem', cursor:(newEn.trim() && newCy.trim()) ? 'pointer' : 'default',
                  fontFamily:'inherit', fontWeight:700, fontSize:'0.875rem',
                  color:(newEn.trim() && newCy.trim()) ? '#fff' : C.muted,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', transition:'all 0.2s',
                }}>
                <Plus size={14}/> Add word
              </button>
            </div>

            {/* Custom words list */}
            {customWords.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:C.muted, fontSize:'0.85rem' }}>
                <p style={{ margin:0 }}>No custom words yet.</p>
                <p style={{ margin:'0.3rem 0 0', fontSize:'0.75rem' }}>Add words above and they will appear in your quiz.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>
                  {customWords.length} custom word{customWords.length !== 1 ? 's' : ''}
                </p>
                {customWords.map((word, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                    <span style={{ flex:1, fontSize:'0.875rem', fontWeight:600, color:C.text }}>{word.en}</span>
                    <span style={{ fontSize:'0.75rem', color:C.muted }}>&#8594;</span>
                    <span style={{ flex:1, fontSize:'0.875rem', fontWeight:600, color:C.purple }}>{word.cy}</span>
                    <button onClick={() => deleteCustomWord(i)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'0.375rem', transition:'color 0.15s' }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
                <button onClick={() => setTab('quiz')} style={{ marginTop:'1rem', width:'100%', padding:'0.75rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'0.875rem', color:C.purple, fontFamily:'inherit', fontWeight:700, fontSize:'0.875rem', cursor:'pointer' }}>
                  Start quiz with these words &#8594;
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---- TODOS TAB ---- */}
        {tab === 'todos' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.3rem', letterSpacing:'-0.02em' }}>Translate Your Todos</h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>Write the Welsh for each task — saved pairs go into your quiz pool</p>
            </div>

            {todoLoading && (
              <div style={{ textAlign:'center', padding:'3rem', color:C.muted, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
                <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.purple, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
                Loading tasks...
              </div>
            )}

            {!todoLoading && todoTasks.length === 0 && (
              <div style={{ textAlign:'center', padding:'3rem', color:C.muted, fontSize:'0.875rem' }}>
                No incomplete tasks found.
              </div>
            )}

            {!todoLoading && todoTasks.length > 0 && todoFinished && (
              <div style={{ textAlign:'center', animation:'fadeInUp 0.4s ease both' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>&#127988;&#917607;&#917602;&#917623;&#917612;&#917619;&#917631;</div>
                <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:C.text, margin:'0 0 0.4rem', letterSpacing:'-0.02em' }}>
                  Da iawn! (Well done!)
                </h2>
                <p style={{ fontSize:'0.85rem', color:C.sec, margin:'0 0 0.5rem' }}>
                  {todoSavedIds.size > 0
                    ? todoSavedIds.size + ' Welsh pair' + (todoSavedIds.size !== 1 ? 's' : '') + ' saved to your quiz pool'
                    : 'No pairs saved this round'}
                </p>
                <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', marginTop:'1.5rem', flexWrap:'wrap' }}>
                  <button onClick={todoRestart}
                    style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', padding:'0.75rem 1.5rem', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.875rem', color:C.purple, fontWeight:700, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit' }}>
                    <RotateCcw size={13}/> Go again
                  </button>
                  {todoSavedIds.size > 0 && (
                    <button onClick={() => { restart(); setTab('quiz') }}
                      style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'0.875rem', color:'#fff', fontWeight:700, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit' }}>
                      Start quiz &#8594;
                    </button>
                  )}
                </div>
              </div>
            )}

            {!todoLoading && todoTasks.length > 0 && !todoFinished && (() => {
              const task = todoTasks[todoIdx]
              const alreadySaved = todoSavedIds.has(task.id)
              const alreadyInPool = customWords.some(w => w.en.toLowerCase() === task.title.toLowerCase())
              return (
                <div>
                  {/* Progress */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
                    <span style={{ fontSize:'0.68rem', color:C.muted, fontWeight:700 }}>Task {todoIdx + 1} of {todoTasks.length}</span>
                    {todoSavedIds.size > 0 && (
                      <span style={{ fontSize:'0.68rem', color:C.green, fontWeight:700 }}>{todoSavedIds.size} saved</span>
                    )}
                  </div>
                  <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.75rem', overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'linear-gradient(90deg,'+C.purple+','+C.cyan+')', width:((todoIdx / todoTasks.length) * 100) + '%', transition:'width 0.3s', borderRadius:'2px' }}/>
                  </div>

                  {/* Card */}
                  <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'2rem 1.75rem', marginBottom:'1.25rem' }}>
                    <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.875rem', textAlign:'center' }}>
                      How do you say this in Welsh?
                    </p>
                    <p style={{ fontSize:'1.35rem', fontWeight:800, color:C.text, margin:'0 0 1.5rem', lineHeight:1.35, textAlign:'center', letterSpacing:'-0.01em' }}>
                      {task.title}
                    </p>
                    {alreadyInPool ? (
                      <div style={{ textAlign:'center', padding:'0.75rem', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.75rem' }}>
                        <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>
                          <CheckCircle2 size={12} style={{ verticalAlign:'middle', marginRight:'0.3rem' }}/>
                          Already in your quiz pool
                        </p>
                      </div>
                    ) : (
                      <input
                        value={todoCy}
                        onChange={e => setTodoCy(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && todoCy.trim()) todoSaveAndNext() }}
                        placeholder="Type your Welsh translation..."
                        autoFocus
                        style={{
                          width:'100%', padding:'0.875rem 1rem', boxSizing:'border-box',
                          background:C.surface, border:'1px solid '+C.border,
                          borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'1rem',
                          textAlign:'center', outline:'none', transition:'border-color 0.2s',
                        }}
                      />
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:'0.625rem' }}>
                    <button onClick={todoSkip}
                      style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.875rem 1.25rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.875rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontWeight:600, fontSize:'0.85rem', flexShrink:0 }}>
                      <SkipForward size={13}/> Skip
                    </button>
                    {alreadyInPool ? (
                      <button onClick={todoSkip}
                        style={{ flex:1, padding:'0.875rem', background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'0.875rem', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:800, fontSize:'0.9rem' }}>
                        Next &#8594;
                      </button>
                    ) : (
                      <button onClick={todoSaveAndNext} disabled={!todoCy.trim()}
                        style={{ flex:1, padding:'0.875rem', background:todoCy.trim() ? 'linear-gradient(135deg,'+C.green+',#00cc6a)' : C.card, border:'none', borderRadius:'0.875rem', color:todoCy.trim() ? '#000' : C.muted, cursor:todoCy.trim() ? 'pointer' : 'default', fontFamily:'inherit', fontWeight:800, fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', transition:'all 0.2s' }}>
                        <CheckCircle2 size={15}/> Save &amp; Next
                      </button>
                    )}
                  </div>
                  <p style={{ textAlign:'center', fontSize:'0.68rem', color:C.muted, marginTop:'0.75rem' }}>
                    Saved pairs are added to your custom quiz pool and appear in the quiz tab
                  </p>
                </div>
              )
            })()}
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform:rotate(360deg) } }
        input:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
