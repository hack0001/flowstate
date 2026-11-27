'use client'
import type { Dispatch, SetStateAction, CSSProperties } from 'react'
import type { EtsyTodo } from '@/lib/etsy-data'
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

/* props below are the parent page's state/handlers this modal reads */
export function TodosTab({ activeTab, search, setSearch, todoFilter, setTodoFilter, ACTIVE_TODOS, priorityOrder, getTodoId, highlightId }: { activeTab: Tab; search: string; setSearch: Dispatch<SetStateAction<string>>; todoFilter: string; setTodoFilter: Dispatch<SetStateAction<string>>; ACTIVE_TODOS: EtsyTodo[]; priorityOrder: string[]; getTodoId: (td: { notion_url?: string | undefined; name: string; }) => string; highlightId: string | null }) {
  if (!(activeTab === 'todos')) return null
  return (
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
  )
}
