'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Lightbulb, Plus, Edit3, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

// Website / app ideas parked for later -- not active projects, just a backlog
// to revisit when there's capacity. Stored in Supabase (site_ideas table).
// This used to live inline (collapsed) at the bottom of the home page, which
// meant it was easy to forget about entirely. It's now its own page, linked
// from the home page's "This week's overview" tile and the top nav bar.
type SiteIdea = {
  id: string
  title: string
  tag: string
  summary: string
  next_step: string
  sort_order: number
  created_at: string
}

type IdeaDraft = {
  id?: string
  title: string
  tag: string
  summary: string
  next_step: string
}

const EMPTY_IDEA_DRAFT: IdeaDraft = { title:'', tag:'Website', summary:'', next_step:'' }

const IDEA_TAGS = ['Website', 'App', 'Content', 'Other']
const IDEA_TAG_COLORS: Record<string, string> = {
  Website: '#00d4ff',
  App: '#8b5cf6',
  Content: '#f97316',
  Other: '#00ff88',
}

export default function IdeasPage() {
  const router = useRouter()

  const [ideas, setIdeas] = useState<SiteIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [ideasErr, setIdeasErr] = useState<string | null>(null)
  const [ideaEditingId, setIdeaEditingId] = useState<string | null>(null)
  const [ideaDraft, setIdeaDraft] = useState<IdeaDraft>(EMPTY_IDEA_DRAFT)
  const [ideaSaving, setIdeaSaving] = useState(false)
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true)
    const { data, error } = await supabase
      .from('site_ideas')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) setIdeasErr(error.message)
    else setIdeasErr(null)
    setIdeas((data ?? []) as SiteIdea[])
    setIdeasLoading(false)
  }, [])

  useEffect(() => { loadIdeas() }, [loadIdeas])

  function openNewIdea() {
    setIdeaDraft(EMPTY_IDEA_DRAFT)
    setIdeaEditingId('new')
  }

  function openEditIdea(idea: SiteIdea) {
    setIdeaDraft({ id: idea.id, title: idea.title, tag: idea.tag, summary: idea.summary, next_step: idea.next_step })
    setIdeaEditingId(idea.id)
  }

  function cancelIdeaEdit() {
    setIdeaEditingId(null)
    setIdeaDraft(EMPTY_IDEA_DRAFT)
  }

  async function saveIdea() {
    if (!ideaDraft.title.trim()) return
    setIdeaSaving(true)
    if (ideaDraft.id) {
      const payload = { title: ideaDraft.title.trim(), tag: ideaDraft.tag, summary: ideaDraft.summary.trim(), next_step: ideaDraft.next_step.trim() }
      const { error } = await supabase.from('site_ideas').update(payload).eq('id', ideaDraft.id)
      if (!error) setIdeas(prev => prev.map(i => i.id === ideaDraft.id ? { ...i, ...payload } : i))
      else setIdeasErr(error.message)
    } else {
      const nextOrder = ideas.length > 0 ? Math.max(...ideas.map(i => i.sort_order)) + 1 : 0
      const { data, error } = await supabase
        .from('site_ideas')
        .insert({ title: ideaDraft.title.trim(), tag: ideaDraft.tag, summary: ideaDraft.summary.trim(), next_step: ideaDraft.next_step.trim(), sort_order: nextOrder })
        .select()
        .single()
      if (!error && data) setIdeas(prev => [...prev, data as SiteIdea])
      else if (error) setIdeasErr(error.message)
    }
    setIdeaSaving(false)
    cancelIdeaEdit()
  }

  async function deleteIdea(id: string) {
    if (!confirm('Remove this idea?')) return
    const { error } = await supabase.from('site_ideas').delete().eq('id', id)
    if (!error) setIdeas(prev => prev.filter(i => i.id !== id))
    else setIdeasErr(error.message)
  }

  const visibleIdeas = filterTag ? ideas.filter(i => i.tag === filterTag) : ideas

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Lightbulb size={22} color={C.purple}/> Website &amp; App Ideas
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {ideasLoading ? 'Loading...' : ideas.length + ' parked for later'}
              </p>
            </div>
            <button onClick={openNewIdea} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.75rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-start' }}>
              <Plus size={14}/> New Idea
            </button>
          </div>

          {/* Tag filter chips */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'1rem' }}>
            <button onClick={() => setFilterTag(null)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background: filterTag===null ? 'rgba(255,255,255,0.07)' : C.card, border:'1px solid '+(filterTag===null ? 'rgba(255,255,255,0.2)' : C.border), color: filterTag===null ? C.text : C.sec }}>
              All ({ideas.length})
            </button>
            {IDEA_TAGS.map(tag => {
              const count = ideas.filter(i => i.tag === tag).length
              const color = IDEA_TAG_COLORS[tag]
              const active = filterTag === tag
              return (
                <button key={tag} onClick={() => setFilterTag(active ? null : tag)} style={{ padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, background: active ? color+'20' : C.card, border:'1px solid '+(active ? color+'60' : C.border), color: active ? color : C.sec }}>
                  {tag} ({count})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem 3rem' }}>
        {ideasErr && (
          <div style={{ marginBottom:'0.75rem', padding:'0.5rem 0.75rem', background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:'0.6rem', color:C.red, fontSize:'0.72rem' }}>
            {ideasErr}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {/* New idea form */}
          {ideaEditingId === 'new' && (
            <div style={{ background:C.card, border:'1px solid '+C.purple+'50', borderRadius:'0.875rem', padding:'1.15rem 1.25rem' }}>
              <div style={{ display:'flex', gap:'0.6rem', marginBottom:'0.6rem', flexWrap:'wrap' }}>
                <input autoFocus value={ideaDraft.title} onChange={e => setIdeaDraft(d => ({ ...d, title: e.target.value }))} placeholder="Idea title"
                  style={{ flex:1, minWidth:'180px', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none' }}/>
                <select value={ideaDraft.tag} onChange={e => setIdeaDraft(d => ({ ...d, tag: e.target.value }))}
                  style={{ padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', cursor:'pointer' }}>
                  {IDEA_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea value={ideaDraft.summary} onChange={e => setIdeaDraft(d => ({ ...d, summary: e.target.value }))} placeholder="Summary — what the idea is"
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box', minHeight:'64px', resize:'vertical' as const, marginBottom:'0.6rem' }}/>
              <textarea value={ideaDraft.next_step} onChange={e => setIdeaDraft(d => ({ ...d, next_step: e.target.value }))} placeholder="Next step — what moves this forward"
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box', minHeight:'64px', resize:'vertical' as const, marginBottom:'0.85rem' }}/>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={saveIdea} disabled={ideaSaving || !ideaDraft.title.trim()} style={{ padding:'0.55rem 1.1rem', background:C.purple, border:'none', borderRadius:'0.5rem', color:'#fff', fontWeight:700, fontSize:'0.8rem', cursor: ideaSaving || !ideaDraft.title.trim() ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: ideaSaving || !ideaDraft.title.trim() ? 0.5 : 1 }}>
                  {ideaSaving ? 'Saving...' : 'Add Idea'}
                </button>
                <button onClick={cancelIdeaEdit} style={{ padding:'0.55rem 1.1rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {ideasLoading ? (
            <p style={{ fontSize:'0.85rem', color:C.muted, margin:0 }}>Loading ideas...</p>
          ) : visibleIdeas.length === 0 && ideaEditingId !== 'new' ? (
            <p style={{ fontSize:'0.85rem', color:C.muted, margin:0 }}>
              {ideas.length === 0 ? 'No ideas parked yet — add one above.' : 'Nothing with this tag.'}
            </p>
          ) : (
            visibleIdeas.map(idea => {
              const color = IDEA_TAG_COLORS[idea.tag] ?? IDEA_TAG_COLORS.Other
              const isEditing = ideaEditingId === idea.id
              return (
                <div key={idea.id} style={{ background:C.card, border:'1px solid '+(isEditing ? color+'50' : C.border), borderRadius:'0.875rem', padding:'1.15rem 1.25rem' }}>
                  {isEditing ? (
                    <>
                      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'0.6rem', flexWrap:'wrap' }}>
                        <input autoFocus value={ideaDraft.title} onChange={e => setIdeaDraft(d => ({ ...d, title: e.target.value }))} placeholder="Idea title"
                          style={{ flex:1, minWidth:'180px', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none' }}/>
                        <select value={ideaDraft.tag} onChange={e => setIdeaDraft(d => ({ ...d, tag: e.target.value }))}
                          style={{ padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', cursor:'pointer' }}>
                          {IDEA_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <textarea value={ideaDraft.summary} onChange={e => setIdeaDraft(d => ({ ...d, summary: e.target.value }))} placeholder="Summary — what the idea is"
                        style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box', minHeight:'64px', resize:'vertical' as const, marginBottom:'0.6rem' }}/>
                      <textarea value={ideaDraft.next_step} onChange={e => setIdeaDraft(d => ({ ...d, next_step: e.target.value }))} placeholder="Next step — what moves this forward"
                        style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box', minHeight:'64px', resize:'vertical' as const, marginBottom:'0.85rem' }}/>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <button onClick={saveIdea} disabled={ideaSaving || !ideaDraft.title.trim()} style={{ padding:'0.55rem 1.1rem', background:color, border:'none', borderRadius:'0.5rem', color:'#000', fontWeight:700, fontSize:'0.8rem', cursor: ideaSaving || !ideaDraft.title.trim() ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: ideaSaving || !ideaDraft.title.trim() ? 0.5 : 1 }}>
                          {ideaSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button onClick={cancelIdeaEdit} style={{ padding:'0.55rem 1.1rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.95rem', fontWeight:800, color:C.text }}>{idea.title}</span>
                        <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const, color, background:color+'18', border:'1px solid '+color+'40', borderRadius:'9999px', padding:'0.12rem 0.5rem' }}>{idea.tag}</span>
                        <div style={{ marginLeft:'auto', display:'flex', gap:'0.35rem' }}>
                          <button onClick={() => openEditIdea(idea)} title="Edit" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.2rem' }}>
                            <Edit3 size={14}/>
                          </button>
                          <button onClick={() => deleteIdea(idea.id)} title="Remove" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.2rem' }}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                      {idea.summary && <p style={{ fontSize:'0.82rem', color:C.sec, margin:'0 0 0.6rem', lineHeight:1.6 }}>{idea.summary}</p>}
                      {idea.next_step && (
                        <div style={{ padding:'0.65rem 0.8rem', background:color+'0d', border:'1px solid '+color+'26', borderRadius:'0.625rem' }}>
                          <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const, color, margin:'0 0 0.3rem' }}>Next step</p>
                          <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>{idea.next_step}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
