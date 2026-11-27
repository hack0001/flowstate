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
export function NotesTab({ activeTab, search, setSearch, lnk }: { activeTab: Tab; search: string; setSearch: Dispatch<SetStateAction<string>>; lnk: (color: string) => CSSProperties }) {
  if (!(activeTab === 'notes')) return null
  return (
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
  )
}
