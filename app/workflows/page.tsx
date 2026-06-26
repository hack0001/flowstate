'use client'
import { useRouter } from 'next/navigation'

const C = { bg: '#0a0a0f', card: '#1a1a26', border: '#2a2a3a', cyan: '#00d4ff', text: '#f0f0ff', sec: '#8888aa' }

const TYPES = [
  { id: 'yt-short',  name: 'YouTube Short',   desc: 'Under 60 seconds' },
  { id: 'yt-long',   name: 'YouTube Longform', desc: 'Full video' },
  { id: 'tweet',     name: 'Tweet',            desc: 'Text post' },
  { id: 'ig-post',   name: 'Instagram Post',   desc: 'Feed image' },
  { id: 'ig-reel',   name: 'Instagram Reel',   desc: 'Short video' },
  { id: 'linkedin',  name: 'LinkedIn',         desc: 'Professional post' },
  { id: 'tiktok',    name: 'TikTok',           desc: 'Short video' },
]

export default function Workflows() {
  const router = useRouter()
  return (
    <main style={{ minHeight: '100vh', maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.5rem', background: C.bg }}>
      <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: C.sec, cursor: 'pointer', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: 'inherit' }}>
        Back to Home
      </button>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, color: C.text, marginBottom: '0.5rem' }}>
        Choose a <span style={{ color: C.cyan }}>workflow</span>
      </h1>
      <p style={{ color: C.sec, marginBottom: '2rem' }}>What are you creating today?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => alert('Session creation coming soon - Supabase needed')}
            style={{ padding: '1.25rem', background: C.card, border: '1px solid ' + C.border, borderRadius: '1rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.cyan }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}>
            <p style={{ fontWeight: 700, color: C.text, marginBottom: '0.25rem', fontSize: '0.875rem' }}>{t.name}</p>
            <p style={{ color: C.sec, fontSize: '0.75rem' }}>{t.desc}</p>
          </button>
        ))}
      </div>
    </main>
  )
}
