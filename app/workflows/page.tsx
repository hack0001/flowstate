'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X, Sparkles } from 'lucide-react'
import { getWorkflowTypes, createSession } from '@/lib/supabase'
import type { WorkflowType } from '@/types'
import { sounds } from '@/lib/sounds'

// Fallback for when Supabase isn't seeded yet
const FALLBACK_WORKFLOWS: WorkflowType[] = [
  { id: 'yt-short', name: 'YouTube Short', slug: 'youtube-short', description: 'Vertical video under 60 seconds', icon: '⚡', color: '#ff0000' },
  { id: 'yt-long', name: 'YouTube Longform', slug: 'youtube-longform', description: 'Full-length educational video', icon: '🎬', color: '#ff4444' },
  { id: 'tweet', name: 'Tweet / X Post', slug: 'tweet', description: 'High-impact text post', icon: '𝕏', color: '#1da1f2' },
  { id: 'ig-post', name: 'Instagram Post', slug: 'instagram-post', description: 'Feed image or carousel', icon: '📸', color: '#e1306c' },
  { id: 'ig-reel', name: 'Instagram Reel', slug: 'instagram-reel', description: 'Short vertical video', icon: '🎞️', color: '#833ab4' },
  { id: 'linkedin', name: 'LinkedIn Post', slug: 'linkedin-post', description: 'Professional thought-leadership', icon: '💼', color: '#0077b5' },
  { id: 'tiktok', name: 'TikTok', slug: 'tiktok', description: 'Trend-driven short video', icon: '🎵', color: '#69c9d0' },
]

export default function WorkflowsPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<WorkflowType[]>([])
  const [selected, setSelected] = useState<WorkflowType | null>(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [supabaseAvailable, setSupabaseAvailable] = useState(true)

  useEffect(() => {
    getWorkflowTypes()
      .then((data) => setWorkflows(data?.length ? data : FALLBACK_WORKFLOWS))
      .catch(() => {
        setWorkflows(FALLBACK_WORKFLOWS)
        setSupabaseAvailable(false)
      })
  }, [])

  function handleSelect(wf: WorkflowType) {
    sounds.playClick()
    setSelected(wf)
    setSessionTitle('')
  }

  async function handleCreate() {
    if (!selected || !sessionTitle.trim()) return
    sounds.playClick()
    setCreating(true)
    try {
      const session = await createSession(selected.id, sessionTitle.trim())
      sounds.playTaskComplete()
      router.push(`/workflow/${session.id}`)
    } catch (e) {
      console.error(e)
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => { sounds.playClick(); router.push('/') }}
        className="flex items-center gap-2 mb-8 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
          Choose your{' '}
          <span style={{ color: 'var(--cyan)' }}>workflow</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          What are you creating today?
        </p>
        {!supabaseAvailable && (
          <p className="text-xs mt-2 px-3 py-1.5 rounded-lg inline-block"
            style={{ background: 'rgba(255,184,0,0.1)', color: 'var(--amber)', border: '1px solid rgba(255,184,0,0.3)' }}>
            ⚠️ Supabase not connected — sessions won&apos;t be saved
          </p>
        )}
      </motion.div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {workflows.map((wf, i) => (
          <motion.div
            key={wf.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => handleSelect(wf)}
              className="w-full text-left card card-hover p-5 flex flex-col gap-3 transition-all duration-200 group"
              style={{
                borderColor: selected?.id === wf.id ? 'var(--cyan)' : 'var(--border)',
                background: selected?.id === wf.id ? 'rgba(0,212,255,0.05)' : 'var(--card)',
                boxShadow: selected?.id === wf.id ? '0 0 20px rgba(0,212,255,0.15)' : 'none',
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: selected?.id === wf.id
                    ? `${wf.color}22`
                    : 'var(--surface)',
                  border: selected?.id === wf.id
                    ? `1px solid ${wf.color}55`
                    : '1px solid var(--border)',
                }}
              >
                {wf.icon}
              </div>
              <div>
                <p className="font-bold text-sm leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                  {wf.name}
                </p>
                <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {wf.description}
                </p>
              </div>
              {selected?.id === wf.id && (
                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--cyan)' }}>
                  <Sparkles size={12} />
                  Selected
                </div>
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Session name modal / inline form */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="session-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="card p-6 max-w-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected.icon}</span>
                <div>
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Name this piece of content</p>
                </div>
              </div>
              <button
                onClick={() => { sounds.playClick(); setSelected(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              placeholder={`e.g. "How to build a habit in 30 days"`}
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--cyan)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />

            <button
              onClick={handleCreate}
              disabled={!sessionTitle.trim() || creating}
              className="btn btn-primary w-full"
            >
              {creating ? 'Creating...' : '🚀 Start Workflow'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
