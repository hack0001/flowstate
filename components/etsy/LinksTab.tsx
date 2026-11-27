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
export function LinksTab({ activeTab, lnk }: { activeTab: Tab; lnk: (color: string) => CSSProperties }) {
  if (!(activeTab === 'links')) return null
  return (
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
  )
}
