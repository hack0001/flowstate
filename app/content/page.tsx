'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, X, ExternalLink, ChevronRight } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const STAGES = [
  { key:'💡 Idea',              color:'#4a4a6a', bg:'rgba(74,74,106,0.12)' },
  { key:'📚 Research',          color:'#8b5cf6', bg:'rgba(139,92,246,0.1)' },
  { key:'📝 Scripting',         color:'#00d4ff', bg:'rgba(0,212,255,0.08)' },
  { key:'🎙️ Voiceover',        color:'#10b981', bg:'rgba(16,185,129,0.08)' },
  { key:'🎨 Assets',            color:'#ffb800', bg:'rgba(255,184,0,0.08)' },
  { key:'✂️ Editing',           color:'#ff6b35', bg:'rgba(255,107,53,0.1)' },
  { key:'🖼️ Thumbnail & SEO',  color:'#f472b6', bg:'rgba(244,114,182,0.08)' },
  { key:'☁️ Ready to Upload',  color:'#00ff88', bg:'rgba(0,255,136,0.08)' },
  { key:'📣 Live',              color:'#ff4466', bg:'rgba(255,68,102,0.1)' },
]

const STAGE_KEYS = STAGES.map(s => s.key)

type ContentItem = {
  id: string
  notion_id: string | null
  title: string
  pipeline_stage: string | null
  format: string | null
  yt_length: string | null
  tag: string | null
  due_date: string | null
  status: string
  link: string | null
  notes: string | null
  notion_url: string | null
}

function StageChip({ stage }: { stage: string | null }) {
  const s = STAGES.find(x => x.key === stage)
  if (!s) return null
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.1rem 0.45rem', letterSpacing:'0.04em' }}>
      {s.key}
    </span>
  )
}

// Move stage modal
function MoveStageModal({ item, onMove, onClose }: { item: ContentItem; onMove: (stage: string) => void; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'22rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Move to stage</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.4 }}>{item.title}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
          {STAGES.map(s => (
            <button key={s.key} onClick={() => onMove(s.key)} style={{
              textAlign:'left', padding:'0.6rem 0.875rem',
              background: item.pipeline_stage === s.key ? s.bg : C.card,
              border: '1px solid ' + (item.pipeline_stage === s.key ? s.color+'50' : C.border),
              borderRadius:'0.625rem', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.82rem', fontWeight:600,
              color: item.pipeline_stage === s.key ? s.color : C.sec,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              {s.key}
              {item.pipeline_stage === s.key && <span style={{ fontSize:'0.65rem', color:s.color }}>current</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ContentPage() {
  const router = useRouter()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null)
  const [view, setView] = useState<'kanban'|'list'>('kanban')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function moveStage(item: ContentItem, stage: string) {
    setMoveTarget(null)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, pipeline_stage: stage } : i))
    await supabase.from('content_items').update({ pipeline_stage: stage, updated_at: new Date().toISOString() }).eq('id', item.id)
  }

  const byStage = STAGES.map(s => ({
    ...s,
    items: items.filter(i => i.pipeline_stage === s.key),
  }))
  const unstaged = items.filter(i => !i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage))

  function ContentCard({ item }: { item: ContentItem }) {
    const stage = STAGES.find(s => s.key === item.pipeline_stage)
    return (
      <div style={{
        background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem',
        padding:'0.75rem', marginBottom:'0.4rem',
      }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', marginBottom:'0.4rem' }}>
          <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, flex:1, lineHeight:1.35 }}>{item.title}</p>
          {item.notion_url && (
            <a href={item.notion_url} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, display:'flex', flexShrink:0 }}>
              <ExternalLink size={11}/>
            </a>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', flexWrap:'wrap' }}>
          {item.format && <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.format}</span>}
          {item.yt_length && <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.yt_length}</span>}
          {item.tag && <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>}
          {item.due_date && <span style={{ fontSize:'0.6rem', color:C.sec }}>{item.due_date}</span>}
        </div>
        <button onClick={() => setMoveTarget(item)} style={{
          marginTop:'0.5rem', width:'100%', padding:'0.3rem',
          background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border,
          borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit',
          fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem',
        }}>
          Move stage <ChevronRight size={10}/>
        </button>
      </div>
    )
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(255,107,53,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#127909; YouTube Pipeline
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {items.length} videos &mdash; {STAGES.find(s => s.key === '📣 Live') ? byStage.find(s => s.key === '📣 Live')?.items.length ?? 0 : 0} live
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
              <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', overflow:'hidden' }}>
                {(['kanban','list'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{ padding:'0.4rem 0.75rem', background:view===v?C.surface:'transparent', border:'none', color:view===v?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>{v}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'1.5rem 2rem', maxWidth:'1400px', margin:'0 auto' }}>
        {loading ? (
          <p style={{ color:C.muted }}>Loading...</p>
        ) : view === 'kanban' ? (
          /* Kanban */
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.75rem', alignItems:'start' }}>
            {byStage.map(stage => (
              <div key={stage.key} style={{ background:stage.bg, border:'1px solid '+stage.color+'25', borderRadius:'1rem', padding:'0.875rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:800, color:stage.color, letterSpacing:'0.04em' }}>{stage.key}</span>
                  <span style={{ fontSize:'0.65rem', color:stage.color, background:stage.color+'18', borderRadius:'9999px', padding:'0.1rem 0.4rem', fontWeight:700 }}>{stage.items.length}</span>
                </div>
                {stage.items.length === 0 ? (
                  <p style={{ fontSize:'0.68rem', color:C.muted, textAlign:'center', padding:'0.5rem 0', margin:0 }}>empty</p>
                ) : (
                  stage.items.map(item => <ContentCard key={item.id} item={item}/>)
                )}
              </div>
            ))}
            {unstaged.length > 0 && (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'0.875rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:800, color:C.muted }}>Unassigned</span>
                  <span style={{ fontSize:'0.65rem', color:C.muted, background:C.surface, borderRadius:'9999px', padding:'0.1rem 0.4rem', fontWeight:700 }}>{unstaged.length}</span>
                </div>
                {unstaged.map(item => <ContentCard key={item.id} item={item}/>)}
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {items.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                <StageChip stage={item.pipeline_stage}/>
                <p style={{ flex:1, fontSize:'0.85rem', fontWeight:600, color:C.text, margin:0 }}>{item.title}</p>
                {item.format && <span style={{ fontSize:'0.68rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                {item.due_date && <span style={{ fontSize:'0.68rem', color:C.muted, flexShrink:0 }}>{item.due_date}</span>}
                <button onClick={() => setMoveTarget(item)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', padding:'0.2rem 0.5rem', flexShrink:0 }}>Move</button>
                {item.notion_url && <a href={item.notion_url} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, display:'flex', flexShrink:0 }}><ExternalLink size={12}/></a>}
              </div>
            ))}
          </div>
        )}
      </div>

      {moveTarget && <MoveStageModal item={moveTarget} onMove={s => moveStage(moveTarget, s)} onClose={() => setMoveTarget(null)}/>}

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
