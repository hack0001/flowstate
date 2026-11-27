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
export function ChecklistsTab({ activeTab, t, totalDone, totalItems, resetAll, pct, checked, openSections, toggleSection, toggleCheck }: { activeTab: Tab; t: (key: "checklists" | "notes" | "links" | "priority" | "goals" | "tasks" | "personal" | "youtube" | "etsy" | "calendar" | "projects" | "tracking" | "morning" | "evening" | "focus" | "workflows" | "dashboard" | "back" | "add" | "save" | "cancel" | "done" | "edit" | "delete" | "reset" | "next" | "complete" | "all" | "active" | "archive" | "restore" | "close" | "high" | "medium" | "low" | "name" | "title" | "status" | "goodMorning" | "goodEvening" | "goodNight" | "goodAfternoon" | "today" | "tomorrow" | "todaysFocus" | "morningRoutine" | "eveningRoutine" | "productionSOPs" | "channelHub" | "yourGoals" | "addGoal" | "personalItems" | "addItem" | "kitchenTidy" | "sleepRoutine" | "overallProgress" | "welshTest" | "welshTestSub" | "showWelsh" | "showEnglish" | "translate" | "yourAnswer" | "correct" | "incorrect" | "score" | "skipToSleep" | "continueToSleep" | "quizComplete" | "reminderTitle" | "reminderMemes" | "reminderMewing" | "dismiss") => string; totalDone: number; totalItems: number; resetAll: () => void; pct: number; checked: Record<string, boolean>; openSections: Set<string>; toggleSection: (id: string) => void; toggleCheck: (id: string) => void }) {
  if (!(activeTab === 'checklists')) return null
  return (
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
  )
}
