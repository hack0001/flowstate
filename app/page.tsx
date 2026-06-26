'use client'
import { useRouter } from 'next/navigation'

const C = { bg: '#0a0a0f', card: '#1a1a26', border: '#2a2a3a', cyan: '#00d4ff', text: '#f0f0ff', sec: '#8888aa' }

export default function Home() {
  const router = useRouter()
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: '2rem' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 900, color: C.cyan, margin: 0 }}>FlowState</h1>
      <p style={{ color: C.sec, fontSize: '1.1rem', margin: 0 }}>Focus-first workflow for content creators</p>
      <button
        onClick={() => router.push('/workflows')}
        style={{ padding: '1rem 2rem', background: C.cyan, border: 'none', borderRadius: '0.75rem', color: '#000', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
        Get Started
      </button>
    </main>
  )
}
