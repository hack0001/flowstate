'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Search, ExternalLink, X, BookOpen, Wrench, Lightbulb, Film, FileText, Headphones, ShoppingCart, Star } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const CATEGORIES = ['All','Book','Article','Tool / Software','Business Idea','Reference','Movie','Academic','Audiobook / Podcast','Video','Spreadsheet','Buy']

const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  'Book':               { icon: <BookOpen size={13}/>,   color: '#8b5cf6' },
  'Article':            { icon: <FileText size={13}/>,    color: '#00d4ff' },
  'Tool / Software':    { icon: <Wrench size={13}/>,      color: '#00ff88' },
  'Business Idea':      { icon: <Lightbulb size={13}/>,   color: '#ffb800' },
  'Reference':          { icon: <Star size={13}/>,         color: '#4a9eff' },
  'Movie':              { icon: <Film size={13}/>,          color: '#ff4466' },
  'Academic':           { icon: <BookOpen size={13}/>,     color: '#10b981' },
  'Audiobook / Podcast':{ icon: <Headphones size={13}/>,  color: '#f472b6' },
  'Video':              { icon: <Film size={13}/>,          color: '#ff6b35' },
  'Spreadsheet':        { icon: <FileText size={13}/>,     color: '#6b7280' },
  'Buy':                { icon: <ShoppingCart size={13}/>, color: '#ffb800' },
}

type VaultItem = {
  id: string
  notion_id: string | null
  title: string
  category: string | null
  author_source: string | null
  link: string | null
  key_takeaway: string | null
  notes: string | null
  platform: string | null
  tag: string | null
  status: string
  notion_url: string | null
  created_at: string
}

function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return null
  const meta = CAT_META[cat]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:'0.25rem',
      fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
      color: meta?.color ?? C.muted,
      background: (meta?.color ?? '#4a4a6a') + '18',
      border: '1px solid ' + (meta?.color ?? '#4a4a6a') + '40',
      borderRadius:'9999px', padding:'0.15rem 0.5rem',
    }}>
      {meta?.icon}{cat}
    </span>
  )
}

export default function VaultPage() {
  const router = useRouter()
  const [items, setItems] = useState<VaultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('vault_items')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(item => {
    const matchCat = catFilter === 'All' || item.category === catFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.title.toLowerCase().includes(q) ||
      (item.author_source ?? '').toLowerCase().includes(q) ||
      (item.key_takeaway ?? '').toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  // Count per category
  const catCounts: Record<string, number> = {}
  items.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] ?? 0) + 1 })

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#128218; Knowledge Vault
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {items.length} items &mdash; books, articles, tools, ideas
              </p>
            </div>
            <div/>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {/* Search */}
        <div style={{ position:'relative', marginBottom:'1.25rem' }}>
          <Search size={15} color={C.muted} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, author, notes..."
            style={{ width:'100%', padding:'0.65rem 2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'0.88rem', boxSizing:'border-box', outline:'none' }}/>
          {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'0.875rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={14}/></button>}
        </div>

        {/* Category filter pills */}
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1.75rem' }}>
          {CATEGORIES.map(cat => {
            const active = catFilter === cat
            const count = cat === 'All' ? items.length : (catCounts[cat] ?? 0)
            if (cat !== 'All' && count === 0) return null
            const meta = cat !== 'All' ? CAT_META[cat] : null
            return (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.72rem', fontWeight:700,
                background: active ? (meta?.color ?? C.purple) + '18' : C.card,
                border: '1px solid ' + (active ? (meta?.color ?? C.purple) + '50' : C.border),
                color: active ? (meta?.color ?? C.purple) : C.sec,
                transition:'all 0.15s',
              }}>
                {meta?.icon}{cat} <span style={{ opacity:0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Items grid */}
        {loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            <p style={{ fontSize:'1rem', marginBottom:'0.5rem' }}>No items found</p>
            <p style={{ fontSize:'0.8rem' }}>Try syncing from Notion or adjust your filter</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.75rem' }}>
            {filtered.map(item => {
              const isExp = expanded === item.id
              const meta = item.category ? CAT_META[item.category] : null
              return (
                <div key={item.id} onClick={() => setExpanded(isExp ? null : item.id)}
                  style={{
                    background:C.card, border:'1px solid '+(isExp?(meta?.color??C.purple)+'40':C.border),
                    borderRadius:'1rem', padding:'1rem', cursor:'pointer',
                    transition:'all 0.2s ease',
                    boxShadow: isExp ? '0 0 20px '+(meta?.color??C.purple)+'15' : 'none',
                  }}>
                  {/* Category + tag row */}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                    <CategoryBadge cat={item.category}/>
                    {item.tag && (
                      <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>
                    )}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ marginLeft:'auto', color:C.cyan, display:'flex' }}>
                        <ExternalLink size={12}/>
                      </a>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.3rem', lineHeight:1.35 }}>{item.title}</h3>

                  {/* Author */}
                  {item.author_source && (
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.5rem' }}>by {item.author_source}</p>
                  )}

                  {/* Key takeaway preview */}
                  {item.key_takeaway && (
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5,
                      overflow:'hidden', display:'-webkit-box', WebkitLineClamp: isExp?'unset':'2',
                      WebkitBoxOrient:'vertical',
                    }}>
                      {item.key_takeaway}
                    </p>
                  )}

                  {/* Expanded: notes + notion link */}
                  {isExp && item.notes && (
                    <div style={{ marginTop:'0.75rem', padding:'0.75rem', background:C.surface, borderRadius:'0.625rem', border:'1px solid '+C.border }}>
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.25rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Notes</p>
                      <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{item.notes}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        input:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
