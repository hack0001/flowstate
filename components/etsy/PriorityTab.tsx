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
export function PriorityTab({ activeTab, unassignedCount, unassigned, setDragOver, dragFrom, dragId, savePriority, validOrder, setDragId, setDragFrom, getTodoId, dragOver, ACTIVE_TODOS }: { activeTab: Tab; unassignedCount: number; unassigned: EtsyTodo[]; setDragOver: Dispatch<SetStateAction<string | null>>; dragFrom: "priority" | "unassigned" | null; dragId: string | null; savePriority: (order: string[]) => void; validOrder: string[]; setDragId: Dispatch<SetStateAction<string | null>>; setDragFrom: Dispatch<SetStateAction<"priority" | "unassigned" | null>>; getTodoId: (td: { notion_url?: string | undefined; name: string; }) => string; dragOver: string | null; ACTIVE_TODOS: EtsyTodo[] }) {
  if (!(activeTab === 'priority')) return null
  return (
    <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            {/* Unassigned zone */}
            <div style={{ marginBottom:'2rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                {unassignedCount > 0 && (
                  <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{unassignedCount}</span>
                )}
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into the priority list below to rank</p>
              </div>
              {unassigned.length === 0 ? (
                <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                  <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All todos assigned</p>
                </div>
              ) : (
                <div
                  style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                  onDragOver={e => { e.preventDefault(); setDragOver('unassigned-zone') }}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'priority' && dragId) {
                      savePriority(validOrder.filter(id => id !== dragId))
                    }
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  {unassigned.map(td => {
                    const tid = getTodoId(td)
                    return (
                      <div
                        key={tid}
                        draggable
                        onDragStart={() => { setDragId(tid); setDragFrom('unassigned') }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                        style={{
                          background:C.card,
                          border:'1px solid '+(dragId===tid ? C.red+'55' : C.border),
                          borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                          display:'flex', alignItems:'center', gap:'0.625rem',
                          cursor:'grab', opacity: dragId===tid ? 0.4 : 1,
                          transition:'all 0.1s',
                        }}
                      >
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                          {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                        </div>
                        <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                          <Badge label={td.stage} color={stageColor(td.stage)} />
                          <Badge label={td.priority} color={priorityColor(td.priority)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority list */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{validOrder.length} items ranked</p>
              </div>
              {validOrder.length === 0 ? (
                <div
                  style={{
                    padding:'2.5rem 1.5rem', textAlign:'center',
                    border:'2px dashed '+(dragOver==='priority-empty' ? '#ff6b35' : C.border),
                    borderRadius:'0.875rem',
                    background: dragOver==='priority-empty' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    transition:'all 0.15s',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver('priority-empty') }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'unassigned' && dragId) savePriority([dragId])
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  <p style={{ fontSize:'0.78rem', color:C.muted, margin:0 }}>Drag items here to set your priority order</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                  {validOrder.map((id, idx) => {
                    const td = ACTIVE_TODOS.find(t => getTodoId(t) === id)
                    if (!td) return null
                    const isInsertTarget = dragOver === id && dragFrom !== null
                    return (
                      <div key={id}>
                        {isInsertTarget && (
                          <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 0.25rem', opacity:0.8 }} />
                        )}
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOver === id) setDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragFrom === 'unassigned' && dragId) {
                              const newOrder = [...validOrder]
                              newOrder.splice(idx, 0, dragId)
                              savePriority(newOrder)
                            } else if (dragFrom === 'priority' && dragId && dragId !== id) {
                              const without = validOrder.filter(i => i !== dragId)
                              const insertAt = without.indexOf(id)
                              without.splice(insertAt, 0, dragId)
                              savePriority(without)
                            }
                            setDragId(null); setDragOver(null); setDragFrom(null)
                          }}
                          draggable
                          onDragStart={() => { setDragId(id); setDragFrom('priority') }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                          style={{
                            background:C.card,
                            border:'1px solid '+(dragId===id ? '#ff6b3555' : C.border),
                            borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                            display:'flex', alignItems:'center', gap:'0.625rem',
                            cursor:'grab', opacity: dragId===id ? 0.4 : 1,
                            transition:'all 0.1s',
                          }}
                        >
                          <span style={{ fontSize:'0.65rem', fontWeight:900, color:'#ff6b35', minWidth:'1.4rem', textAlign:'center' as const, flexShrink:0 }}>#{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                            {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                          </div>
                          <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                            <Badge label={td.stage} color={stageColor(td.stage)} />
                            <Badge label={td.priority} color={priorityColor(td.priority)} />
                          </div>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([id, ...validOrder.filter(i => i !== id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([...validOrder.filter(i => i !== id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button
                            onClick={e => { e.stopPropagation(); savePriority(validOrder.filter(i => i !== id)) }}
                            style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}
                            title="Remove from priority list"
                          >x</button>
                        </div>
                      </div>
                    )
                  })}
                  {/* Drop zone at bottom */}
                  <div
                    style={{
                      height:'2.75rem',
                      border:'2px dashed '+(dragOver==='priority-bottom' ? '#ff6b35' : C.border),
                      borderRadius:'0.75rem',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                      background: dragOver==='priority-bottom' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver('priority-bottom') }}
                    onDragLeave={() => { if (dragOver === 'priority-bottom') setDragOver(null) }}
                    onDrop={e => {
                      e.preventDefault()
                      if (dragFrom === 'unassigned' && dragId) {
                        savePriority([...validOrder, dragId])
                      } else if (dragFrom === 'priority' && dragId) {
                        savePriority([...validOrder.filter(i => i !== dragId), dragId])
                      }
                      setDragId(null); setDragOver(null); setDragFrom(null)
                    }}
                  >
                    <p style={{ fontSize:'0.67rem', color: dragOver==='priority-bottom' ? '#ff6b35' : C.muted, margin:0, transition:'color 0.15s' }}>Drop here to add at end</p>
                  </div>
                </div>
              )}
            </div>
          </div>
  )
}
