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
  if (slug === 'yt-short' || slug === 'yt-long') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#FF0000"/>
      <path d="M19 14l18 10-18 10V14z" fill="white"/>
      {slug === 'yt-short' && <rect x="10" y="36" width="8" height="8" rx="2" fill="white" opacity="0.9"/>}
      {slug === 'yt-short' && <path d="M11 37.5 l2-2 2 2 2-2 2 2" stroke="#FF0000" strokeWidth="1.2" fill="none"/>}
    </svg>
  )
  if (slug === 'tweet') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#111111"/>
      <path d="M10 11h7l7 10.5L33 11h5L26.5 24 38 37h-7l-7.5-11L14 37H9l11.5-13.5L10 11z" fill="white"/>
    </svg>
  )
  if (slug === 'ig-post' || slug === 'ig-reel') return (
    <svg viewBox="0 0 48 48" style={s}>
      <defs>
        <linearGradient id={"ig"+slug} x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F09433"/>
          <stop offset="30%" stopColor="#E6683C"/>
          <stop offset="55%" stopColor="#DC2743"/>
          <stop offset="75%" stopColor="#CC2366"/>
          <stop offset="100%" stopColor="#BC1888"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill={"url(#ig"+slug+")"}/>
      <rect x="13" y="13" width="22" height="22" rx="5" fill="none" stroke="white" strokeWidth="2.5"/>
      <circle cx="24" cy="24" r="5.5" fill="none" stroke="white" strokeWidth="2.5"/>
      <circle cx="33" cy="15" r="2" fill="white"/>
      {slug === 'ig-reel' && <path d="M20 19l10 5-10 5V19z" fill="white" opacity="0.8"/>}
    </svg>
  )
  if (slug === 'linkedin') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#0077B5"/>
      <rect x="11" y="20" width="6" height="18" fill="white"/>
      <circle cx="14" cy="14" r="4" fill="white"/>
      <path d="M21 20h6v3c1-2 3.5-3.5 6-3.5 5 0 7 3 7 8.5V38h-6V28.5c0-2.5-1-4-3.5-4S27 26.5 27 29V38h-6V20z" fill="white"/>
    </svg>
  )
  if (slug === 'tiktok') return (
    <svg viewBox="0 0 48 48" style={s}>
      <rect width="48" height="48" rx="10" fill="#010101"/>
      <path d="M29 8c.5 3.5 2.5 6 6 7.5v5c-2-.3-3.8-1-5.5-2.2V29c0 5.5-4.5 10-10 10S9.5 34.5 9.5 29 14 19 19.5 19c.5 0 1 0 1.5.1v5.4c-.5-.1-1-.2-1.5-.2-2.5 0-4.5 2-4.5 4.7s2 4.7 4.5 4.7 4.5-2.1 4.5-4.7V8H29z" fill="white"/>
      <path d="M32 8c.5 3.5 2.5 6 6 7.5v5c-2-.3-3.8-1-5.5-2.2" fill="none" stroke="#69C9D0" strokeWidth="2"/>
      <path d="M35 7c.3 2 1.5 3.8 3.5 5" stroke="#FF0050" strokeWidth="1.5" fill="none"/>
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
