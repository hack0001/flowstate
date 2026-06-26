'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, ArrowRight, Clock } from 'lucide-react'
import { getWorkflowTypes, createSession } from '@/lib/supabase'
import type { WorkflowType } from '@/types'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', amber:'#ffb800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

const FALLBACK: WorkflowType[] = [
  { id:'yt-short',  name:'YouTube Short',    slug:'yt-short',  description:'Viral vertical video under 60s', icon:'yt-short',  color:'#FF0000' },
  { id:'yt-long',   name:'YouTube Longform', slug:'yt-long',   description:'In-depth video 8-20+ minutes',  icon:'yt-long',   color:'#FF0000' },
  { id:'tweet',     name:'Tweet / X Post',   slug:'tweet',     description:'High-impact post under 280 chars',icon:'tweet',   color:'#000000' },
  { id:'ig-post',   name:'Instagram Post',   slug:'ig-post',   description:'Feed photo or carousel',        icon:'ig-post',   color:'#E1306C' },
  { id:'ig-reel',   name:'Instagram Reel',   slug:'ig-reel',   description:'Short vertical video for Reels',icon:'ig-reel',   color:'#833AB4' },
  { id:'linkedin',  name:'LinkedIn Post',    slug:'linkedin',  description:'Professional thought leadership',icon:'linkedin',  color:'#0077B5' },
  { id:'tiktok',    name:'TikTok Video',     slug:'tiktok',    description:'Short entertaining vertical video',icon:'tiktok', color:'#010101' },
]

const EST: Record<string, number> = {
  'yt-short': 45, 'yt-long': 180, 'tweet': 20, 'ig-post': 40, 'ig-reel': 60, 'linkedin': 35, 'tiktok': 50,
}

function PlatformIcon({ slug }: { slug: string }) {
  const s: React.CSSProperties = { width:'100%', height:'100%' }

  // YouTube (long + short)
  if (slug === 'yt-long') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#FF0000"/>
      {/* YouTube wordmark play button - rounded rect + triangle */}
      <rect x="9" y="15" width="30" height="18" rx="5" fill="white"/>
      <path d="M20 19.5l12 4.5-12 4.5z" fill="#FF0000"/>
    </svg>
  )
  if (slug === 'yt-short') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#FF0000"/>
      {/* Shorts logo: play button + lightning bolt */}
      <rect x="9" y="13" width="30" height="18" rx="5" fill="white"/>
      <path d="M20 17.5l12 4.5-12 4.5z" fill="#FF0000"/>
      <text x="24" y="41" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="Arial,sans-serif" fill="white">SHORTS</text>
    </svg>
  )

  // X (formerly Twitter)
  if (slug === 'tweet') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#000000"/>
      <path d="M8 8h9.5l7.2 10.2L34.5 8H42L28.8 23.8 43 40h-9.5L25.8 28.8 14.5 40H7l14-16.8L8 8zm3.5 3 16.5 23.5h4L15.5 11H11.5zm18.8 0L14.5 37H18l15.8-23h-3.5z" fill="white"/>
    </svg>
  )

  // Instagram
  if (slug === 'ig-post' || slug === 'ig-reel') return (
    <svg viewBox="0 0 48 48" style={s}>
      <defs>
        <linearGradient id={"ig-grad-"+slug} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="20%" stopColor="#FCAF45"/>
          <stop offset="40%" stopColor="#F77737"/>
          <stop offset="55%" stopColor="#F56040"/>
          <stop offset="70%" stopColor="#FD1D1D"/>
          <stop offset="85%" stopColor="#E1306C"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill={"url(#ig-grad-"+slug+")"}/>
      {/* Camera outline */}
      <rect x="12" y="12" width="24" height="24" rx="6" fill="none" stroke="white" strokeWidth="2.5"/>
      {/* Lens */}
      <circle cx="24" cy="24" r="6" fill="none" stroke="white" strokeWidth="2.5"/>
      {/* Dot */}
      <circle cx="32.5" cy="15.5" r="2" fill="white"/>
      {slug === 'ig-reel' && <path d="M21 20l9 4-9 4z" fill="white" opacity="0.9"/>}
    </svg>
  )

  // LinkedIn
  if (slug === 'linkedin') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#0A66C2"/>
      {/* "in" logo */}
      <rect x="10" y="19" width="7" height="20" rx="1" fill="white"/>
      <circle cx="13.5" cy="13.5" r="4" fill="white"/>
      <path d="M21 19h6.5v3.2c1-1.8 3.2-3.7 6.5-3.7 5.5 0 8 3.5 8 9.5V39h-7v-9.8c0-2.8-1-4.7-3.5-4.7-2.8 0-4 2-4 5V39H21V19z" fill="white"/>
    </svg>
  )

  // TikTok
  if (slug === 'tiktok') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#010101"/>
      {/* Cyan shadow layer */}
      <path d="M27.5 7.5c.5 4 2.8 6.5 6.5 8v5.5c-2.2-.3-4.2-1.1-6-2.3V28c0 6-4.8 11-11 11S6 34 6 28s4.8-11 11-11c.6 0 1.1.05 1.6.1v6c-.5-.1-1-.15-1.6-.15-2.8 0-5 2.3-5 5s2.2 5 5 5 5-2.3 5-5V7.5h5.5z" fill="#69C9D0" opacity="0.9"/>
      {/* Red shadow layer */}
      <path d="M29.5 7.5c.5 4 2.8 6.5 6.5 8v5.5c-2.2-.3-4.2-1.1-6-2.3V28c0 6-4.8 11-11 11S8 34 8 28s4.8-11 11-11c.6 0 1.1.05 1.6.1v6c-.5-.1-1-.15-1.6-.15-2.8 0-5 2.3-5 5s2.2 5 5 5 5-2.3 5-5V7.5h5.5z" fill="#FF0050" opacity="0.9"/>
      {/* White main layer */}
      <path d="M28.5 7.5c.5 4 2.8 6.5 6.5 8v5.5c-2.2-.3-4.2-1.1-6-2.3V28c0 6-4.8 11-11 11S7 34 7 28s4.8-11 11-11c.6 0 1.1.05 1.6.1v6c-.5-.1-1-.15-1.6-.15-2.8 0-5 2.3-5 5s2.2 5 5 5 5-2.3 5-5V7.5h5.5z" fill="white"/>
    </svg>
  )

  return <svg viewBox="0 0 48 48" style={s}><rect width="48" height="48" rx="10" fill="#2a2a3a"/></svg>
}

function PlatformMini({ slug }: { slug: string }) {
  return (
    <div style={{ width:'1.75rem', height:'1.75rem', borderRadius:'0.375rem', overflow:'hidden', flexShrink:0 }}>
      <PlatformIcon slug={slug} />
    </div>
  )
}

export default function WorkflowsPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<WorkflowType[]>([])
  const [selected, setSelected] = useState<WorkflowType | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [ok, setOk] = useState(true)

  useEffect(() => {
    getWorkflowTypes()
      .then(d => setWorkflows(d?.length ? d : FALLBACK))
      .catch(() => { setWorkflows(FALLBACK); setOk(false) })
  }, [])

  async function create() {
    if (!selected || !title.trim()) return
    setCreating(true)
    try { const s = await createSession(selected.id, title.trim()); router.push('/workflow/'+s.id) }
    catch { setCreating(false) }
  }

  const selSlug = selected?.slug ?? selected?.icon ?? ''
  const estMin = EST[selSlug] ?? 30

  return (
    <main style={{ minHeight:'100vh', background:C.bg }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2rem', borderBottom:'1px solid '+C.border }}>
        <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}>
          <ArrowLeft size={15}/>Back
        </button>
        {!ok && <span style={{ fontSize:'0.75rem', padding:'0.3rem 0.75rem', borderRadius:'0.5rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', color:C.amber }}>Offline mode - sessions not saved</span>}
      </div>

      <div style={{ padding:'2.5rem 2rem', maxWidth:'72rem', margin:'0 auto' }}>
        <div style={{ marginBottom:'2.5rem' }}>
          <h1 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:900, letterSpacing:'-0.03em', color:C.text, marginBottom:'0.5rem' }}>
            What are you <span style={{ color:C.cyan }}>creating?</span>
          </h1>
          <p style={{ color:C.sec, fontSize:'1rem' }}>Choose a workflow type to get your step-by-step plan.</p>
        </div>

        {/* Workflow grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:'1rem', marginBottom:'2.5rem' }}>
          {workflows.map(wf => {
            const slug = wf.slug ?? wf.icon ?? ''
            const est = EST[slug] ?? 30
            const isSelected = selected?.id === wf.id
            return (
              <button key={wf.id}
                onClick={() => { setSelected(wf); setTitle('') }}
                style={{ textAlign:'left', background:isSelected ? 'rgba(255,255,255,0.04)' : C.card, border:'1px solid '+(isSelected ? wf.color : C.border), borderRadius:'1.125rem', cursor:'pointer', fontFamily:'inherit', overflow:'hidden', transition:'all 0.18s', boxShadow:isSelected ? '0 0 20px '+(wf.color)+'33' : 'none', padding:0 }}
                onMouseEnter={e=>{ if(!isSelected)(e.currentTarget as HTMLButtonElement).style.borderColor=wf.color+'88' }}
                onMouseLeave={e=>{ if(!isSelected)(e.currentTarget as HTMLButtonElement).style.borderColor=C.border }}>
                {/* Icon strip */}
                <div style={{ height:'5rem', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid '+C.border, position:'relative' }}>
                  <div style={{ width:'3.5rem', height:'3.5rem' }}>
                    <PlatformIcon slug={slug} />
                  </div>
                  {isSelected && (
                    <div style={{ position:'absolute', top:'0.5rem', right:'0.5rem', width:'1.25rem', height:'1.25rem', borderRadius:'50%', background:C.cyan, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                    </div>
                  )}
                </div>
                {/* Text */}
                <div style={{ padding:'1rem' }}>
                  <p style={{ fontWeight:700, fontSize:'0.9rem', color:C.text, marginBottom:'0.3rem', lineHeight:1.2 }}>{wf.name}</p>
                  <p style={{ fontSize:'0.75rem', color:C.sec, lineHeight:1.4, marginBottom:'0.75rem' }}>{wf.description}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.7rem', color:C.muted }}>
                    <Clock size={10}/>{est} min est.
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Session name panel */}
        {selected && (
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.125rem', padding:'1.75rem', maxWidth:'36rem', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <PlatformMini slug={selSlug} />
                <div>
                  <p style={{ fontWeight:700, fontSize:'1rem', color:C.text }}>{selected.name}</p>
                  <p style={{ fontSize:'0.75rem', color:C.sec }}>~{estMin} min</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:'0.25rem' }}><X size={16}/></button>
            </div>
            <p style={{ fontSize:'0.8rem', color:C.muted, marginBottom:'0.625rem' }}>Give this session a name (e.g. the title of your content)</p>
            <input
              type="text"
              placeholder="e.g. How to build a habit in 30 days"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key==='Enter' && create()}
              autoFocus
              style={{ width:'100%', padding:'0.875rem 1rem', borderRadius:'0.875rem', fontSize:'0.925rem', outline:'none', background:C.surface, border:'1px solid '+C.border, color:C.text, fontFamily:'inherit', boxSizing:'border-box', marginBottom:'1rem' }}
              onFocus={e => { e.target.style.borderColor=C.cyan }}
              onBlur={e => { e.target.style.borderColor=C.border }}
            />
            <button
              onClick={create}
              disabled={!title.trim() || creating}
              style={{ width:'100%', padding:'0.875rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', opacity:(!title.trim()||creating)?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
              {creating ? 'Creating...' : <><span>Start Workflow</span><ArrowRight size={16}/></>}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
