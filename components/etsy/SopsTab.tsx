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
export function SopsTab({ activeTab }: { activeTab: Tab }) {
  if (!(activeTab === 'sops')) return null
  return (
    <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:'0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1rem' }}>&#128722;</span>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }}>TopNotchThreadz operating procedures. Open the relevant accordion when you need it.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {SOPS.map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>
          </div>
  )
}
