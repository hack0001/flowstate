'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, Sparkles } from 'lucide-react'
import { getWorkflowTypes, createSession } from '@/lib/supabase'
import type { WorkflowType } from '@/types'
import { sounds } from '@/lib/sounds'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', amber:'#ffb800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }
const FALLBACK: WorkflowType[] = [
  { id:'yt-short', name:'YouTube Short',   slug:'youtube-short',   description:'Under 60 seconds',           icon:'Short',    color:'#ff0000' },
  { id:'yt-long',  name:'YouTube Longform', slug:'youtube-longform',description:'Full-length educational video',icon:'Long',     color:'#ff4444' },
  { id:'tweet',    name:'Tweet / X Post',   slug:'tweet',           description:'High-impact text post',       icon:'Tweet',    color:'#1da1f2' },
  { id:'ig-post',  name:'Instagram Post',   slug:'instagram-post',  description:'Feed image or carousel',      icon:'Photo',    color:'#e1306c' },
  { id:'ig-reel',  name:'Instagram Reel',   slug:'instagram-reel',  description:'Short vertical video',        icon:'Reel',     color:'#833ab4' },
  { id:'linkedin', name:'LinkedIn Post',    slug:'linkedin-post',   description:'Professional thought-leadership',icon:'LinkedIn',color:'#0077b5' },
  { id:'tiktok',   name:'TikTok',           slug:'tiktok',          description:'Trend-driven short video',    icon:'TikTok',   color:'#69c9d0' },
]

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
    sounds.playClick(); setCreating(true)
    try { const s = await createSession(selected.id, title.trim()); router.push('/workflow/'+s.id) }
    catch { setCreating(false) }
  }

  return (
    <main style={{ minHeight:'100vh', padding:'2rem 1.5rem', maxWidth:'56rem', margin:'0 auto', background:C.bg }}>
      <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'2rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}>
        <ArrowLeft size={16} />Back
      </button>
      <h1 style={{ fontSize:'clamp(1.8rem,4vw,2.5rem)', fontWeight:900, color:C.text, marginBottom:'0.5rem' }}>
        {'Choose your '}<span style={{ color:C.cyan }}>workflow</span>
      </h1>
      <p style={{ color:C.sec, marginBottom:ok?'2rem':'0.5rem' }}>What are you creating today?</p>
      {!ok && <span style={{ display:'inline-block', marginBottom:'2rem', padding:'0.3rem 0.75rem', borderRadius:'0.5rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', color:C.amber, fontSize:'0.75rem' }}>Supabase not connected - sessions will not be saved</span>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
        {workflows.map(wf => (
          <button key={wf.id} onClick={() => { sounds.playClick(); setSelected(wf); setTitle('') }}
            style={{ width:'100%', textAlign:'left', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'0.75rem', background:selected?.id===wf.id ? wf.color+'11' : C.card, border:'1px solid '+(selected?.id===wf.id ? C.cyan : C.border), borderRadius:'1rem', cursor:'pointer', transition:'all 0.2s', fontFamily:'inherit' }}
            onMouseEnter={e=>{ if(selected?.id!==wf.id)(e.currentTarget as HTMLButtonElement).style.borderColor=C.cyan }}
            onMouseLeave={e=>{ if(selected?.id!==wf.id)(e.currentTarget as HTMLButtonElement).style.borderColor=C.border }}>
            <div style={{ width:'3rem', height:'3rem', borderRadius:'0.875rem', background:C.surface, border:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, color:C.sec }}>
              {wf.icon}
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:'0.875rem', color:C.text, marginBottom:'0.2rem' }}>{wf.name}</p>
              <p style={{ fontSize:'0.75rem', color:C.sec, lineHeight:1.4 }}>{wf.description}</p>
            </div>
            {selected?.id===wf.id && <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', color:C.cyan, fontSize:'0.75rem', fontWeight:700 }}><Sparkles size={11} />Selected</div>}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', maxWidth:'28rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <p style={{ fontWeight:700, color:C.text }}>{selected.name}</p>
              <p style={{ fontSize:'0.75rem', color:C.sec }}>Name this piece of content</p>
            </div>
            <button onClick={() => { sounds.playClick(); setSelected(null) }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={18} /></button>
          </div>
          <input type="text" placeholder="e.g. How to build a habit in 30 days" value={title}
            onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key==='Enter' && create()} autoFocus
            style={{ width:'100%', padding:'0.75rem 1rem', borderRadius:'0.75rem', fontSize:'0.875rem', marginBottom:'1rem', outline:'none', background:C.surface, border:'1px solid '+C.border, color:C.text, fontFamily:'inherit', boxSizing:'border-box' }}
            onFocus={e => { e.target.style.borderColor=C.cyan }} onBlur={e => { e.target.style.borderColor=C.border }} />
          <button onClick={create} disabled={!title.trim()||creating}
            style={{ width:'100%', padding:'0.75rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', opacity:(!title.trim()||creating)?0.5:1 }}>
            {creating ? 'Creating...' : 'Start Workflow'}
          </button>
        </div>
      )}
    </main>
  )
}
