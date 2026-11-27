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
export function FrameworkTab({ activeTab }: { activeTab: Tab }) {
  if (!(activeTab === 'framework')) return null
  return (
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
  )
}
