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
import { FrameworkTab } from '@/components/etsy/FrameworkTab'
import { ChecklistsTab } from '@/components/etsy/ChecklistsTab'
import { SopsTab } from '@/components/etsy/SopsTab'
import { PromptsTab } from '@/components/etsy/PromptsTab'
import { NotesTab } from '@/components/etsy/NotesTab'
import { PipelineTab } from '@/components/etsy/PipelineTab'
import { TodosTab } from '@/components/etsy/TodosTab'
import { LinksTab } from '@/components/etsy/LinksTab'
import { BatchTab } from '@/components/etsy/BatchTab'
import { PriorityTab } from '@/components/etsy/PriorityTab'
import { NicheTab } from '@/components/etsy/NicheTab'




























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
        {<FrameworkTab activeTab={activeTab} />}

        {/* Checklists */}
        {<ChecklistsTab activeTab={activeTab} t={t} totalDone={totalDone} totalItems={totalItems} resetAll={resetAll} pct={pct} checked={checked} openSections={openSections} toggleSection={toggleSection} toggleCheck={toggleCheck} />}

        {/* SOPs */}
        {<SopsTab activeTab={activeTab} />}

        {/* Prompts */}
        {<PromptsTab activeTab={activeTab} copiedPrompt={copiedPrompt} copyPrompt={copyPrompt} />}

        {/* Notes */}
        {<NotesTab activeTab={activeTab} search={search} setSearch={setSearch} lnk={lnk} />}

        {/* Pipeline */}
        {<PipelineTab activeTab={activeTab} search={search} setSearch={setSearch} pipeFilter={pipeFilter} setPipeFilter={setPipeFilter} lnk={lnk} />}

        {/* Todos */}
        {<TodosTab activeTab={activeTab} search={search} setSearch={setSearch} todoFilter={todoFilter} setTodoFilter={setTodoFilter} ACTIVE_TODOS={ACTIVE_TODOS} priorityOrder={priorityOrder} getTodoId={getTodoId} highlightId={highlightId} />}

        {/* Links */}
        {<LinksTab activeTab={activeTab} lnk={lnk} />}

        {/* Batch */}
        {<BatchTab activeTab={activeTab} search={search} setSearch={setSearch} />}

        {/* Priority */}
        {<PriorityTab activeTab={activeTab} unassignedCount={unassignedCount} unassigned={unassigned} setDragOver={setDragOver} dragFrom={dragFrom} dragId={dragId} savePriority={savePriority} validOrder={validOrder} setDragId={setDragId} setDragFrom={setDragFrom} getTodoId={getTodoId} dragOver={dragOver} ACTIVE_TODOS={ACTIVE_TODOS} />}

        {/* Niche Calendar */}
        {<NicheTab activeTab={activeTab} nicheMonth={nicheMonth} setNicheMonth={setNicheMonth} />}

      </div>
    </main>
  )
}

export default function EtsyPage() {
  return <Suspense><EtsyPageInner/></Suspense>
}
