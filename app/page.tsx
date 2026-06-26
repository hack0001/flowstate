'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Plus, Zap, Star, ChevronRight } from 'lucide-react'
import { getPrioritySession, getSessions, setPrioritySession } from '@/lib/supabase'
import type { WorkflowSession } from '@/types'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }
const QUOTES = [
  { q:'The secret of getting ahead is getting started.', a:'Mark Twain' },
  { q:'Focus on being productive instead of busy.', a:'Tim Ferriss' },
  { q:'One task. Full attention. Ship it.', a:'' },
  { q:'Done beats perfect.', a:'' },
]

export default function Home() {
  const router = useRouter()
  const [priority, setPriority] = useState<WorkflowSession | null>(null)
  const [sessions, setSessions] = useState<WorkflowSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const quote = QUOTES[new Date().getDate() % QUOTES.length]
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    Promise.all([getPrioritySession(), getSessions()])
      .then(([p, all]) => { setPriority(p); setSessions(all ?? []) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  function handleStart() {
    if (priority) router.push('/workflow/' + priority.id + '/focus')
    else if (sessions.length > 0) router.push('/workflow/' + sessions[0].id)
    else router.push('/workflows')
  }

  async function setP(s: WorkflowSession) {
    try { await setPrioritySession(s.id); setPriority(s) } catch {}
  }

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.5rem 2rem', borderBottom:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <Zap size={20} color={C.cyan} />
          <span style={{ fontWeight:700, fontSize:'1.125rem', color:C.text }}>FlowState</span>
        </div>
        <button onClick={() => { router.push('/workflows') }}
          style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontWeight:600, fontFamily:'inherit' }}
          onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.cyan; el.style.color=C.cyan }}
          onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.border; el.style.color=C.sec }}>
          <Plus size={15} />New Workflow
        </button>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 2rem 4rem' }}>
        <div style={{ textAlign:'center', marginBottom:'3rem' }}>
          <p style={{ fontSize:'1.1rem', color:C.sec, marginBottom:'0.5rem' }}>{greeting}</p>
          <h1 style={{ fontSize:'clamp(2.5rem,5vw,3.5rem)', fontWeight:900, letterSpacing:'-0.03em', color:C.text, margin:'0 0 0.75rem' }}>
            {'Ready to '}<span style={{ color:C.cyan }}>create?</span>
          </h1>
          <p style={{ fontSize:'1rem', color:C.sec }}>
            {loading ? '...' : error ? 'Connect Supabase in Vercel env vars' : priority ? ('Priority: "'+priority.title+'"') : sessions.length > 0 ? 'Select a session below' : 'Start your first workflow'}
          </p>
        </div>

        {!error && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'3rem' }}>
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', inset:'-30px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,212,255,0.12) 0%,transparent 70%)', animation:'pulse 2s ease-in-out infinite', pointerEvents:'none' }} />
              <button onClick={handleStart}
                style={{ width:'10rem', height:'10rem', borderRadius:'50%', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px rgba(0,212,255,0.35),0 8px 32px rgba(0,0,0,0.4)', position:'relative' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.transform='scale(1.06)'; el.style.boxShadow='0 0 50px rgba(0,212,255,0.55),0 8px 32px rgba(0,0,0,0.4)' }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.transform='scale(1)'; el.style.boxShadow='0 0 30px rgba(0,212,255,0.35),0 8px 32px rgba(0,0,0,0.4)' }}>
                <Play size={44} fill="#000" color="#000" />
              </button>
            </div>
            <p style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, marginTop:'1rem' }}>
              {priority ? 'Continue Focus' : sessions.length > 0 ? 'Pick a Session' : 'Start Here'}
            </p>
          </div>
        )}

        {error && (
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', maxWidth:'28rem', textAlign:'center', marginBottom:'2rem' }}>
            <p style={{ fontWeight:700, color:C.amber, marginBottom:'0.5rem' }}>Supabase Not Connected</p>
            <p style={{ fontSize:'0.875rem', color:C.sec, marginBottom:'1rem' }}>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.</p>
            <button onClick={() => router.push('/workflows')} style={{ padding:'0.6rem 1.2rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Browse Anyway</button>
          </div>
        )}

        {!error && !loading && sessions.length > 0 && (
          <div style={{ width:'100%', maxWidth:'32rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Active Sessions</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {sessions.map(s => (
                <div key={s.id} onClick={() => { router.push('/workflow/'+s.id) }}
                  style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', cursor:'pointer', transition:'all 0.2s' }}
                  onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.cyan; el.style.transform='translateY(-1px)' }}
                  onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.border; el.style.transform='none' }}>
                  <div style={{ width:'2.5rem', height:'2.5rem', borderRadius:'0.75rem', background:C.surface, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:C.sec, flexShrink:0 }}>
                    {(s.workflow_type?.icon ?? 'WF').slice(0,3)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:600, fontSize:'0.875rem', color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize:'0.75rem', color:C.sec }}>{s.workflow_type?.name ?? 'Workflow'}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
                    {s.is_priority
                      ? <span style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', color:C.amber, padding:'0.2rem 0.6rem', borderRadius:'9999px', fontSize:'0.7rem', fontWeight:700 }}><Star size={10} fill="currentColor" />Priority</span>
                      : <button style={{ fontSize:'0.7rem', padding:'0.2rem 0.5rem', borderRadius:'0.5rem', background:C.surface, border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit' }} onClick={e => { e.stopPropagation(); setP(s) }}>Set Priority</button>
                    }
                    <ChevronRight size={15} color={C.muted} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop:'3rem', textAlign:'center', maxWidth:'24rem' }}>
          <p style={{ fontSize:'0.875rem', color:C.sec, fontStyle:'italic', lineHeight:1.6 }}>"{quote.q}"</p>
          {quote.a && <p style={{ fontSize:'0.75rem', color:C.muted, marginTop:'0.25rem' }}>-- {quote.a}</p>}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}`}</style>
    </main>
  )
}
