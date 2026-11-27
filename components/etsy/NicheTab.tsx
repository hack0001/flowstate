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
export function NicheTab({ activeTab, nicheMonth, setNicheMonth }: { activeTab: Tab; nicheMonth: number; setNicheMonth: Dispatch<SetStateAction<number>> }) {
  if (!(activeTab === 'niche')) return null
  return (
    (() => {
          const entry = NICHE_CALENDAR.find(e => e.num === nicheMonth)!
          return (
            <div style={{ animation:'fadeInUp 0.3s ease both' }}>
              <p style={{ fontSize:'0.78rem', color:C.muted, textAlign:'center', marginBottom:'1.75rem', lineHeight:1.6 }}>
                List 6-8 weeks before the event. Dates below are listing deadlines, not event dates.
              </p>

              {/* Month selector */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', justifyContent:'center', marginBottom:'2rem' }}>
                {NICHE_CALENDAR.map(e => (
                  <button
                    key={e.num}
                    onClick={() => setNicheMonth(e.num)}
                    style={{
                      padding:'0.4rem 0.85rem',
                      borderRadius:'9999px',
                      border:'1px solid '+(nicheMonth === e.num ? C.teal : C.border),
                      background: nicheMonth === e.num ? 'rgba(20,184,166,0.12)' : 'transparent',
                      color: nicheMonth === e.num ? C.teal : C.sec,
                      fontFamily:'inherit', fontWeight: nicheMonth === e.num ? 700 : 500,
                      fontSize:'0.78rem', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                  >
                    {NICHE_MONTH_NAMES[e.num - 1]}
                    {e.num === currentMonthNum() && (
                      <span style={{ marginLeft:'0.3rem', fontSize:'0.6rem', color:C.green }}>now</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Month card */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', overflow:'hidden' }}>
                <div style={{ padding:'1.25rem 1.75rem', borderBottom:'1px solid '+C.border, background:'rgba(20,184,166,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, letterSpacing:'-0.02em' }}>{entry.month}</h2>
                  <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>Recurring</span>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                  <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border, borderBottom:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.green }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.green }}>Start listing</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.start.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.start.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.red }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>Wind down</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.stop.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.stop.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.teal }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.teal }}>Evergreen ideas</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.evergreen.map((s, i) => (
                        <li key={i} style={{ fontSize:'0.82rem', color:C.sec, padding:'0.25rem 0', borderBottom: i < entry.evergreen.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding:'1.25rem 1.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.amber }}/>
                      <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.amber }}>Listing deadlines</span>
                    </div>
                    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                      {entry.deadlines.map((d, i) => (
                        <li key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'0.5rem', padding:'0.25rem 0', borderBottom: i < entry.deadlines.length-1 ? '1px solid '+C.border : 'none' }}>
                          <span style={{ fontSize:'0.82rem', color:C.text, lineHeight:1.4 }}>{d.label}</span>
                          <span style={{ fontSize:'0.7rem', color:C.amber, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{d.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Full year overview table */}
              <div style={{ marginTop:'2.5rem' }}>
                <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:C.sec, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'1rem' }}>Full Year at a Glance</h3>
                <div style={{ border:'1px solid '+C.border, borderRadius:'1rem', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
                    <thead>
                      <tr style={{ background:C.surface }}>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.muted, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Month</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.green, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Start Listing</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.red, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Wind Down</th>
                        <th style={{ padding:'0.7rem 1rem', textAlign:'left', color:C.amber, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontSize:'0.65rem', borderBottom:'1px solid '+C.border }}>Key Deadlines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NICHE_CALENDAR.map((e, idx) => (
                        <tr
                          key={e.num}
                          onClick={() => setNicheMonth(e.num)}
                          style={{
                            background: nicheMonth === e.num ? 'rgba(20,184,166,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            borderLeft: nicheMonth === e.num ? '2px solid '+C.teal : '2px solid transparent',
                            cursor:'pointer',
                            transition:'background 0.15s',
                          }}
                        >
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, fontWeight:700, color: nicheMonth === e.num ? C.teal : C.text, whiteSpace:'nowrap' }}>
                            {e.month.slice(0,3)}
                            {e.num === currentMonthNum() && <span style={{ marginLeft:'0.35rem', fontSize:'0.55rem', color:C.green, fontWeight:700 }}>NOW</span>}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.sec, lineHeight:1.5 }}>
                            {e.start.slice(0,2).join(', ')}{e.start.length > 2 ? ' +'+String(e.start.length-2) : ''}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.sec, lineHeight:1.5 }}>
                            {e.stop.slice(0,2).join(', ')}{e.stop.length > 2 ? ' +'+String(e.stop.length-2) : ''}
                          </td>
                          <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, color:C.amber, lineHeight:1.5 }}>
                            {e.deadlines.map(d => d.note).join(' | ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()
  )
}
