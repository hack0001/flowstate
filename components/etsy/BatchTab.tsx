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
export function BatchTab({ activeTab, search, setSearch }: { activeTab: Tab; search: string; setSearch: Dispatch<SetStateAction<string>> }) {
  if (!(activeTab === 'batch')) return null
  return (
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
  )
}
