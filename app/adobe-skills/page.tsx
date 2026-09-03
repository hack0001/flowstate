'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAdobeSkillResources, addAdobeSkillResource, updateAdobeSkillResource, deleteAdobeSkillResource,
  ADOBE_TOOLS, type AdobeTool, type AdobeSkillResource,
} from '@/lib/supabase'
import { ChevronLeft, Plus, X, ExternalLink, Edit3, Trash2, CheckCircle2, Circle, Youtube, Globe, Palette } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

// Adobe's own brand colors per app, used consistently for badges/filters.
const TOOL_META: Record<AdobeTool, { color: string; emoji: string }> = {
  'Premiere Pro':  { color:'#9161f2', emoji:'🎬' },
  'After Effects': { color:'#4f8ef7', emoji:'✨' },
  'Illustrator':   { color:'#ff9a00', emoji:'🎨' },
  'General':       { color:'#8888aa', emoji:'🧰' },
}

function resourceKind(url: string): 'YouTube' | 'Website' {
  return /youtube\.com|youtu\.be/i.test(url) ? 'YouTube' : 'Website'
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.6rem 0.8rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none',
  boxSizing:'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor:'pointer', appearance:'none' as const }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize:'vertical' as const, minHeight:80, lineHeight:1.6 }

type Draft = { id?: string; tool: AdobeTool; title: string; url: string; description: string }
const EMPTY_DRAFT: Draft = { tool:'Premiere Pro', title:'', url:'', description:'' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ResourceDrawer({
  draft, setDraft, onSave, onClose, saving,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100 }}/>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'min(480px,100vw)',
        background:C.surface, borderLeft:'1px solid '+C.border,
        zIndex:101, display:'flex', flexDirection:'column', overflowY:'auto',
      }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, flex:1 }}>
            {draft.id ? 'Edit Resource' : 'New Resource'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding:'1.25rem 1.5rem', flex:1 }}>
          <Field label="Tool">
            <select value={draft.tool} onChange={e => setDraft({ ...draft, tool: e.target.value as AdobeTool })} style={selectStyle}>
              {ADOBE_TOOLS.map(t => <option key={t} value={t}>{TOOL_META[t].emoji} {t}</option>)}
            </select>
          </Field>

          <Field label="Name *">
            <input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="What is it?" style={inputStyle}/>
          </Field>

          <Field label="Link *">
            <input value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://youtube.com/... or a website" style={inputStyle}/>
          </Field>

          <Field label="What it does">
            <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What it teaches / why it's useful..." style={textareaStyle}/>
          </Field>
        </div>

        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid '+C.border, display:'flex', gap:'0.75rem', flexShrink:0 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.title.trim() || !draft.url.trim()}
            style={{
              flex:1, padding:'0.75rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none',
              borderRadius:'0.75rem', color:'#000', fontWeight:800, fontSize:'0.9rem',
              cursor: saving || !draft.title.trim() || !draft.url.trim() ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', opacity: saving || !draft.title.trim() || !draft.url.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : draft.id ? 'Save Changes' : 'Add Resource'}
          </button>
          <button onClick={onClose} style={{ padding:'0.75rem 1.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

export default function AdobeSkillsPage() {
  const router = useRouter()
  const [resources, setResources] = useState<AdobeSkillResource[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [toolFilter, setToolFilter] = useState<AdobeTool | 'All'>('All')
  const [showLearned, setShowLearned] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { resources, error } = await getAdobeSkillResources()
    setResources(resources)
    setErrMsg(error)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setDrawerOpen(true)
  }

  function openEdit(r: AdobeSkillResource) {
    setDraft({ id:r.id, tool:r.tool, title:r.title, url:r.url, description:r.description ?? '' })
    setDrawerOpen(true)
  }

  async function saveDrawer() {
    if (!draft.title.trim() || !draft.url.trim()) return
    setSaving(true)
    if (draft.id) {
      const { error } = await updateAdobeSkillResource(draft.id, { tool:draft.tool, title:draft.title.trim(), url:draft.url.trim(), description:draft.description.trim() || undefined })
      if (error) setErrMsg(error)
      else setResources(prev => prev.map(r => r.id === draft.id ? { ...r, tool:draft.tool, title:draft.title.trim(), url:draft.url.trim(), description:draft.description.trim() || null } : r))
    } else {
      const { resource, error } = await addAdobeSkillResource(draft.tool, draft.title, draft.url, draft.description)
      if (error) setErrMsg(error)
      else if (resource) setResources(prev => [resource, ...prev])
    }
    setSaving(false)
    setDrawerOpen(false)
  }

  async function toggleLearned(r: AdobeSkillResource) {
    const nextStatus = r.status === 'Learned' ? 'To learn' : 'Learned'
    setResources(prev => prev.map(x => x.id === r.id ? { ...x, status: nextStatus } : x)) // optimistic
    const { error } = await updateAdobeSkillResource(r.id, { status: nextStatus })
    if (error) setErrMsg(error)
  }

  async function removeResource(id: string) {
    if (!confirm('Remove this resource?')) return
    setResources(prev => prev.filter(r => r.id !== id)) // optimistic
    const { error } = await deleteAdobeSkillResource(id)
    if (error) setErrMsg(error)
  }

  const toolCounts: Record<string, number> = {}
  resources.forEach(r => { if (r.status !== 'Learned') toolCounts[r.tool] = (toolCounts[r.tool] ?? 0) + 1 })

  const visible = resources
    .filter(r => showLearned ? r.status === 'Learned' : r.status !== 'Learned')
    .filter(r => toolFilter === 'All' || r.tool === toolFilter)

  const toLearnCount = resources.filter(r => r.status !== 'Learned').length
  const learnedCount = resources.filter(r => r.status === 'Learned').length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(145,97,242,0.08) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Palette size={22} color="#9161f2"/> Adobe Skills
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {toLearnCount} to learn &mdash; {learnedCount} learned
              </p>
            </div>
            <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:'rgba(145,97,242,0.12)', border:'1px solid rgba(145,97,242,0.3)', borderRadius:'0.75rem', color:'#9161f2', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-end' }}>
              <Plus size={14}/> New Resource
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {errMsg && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.amber, margin:0, lineHeight:1.5, flex:1 }}>{errMsg}</p>
            <button onClick={() => setErrMsg(null)} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </div>
        )}

        {/* To-learn / Learned toggle */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem' }}>
          <button onClick={() => setShowLearned(false)} style={{ padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(!showLearned ? '#9161f2' : C.border), background:!showLearned ? 'rgba(145,97,242,0.12)' : 'transparent', color:!showLearned ? '#9161f2' : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
            To Learn {toLearnCount > 0 && <span style={{ opacity:0.7 }}>({toLearnCount})</span>}
          </button>
          <button onClick={() => setShowLearned(true)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(showLearned ? C.green : C.border), background:showLearned ? 'rgba(0,255,136,0.08)' : 'transparent', color:showLearned ? C.green : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
            Learned {learnedCount > 0 && <span style={{ opacity:0.7 }}>({learnedCount})</span>}
          </button>
        </div>

        {/* Tool filter pills */}
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const, marginBottom:'1.75rem' }}>
          {(['All', ...ADOBE_TOOLS] as const).map(t => {
            const active = toolFilter === t
            const meta = t !== 'All' ? TOOL_META[t] : null
            const count = t === 'All' ? (showLearned ? learnedCount : toLearnCount) : (showLearned ? resources.filter(r => r.status === 'Learned' && r.tool === t).length : (toolCounts[t] ?? 0))
            return (
              <button key={t} onClick={() => setToolFilter(t)} style={{
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.72rem', fontWeight:700,
                background: active ? (meta?.color ?? C.purple) + '18' : C.card,
                border: '1px solid ' + (active ? (meta?.color ?? C.purple) + '50' : C.border),
                color: active ? (meta?.color ?? C.purple) : C.sec,
                transition:'all 0.15s',
              }}>
                {meta?.emoji} {t} <span style={{ opacity:0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            {resources.length === 0 ? (
              <>
                <p style={{ fontSize:'1rem', color:C.sec, marginBottom:'0.5rem', fontWeight:700 }}>No resources yet</p>
                <p style={{ fontSize:'0.8rem', marginBottom:'1rem' }}>Save a website or YouTube video that teaches you something in Premiere Pro, After Effects, or Illustrator.</p>
                <button onClick={openNew} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,#9161f2,#7c3aed)', border:'none', borderRadius:'0.875rem', color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}>
                  <Plus size={16}/> Add First Resource
                </button>
              </>
            ) : (
              <p>Nothing here yet.</p>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.75rem' }}>
            {visible.map(r => {
              const meta = TOOL_META[r.tool]
              const kind = resourceKind(r.url)
              const learned = r.status === 'Learned'
              return (
                <div key={r.id} style={{ background:C.card, border:'1px solid '+(learned ? 'rgba(0,255,136,0.25)' : C.border), borderRadius:'1rem', padding:'1rem', opacity: learned ? 0.75 : 1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.6rem', flexWrap:'wrap' as const }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.05em', color:meta.color, background:meta.color+'18', border:'1px solid '+meta.color+'40', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>
                      {meta.emoji} {r.tool}
                    </span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>
                      {kind === 'YouTube' ? <Youtube size={10}/> : <Globe size={10}/>} {kind}
                    </span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color:C.cyan, display:'flex', marginLeft:'auto' }}>
                      <ExternalLink size={12}/>
                    </a>
                  </div>

                  <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.4rem', lineHeight:1.35, textDecoration: learned ? 'line-through' : 'none' }}>{r.title}</h3>

                  {r.description && (
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.75rem', lineHeight:1.5 }}>{r.description}</p>
                  )}

                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' as const }}>
                    <button onClick={() => toggleLearned(r)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.75rem', background: learned ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)', border:'1px solid '+(learned ? 'rgba(0,255,136,0.3)' : C.border), borderRadius:'0.5rem', color: learned ? C.green : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                      {learned ? <CheckCircle2 size={12}/> : <Circle size={12}/>} {learned ? 'Learned' : 'Mark learned'}
                    </button>
                    <button onClick={() => openEdit(r)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.6rem', background:'rgba(145,97,242,0.08)', border:'1px solid rgba(145,97,242,0.25)', borderRadius:'0.5rem', color:'#9161f2', cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                      <Edit3 size={11}/>
                    </button>
                    <button onClick={() => removeResource(r.id)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.6rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'0.5rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, marginLeft:'auto' }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {drawerOpen && (
        <ResourceDrawer
          draft={draft}
          setDraft={setDraft}
          onSave={saveDrawer}
          onClose={() => setDrawerOpen(false)}
          saving={saving}
        />
      )}

      <style>{`
        input:focus, select:focus, textarea:focus { border-color: #9161f2 !important; }
        button:hover { opacity:0.85; }
        select { appearance:none; }
        textarea { font-family:inherit; }
      `}</style>
    </main>
  )
}
