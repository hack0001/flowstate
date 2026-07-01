'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Zap, Star, ChevronRight, CalendarDays, Sunrise } from 'lucide-react'
import { getPrioritySession, getSessions, setPrioritySession } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import type { WorkflowSession } from '@/types'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

const QUOTES = [
  { q:'The secret of getting ahead is getting started.', a:'Mark Twain' },
  { q:'Discipline is the bridge between goals and accomplishment.', a:'Jim Rohn' },
  { q:'Motivation gets you started. Habit keeps you going.', a:'Jim Rohn' },
  { q:'Done beats perfect.', a:'' },
  { q:'One task. Full attention. Ship it.', a:'' },
  { q:'Your future self is watching you right now through memories.', a:'Hal Elrod' },
]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

export default function Home() {
  const router = useRouter()
  const now = useClock()
  const h = now.getHours()

  const [priority, setPriority] = useState<WorkflowSession | null>(null)
  const [sessions, setSessions] = useState<WorkflowSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [routineDone, setRoutineDone] = useState(false)
  const [topTask, setTopTask] = useState<{ title: string; id: string } | null>(null)

  const quote = QUOTES[now.getDate() % QUOTES.length]

  const greeting =
    h < 6  ? 'Up early, Tom' :
    h < 12 ? 'Good morning, Tom' :
    h < 17 ? 'Good afternoon, Tom' :
    h < 21 ? 'Good evening, Tom' : 'Late night, Tom'

  const dateLabel = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
  const timeLabel = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })

  const lateStart = h >= 10 && h < 14
  const veryLate  = h >= 14

  const morningCtaLabel =
    veryLate  ? 'Still time to win the afternoon' :
    lateStart ? "Running late -- let's go!" :
    "Let's get the day started"

  // Load data -- extracted so we can call on mount AND on page focus/visibility
  const loadData = useCallback(() => {
    const today = toDateStr(new Date())
    Promise.all([
      getPrioritySession(),
      getSessions(),
      supabase.from('routine_completions').select('routine_date').eq('routine_date', today).maybeSingle(),
      supabase.from('daily_tasks')
        .select('id,title,urgency,importance,task_type,is_frog')
        .eq('due_date', today)
        .neq('status','Done')
        .order('is_frog', { ascending:false })
        .limit(10),
    ])
      .then(([p, all, routineRes, tasksRes]) => {
        setPriority(p)
        setSessions(all ?? [])
        setRoutineDone(!!routineRes.data)
        const tasks: Array<{ id:string; title:string; urgency:string|null; importance:string|null; task_type:string|null; is_frog:boolean }> = tasksRes.data ?? []
        const frog   = tasks.find(t => t.is_frog)
        const urgent = tasks.find(t => t.urgency === 'Urgent' && t.importance === 'Important')
        const top    = frog ?? urgent ?? tasks[0]
        if (top) setTopTask({ id:top.id, title:top.title })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Run on mount; re-run when user returns to this tab (e.g. after finishing routine)
  useEffect(() => {
    loadData()
    const onVisible = () => { if (!document.hidden) loadData() }
    const onFocus   = () => loadData()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadData])

  function handleFocusClick() {
    if (priority) router.push('/workflow/' + priority.id + '/focus')
    else if (sessions.length > 0) router.push('/workflow/' + sessions[0].id + '/focus')
    else router.push('/workflows')
  }

  async function setP(s: WorkflowSession) {
    try { await setPrioritySession(s.id); setPriority(s) } catch {}
  }

  // ---- Focus-mode card (shown when routine is done) ----
  const FocusCard = () => (
    <div style={{
      width:'100%', maxWidth:'32rem',
      background:'linear-gradient(135deg,rgba(0,255,136,0.06) 0%,rgba(0,212,255,0.04) 100%)',
      border:'1px solid rgba(0,255,136,0.2)',
      borderRadius:'1.5rem', padding:'2rem',
      marginBottom:'2rem', position:'relative', overflow:'hidden'
    }}>
      {/* Glow */}
      <div style={{ position:'absolute', top:'-40px', right:'-40px', width:'180px', height:'180px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,255,136,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div style={{ position:'relative' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.5rem' }}>
          <span style={{ fontSize:'1.1rem' }}>&#128293;</span>
          <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.green }}>Focus time</span>
        </div>

        <h2 style={{ fontSize:'1.5rem', fontWeight:900, color:C.text, margin:'0 0 1.25rem', letterSpacing:'-0.02em', lineHeight:1.2 }}>
          Time to do<br/>deep work.
        </h2>

        {/* Top task */}
        {topTask && (
          <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(0,255,136,0.12)', borderRadius:'0.875rem', padding:'0.875rem 1rem', marginBottom:'1.5rem' }}>
            <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.green, margin:'0 0 0.3rem' }}>Your #1 task today</p>
            <p style={{ fontSize:'1rem', fontWeight:700, color:C.text, margin:0, lineHeight:1.35 }}>{topTask.title}</p>
          </div>
        )}
        {!topTask && !loading && (
          <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(0,255,136,0.12)', borderRadius:'0.875rem', padding:'0.875rem 1rem', marginBottom:'1.5rem' }}>
            <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>No task set for today &mdash; pick one from your workflow.</p>
          </div>
        )}

        {/* CTA button */}
        <button onClick={handleFocusClick} style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem',
          width:'100%', padding:'0.9rem 1.5rem',
          background:'linear-gradient(135deg,'+C.green+',#00cc6a)',
          border:'none', borderRadius:'1rem', cursor:'pointer', fontFamily:'inherit',
          fontWeight:800, fontSize:'0.95rem', color:'#000',
          boxShadow:'0 4px 20px rgba(0,255,136,0.25)',
          transition:'transform 0.15s',
        }}>
          &#9654; Start focus session
        </button>
      </div>
    </div>
  )

  // ---- Morning-mode card (shown when routine not done) ----
  const MorningCard = () => (
    <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
      <div style={{ position:'relative', display:'inline-block', marginBottom:'1.25rem' }}>
        <div style={{ position:'absolute', inset:'-24px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,212,255,0.1) 0%,transparent 70%)', animation:'pulse 2.5s ease-in-out infinite', pointerEvents:'none' }} />
        <button onClick={() => router.push('/morning')} style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:'0.35rem',
          padding:'1.5rem 2.5rem', borderRadius:'1.5rem',
          background: veryLate
            ? 'linear-gradient(135deg,'+C.purple+',#6d28d9)'
            : lateStart
            ? 'linear-gradient(135deg,'+C.amber+',#cc8800)'
            : 'linear-gradient(135deg,'+C.cyan+',#0099cc)',
          border:'none', cursor:'pointer', fontFamily:'inherit',
          boxShadow:'0 8px 32px rgba(0,0,0,0.35)',
        }}>
          <span style={{ fontSize:'1rem', fontWeight:900, color:'#000', letterSpacing:'-0.01em' }}>{morningCtaLabel}</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, color:'rgba(0,0,0,0.65)' }}>
            {veryLate ? 'Do the routine, then lock in' : lateStart ? 'Morning routine -- quick version' : 'Start your morning routine'}
          </span>
          <span style={{ fontSize:'1.1rem', marginTop:'0.2rem' }}>&#8594;</span>
        </button>
      </div>

      {/* Quote */}
      <div style={{ maxWidth:'24rem', margin:'0 auto' }}>
        <p style={{ fontSize:'0.85rem', color:C.sec, fontStyle:'italic', lineHeight:1.6, margin:0 }}>"{quote.q}"</p>
        {quote.a && <p style={{ fontSize:'0.72rem', color:C.muted, marginTop:'0.25rem' }}>-- {quote.a}</p>}
      </div>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg }}>

      {/* ---- Header ---- */}
      <div style={{
        position:'relative', overflow:'hidden', padding:'2.5rem 2rem 2rem',
        borderBottom:'1px solid '+C.border,
        background: routineDone && !loading
          ? 'linear-gradient(160deg,rgba(0,255,136,0.05) 0%,rgba(0,212,255,0.03) 50%,transparent 100%)'
          : 'linear-gradient(160deg,rgba(0,212,255,0.05) 0%,rgba(139,92,246,0.04) 50%,transparent 100%)'
      }}>
        <div style={{ position:'absolute', top:'-60px', left:'50%', transform:'translateX(-50%)', width:'400px', height:'200px', borderRadius:'50%', background:'radial-gradient(ellipse,'+(routineDone && !loading ? 'rgba(0,255,136,0.06)' : 'rgba(0,212,255,0.06)')+' 0%,transparent 70%)', pointerEvents:'none' }} />

        <div style={{ position:'relative', maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1.5rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem' }}>
              <Zap size={16} color={routineDone && !loading ? C.green : C.cyan} />
              <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:routineDone && !loading ? C.green : C.cyan }}>FlowState</span>
            </div>
            <h1 style={{ fontSize:'clamp(1.6rem,3.5vw,2.25rem)', fontWeight:900, color:C.text, margin:'0 0 0.35rem', letterSpacing:'-0.02em' }}>{greeting}</h1>
            <p style={{ fontSize:'0.9rem', color:C.sec, margin:'0 0 0.75rem' }}>{dateLabel}</p>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
              <span style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700, color:C.text, letterSpacing:'0.05em' }}>{timeLabel}</span>
              {!loading && routineDone && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem' }}>
                  &#10003; Routine complete
                </span>
              )}
              {!loading && !routineDone && h >= 6 && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', fontWeight:700, color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.2rem 0.7rem' }}>
                  Morning routine pending
                </span>
              )}
            </div>
          </div>

          {/* Nav */}
          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'flex-start' }}>
            <button onClick={() => router.push('/morning')}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem', color:C.amber, cursor:'pointer', fontSize:'0.8rem', fontWeight:600, fontFamily:'inherit' }}>
              <Sunrise size={14}/>Morning
            </button>
            <button onClick={() => router.push('/calendar')}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.1rem', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontSize:'0.8rem', fontWeight:600, fontFamily:'inherit' }}>
              <CalendarDays size={14}/>Calendar
            </button>
            <button onClick={() => router.push('/workflows')}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.1rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, fontFamily:'inherit' }}>
              <Plus size={14}/>New Workflow
            </button>
          </div>
        </div>
      </div>

      {/* ---- Main body ---- */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem 2rem 2rem' }}>

        {error ? (
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', maxWidth:'28rem', textAlign:'center', marginBottom:'2rem' }}>
            <p style={{ fontWeight:700, color:C.amber, marginBottom:'0.5rem' }}>Supabase Not Connected</p>
            <p style={{ fontSize:'0.875rem', color:C.sec, marginBottom:'1rem' }}>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.</p>
            <button onClick={() => router.push('/workflows')} style={{ padding:'0.6rem 1.2rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Browse Anyway</button>
          </div>
        ) : loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : (
          <>
            {routineDone ? <FocusCard /> : <MorningCard />}

            {/* Sessions list */}
            {sessions.length > 0 && (
              <div style={{ width:'100%', maxWidth:'32rem' }}>
                <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Workflows</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {sessions.slice(0,5).map(s => (
                    <div key={s.id} onClick={() => router.push('/workflow/'+s.id)}
                      style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', cursor:'pointer' }}>
                      <div style={{ width:'2rem', height:'2rem', borderRadius:'0.625rem', background:C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:C.sec, flexShrink:0 }}>
                        {(s.workflow_type?.icon ?? 'WF').slice(0,3)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:600, fontSize:'0.85rem', color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{s.title}</p>
                        <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>{s.workflow_type?.name ?? 'Workflow'}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
                        {s.is_priority
                          ? <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', color:C.amber, padding:'0.15rem 0.5rem', borderRadius:'9999px', fontSize:'0.65rem', fontWeight:700 }}><Star size={9} fill="currentColor" />Priority</span>
                          : <button style={{ fontSize:'0.65rem', padding:'0.15rem 0.4rem', borderRadius:'0.375rem', background:C.surface, border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit' }} onClick={e => { e.stopPropagation(); setP(s) }}>Set Priority</button>
                        }
                        <ChevronRight size={14} color={C.muted} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}`}</style>
    </main>
  )
}
