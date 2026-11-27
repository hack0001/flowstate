'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingBag, CheckCircle, Circle, RotateCcw, ChevronDown, ExternalLink, Search, BookOpen } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ETSY_NOTES, SOFTWARE_PIPELINE, ETSY_TODOS, ETSY_LINKS, BATCH_WORKFLOW } from '@/lib/etsy-data'
import { supabase } from '@/lib/supabase'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'

import { C } from '@/lib/theme'
import { Tab, tabColor, NICHE_CALENDAR, NICHE_MONTH_NAMES, currentMonthNum, priorityColor, stageColor, SECTIONS, LS_KEY, SOPS, CHATGPT_PROMPTS, FONTS, PHASE_RULES, TIME_BLOCK_RULES, STRATEGY_RULES, WORKFLOW_PHASES, THIRTY_DAY_PLAN, DESIGN_TYPES, ETSY_PRIORITY_KEY } from '@/lib/etsyPageData'
import { Badge, SearchBar, CheckItem, SOPCard } from '@/components/etsy/EtsyUi'




























function EtsyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { celebrate } = useCelebration()
  const [activeTab, setActiveTab] = useState<Tab>('checklists')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string,boolean>>({})
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['product']))
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [todoFilter, setTodoFilter] = useState('All')
  const [pipeFilter, setPipeFilter] = useState('All')
  const [copiedPrompt, setCopiedPrompt] = useState<string|null>(null)
  const [priorityOrder, setPriorityOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)
  const [dragFrom, setDragFrom] = useState<'unassigned'|'priority'|null>(null)
  const [nicheMonth, setNicheMonth] = useState<number>(currentMonthNum())

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPrompt(text)
      setTimeout(() => setCopiedPrompt(null), 1600)
    }).catch(() => {
      setCopiedPrompt(text)
      setTimeout(() => setCopiedPrompt(null), 1600)
    })
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setChecked(JSON.parse(raw) as Record<string,boolean>)
    } catch {}
    supabase.from('checklist_state').select('state').eq('key', 'etsy_checklists').single().then(({ data }) => {
      if (data?.state && typeof data.state === 'object' && !Array.isArray(data.state)) {
        const s = data.state as Record<string,boolean>
        setChecked(s)
        try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
      }
    })
    let pLsLoaded = false
    let pLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_etsy')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setPriorityOrder(ids); pLsLoaded = true; pLocalIds = ids } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', ETSY_PRIORITY_KEY).single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setPriorityOrder(ids)
        try { localStorage.setItem('fs_p_etsy', JSON.stringify(ids)) } catch {}
      } else if (pLsLoaded) {
        supabase.from('priority_lists').upsert({ key: ETSY_PRIORITY_KEY, ordered_ids: pLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      } else {
        const allIds = ETSY_TODOS.map(td => td.notion_url || td.name)
        setPriorityOrder(allIds)
        try { localStorage.setItem('fs_p_etsy', JSON.stringify(allIds)) } catch {}
        supabase.from('priority_lists').upsert({ key: ETSY_PRIORITY_KEY, ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
    setMounted(true)
  }, [])

  // Deep link from the home page's Top 5 ("...?focus=<id>") — jump to the
  // Todos tab and scroll/highlight that item once it's loaded.
  useEffect(() => {
    const f = searchParams.get('focus')
    if (!f) return
    setHighlightId(f)
    setActiveTab('todos')
  }, [searchParams])

  useEffect(() => {
    if (!highlightId || !mounted) return
    const el = document.getElementById('etsy-todo-row-' + highlightId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlightId(null), 4000)
    return () => clearTimeout(t)
  }, [highlightId, mounted, activeTab])

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      supabase.from('checklist_state').upsert({ key: 'etsy_checklists', state: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      if (next[id]) { sounds.playTaskComplete(); celebrate('task') }
      return next
    })
  }

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function resetAll() {
    setChecked({})
    try { localStorage.removeItem(LS_KEY) } catch {}
    supabase.from('checklist_state').upsert({ key: 'etsy_checklists', state: {}, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
  }

  function savePriority(order: string[]) {
    const y = window.scrollY
    setPriorityOrder(order)
    try { localStorage.setItem('fs_p_etsy', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: ETSY_PRIORITY_KEY, ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  function getTodoId(td: { notion_url?: string; name: string }): string {
    return td.notion_url || td.name
  }

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  const totalDone  = Object.values(checked).filter(Boolean).length
  const pct = Math.round(totalDone / totalItems * 100)

  const ACTIVE_TODOS = ETSY_TODOS.filter(td => td.stage !== 'Completed')
  const validOrder = priorityOrder.filter(id => ACTIVE_TODOS.some(td => getTodoId(td) === id))
  const assignedSet = new Set(validOrder)
  const unassigned = ACTIVE_TODOS.filter(td => !assignedSet.has(getTodoId(td)))
  const unassignedCount = unassigned.length

  const tabs: { key: Tab; label: string }[] = [
    { key:'framework', label:'Framework' },
    { key:'checklists', label: t('checklists') },
    { key:'sops', label: t('productionSOPs') },
    { key:'prompts', label:'Prompts' },
    { key:'notes', label:'Notes' },
    { key:'pipeline', label:'Pipeline' },
    { key:'todos', label:'Todos' },
    { key:'links', label:'Links' },
    { key:'batch', label:'Batch' },
    { key:'niche', label:'Niche Calendar' },
    { key:'priority', label:'Priority' },
  ]

  function lnk(color: string): React.CSSProperties {
    return {
      display:'flex', alignItems:'center', gap:'0.3rem',
      background: color+'14', border:'1px solid '+color+'33',
      borderRadius:'0.45rem', color, textDecoration:'none',
      padding:'0.28rem 0.55rem', fontSize:'0.67rem', fontWeight:700, flexShrink:0,
      whiteSpace:'nowrap',
    }
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(249,115,22,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
        input::placeholder{color:#4a4a6a}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem 0' }}>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem', paddingBottom:'0.75rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            &#8592; {t('back')}
          </button>
          <div style={{ flex:1 }} />
          <button
            onClick={() => router.push('/etsy/knowledge')}
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.blue, cursor:'pointer', padding:'0.35rem 0.75rem', fontSize:'0.75rem', fontWeight:600, fontFamily:'inherit' }}
          >
            <BookOpen size={13} /> Knowledge Base
          </button>
          <ShoppingBag size={18} color={C.orange} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.orange }}>Etsy</span>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>TopNotchThreadz</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 1rem' }}>SOPs, checklists, notes, and data for the Etsy POD shop</p>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', gap:'0', overflowX:'auto' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'0.7rem 1rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight: activeTab===tab.key ? 700 : 500,
              color: activeTab===tab.key ? tabColor[tab.key] : C.muted,
              borderBottom: activeTab===tab.key ? '2px solid '+tabColor[tab.key] : '2px solid transparent',
              marginBottom:'-1px', transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0,
              display:'flex', alignItems:'center', gap:'0.25rem',
            }}>
              {tab.label}
              {tab.key === 'priority' && unassignedCount > 0 && (
                <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>
                  {unassignedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>

        {/* Framework */}
        {activeTab === 'framework' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'1rem', padding:'1.25rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.75rem' }}>
                <span dangerouslySetInnerHTML={{ __html:'&#128204;' }} />
                <h2 style={{ fontSize:'0.75rem', fontWeight:800, color:C.blue, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Phase 1 Rules</h2>
              </div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.3rem' }}>
                {PHASE_RULES.map((rule, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
                    <span style={{ color:C.blue, fontSize:'0.65rem', marginTop:'0.15rem', flexShrink:0 }}>&#8227;</span>
                    <p style={{ fontSize:'0.8rem', color:C.sec, margin:0, lineHeight:1.5 }}>{rule}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1rem' }}>
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'1rem' }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:C.amber, margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Time Block</p>
                {TIME_BLOCK_RULES.map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                    <span style={{ color:C.amber, fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                  </div>
                ))}
              </div>
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'1rem' }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:C.green, margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Strategy</p>
                {STRATEGY_RULES.map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                    <span style={{ color:C.green, fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.75rem' }}>Workflow Phases</p>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem' }}>
              {WORKFLOW_PHASES.map(phase => (
                <div key={phase.num} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'0.875rem 1rem', display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                  <div style={{ width:'2.1rem', height:'2.1rem', borderRadius:'50%', background:phase.color+'18', border:'1.5px solid '+phase.color+'44', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:'0.6rem', fontWeight:800, color:phase.color }}>{phase.num}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:'0 0 0.35rem' }} dangerouslySetInnerHTML={{ __html: phase.title }} />
                    <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' as const }}>
                      {phase.tasks.map((task, ti) => (
                        <span key={ti} style={{ fontSize:'0.65rem', color:C.muted, background:phase.color+'0e', border:'1px solid '+phase.color+'22', borderRadius:'0.3rem', padding:'0.1rem 0.4rem' }}>{task}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'1rem', background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.18)', borderRadius:'0.875rem', padding:'1rem' }}>
              <p style={{ fontSize:'0.72rem', fontWeight:800, color:'#22d3ee', margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Alek 30-Day Launch Plan</p>
              {THIRTY_DAY_PLAN.map((item, i) => (
                <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                  <span style={{ color:'#22d3ee', fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                  <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'0.75rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.6rem' }}>Types of Design</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                {DESIGN_TYPES.map(dt => (
                  <div key={dt.type} style={{ background:C.card, border:'1px solid '+dt.color+'33', borderRadius:'0.875rem', padding:'1rem' }}>
                    <p style={{ fontSize:'0.75rem', fontWeight:800, color:dt.color, margin:'0 0 0.4rem' }}>{dt.type}</p>
                    <p style={{ fontSize:'0.71rem', color:C.muted, margin:0, lineHeight:1.5 }}>{dt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop:'0.75rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.6rem' }}>Font Reference</p>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                {FONTS.map((fg, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.65rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.73rem', fontWeight:700, color:C.text, margin:'0 0 0.18rem' }}>{fg.category}</p>
                      <p style={{ fontSize:'0.7rem', color:C.orange, margin:'0 0 0.18rem', fontStyle:'italic' }}>{fg.fonts.join(', ')}</p>
                      <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{fg.useCase}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Checklists */}
        {activeTab === 'checklists' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                <div>
                  <h2 style={{ fontSize:'0.9rem', fontWeight:800, margin:0 }}>{t('overallProgress')}</h2>
                  <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.2rem 0 0' }}>{totalDone} of {totalItems} items complete</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {totalDone > 0 && (
                    <button onClick={resetAll} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset all
                    </button>
                  )}
                  <span style={{ fontSize:'1.5rem', fontWeight:900, color: pct===100 ? C.green : C.orange }}>{pct}%</span>
                </div>
              </div>
              <div style={{ height:'4px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:pct+'%', borderRadius:'2px', transition:'width 0.4s ease', background: pct===100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.orange+',#ea580c)' }} />
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
              {SECTIONS.map(section => {
                const secDone = section.items.filter(item => checked[item.id]).length
                const secPct  = Math.round(secDone / section.items.length * 100)
                const isOpen  = openSections.has(section.id)
                return (
                  <div key={section.id} style={{ background:C.card, border:'1px solid '+(secPct===100 ? 'rgba(0,255,136,0.25)' : C.border), borderRadius:'0.875rem', overflow:'hidden', transition:'border-color 0.3s' }}>
                    <button onClick={() => toggleSection(section.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem 1.125rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: section.emoji }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'0.85rem', fontWeight:700, color: secPct===100 ? C.green : C.text, margin:0 }}>{section.title}</p>
                        <p style={{ fontSize:'0.65rem', color:C.muted, margin:'0.15rem 0 0' }}>{secDone}/{section.items.length} complete</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <div style={{ width:'48px', height:'3px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:secPct+'%', background: secPct===100 ? C.green : C.orange, borderRadius:'2px', transition:'width 0.3s' }} />
                        </div>
                        <ChevronDown size={15} color={C.muted} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s', flexShrink:0 }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ padding:'0.25rem 1rem 1rem', borderTop:'1px solid '+C.border }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                          {section.items.map(item => (
                            <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={!!checked[item.id]} onToggle={toggleCheck} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SOPs */}
        {activeTab === 'sops' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:'0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1rem' }}>&#128722;</span>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }}>TopNotchThreadz operating procedures. Open the relevant accordion when you need it.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {SOPS.map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>
          </div>
        )}

        {/* Prompts */}
        {activeTab === 'prompts' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.15)', borderRadius:'0.875rem' }}>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                Copy-paste ChatGPT prompts. Click any prompt box to copy it, then paste into ChatGPT. Replace text in [BRACKETS] with your specifics.
              </p>
            </div>
            {CHATGPT_PROMPTS.map((cat, ci) => (
              <div key={ci} style={{ marginBottom:'1.75rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <span dangerouslySetInnerHTML={{ __html: cat.emoji }} />
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#22d3ee', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{cat.category}</h2>
                </div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem' }}>
                  {cat.items.map((item, ii) => (
                    <div key={ii} style={{ background:C.card, border:'1px solid '+(copiedPrompt===item.prompt ? 'rgba(34,211,238,0.35)' : C.border), borderRadius:'0.875rem', overflow:'hidden', transition:'border-color 0.2s' }}>
                      <div style={{ padding:'0.875rem 1rem' }}>
                        <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:'0 0 0.5rem' }}>{item.title}</p>
                        <button
                          onClick={() => copyPrompt(item.prompt)}
                          style={{ width:'100%', textAlign:'left', background: copiedPrompt===item.prompt ? 'rgba(34,211,238,0.1)' : 'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.18)', borderRadius:'0.5rem', padding:'0.6rem 0.75rem', cursor:'pointer', fontFamily:'monospace', fontSize:'0.74rem', color: copiedPrompt===item.prompt ? '#22d3ee' : C.sec, lineHeight:1.65, transition:'all 0.15s', display:'block' }}
                        >
                          {copiedPrompt===item.prompt ? 'Copied to clipboard!' : item.prompt}
                        </button>
                        {item.note && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.4rem 0 0', lineHeight:1.5 }}>{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search notes and study materials..." />
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {ETSY_NOTES.filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.notes.toLowerCase().includes(search.toLowerCase())).length} of {ETSY_NOTES.length} notes
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {ETSY_NOTES
                .filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.notes.toLowerCase().includes(search.toLowerCase()))
                .map((note, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                    <Badge label={note.priority} color={priorityColor(note.priority)} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.name}</p>
                      {note.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.15rem 0 0' }}>{note.notes}</p>}
                    </div>
                    {note.file_url && (
                      <a href={note.file_url} target="_blank" rel="noreferrer" style={lnk(C.purple)}>
                        <ExternalLink size={11} />
                        Open
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Pipeline */}
        {activeTab === 'pipeline' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search tools and software..." />
            <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              {['All','Active','Not Active',''].map(f => {
                const label = f === '' ? 'Misc' : f
                const isAct = pipeFilter === f
                const col = f === 'Active' ? C.green : f === 'Not Active' ? C.red : f === '' ? C.muted : C.orange
                return (
                  <button key={label} onClick={() => setPipeFilter(f)} style={{
                    padding:'0.22rem 0.6rem', borderRadius:'999px',
                    border:'1px solid '+(isAct ? col : C.border),
                    background: isAct ? col+'18' : 'transparent',
                    color: isAct ? col : C.muted,
                    cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {SOFTWARE_PIPELINE
                .filter(tool => !search || tool.name.toLowerCase().includes(search.toLowerCase()) || tool.notes.toLowerCase().includes(search.toLowerCase()))
                .filter(tool => pipeFilter === 'All' || tool.status === pipeFilter)
                .map((tool, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flexShrink:0, minWidth:'4.5rem' }}>
                      <Badge label={tool.status || 'Misc'} color={tool.status === 'Active' ? C.green : tool.status === 'Not Active' ? C.red : C.muted} />
                      {tool.priority === 'High' && <Badge label="High priority" color={C.red} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{tool.name}</p>
                      {tool.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.15rem 0 0', lineHeight:1.5 }}>{tool.notes}</p>}
                    </div>
                    {tool.file_url && (
                      <a href={tool.file_url} target="_blank" rel="noreferrer" style={lnk(C.green)}>
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Todos */}
        {activeTab === 'todos' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search todos..." />
            <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              {['All','Not Started','Started','Ongoing','Completed'].map(f => {
                const isAct = todoFilter === f
                const col = f === 'All' ? C.orange : stageColor(f)
                return (
                  <button key={f} onClick={() => setTodoFilter(f)} style={{
                    padding:'0.22rem 0.6rem', borderRadius:'999px',
                    border:'1px solid '+(isAct ? col : C.border),
                    background: isAct ? col+'18' : 'transparent',
                    color: isAct ? col : C.muted,
                    cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                  }}>
                    {f}
                  </button>
                )
              })}
            </div>
            {(() => {
              // "All" (and the active-stage filters) only ever show
              // active todos, ordered the same way Priority View ranks
              // them -- reorder there and it's reflected here immediately.
              // Completed todos only appear once "Completed" is picked
              // explicitly, same rule as the Tasks page's Done status.
              const base = todoFilter === 'Completed' ? ETSY_TODOS.filter(td => td.stage === 'Completed') : ACTIVE_TODOS
              const ordered = todoFilter === 'Completed' ? base : [...base].sort((a, b) => {
                const ai = priorityOrder.indexOf(getTodoId(a)), bi = priorityOrder.indexOf(getTodoId(b))
                if (ai === -1 && bi === -1) return 0
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })
              const visible = ordered
                .filter(td => !search || td.name.toLowerCase().includes(search.toLowerCase()) || td.notes.toLowerCase().includes(search.toLowerCase()))
                .filter(td => todoFilter === 'All' || todoFilter === 'Completed' || td.stage === todoFilter)
              return (
            <>
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {visible.length} todos
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {visible.map((td, i) => {
                const isHighlighted = highlightId === getTodoId(td)
                return (
                  <div key={i} id={'etsy-todo-row-' + getTodoId(td)} style={{ background:C.card, border:'1px solid '+(isHighlighted ? C.teal : td.stage === 'Completed' ? 'rgba(0,255,136,0.12)' : C.border), borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'flex-start', gap:'0.625rem', boxShadow: isHighlighted ? '0 0 0 3px rgba(0,212,255,0.25)' : 'none' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flexShrink:0, paddingTop:'1px' }}>
                      <Badge label={td.stage} color={stageColor(td.stage)} />
                      <Badge label={td.priority} color={priorityColor(td.priority)} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color: td.stage === 'Completed' ? C.muted : C.text, margin:0, textDecoration: td.stage === 'Completed' ? 'line-through' : 'none', opacity: td.stage === 'Completed' ? 0.7 : 1 }}>{td.name}</p>
                      {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.2rem 0 0', lineHeight:1.5 }}>{td.notes}</p>}
                    </div>
                    {td.target_date && (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.35rem', flexShrink:0 }}>
                        <span style={{ fontSize:'0.62rem', color:C.muted, whiteSpace:'nowrap' }}>{td.target_date}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </>
              )
            })()}
          </div>
        )}

        {/* Links */}
        {activeTab === 'links' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 1rem' }}>{ETSY_LINKS.length} saved links from Notion</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {ETSY_LINKS.map((link, i) => (
                <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.name}</p>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>Saved {link.created}</p>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" style={lnk(C.teal)}>
                    <ExternalLink size={11} /> Open
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch */}
        {activeTab === 'batch' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search ideas, niches, seed keywords..." />
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {BATCH_WORKFLOW.filter(item => !search || item.idea_theme.toLowerCase().includes(search.toLowerCase()) || item.seed_keyword.toLowerCase().includes(search.toLowerCase()) || item.niche.toLowerCase().includes(search.toLowerCase())).length} of {BATCH_WORKFLOW.length} batch items
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {BATCH_WORKFLOW
                .filter(item => !search || item.idea_theme.toLowerCase().includes(search.toLowerCase()) || item.seed_keyword.toLowerCase().includes(search.toLowerCase()) || item.niche.toLowerCase().includes(search.toLowerCase()))
                .map((item, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'flex-start', gap:'0.625rem' }}>
                    <span style={{ fontSize:'0.6rem', color:C.muted, fontWeight:700, minWidth:'1.75rem', flexShrink:0, paddingTop:'2px' }}>#{item.id}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.3rem' }}>{item.idea_theme}</p>
                      <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', alignItems:'center' }}>
                        {item.niche && <Badge label={item.niche} color={C.muted} />}
                        <Badge label={item.batch_priority} color={priorityColor(item.batch_priority)} />
                        {item.batch_stage && <Badge label={item.batch_stage} color={C.pink} />}
                        {item.method && <Badge label={item.method} color={C.teal} />}
                      </div>
                      {item.seed_keyword && (
                        <p style={{ fontSize:'0.67rem', color:C.sec, margin:'0.3rem 0 0' }}>Keyword: {item.seed_keyword}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Priority */}
        {activeTab === 'priority' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            {/* Unassigned zone */}
            <div style={{ marginBottom:'2rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                {unassignedCount > 0 && (
                  <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{unassignedCount}</span>
                )}
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into the priority list below to rank</p>
              </div>
              {unassigned.length === 0 ? (
                <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                  <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All todos assigned</p>
                </div>
              ) : (
                <div
                  style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                  onDragOver={e => { e.preventDefault(); setDragOver('unassigned-zone') }}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'priority' && dragId) {
                      savePriority(validOrder.filter(id => id !== dragId))
                    }
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  {unassigned.map(td => {
                    const tid = getTodoId(td)
                    return (
                      <div
                        key={tid}
                        draggable
                        onDragStart={() => { setDragId(tid); setDragFrom('unassigned') }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                        style={{
                          background:C.card,
                          border:'1px solid '+(dragId===tid ? C.red+'55' : C.border),
                          borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                          display:'flex', alignItems:'center', gap:'0.625rem',
                          cursor:'grab', opacity: dragId===tid ? 0.4 : 1,
                          transition:'all 0.1s',
                        }}
                      >
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                          {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                        </div>
                        <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                          <Badge label={td.stage} color={stageColor(td.stage)} />
                          <Badge label={td.priority} color={priorityColor(td.priority)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority list */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{validOrder.length} items ranked</p>
              </div>
              {validOrder.length === 0 ? (
                <div
                  style={{
                    padding:'2.5rem 1.5rem', textAlign:'center',
                    border:'2px dashed '+(dragOver==='priority-empty' ? '#ff6b35' : C.border),
                    borderRadius:'0.875rem',
                    background: dragOver==='priority-empty' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    transition:'all 0.15s',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver('priority-empty') }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'unassigned' && dragId) savePriority([dragId])
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  <p style={{ fontSize:'0.78rem', color:C.muted, margin:0 }}>Drag items here to set your priority order</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                  {validOrder.map((id, idx) => {
                    const td = ACTIVE_TODOS.find(t => getTodoId(t) === id)
                    if (!td) return null
                    const isInsertTarget = dragOver === id && dragFrom !== null
                    return (
                      <div key={id}>
                        {isInsertTarget && (
                          <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 0.25rem', opacity:0.8 }} />
                        )}
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOver === id) setDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragFrom === 'unassigned' && dragId) {
                              const newOrder = [...validOrder]
                              newOrder.splice(idx, 0, dragId)
                              savePriority(newOrder)
                            } else if (dragFrom === 'priority' && dragId && dragId !== id) {
                              const without = validOrder.filter(i => i !== dragId)
                              const insertAt = without.indexOf(id)
                              without.splice(insertAt, 0, dragId)
                              savePriority(without)
                            }
                            setDragId(null); setDragOver(null); setDragFrom(null)
                          }}
                          draggable
                          onDragStart={() => { setDragId(id); setDragFrom('priority') }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                          style={{
                            background:C.card,
                            border:'1px solid '+(dragId===id ? '#ff6b3555' : C.border),
                            borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                            display:'flex', alignItems:'center', gap:'0.625rem',
                            cursor:'grab', opacity: dragId===id ? 0.4 : 1,
                            transition:'all 0.1s',
                          }}
                        >
                          <span style={{ fontSize:'0.65rem', fontWeight:900, color:'#ff6b35', minWidth:'1.4rem', textAlign:'center' as const, flexShrink:0 }}>#{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                            {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                          </div>
                          <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                            <Badge label={td.stage} color={stageColor(td.stage)} />
                            <Badge label={td.priority} color={priorityColor(td.priority)} />
                          </div>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([id, ...validOrder.filter(i => i !== id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([...validOrder.filter(i => i !== id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button
                            onClick={e => { e.stopPropagation(); savePriority(validOrder.filter(i => i !== id)) }}
                            style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}
                            title="Remove from priority list"
                          >x</button>
                        </div>
                      </div>
                    )
                  })}
                  {/* Drop zone at bottom */}
                  <div
                    style={{
                      height:'2.75rem',
                      border:'2px dashed '+(dragOver==='priority-bottom' ? '#ff6b35' : C.border),
                      borderRadius:'0.75rem',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                      background: dragOver==='priority-bottom' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver('priority-bottom') }}
                    onDragLeave={() => { if (dragOver === 'priority-bottom') setDragOver(null) }}
                    onDrop={e => {
                      e.preventDefault()
                      if (dragFrom === 'unassigned' && dragId) {
                        savePriority([...validOrder, dragId])
                      } else if (dragFrom === 'priority' && dragId) {
                        savePriority([...validOrder.filter(i => i !== dragId), dragId])
                      }
                      setDragId(null); setDragOver(null); setDragFrom(null)
                    }}
                  >
                    <p style={{ fontSize:'0.67rem', color: dragOver==='priority-bottom' ? '#ff6b35' : C.muted, margin:0, transition:'color 0.15s' }}>Drop here to add at end</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Niche Calendar */}
        {activeTab === 'niche' && (() => {
          const entry = NICHE_CALENDAR.find(e => e.num === nicheMonth)!
          return (
            <div style={{ animation:'fadeInUp 0.3s ease both' }}>
              <p style={{ fontSize:'0.78rem', color:C.muted, textAlign:'center', marginBottom:'1.75rem', lineHeight:1.6 }}>
                List 6-8 weeks before the event. Dates below are listing deadlines, not event dates.
              </p>

              {/* Month selector */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', justifyContent:'center', marginBottom:'2rem' }}>
                {NICHE_CALENDAR.map(e => (
                  <button
                    key={e.num}
                    onClick={() => setNicheMonth(e.num)}
                    style={{
                      padding:'0.4rem 0.85rem',
                      borderRadius:'9999px',
                      border:'1px solid '+(nicheMonth === e.num ? C.teal : C.border),
                      background: nicheMonth === e.num ? 'rgba(20,184,166,0.12)' : 'transparent',
                      color: nicheMonth === e.num ? C.teal : C.sec,
                      fontFamily:'inherit', fontWeight: nicheMonth === e.num ? 700 : 500,
                      fontSize:'0.78rem', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                  >
                    {NICHE_MONTH_NAMES[e.num - 1]}
                    {e.num === currentMonthNum() && (
                      <span style={{ marginLeft:'0.3rem', fontSize:'0.6rem', color:C.green }}>now</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Month card */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', overflow:'hidden' }}>
                <div style={{ padding:'1.25rem 1.75rem', borderBottom:'1px solid '+C.border, background:'rgba(20,184,166,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, letterSpacing:'-0.02em' }}>{entry.month}</h2>
                  <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>Recurring</span>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                  <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border, borderBottom:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.green }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.green }}>Start listing</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.start.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.start.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.red }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>Wind down</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.stop.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.stop.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.teal }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.teal }}>Evergreen ideas</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.evergreen.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.sec, padding:'0.25rem 0', borderBottom: i < entry.evergreen.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.amber }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.amber }}>Listing deadlines</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.deadlines.map((d, i) => (
                        <li key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'0.5rem', padding:'0.25rem 0', borderBottom: i < entry.deadlines.length-1 ? '1px solid '+C.border : 'none' }}>
                          <span style={{ fontSize:'0.82rem', color:C.text, lineHeight:1.4 }}>{d.label}</span>
                          <span style={{ fontSize:'0.7rem', color:C.amber, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{d.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Full year overview table */}
              <div style={{ marginTop:'2.5rem' }}>
                <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:C.sec, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'1rem' }}>Full Year at a Glance</h3>
                <div style={{ border:'1px solid '+C.border, borderRadius:'1rem', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
                    <thead>
                      <tr style={{ background:C.surface }}>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.muted, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Month</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.green, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Start Listing</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.red, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Wind Down</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.amber, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Key Deadlines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NICHE_CALENDAR.map((e, idx) => (
                        <tr
                          key={e.num}
                          onClick={() => setNicheMonth(e.num)}
                          style={{
                            background: nicheMonth === e.num ? 'rgba(20,184,166,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            borderLeft: nicheMonth === e.num ? '2px solid '+C.teal : '2px solid transparent',
                            cursor:'pointer',
                            transition:'background 0.15s',
                          }}
                        >
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, fontWeight:700, color: nicheMonth === e.num ? C.teal : C.text, whiteSpace:'nowrap' }}>
                            {e.month.slice(0,3)}
                            {e.num === currentMonthNum() && <span style={{ marginLeft:'0.35rem', fontSize:'0.55rem', color:C.green, fontWeight:700 }}>NOW</span>}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.sec, lineHeight:1.5 }}>
                            {e.start.slice(0,2).join(', ')}{e.start.length > 2 ? ' +'+String(e.start.length-2) : ''}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.sec, lineHeight:1.5 }}>
                            {e.stop.slice(0,2).join(', ')}{e.stop.length > 2 ? ' +'+String(e.stop.length-2) : ''}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.amber, lineHeight:1.5 }}>
                            {e.deadlines.map(d => d.note).join(' | ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

      </div>
    </main>
  )
}

export default function EtsyPage() {
  return <Suspense><EtsyPageInner/></Suspense>
}
