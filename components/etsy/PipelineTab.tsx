'use client'
import type { Dispatch, SetStateAction, CSSProperties } from 'react'
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
export function PipelineTab({ activeTab, search, setSearch, pipeFilter, setPipeFilter, lnk }: { activeTab: Tab; search: string; setSearch: Dispatch<SetStateAction<string>>; pipeFilter: string; setPipeFilter: Dispatch<SetStateAction<string>>; lnk: (color: string) => CSSProperties }) {
  if (!(activeTab === 'pipeline')) return null
  return (
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
  )
}
