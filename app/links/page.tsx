'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Link2, Check, RotateCcw, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

type LinkRow = {
  id: string
  notion_id: string | null
  name: string
  url: string | null
  select_type: string | null
  priority: string | null
  checked: boolean
}

const PRIORITY_ORDER: Record<string, number> = { Important: 0, Medium: 1, 'Long Term': 2 }

function priorityBadge(p: string | null) {
  if (!p) return null
  const cfg: Record<string, { bg: string; color: string }> = {
    Important:   { bg:'rgba(255,68,102,0.12)', color:'#ff4466' },
    Medium:      { bg:'rgba(255,184,0,0.12)',  color:'#ffb800' },
    'Long Term': { bg:'rgba(0,212,255,0.1)',   color:'#00d4ff' },
  }
  const s = cfg[p]
  if (!s) return null
  return (
    <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'9999px', fontSize:'0.62rem', fontWeight:700, background:s.bg, color:s.color, whiteSpace:'nowrap', letterSpacing:'0.04em' }}>
      {p}
    </span>
  )
}

function domainOf(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch { return url.slice(0, 40) }
}

function typeBadge(t: string | null) {
  if (!t) return null
  const isWatch = t === 'Watch'
  return (
    <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'9999px', fontSize:'0.62rem', fontWeight:700, background: isWatch ? 'rgba(139,92,246,0.12)' : 'rgba(0,255,136,0.1)', color: isWatch ? C.purple : C.green, whiteSpace:'nowrap' }}>
      {t}
    </span>
  )
}

function LinkCard({ row, onToggle }: { row: LinkRow; onToggle: (id: string, checked: boolean) => void }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.875rem',
      padding:'0.875rem 1rem',
      background: C.card, border:'1px solid '+C.border,
      borderRadius:'0.875rem', transition:'border-color 0.15s',
    }}>
      {/* Done toggle */}
      <button
        onClick={() => onToggle(row.id, !row.checked)}
        title={row.checked ? 'Mark undone' : 'Mark done'}
        style={{
          flexShrink:0, width:'28px', height:'28px', borderRadius:'50%',
          border:'2px solid '+(row.checked ? C.green : C.border),
          background: row.checked ? 'rgba(0,255,136,0.12)' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', transition:'all 0.15s',
        }}>
        {row.checked && <Check size={13} color={C.green} />}
      </button>

      {/* Title + domain */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.85rem', fontWeight:600, color: row.checked ? C.muted : C.text, margin:'0 0 0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration: row.checked ? 'line-through' : 'none', opacity: row.checked ? 0.6 : 1 }}>
          {row.name}
        </p>
        <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {domainOf(row.url)}
        </p>
      </div>

      {/* Badges */}
      <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexShrink:0 }}>
        {priorityBadge(row.priority)}
        {typeBadge(row.select_type)}
      </div>

      {/* Open link */}
      {row.url && (
        <a href={row.url} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:'28px', height:'28px', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.5rem', color:C.cyan, textDecoration:'none' }}>
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}

type Tab = 'watch' | 'read' | 'done'

export default function LinksPage() {
  const router = useRouter()
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('watch')
  const [showDone, setShowDone] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadLinks()
  }, [])

  async function loadLinks() {
    setLoading(true)
    const { data } = await supabase
      .from('workspace_links')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
    setLinks((data ?? []) as LinkRow[])
    setLoading(false)
  }

  async function toggleChecked(id: string, checked: boolean) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, checked } : l))
    await supabase.from('workspace_links').update({ checked }).eq('id', id)
  }

  async function resetDone() {
    const doneIds = links.filter(l => l.checked).map(l => l.id)
    if (!doneIds.length) return
    setLinks(prev => prev.map(l => ({ ...l, checked: false })))
    await supabase.from('workspace_links').update({ checked: false }).in('id', doneIds)
  }

  const active = links.filter(l => !l.checked)
  const done   = links.filter(l =>  l.checked)

  const watchItems = active
    .filter(l => l.select_type === 'Watch' || l.select_type === null)
    .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 99) - (PRIORITY_ORDER[b.priority ?? ''] ?? 99))

  const readItems = active
    .filter(l => l.select_type === 'Read')
    .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 99) - (PRIORITY_ORDER[b.priority ?? ''] ?? 99))

  const tabItems = tab === 'watch' ? watchItems : readItems

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key:'watch', label:'Watch', count: watchItems.length, color: C.purple },
    { key:'read',  label:'Read',  count: readItems.length,  color: C.green  },
  ]

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,212,255,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem' }}>
        <div style={{ maxWidth:'780px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex:1 }} />
          <Link2 size={16} color={C.cyan} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.cyan }}>Links</span>
        </div>
        <div style={{ maxWidth:'780px', margin:'0.75rem auto 0', display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>My Workspace Links</h1>
            <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 0' }}>
              {active.length} to go &bull; {done.length} done
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:'1px solid '+C.border, background:C.surface }}>
        <div style={{ maxWidth:'780px', margin:'0 auto', padding:'0 2rem', display:'flex', gap:'0.25rem' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'0.75rem 1rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.82rem', fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? t.color : C.muted,
              borderBottom: tab === t.key ? '2px solid '+t.color : '2px solid transparent',
              marginBottom:'-1px', transition:'all 0.15s',
              display:'flex', alignItems:'center', gap:'0.4rem',
            }}>
              {t.label}
              <span style={{ fontSize:'0.65rem', background:'rgba(255,255,255,0.06)', padding:'0.1rem 0.4rem', borderRadius:'9999px' }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'780px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:C.muted, fontSize:'0.85rem' }}>
            <div style={{ width:'1rem', height:'1rem', borderRadius:'50%', border:'2px solid '+C.muted, borderTopColor:C.cyan, animation:'spin 0.8s linear infinite' }} />
            Loading...
          </div>
        ) : tabItems.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem 1rem', color:C.muted }}>
            <Link2 size={32} style={{ marginBottom:'0.75rem', opacity:0.3 }} />
            <p style={{ margin:0, fontSize:'0.875rem' }}>No {tab} links pending</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', animation:'fadeInUp 0.3s ease both' }}>
            {tabItems.map(row => (
              <LinkCard key={row.id} row={row} onToggle={toggleChecked} />
            ))}
          </div>
        )}

        {/* Done section */}
        {done.length > 0 && (
          <div style={{ marginTop:'2.5rem' }}>
            <button
              onClick={() => setShowDone(s => !s)}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0 0 0.75rem', marginBottom:showDone ? '0.75rem' : 0 }}>
              <ChevronDown size={14} style={{ transform: showDone ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }} />
              Done ({done.length})
              {done.length > 0 && (
                <button onClick={e => { e.stopPropagation(); resetDone() }} style={{
                  marginLeft:'0.5rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.375rem',
                  color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', padding:'0.1rem 0.4rem',
                  display:'flex', alignItems:'center', gap:'0.2rem',
                }}>
                  <RotateCcw size={10} /> Reset all
                </button>
              )}
            </button>
            {showDone && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', opacity:0.65 }}>
                {done.map(row => (
                  <LinkCard key={row.id} row={row} onToggle={toggleChecked} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
