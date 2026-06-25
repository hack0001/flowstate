'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Play, Plus, Zap, Clock, ChevronRight, Star } from 'lucide-react'
import { getPrioritySession, getSessions, setPrioritySession } from '@/lib/supabase'
import type { WorkflowSession } from '@/types'
import { sounds } from '@/lib/sounds'

const FOCUS_QUOTES = [
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { quote: "One task. Full attention. Ship it.", author: "" },
  { quote: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { quote: "The quality of your output is determined by the quality of your focus.", author: "" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "Energy flows where attention goes.", author: "" },
  { quote: "Do the hard task first. Your future self will thank you.", author: "" },
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDayQuote() {
  const idx = new Date().getDate() % FOCUS_QUOTES.length
  return FOCUS_QUOTES[idx]
}

export default function HomePage() {
  const router = useRouter()
  const [prioritySession, setPrioritySession_] = useState<WorkflowSession | null>(null)
  const [sessions, setSessions] = useState<WorkflowSession[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseError, setSupabaseError] = useState(false)
  const quote = getDayQuote()

  useEffect(() => {
    async function load() {
      try {
        const [priority, all] = await Promise.all([getPrioritySession(), getSessions()])
        setPrioritySession_(priority)
        setSessions(all ?? [])
      } catch {
        setSupabaseError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleStart() {
    sounds.playClick()
    if (prioritySession) {
      router.push(`/workflow/${prioritySession.id}/focus`)
    } else if (sessions.length > 0) {
      router.push(`/workflow/${sessions[0].id}`)
    } else {
      router.push('/workflows')
    }
  }

  async function handleSetPriority(session: WorkflowSession) {
    sounds.playClick()
    try {
      await setPrioritySession(session.id)
      setPrioritySession_(session)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <Zap size={20} style={{ color: 'var(--cyan)' }} />
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
            FlowState
          </span>
        </div>
        <button
          onClick={() => { sounds.playClick(); router.push('/workflows') }}
          className="btn btn-ghost flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          New Workflow
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-lg mb-1" style={{ color: 'var(--text-secondary)' }}>
            {getGreeting()} 👋
          </p>
          <h1 className="text-5xl font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            Ready to{' '}
            <span className="text-glow-cyan" style={{ color: 'var(--cyan)' }}>
              create?
            </span>
          </h1>
          <p className="text-base max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {loading ? '...' : supabaseError
              ? 'Connect Supabase to save your sessions'
              : prioritySession
              ? `Your priority: "${prioritySession.title}"`
              : sessions.length > 0
              ? 'Select a workflow to continue or start something new'
              : 'Start your first workflow to get going'}
          </p>
        </motion.div>

        {/* Big START Button */}
        {!supabaseError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring', bounce: 0.4 }}
            className="mb-12"
          >
            <button
              onClick={handleStart}
              className="relative group"
              style={{ outline: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {/* Glow ring */}
              <div
                className="absolute inset-0 rounded-full animate-pulse-glow"
                style={{
                  background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
                  transform: 'scale(1.5)',
                }}
              />
              <div
                className="relative flex items-center justify-center w-40 h-40 rounded-full font-black text-2xl tracking-wide glow-cyan transition-all duration-200 group-hover:scale-105 group-active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--cyan), #0099cc)',
                  color: '#000',
                }}
              >
                <Play size={40} fill="currentColor" />
              </div>
            </button>
            <p className="text-center mt-4 text-sm font-semibold tracking-widest uppercase"
              style={{ color: 'var(--text-secondary)' }}>
              {prioritySession ? 'Continue Focus' : sessions.length > 0 ? 'Pick a Session' : 'Start Here'}
            </p>
          </motion.div>
        )}

        {/* Supabase setup notice */}
        {supabaseError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 max-w-md text-center mb-8"
          >
            <p className="font-bold mb-2" style={{ color: 'var(--amber)' }}>⚠️ Supabase Not Connected</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Copy <code className="px-1 rounded" style={{ background: 'var(--surface)', color: 'var(--cyan)' }}>.env.local.example</code>{' '}
              to <code className="px-1 rounded" style={{ background: 'var(--surface)', color: 'var(--cyan)' }}>.env.local</code>{' '}
              and add your Supabase credentials to enable sessions.
            </p>
            <button
              onClick={() => { sounds.playClick(); router.push('/workflows') }}
              className="btn btn-primary text-sm"
            >
              Browse Workflows (preview only)
            </button>
          </motion.div>
        )}

        {/* Sessions list */}
        {!supabaseError && !loading && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-lg"
          >
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Active Sessions
            </p>
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="card card-hover flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => { sounds.playClick(); router.push(`/workflow/${session.id}`) }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: 'var(--surface)' }}
                  >
                    {session.workflow_type?.icon ?? '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {session.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {session.workflow_type?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.is_priority && (
                      <span className="streak-badge text-xs">
                        <Star size={10} fill="currentColor" /> Priority
                      </span>
                    )}
                    {!session.is_priority && (
                      <button
                        className="text-xs px-2 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
                        onClick={(e) => { e.stopPropagation(); handleSetPriority(session) }}
                      >
                        Set Priority
                      </button>
                    )}
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center max-w-sm"
        >
          <p className="focus-tip">
            &ldquo;{quote.quote}&rdquo;
          </p>
          {quote.author && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              — {quote.author}
            </p>
          )}
        </motion.div>
      </div>

      {/* Bottom quick stats */}
      {!supabaseError && !loading && (
        <div className="flex items-center justify-center gap-8 pb-8">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Clock size={14} />
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </main>
  )
}
