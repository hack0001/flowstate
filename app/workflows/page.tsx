'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkflowTypes } from '@/lib/supabase'

const C = { bg: '#0a0a0f', card: '#1a1a26', border: '#2a2a3a', cyan: '#00d4ff', text: '#f0f0ff', sec: '#8888aa', amber: '#ffb800' }

const FALLBACK = [
  { id: 'yt-short',  name: 'YouTube Short',   description: 'Under 60 seconds' },
  { id: 'yt-long',   name: 'YouTube Longform', description: 'Full video' },
  { id: 'tweet',     name: 'Tweet',            description: 'Text post' },
  { id: 'ig-post',   name: 'Instagram Post',   description: 'Feed image' },
  { id: 'ig-reel',   name: 'Instagram Reel',   description: 'Short video' },
  { id: 'linkedin',  name: 'LinkedIn',         description: 'Professional post' },
  { id: 'tiktok',    name: 'TikTok',           description: 'Short video' },
]

export default function Workflows() {
  const router = useRouter()
  const [types, setTypes] = useState(FALLBACK)
  const [status, setStatus] = useState('Checking Supabase...')

  useEffect(() => {
    getWorkflowTypes()
      .then(data => {
        if (data && data.length > 0) {
          setTypes(data)
          setStatus('Supabase connected')
        } else {
          setStatus('Supabase connected (no data yet - run seed.sql)')
        }
      })
      .catch(() => setStatus('No Supabase - using local data'))
  }, [])

  return (
    <main style={{ minHeight: '100vh', maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.5rem', background: C.bg }}>
      <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: 'inherit' }}>
        Back
      </button>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, color: C.text, marginBottom: '0.5rem' }}>
        {'Choose a '}<span style={{ color: C.cyan }}>workflow</span>
      </h1>
      <p style={{ color: status.includes('connected') ? C.cyan : C.amber, fontSize: '0.8rem', marginBottom: '2rem', fontWeight: 600 }}>
        {status}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
        {types.map(t => (
          <button key={t.id}
            style={{ padding: '1.25rem', background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.cyan }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}>
            <p style={{ fontWeight: 700, color: C.text, marginBottom: '0.25rem', fontSize: '0.875rem' }}>{t.name}</p>
            <p style={{ color: C.sec, fontSize: '0.75rem' }}>{t.description}</p>
          </button>
        ))}
      </div>
    </main>
  )
}
