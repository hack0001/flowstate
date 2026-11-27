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
export function PromptsTab({ activeTab, copiedPrompt, copyPrompt }: { activeTab: Tab; copiedPrompt: string | null; copyPrompt: (text: string) => void }) {
  if (!(activeTab === 'prompts')) return null
  return (
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
  )
}
