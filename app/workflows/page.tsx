'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, ArrowRight, Clock } from 'lucide-react'
import { SiYoutube, SiX, SiInstagram, SiTiktok } from 'react-icons/si'
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

const ICON_BG: Record<string, string> = {
  'yt-long':  '#FF0000',
  'yt-short': '#FF0000',
  'tweet':    '#000000',
  'ig-post':  '#E1306C',
  'ig-reel':  '#833AB4',
  'linkedin': '#0A66C2',
  'tiktok':   '#010101',
}

function PlatformIcon({ slug }: { slug: string }) {
  const bg = ICON_BG[slug] ?? '#2a2a3a'
  const iconStyle = { color:'white', width:'55%', height:'55%' }
  const wrapStyle: React.CSSProperties = {
    width:'100%', height:'100%', borderRadius:'10px', position:'relative',
    background: slug === 'ig-post' || slug === 'ig-reel'
      ? 'radial-gradient(circle at 30% 110%, #FFDC80, #FCAF45 25%, #F77737 40%, #FD1D1D 60%, #E1306C 75%, #833AB4 100%)'
      : bg,
    display:'flex', alignItems:'center', justifyContent:'center',
  }
  const icon = (() => {
    if (slug === 'yt-long' || slug === 'yt-short') return <SiYoutube style={iconStyle}/>
    if (slug === 'tweet')    return <SiX style={iconStyle}/>
    if (slug === 'ig-post' || slug === 'ig-reel') return <SiInstagram style={iconStyle}/>
    if (slug === 'linkedin') return (
      <svg viewBox="0 0 24 24" style={{ width:'55%', height:'55%', fill:'white' }}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    )
    if (slug === 'tiktok')   return <SiTiktok style={iconStyle}/>
    return null
  })()
  return (
    <div style={wrapStyle}>
      {icon}
      {slug === 'yt-short' && (
        <span style={{ position:'absolute', bottom:'3px', right:'4px', fontSize:'5px', fontWeight:900, color:'white', letterSpacing:'0.02em', fontFamily:'Arial,sans-serif' }}>S</span>
      )}
    </div>
  )
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
