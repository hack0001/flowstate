'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6',
}

// ── Aligned with Production SOPs + Shane Hummus Holy Trifecta ──────────────
const PIPELINE_STAGES = [
  { key:'✅ Validated',        color:'#22c55e', bg:'rgba(34,197,94,0.08)',   tip:'Angle confirmed. One-line pitch written. Folder created.' },
  { key:'📚 Research',         color:'#8b5cf6', bg:'rgba(139,92,246,0.08)',  tip:'60-90 min deep dive. Wild stats + story arc found.' },
  { key:'🎯 Holy Trifecta',    color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  tip:'Title + Thumbnail concept + Hook decided BEFORE scripting.' },
  { key:'✍️ Script',           color:'#00d4ff', bg:'rgba(0,212,255,0.06)',   tip:'Full script written, read aloud, timed. [MEME] + [B-ROLL] tagged.' },
  { key:'🎨 Assets',           color:'#f97316', bg:'rgba(249,115,22,0.08)',  tip:'All memes, b-roll, charts gathered and organised in folders.' },
  { key:'🎙️ Voiceover',       color:'#10b981', bg:'rgba(16,185,129,0.08)',  tip:'VO recorded section-by-section. Files labelled. Re-recorded flats.' },
  { key:'✂️ Editing',          color:'#ec4899', bg:'rgba(236,72,153,0.08)', tip:'Full edit done. 2x-speed test passed. Music, SFX, captions added.' },
  { key:'🖼️ Thumbnail & SEO', color:'#f472b6', bg:'rgba(244,114,182,0.08)',tip:'Thumbnail passes 2-sec test. Title, description, tags all written.' },
  { key:'☁️ Scheduled',        color:'#00ff88', bg:'rgba(0,255,136,0.06)',   tip:'Uploaded private. End screens + cards added. Scheduled for peak time.' },
  { key:'📣 Live',             color:'#ff4466', bg:'rgba(255,68,102,0.1)',   tip:'Published. Community post done. Reddit seeded within 30 min.' },
  { key:'📊 Post-Published',   color:'#64748b', bg:'rgba(100,116,139,0.1)', tip:'Short clipped. 48hr analytics checked. CTR + retention logged.' },
]

const IDEA_STAGE = { key:'💡 Idea', color:'#4a4a6a', bg:'rgba(74,74,106,0.12)' }
const ALL_STAGES = [IDEA_STAGE, ...PIPELINE_STAGES]
const STAGE_KEYS  = ALL_STAGES.map(s => s.key)

const FORMATS = ['Long-form', 'Short', 'Both', 'Podcast clip']

// Which funnel role a video plays — from Dave Jeltema / Shane Hummus content-system videos:
// how-tos pull search traffic, listicles are passive top-of-funnel, case studies build
// authority, testimonials/interviews convert. Optional — leave blank if it doesn't apply.
const VIDEO_TYPES = ['How-To', 'Listicle', 'Case Study', 'Explainer', 'Testimonial/Interview']

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
  created_at?: string
  video_type: string | null
  unique_angle: string | null
  revenue_note: string | null
  is_active_focus: boolean
}

type View = 'ideas' | 'pipeline' | 'list'

function stageStyle(key: string | null) {
  return ALL_STAGES.find(s => s.key === key) ?? { color:C.muted, bg:'transparent' }
}

function StageChip({ stage }: { stage: string | null }) {
  const s = stageStyle(stage)
  if (!stage) return null
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', whiteSpace:'nowrap' as const }}>
      {stage}
    </span>
  )
}

// ── Move stage modal ────────────────────────────────────────────────────────
function MoveModal({ item, onMove, onClose }: { item:ContentItem; onMove:(s:string)=>void; onClose:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'22rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Move to stage</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.4 }}>{item.title}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
          {ALL_STAGES.map(s => (
            <button key={s.key} onClick={() => onMove(s.key)} style={{
              textAlign:'left', padding:'0.55rem 0.875rem',
              background: item.pipeline_stage === s.key ? s.bg : C.card,
              border: '1px solid ' + (item.pipeline_stage === s.key ? s.color+'55' : C.border),
              borderRadius:'0.625rem', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight:600, color: item.pipeline_stage === s.key ? s.color : C.sec,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span>{s.key}</span>
              {item.pipeline_stage === s.key && <span style={{ fontSize:'0.6rem', color:s.color }}>current</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Add idea modal ──────────────────────────────────────────────────────────
function AddIdeaModal({ onAdd, onClose }: { onAdd:(title:string,format:string,notes:string,videoType:string,uniqueAngle:string)=>Promise<void>; onClose:()=>void }) {
  const [title,  setTitle]  = useState('')
  const [format, setFormat] = useState('Long-form')
  const [notes,  setNotes]  = useState('')
  const [videoType, setVideoType] = useState('')
  const [uniqueAngle, setUniqueAngle] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title.trim(), format, notes.trim(), videoType, uniqueAngle.trim())
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'26rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Lightbulb size={16} color={C.amber}/> New idea
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Title / Working idea</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              autoFocus placeholder="e.g. Why the Cantillon Effect makes the rich richer"
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', boxSizing:'border-box' as const }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Format</label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{ padding:'0.35rem 0.75rem', background:format===f?'rgba(0,212,255,0.1)':C.card, border:'1px solid '+(format===f?C.cyan:C.border), borderRadius:'9999px', color:format===f?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Video type <span style={{ fontWeight:400 }}>(optional — which funnel role this plays)</span></label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {VIDEO_TYPES.map(v => (
                <button key={v} onClick={() => setVideoType(videoType===v?'':v)} style={{ padding:'0.35rem 0.75rem', background:videoType===v?'rgba(139,92,246,0.12)':C.card, border:'1px solid '+(videoType===v?C.purple:C.border), borderRadius:'9999px', color:videoType===v?C.purple:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Alpha check <span style={{ fontWeight:400 }}>— what does this have that a generic AI answer or the top existing videos don&apos;t?</span></label>
            <textarea
              value={uniqueAngle} onChange={e => setUniqueAngle(e.target.value)} rows={2}
              placeholder="e.g. original data pull, contrarian take, historical parallel nobody else has used, a real number nobody else calculated..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.35rem 0 0' }}>If you can&apos;t fill this in, the idea is probably a recipe &mdash; something AI or a search engine already answers well. Find the edge before you validate it.</p>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Notes / angle / hook idea <span style={{ fontWeight:400 }}>(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Any early thoughts on the angle, hook, or why this topic matters..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
          </div>

          <button onClick={submit} disabled={!title.trim() || saving} style={{
            width:'100%', padding:'0.75rem',
            background: title.trim() && !saving ? 'linear-gradient(135deg,'+C.amber+',#d97706)' : C.card,
            border:'none', borderRadius:'0.75rem', color: title.trim() && !saving ? '#000' : C.muted,
            fontWeight:800, fontSize:'0.9rem', cursor:title.trim() && !saving ? 'pointer' : 'not-allowed',
            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
          }}>
            <Plus size={15}/>{saving ? 'Saving...' : 'Add to ideas bank'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Focus pin star ──────────────────────────────────────────────────────────
// Pins up to 2 items as the Home page's "active focus" videos/shorts. Capped
// at 2 in the app layer (see toggleFocus in the main page component below).
function FocusStar({ active, atCap, onToggle }: { active:boolean; atCap:boolean; onToggle:()=>void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      disabled={!active && atCap}
      title={active ? 'Unpin from Home focus' : atCap ? 'Already 2 pinned — unpin one first' : 'Pin as active focus on Home'}
      style={{
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        width:'1.375rem', height:'1.375rem', borderRadius:'0.4rem',
        background: active ? 'rgba(255,184,0,0.14)' : 'transparent',
        border:'1px solid '+(active ? 'rgba(255,184,0,0.4)' : C.border),
        color: active ? C.amber : C.muted,
        cursor: (!active && atCap) ? 'not-allowed' : 'pointer',
        opacity: (!active && atCap) ? 0.4 : 1,
        padding:0,
      }}>
      <Star size={11} fill={active ? 'currentColor' : 'none'}/>
    </button>
  )
}

// ── Pipeline card ───────────────────────────────────────────────────────────
function PipelineCard({ item, onMove, onSaveRevenue, onToggleFocus, focusAtCap }: { item:ContentItem; onMove:()=>void; onSaveRevenue:(note:string)=>void; onToggleFocus:()=>void; focusAtCap:boolean }) {
  const s = stageStyle(item.pipeline_stage)
  const [revenue, setRevenue] = useState(item.revenue_note ?? '')
  const isPostPublished = item.pipeline_stage === '📊 Post-Published'
  return (
    <div style={{ background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.875rem', padding:'0.75rem', marginBottom:'0.4rem' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', marginBottom:'0.4rem' }}>
        <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, lineHeight:1.35, flex:1 }}>{item.title}</p>
        <FocusStar active={item.is_active_focus} atCap={focusAtCap} onToggle={onToggleFocus}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap' as const, marginBottom:'0.4rem' }}>
        {item.format && <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.format}</span>}
        {item.video_type && <span style={{ fontSize:'0.6rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.video_type}</span>}
        {item.tag && <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>}
      </div>
      {item.unique_angle && <p style={{ fontSize:'0.65rem', color:C.purple, margin:'0 0 0.3rem', lineHeight:1.4 }}>&#9889; {item.unique_angle.slice(0,90)}{item.unique_angle.length>90?'…':''}</p>}
      {item.notes && <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.45, fontStyle:'italic' }}>{item.notes.slice(0,80)}{item.notes.length>80?'…':''}</p>}
      {isPostPublished && (
        <div style={{ marginBottom:'0.4rem' }}>
          <label style={{ display:'block', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, marginBottom:'0.2rem' }}>Revenue attribution</label>
          <input
            value={revenue} onChange={e => setRevenue(e.target.value)} onBlur={() => onSaveRevenue(revenue)}
            placeholder="e.g. $210 AdSense in 30d, or link clicks from UTM"
            style={{ width:'100%', padding:'0.35rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.68rem', outline:'none', boxSizing:'border-box' as const }}
          />
        </div>
      )}
      <button onClick={onMove} style={{ width:'100%', padding:'0.3rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
        Move stage <ChevronRight size={10}/>
      </button>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ContentPage() {
  const router = useRouter()
  const [items,      setItems]      = useState<ContentItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<View>('ideas')
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [focusMsg,   setFocusMsg]   = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function moveStage(item: ContentItem, stage: string) {
    setMoveTarget(null)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, pipeline_stage: stage } : i))
    await supabase.from('content_items').update({ pipeline_stage: stage }).eq('id', item.id)
  }

  async function addIdea(title: string, format: string, notes: string, videoType: string, uniqueAngle: string) {
    const { data } = await supabase
      .from('content_items')
      .insert({ title, pipeline_stage:'💡 Idea', format, notes: notes || null, video_type: videoType || null, unique_angle: uniqueAngle || null, status:'active', archived: false })
      .select()
      .single()
    if (data) setItems(prev => [data, ...prev])
    setShowAdd(false)
  }

  async function saveRevenueNote(item: ContentItem, note: string) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, revenue_note: note } : i))
    await supabase.from('content_items').update({ revenue_note: note || null }).eq('id', item.id)
  }

  const focusCount = items.filter(i => i.is_active_focus).length

  async function toggleFocus(item: ContentItem) {
    if (!item.is_active_focus && focusCount >= 2) return // capped in the UI too, this is a safety net
    const next = !item.is_active_focus
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: next } : i))
    const { error } = await supabase.from('content_items').update({ is_active_focus: next }).eq('id', item.id)
    if (error) {
      // Revert the optimistic update — most likely cause is migration
      // 018_content_focus.sql not having been run yet (is_active_focus
      // column doesn't exist), so surface that clearly instead of failing silently.
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: !next } : i))
      setFocusMsg(
        error.message?.toLowerCase().includes('is_active_focus')
          ? "Setup needed: run supabase/migrations/018_content_focus.sql against your database before pinning works."
          : 'Could not save — ' + error.message
      )
    }
  }

  async function promoteToValidated(item: ContentItem) {
    await moveStage(item, '✅ Validated')
  }

  const ideas    = items.filter(i => i.pipeline_stage === '💡 Idea' || !i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))
  const pipeline = items.filter(i => i.pipeline_stage && STAGE_KEYS.includes(i.pipeline_stage) && i.pipeline_stage !== '💡 Idea')
  const liveCount = items.filter(i => i.pipeline_stage === '📣 Live').length

  const byStage = PIPELINE_STAGES.map(s => ({
    ...s,
    items: items.filter(i => i.pipeline_stage === s.key),
  }))

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(255,107,53,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.5rem', padding:0 }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.3rem,3vw,1.75rem)', fontWeight:900, margin:'0 0 0.15rem', letterSpacing:'-0.02em' }}>
                &#127909; YouTube Pipeline
              </h1>
              <p style={{ fontSize:'0.8rem', color:C.sec, margin:0 }}>
                {ideas.length} ideas &bull; {pipeline.length} in production &bull; {liveCount} live
              </p>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' as const }}>
              {/* View switcher */}
              <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', overflow:'hidden' }}>
                {([
                  { v:'ideas',    icon:<Lightbulb size={12}/>,  label:'Ideas' },
                  { v:'pipeline', icon:<LayoutGrid size={12}/>, label:'Pipeline' },
                  { v:'list',     icon:<List size={12}/>,       label:'All' },
                ] as const).map(({ v, icon, label }) => (
                  <button key={v} onClick={() => setView(v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.8rem', background:view===v?C.surface:'transparent', border:'none', color:view===v?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                    {icon}{label}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'linear-gradient(135deg,'+C.amber+',#d97706)', border:'none', borderRadius:'0.625rem', color:'#000', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:800 }}>
                <Plus size={14}/>New idea
              </button>
            </div>
          </div>

          {/* Pipeline stage legend */}
          {view === 'pipeline' && (
            <div style={{ marginTop:'0.875rem', display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              {PIPELINE_STAGES.map(s => (
                <div key={s.key} title={s.tip} style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.62rem', color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', cursor:'default' }}>
                  {s.key}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'1.5rem 2rem', maxWidth:'1400px', margin:'0 auto' }}>
        {focusMsg && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.amber, margin:0, lineHeight:1.5, flex:1 }}>{focusMsg}</p>
            <button onClick={() => setFocusMsg(null)} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </div>
        )}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:C.muted, padding:'2rem 0' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.orange, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            Loading pipeline...
          </div>
        ) : view === 'ideas' ? (

          /* ── IDEAS BANK ── */
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, margin:'0 0 0.2rem' }}>&#128161; Ideas Bank</h2>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0 }}>{ideas.length} ideas &mdash; validate before moving to production</p>
              </div>
              <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.625rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                <Plus size={13}/>Add idea
              </button>
            </div>

            {ideas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem 1rem', color:C.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.5rem', opacity:0.4 }}>&#128161;</div>
                <p style={{ margin:0, fontSize:'0.85rem' }}>No ideas yet. Add the first one.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' as const }}>
                <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:'0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid '+C.border }}>
                      {['Title','Type','Format','Alpha (unique angle)','Notes / Angle','Added','Actions'].map(h => (
                        <th key={h} style={{ padding:'0.5rem 0.875rem', textAlign:'left' as const, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.muted, whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map(item => (
                      <tr key={item.id} style={{ borderBottom:'1px solid '+C.border+'60' }}>
                        <td style={{ padding:'0.75rem 0.875rem', fontWeight:700, color:C.text, maxWidth:'240px' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem' }}>
                            <span style={{ lineHeight:1.4 }}>{item.title}</span>
                          </div>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.video_type
                            ? <span style={{ fontSize:'0.65rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.video_type}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.format
                            ? <span style={{ fontSize:'0.68rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.format}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.purple, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.unique_angle || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.sec, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.notes || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.muted, whiteSpace:'nowrap' as const, fontSize:'0.72rem' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—'}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                            <button onClick={() => promoteToValidated(item)} title="Move to Validated — begin production" style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.65rem', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'0.5rem', color:'#22c55e', cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                              <CheckCircle2 size={11}/>Validate
                            </button>
                            <button onClick={() => setMoveTarget(item)} style={{ padding:'0.3rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem' }}>
                              Move
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : view === 'pipeline' ? (

          /* ── PIPELINE KANBAN ── */
          <div>
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 1.25rem' }}>
              Hover a stage chip to see the SOP checklist for that step. {pipeline.length} videos in active production.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:'0.625rem', alignItems:'start' }}>
              {byStage.map(stage => (
                <div key={stage.key} style={{ background:stage.bg, border:'1px solid '+stage.color+'28', borderRadius:'1rem', padding:'0.875rem' }}>
                  <div style={{ marginBottom:'0.75rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:800, color:stage.color }}>{stage.key}</span>
                      <span style={{ fontSize:'0.62rem', color:stage.color, background:stage.color+'18', borderRadius:'9999px', padding:'0.1rem 0.375rem', fontWeight:700 }}>{stage.items.length}</span>
                    </div>
                    <p style={{ fontSize:'0.6rem', color:C.muted, margin:0, lineHeight:1.45 }}>{stage.tip}</p>
                  </div>
                  {stage.items.length === 0 ? (
                    <p style={{ fontSize:'0.65rem', color:C.muted, textAlign:'center', padding:'0.75rem 0', margin:0 }}>empty</p>
                  ) : (
                    stage.items.map(item => <PipelineCard key={item.id} item={item} onMove={() => setMoveTarget(item)} onSaveRevenue={note => saveRevenueNote(item, note)} onToggleFocus={() => toggleFocus(item)} focusAtCap={focusCount >= 2}/>)
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : (

          /* ── ALL / LIST ── */
          <div>
            <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1rem' }}>{items.length} total videos across all stages</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              {ALL_STAGES.map(stage => {
                const group = items.filter(i => i.pipeline_stage === stage.key || (stage.key === '💡 Idea' && (!i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))))
                if (group.length === 0) return null
                return (
                  <div key={stage.key} style={{ marginBottom:'0.5rem' }}>
                    <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:stage.color, margin:'0 0 0.35rem' }}>
                      {stage.key} <span style={{ fontWeight:500, color:C.muted }}>({group.length})</span>
                    </p>
                    {group.map(item => (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 0.875rem', background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.75rem', marginBottom:'0.25rem' }}>
                        <FocusStar active={item.is_active_focus} atCap={focusCount >= 2} onToggle={() => toggleFocus(item)}/>
                        <p style={{ flex:1, fontSize:'0.83rem', fontWeight:600, color:C.text, margin:0 }}>{item.title}</p>
                        {item.format && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                        {item.due_date && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.due_date}</span>}
                        <button onClick={() => setMoveTarget(item)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', padding:'0.2rem 0.5rem', flexShrink:0 }}>Move</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {moveTarget && <MoveModal item={moveTarget} onMove={s => moveStage(moveTarget, s)} onClose={() => setMoveTarget(null)}/>}
      {showAdd    && <AddIdeaModal onAdd={addIdea} onClose={() => setShowAdd(false)}/>}

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}
