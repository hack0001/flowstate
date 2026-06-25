'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Plus, Zap, Clock, ChevronRight, Star } from 'lucide-react'
import { getPrioritySession, getSessions, setPrioritySession } from '@/lib/supabase'
import type { WorkflowSession } from '@/types'
import { sounds } from '@/lib/sounds'

const QUOTES = [
  { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { quote: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { quote: 'One task. Full attention. Ship it.', author: '' },
  { quote: 'Done beats perfect.', author: '' },
  { quote: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
]

const C = {
  bg: '#0a0a0f', surface: '#12121a', card: '#1a1a26', border: '#2a2a3a',
  cyan: '#00d4ff', green: '#00ff88', amber: '#ffb800',
  text: '#f0f0ff', textSec: '#8888aa', textMut: '#4a4a6a',
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function HomePage() {
  const router = useRouter()
  const [priority, setPriority] = useState<WorkflowSession | null>(null)
  const [sessions, setSessions] = useState<WorkflowSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  useEffect(() => {
    Promise.all([getPrioritySession(), getSessions()])
      .then(([p, all]) => { setPriority(p); setSessions(all ?? []) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  function handleStart() {
    sounds.playClick()
    if (priority) router.push('/workflow/' + priority.id + '/focus')
    else if (sessions.length > 0) router.push('/workflow/' + sessions[0].id)
    else router.push('/workflows')
  }

  async function handleSetPriority(s: WorkflowSession) {
    sounds.playClick()
    try { await setPrioritySession(s.id); setPriority(s) } catch {}
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={20} color={C.cyan} />
          <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.025em', color: C.text }}>FlowState</span>
        </div>
        <button
          onClick={() => { sounds.playClick(); router.push('/workflows') }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '0.75rem', color: C.textSec, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.cyan; el.style.color = C.cyan }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.color = C.textSec }}
        >
          <Plus size={15} />New Workflow
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 2rem 4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ fontSize: '1.1rem', color: C.textSec, marginBottom: '0.5rem' }}>{getGreeting()}</p>
          <h1 style={{ fontSize: 'clamp(2.5rem,5vw,3.5rem)', fontWeight: 900, letterSpacing: '-0.03em', color: C.text, margin: '0 0 0.75rem' }}>
            Ready to{' '}
            <span style={{ color: C.cyan }}>create?</span>
          </h1>
          <p style={{ fontSize: '1rem', color: C.textSec, maxWidth: '28rem', margin: '0 auto' }}>
            {loading ? '...'
              : error ? 'Connect Supabase to save sessions'
              : priority ? ('Priority: "' + priority.title + '"')
              : sessions.length > 0 ? 'Select a workflow to continue'
              : 'Start your first workflow'}
          </p>
        </div>

        {!error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '3rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '-30px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,212,255,0.12) 0%,transparent 70%)', animation: 'pulseGlow 2s ease-in-out infinite', pointerEvents: 'none' }} />
              <button
                onClick={handleStart}
                style={{ width: '10rem', height: '10rem', borderRadius: '50%', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(0,212,255,0.35),0 8px 32px rgba(0,0,0,0.4)', transition: 'transform 0.2s,box-shadow 0.2s', color: '#000', position: 'relative' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.transform = 'scale(1.06)'; el.style.boxShadow = '0 0 50px rgba(0,212,255,0.55),0 8px 32px rgba(0,0,0,0.4)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.transform = 'scale(1)'; el.style.boxShadow = '0 0 30px rgba(0,212,255,0.35),0 8px 32px rgba(0,0,0,0.4)' }}
                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)' }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)' }}
              >
                <Play size={44} fill="#000" color="#000" />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textSec, marginTop: '1rem' }}>
              {priority ? 'Continue Focus' : sessions.length > 0 ? 'Pick a Session' : 'Start Here'}
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', padding: '1.5rem', maxWidth: '28rem', textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontWeight: 700, color: C.amber, marginBottom: '0.5rem' }}>Supabase Not Connected</p>
            <p style={{ fontSize: '0.875rem', color: C.textSec, marginBottom: '1rem' }}>Add your Supabase URL and anon key in Vercel environment variables.</p>
            <button onClick={() => router.push('/workflows')} style={{ padding: '0.6rem 1.2rem', background: 'linear-gradient(135deg,' + C.cyan + ',#0099cc)', border: 'none', borderRadius: '0.75rem', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Browse Workflows
            </button>
          </div>
        )}

        {!error && !loading && sessions.length > 0 && (
          <div style={{ width: '100%', maxWidth: '32rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMut, marginBottom: '0.75rem' }}>Active Sessions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.map(s => (
                <div key={s.id} onClick={() => { sounds.playClick(); router.push('/workflow/' + s.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.cyan; el.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.transform = 'none' }}
                >
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                    {s.workflow_type?.icon ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                    <p style={{ fontSize: '0.75rem', color: C.textSec }}>{s.workflow_type?.name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {s.is_priority && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)', color: C.amber, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700 }}>
                        <Star size={10} fill="currentColor" />Priority
                      </span>
                    )}
                    {!s.is_priority && (
                      <button style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', background: C.surface, border: 'none', color: C.textMut, cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={e => { e.stopPropagation(); handleSetPriority(s) }}>
                        Set Priority
                      </button>
                    )}
                    <ChevronRight size={15} color={C.textMut} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '3rem', textAlign: 'center', maxWidth: '24rem' }}>
          <p style={{ fontSize: '0.875rem', color: C.textSec, fontStyle: 'italic', lineHeight: 1.6 }}>"{quote.quote}"</p>
          {quote.author && <p style={{ fontSize: '0.75rem', color: C.textMut, marginTop: '0.25rem' }}>-- {quote.author}</p>}
        </div>
      </div>

      {!error && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', paddingBottom: '2rem', color: C.textMut, fontSize: '0.875rem' }}>
          <Clock size={14} />{sessions.length} active session{sessions.length !== 1 ? 's' : ''}
        </div>
      )}

      <style>{`
        @keyframes pulseGlow {
          0%,100%{opacity:0.6;transform:scale(1)}
          50%{opacity:1;transform:scale(1.05)}
        }
      `}</style>
    </main>
  )
}
