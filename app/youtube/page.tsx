'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Circle, RotateCcw, Tv, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import { SOPS, type SOP } from '@/lib/sops'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

// ---- Checklists ----
const CREATION_ITEMS = [
  { id:'desc',      label:'Write and publish a proper channel description', note:'Niche, audience, value you provide &mdash; written in the words your audience actually uses' },
  { id:'keywords',  label:'Add 10&ndash;15 channel keywords in YouTube Studio', note:'Settings &rarr; Basic Info &rarr; Keywords' },
  { id:'defaults',  label:'Set up upload defaults in YouTube Studio', note:'Title format, description template, tags and category pre-filled on every upload' },
  { id:'gsc',       label:'Link your channel to Google Search Console', note:'For additional keyword data' },
  { id:'trailer',   label:'Set a channel trailer', note:'Answers one question: why subscribe right now' },
  { id:'about',     label:'Update your About page with links to other platforms', note:'Every platform you are active on' },
  { id:'playlists', label:'Create a playlist structure', note:'Organised by topic and audience intent &mdash; not chronological' },
  { id:'community', label:'Enable and set up Community tab if you have access', note:'Start the conversation with your audience' },
  { id:'comments',  label:'Set comments to open with moderation', note:'Not off &mdash; moderated' },
]

const INITIAL_CREATION = new Set(['desc', 'about', 'community', 'comments'])
const LS_KEY = 'flowstate_yt_creation'

const HEALTH_ITEMS = [
  { id:'avpv',      label:'Check &ldquo;Average views per viewer&rdquo; in YouTube Studio', note:'Advanced Mode &rarr; Metrics. Above 1 means people are watching multiple videos &mdash; your channel universe is working. Below 1 means viewers are not returning. The most important channel health metric.' },
  { id:'peak',      label:'Publish at peak times', note:'YouTube Analytics &rarr; Audience tab &mdash; confirm you are hitting peak active hours and adjust schedule if not' },
  { id:'playlists', label:'Review playlist structure monthly', note:'Add new videos to the right playlists as the catalogue grows' },
  { id:'tags',      label:'Update tags on older videos periodically', note:'Move to more specific long-tail phrases as you learn what your audience searches' },
  { id:'realtime',  label:'Check real-time analytics within 2 hours of every publish', note:'Make it a habit, not an afterthought' },
  { id:'audit',     label:'Audit the channel regularly as a product', note:'Ask: who is this for and why &mdash; not just: what content can I make' },
]

const SHORTS_CHECKLIST = [
  { id:'sh-hook',     label:'First second: text on screen + 2 sounds + circle highlight on subject', note:'The only moment you have to stop the scroll &mdash; miss this and the short fails' },
  { id:'sh-length',   label:'Script is 60&ndash;80 words max', note:'One topic, one punchline, one twist. No padding whatsoever.' },
  { id:'sh-edit',     label:'New visual cut every 2 seconds minimum', note:'No static shots. If it stops moving, they stop watching.' },
  { id:'sh-captions', label:'Full captions burned in for every word', note:'85% of Shorts are watched with sound off &mdash; captions are not optional' },
  { id:'sh-sfx',      label:'Sound effects on key moments (pop, whoosh, ding)', note:'Build a dedicated sound effects folder &mdash; reuse across every short' },
  { id:'sh-loop',     label:'End frame connects back to start (plays on a loop)', note:'A loopable short increases watch time &mdash; first and last frames should match' },
  { id:'sh-cover',    label:'Cover frame is strong before posting', note:'The still frame the algorithm shows before anyone presses play' },
  { id:'sh-watch',    label:'Watch it as a viewer at 1x &mdash; does it hold every second?', note:'If you want to skip, they will swipe. Re-edit that moment.' },
]
const LS_SHORTS = 'flowstate_yt_shorts'

// ---- Production SOPs ----
// SOPS data now lives in lib/sops.ts (shared with the YouTube-Pipeline-driven
// focus session at app/content-focus). Imported above.

// ---- Components ----
function CheckItem({ id, label, note, checked, onToggle }: { id: string; label: string; note: string; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <button onClick={() => onToggle(id)} style={{
      display:'flex', alignItems:'flex-start', gap:'0.875rem',
      width:'100%', padding:'0.875rem 1rem', textAlign:'left',
      background: checked ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.02)',
      border: '1px solid '+(checked ? 'rgba(0,255,136,0.2)' : C.border),
      borderRadius:'0.875rem', cursor:'pointer', fontFamily:'inherit',
      transition:'all 0.15s ease',
    }}>
      <div style={{ flexShrink:0, marginTop:'1px', color: checked ? C.green : C.muted, transition:'color 0.15s' }}>
        {checked ? <CheckCircle size={18} /> : <Circle size={18} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.875rem', fontWeight:600, margin:'0 0 0.2rem', color: checked ? C.green : C.text, transition:'color 0.15s', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.75 : 1 }}
          dangerouslySetInnerHTML={{ __html: label }} />
        <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}
          dangerouslySetInnerHTML={{ __html: note }} />
      </div>
    </button>
  )
}

function SOPCard({ sop }: { sop: SOP }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border:'1px solid '+C.border, borderRadius:'0.875rem', overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'1rem 1.125rem', background:'rgba(255,255,255,0.02)',
        border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left',
      }}>
        <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: sop.icon }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:'0.85rem', fontWeight:700, color:C.text, margin:'0 0 0.1rem' }}>
            <span style={{ color:C.muted, fontSize:'0.65rem', fontWeight:500, marginRight:'0.4rem' }}>SOP {sop.id}</span>
            {sop.title}
          </p>
          {!open && <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sop.tagline}</p>}
        </div>
        <ChevronDown size={16} color={C.muted} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s', flexShrink:0 }} />
      </button>
      {open && (
        <div style={{ padding:'0.25rem 1.125rem 1.125rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.72rem', color:C.cyan, fontStyle:'italic', margin:'0.75rem 0 0.875rem', lineHeight:1.5 }}>{sop.tagline}</p>
          <ol style={{ margin:0, padding:'0 0 0 1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {sop.steps.map((step, i) => (
              <li key={i} style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6 }}
                dangerouslySetInnerHTML={{ __html: step }} />
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default function YouTubePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [creation, setCreation] = useState<Set<string>>(new Set(INITIAL_CREATION))
  const [health, setHealth] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'checklists'|'shorts'|'sops'|'priority'>('checklists')
  const [shorts, setShorts] = useState<Set<string>>(new Set())
  const [priorityOrder, setPriorityOrder] = useState<string[]>([])
  const [ytDragId, setYtDragId] = useState<string|null>(null)
  const [ytDragOver, setYtDragOver] = useState<string|null>(null)
  const [ytDragFrom, setYtDragFrom] = useState<'unassigned'|'priority'|null>(null)

  useEffect(() => {
    // Local cache first
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setCreation(new Set(JSON.parse(raw) as string[]))
      const rs = localStorage.getItem(LS_SHORTS)
      if (rs) setShorts(new Set(JSON.parse(rs) as string[]))
    } catch {}
    // Supabase authoritative fetch
    supabase.from('checklist_state').select('key,state').in('key', ['yt_creation', 'yt_shorts']).then(({ data }) => {
      data?.forEach(row => {
        if (row.key === 'yt_creation' && Array.isArray(row.state)) {
          const s = new Set(row.state as string[])
          setCreation(s)
          try { localStorage.setItem(LS_KEY, JSON.stringify([...s])) } catch {}
        }
        if (row.key === 'yt_shorts' && Array.isArray(row.state)) {
          const s = new Set(row.state as string[])
          setShorts(s)
          try { localStorage.setItem(LS_SHORTS, JSON.stringify([...s])) } catch {}
        }
      })
    })
    let ytPLsLoaded = false
    let ytLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_youtube')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setPriorityOrder(ids); ytPLsLoaded = true; ytLocalIds = ids } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', 'youtube_priority').single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setPriorityOrder(ids)
        try { localStorage.setItem('fs_p_youtube', JSON.stringify(ids)) } catch {}
      } else if (ytPLsLoaded) {
        supabase.from('priority_lists').upsert({ key: 'youtube_priority', ordered_ids: ytLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      } else {
        const allIds = [...CREATION_ITEMS, ...HEALTH_ITEMS, ...SHORTS_CHECKLIST].map(it => it.id)
        setPriorityOrder(allIds)
        try { localStorage.setItem('fs_p_youtube', JSON.stringify(allIds)) } catch {}
        supabase.from('priority_lists').upsert({ key: 'youtube_priority', ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
    setMounted(true)
  }, [])

  const ALL_YT_ITEMS = [...CREATION_ITEMS, ...HEALTH_ITEMS, ...SHORTS_CHECKLIST]

  function saveYtPriority(order: string[]) {
    const y = window.scrollY
    setPriorityOrder(order)
    try { localStorage.setItem('fs_p_youtube', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: 'youtube_priority', ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  function toggleCreation(id: string) {
    setCreation(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      const arr = [...next]
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr)) } catch {}
      supabase.from('checklist_state').upsert({ key: 'yt_creation', state: arr, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      return next
    })
  }

  function toggleHealth(id: string) {
    setHealth(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleShorts(id: string) {
    setShorts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      const arr = [...next]
      try { localStorage.setItem(LS_SHORTS, JSON.stringify(arr)) } catch {}
      supabase.from('checklist_state').upsert({ key: 'yt_shorts', state: arr, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      return next
    })
  }

  const creationPct = Math.round(creation.size / CREATION_ITEMS.length * 100)
  const healthPct   = Math.round(health.size / HEALTH_ITEMS.length * 100)

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,212,255,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem 0' }}>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem', paddingBottom:'0.75rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            <ArrowLeft size={16} /> {t('back')}
          </button>
          <div style={{ flex:1 }} />
          <Tv size={18} color={C.red} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>YouTube</span>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>{t('channelHub')}</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 1rem' }}>{t('checklists')} &amp; {t('productionSOPs')}</p>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', gap:'0.25rem', overflowX:'auto' }}>
          {(['checklists','shorts','sops','priority'] as const).map(tab => {
            const tabCol = tab === 'sops' ? C.amber : tab === 'shorts' ? C.green : tab === 'priority' ? '#ff6b35' : C.red
            const ytActiveItems = ALL_YT_ITEMS.filter(it => !creation.has(it.id) && !health.has(it.id) && !shorts.has(it.id))
            const ytValidOrder = priorityOrder.filter(id => ytActiveItems.some(it => it.id === id))
            const ytUnassignedCount = ytActiveItems.filter(it => !ytValidOrder.includes(it.id)).length
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding:'0.7rem 1.25rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.82rem', fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? tabCol : C.muted,
                borderBottom: activeTab === tab ? '2px solid '+tabCol : '2px solid transparent',
                marginBottom:'-1px', transition:'all 0.15s', textTransform:'capitalize',
                display:'flex', alignItems:'center', gap:'0.25rem', whiteSpace:'nowrap', flexShrink:0,
              }}>
                {tab === 'sops' ? t('productionSOPs') : tab === 'shorts' ? 'Shorts SOP' : tab === 'priority' ? 'Priority' : t('checklists')}
                {tab === 'priority' && ytUnassignedCount > 0 && (
                  <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{ytUnassignedCount}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>

        {activeTab === 'checklists' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'2rem', animation:'fadeInUp 0.3s ease both' }}>

            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Channel Creation</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>One-time setup checklist</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontSize:'1.3rem', fontWeight:900, color: creationPct === 100 ? C.green : C.amber }}>{creationPct}%</span>
                  <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{creation.size}/{CREATION_ITEMS.length}</p>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background: creationPct === 100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.amber+',#cc8800)', width:creationPct+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {CREATION_ITEMS.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={creation.has(item.id)} onToggle={toggleCreation} />
                ))}
              </div>
              {creationPct === 100 && (
                <div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', textAlign:'center' }}>
                  <p style={{ fontSize:'0.85rem', fontWeight:700, color:C.green, margin:0 }}>Channel fully set up &#10003;</p>
                </div>
              )}
            </section>

            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Health Check</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Recurring review &mdash; reset each session</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {health.size > 0 && (
                    <button onClick={() => setHealth(new Set())} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  )}
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'1.3rem', fontWeight:900, color: healthPct === 100 ? C.green : C.cyan }}>{healthPct}%</span>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{health.size}/{HEALTH_ITEMS.length}</p>
                  </div>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background: healthPct === 100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.cyan+',#0099cc)', width:healthPct+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {HEALTH_ITEMS.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={health.has(item.id)} onToggle={toggleHealth} />
                ))}
              </div>
              <div style={{ marginTop:'1.5rem', padding:'0.875rem 1rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.purple, margin:'0 0 0.3rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Tip</p>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.55 }}>Run the health check once a month after reviewing your analytics. It should take under 20 minutes.</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shorts' && (
          <div style={{ animation:'fadeInUp 0.3s ease both', display:'flex', flexDirection:'column', gap:'2rem' }}>

            {/* Brand Setup */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Brand Setup &mdash; Do This First</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Before your first Short goes live</p>
              </div>
              <div style={{ padding:'0.75rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem', marginBottom:'0.625rem' }}>
                <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>Shorts move through the same Content Pipeline stages and the same numbered SOPs (01&ndash;10) on the Production SOPs tab as long-form &mdash; the sections below are the Short-specific swaps at Scripting, Editing and Thumbnail &amp; SEO, not a separate process.</p>
              </div>
              <div style={{ padding:'0.875rem 1rem', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'0.875rem', marginBottom:'0.625rem' }}>
                <p style={{ fontSize:'0.78rem', color:C.green, fontWeight:700, margin:'0 0 0.5rem' }}>Treat the channel as a brand from day one.</p>
                <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.6 }}>Decide your fonts, colours, logo, and banner before posting anything. Posting without this means building an audience on a channel that doesn&apos;t look like a real brand &mdash; and it shows.</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {([
                  { icon:'&#127912;', title:'Pick one colour palette and one font pairing &mdash; use them on every Short, every time', note:'Consistency is what makes your content recognisable in the feed before anyone reads your name.' },
                  { icon:'&#128444;', title:'Design a logo and channel banner before uploading anything', note:'Use Midjourney if you are not a designer &mdash; prompt: flat logo, [your niche], minimal, dark background. Export clean PNG.' },
                  { icon:'&#127919;', title:'Lock in your niche before posting &mdash; do not post across multiple topics', note:'Posting randomly across topics is a failure mode regardless of quality. The algorithm needs a clear signal about what your channel is.' },
                  { icon:'&#128196;', title:'Write the channel description and add 10&ndash;15 keywords in YouTube Studio before your first upload', note:'Settings &rarr; Basic Info. Seeds the algorithm with context before it has any watch data to work with.' },
                ] as {icon:string;title:string;note:string}[]).map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.875rem', padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <span style={{ fontSize:'1.1rem', flexShrink:0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
                    <div>
                      <p style={{ fontSize:'0.83rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem' }}>{item.title}</p>
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Upload Timing */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Upload Timing</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>When to post &mdash; the algorithm gate</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                {([
                  { icon:'&#128337;', title:'Wait for the previous short to drop below 100 views/hour for 12 hours &mdash; or flatline completely', note:'Uploading too early splits the algorithm&apos;s focus. Let one short die before feeding it another.' },
                  { icon:'&#128198;', title:'New channel: 7 days of watching before your first upload', note:'Seed the algorithm with your niche. Watch competitors and top-performing shorts in your space first.' },
                  { icon:'&#128200;', title:'3&ndash;5 Shorts per week. Do not flood.', note:'Volume is good but flooding the algorithm hurts distribution. Consistency beats bursts.' },
                  { icon:'&#9201;', title:'Expect a test phase then a 7&ndash;30 day flat period before a short goes viral', note:'If it is flat it is not dead. Give it time. Do not delete.' },
                ] as {icon:string;title:string;note:string}[]).map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.875rem', padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <span style={{ fontSize:'1.1rem', flexShrink:0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
                    <div>
                      <p style={{ fontSize:'0.83rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: item.title }} />
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: item.note }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Hook Formula */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>First-Second Formula</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>The hook is everything</p>
              </div>
              <div style={{ padding:'1rem 1.125rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'0.875rem', marginBottom:'0.625rem' }}>
                <p style={{ fontSize:'0.8rem', color:C.cyan, fontWeight:700, margin:'0 0 0.75rem' }}>Within the first second:</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {['Text on screen', '2 sounds (pop + whoosh, or similar)', 'Circle highlight drawn on the subject'].map((s, i) => (
                    <p key={i} style={{ fontSize:'0.8rem', color:C.text, margin:0, display:'flex', gap:'0.5rem' }}>
                      <span style={{ color:C.cyan, fontWeight:700, flexShrink:0 }}>{i+1}.</span> {s}
                    </p>
                  ))}
                </div>
              </div>
              <div style={{ padding:'1rem 1.125rem', background:'rgba(255,184,0,0.04)', border:'1px solid rgba(255,184,0,0.15)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.75rem', fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 0.4rem' }}>Hook Formula</p>
                <p style={{ fontSize:'0.82rem', color:C.text, margin:'0 0 0.3rem' }}>Statement or joke + call to action</p>
                <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>&ldquo;This economist predicted 2008 &mdash; comment below what you think happens next.&rdquo;</p>
              </div>
            </section>

            {/* Pre-Publish Checklist */}
            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Pre-Publish Checklist</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Run before every short goes live</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {shorts.size > 0 && (
                    <button onClick={() => { setShorts(new Set()); try { localStorage.removeItem(LS_SHORTS) } catch {} }} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  )}
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'1.3rem', fontWeight:900, color:C.green }}>{Math.round(shorts.size/SHORTS_CHECKLIST.length*100)}%</span>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{shorts.size}/{SHORTS_CHECKLIST.length}</p>
                  </div>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background:'linear-gradient(90deg,'+C.green+',#00cc6a)', width:Math.round(shorts.size/SHORTS_CHECKLIST.length*100)+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {SHORTS_CHECKLIST.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={shorts.has(item.id)} onToggle={toggleShorts} />
                ))}
              </div>
            </section>

            {/* Metrics */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Reading Your Metrics</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>What the numbers actually mean</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.625rem', marginBottom:'0.625rem' }}>
                {([
                  { metric:'108% view rate', verdict:'Very high', color:C.green, note:'People looping the short. Best algorithm signal possible.' },
                  { metric:'55% swipe-through', verdict:'Very low', color:C.red, note:'Hook failed. More than half left in the first second. Fix the first-second formula.' },
                  { metric:'View rate &gt; 80%', verdict:'Good', color:C.green, note:'Algorithm will push it further. Keep going.' },
                  { metric:'Swipe-through &gt; 30%', verdict:'Problem', color:C.amber, note:'Change the text, sounds, or opening visual before reposting.' },
                ] as {metric:string;verdict:string;color:string;note:string}[]).map((m, i) => (
                  <div key={i} style={{ padding:'0.875rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: m.metric }} />
                    <p style={{ fontSize:'0.9rem', fontWeight:800, color:m.color, margin:'0 0 0.35rem' }}>{m.verdict}</p>
                    <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}>{m.note}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.78rem', fontWeight:600, color:C.text, margin:'0 0 0.3rem' }}>If a short fails:</p>
                <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>Report it to YouTube (3-dot menu &rarr; &ldquo;Report a problem&rdquo;) then repost with a new hook 4 days later.</p>
              </div>
            </section>

            {/* SoundMoney Short Ideas */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>SoundMoney Short Ideas</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Validated formats for your niche</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {([
                  { title:'PETER SCHIFF &mdash; HIS RESPONSE SHOCKED HIM', note:'Named subject + reaction hook. High click pull &mdash; audience already knows the name.' },
                  { title:'WHEN ECONOMISTS GET IT WRONG', note:'Series format &mdash; repeat monthly. Each episode = a new prediction failure. Builds returning viewers.' },
                  { title:'THE STAT THEY DON&rsquo;T WANT YOU TO KNOW', note:'Classic contrarian hook. Works on any economic data point. Infinitely repeatable.' },
                  { title:'WHY [THING] COSTS MORE THAN YOUR HOUSE', note:'Absurd comparison format. High curiosity gap. Endless supply of finance topics.' },
                ] as {title:string;note:string}[]).map((idea, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.875rem', padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <span style={{ fontSize:'0.65rem', fontWeight:900, color:C.cyan, marginTop:'3px', flexShrink:0 }}>{'#'+(i+1)}</span>
                    <div>
                      <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.amber, margin:'0 0 0.2rem', letterSpacing:'0.02em' }} dangerouslySetInnerHTML={{ __html: idea.title }} />
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: idea.note }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {activeTab === 'sops' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.15)', borderRadius:'0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1rem' }}>&#128214;</span>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }}>
                Permanent reference for the finance brand format. SOPs 01&ndash;10 are numbered to match the Content Pipeline stages in order &mdash; open the one matching whatever stage a video is sitting in. You don&apos;t need to re-read this every video.
              </p>
            </div>

            <p style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Setup &mdash; run once</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.5rem' }}>
              {SOPS.filter(s => s.group === 'setup').map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>

            <p style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Per-video production &mdash; run in order, every video</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {SOPS.filter(s => s.group === 'production').map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>
          </div>
        )}

        {activeTab === 'priority' && (() => {
          const ytActiveItems = ALL_YT_ITEMS.filter(it => !creation.has(it.id) && !health.has(it.id) && !shorts.has(it.id))
          const ytValidOrder = priorityOrder.filter(id => ytActiveItems.some(it => it.id === id))
          const ytAssigned = new Set(ytValidOrder)
          const ytUnassigned = ytActiveItems.filter(it => !ytAssigned.has(it.id))
          return (
            <div style={{ animation:'fadeInUp 0.3s ease both' }}>
              {/* Unassigned */}
              <div style={{ marginBottom:'2rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                  {ytUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{ytUnassigned.length}</span>}
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into priority list to rank</p>
                </div>
                {ytUnassigned.length === 0 ? (
                  <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                    <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All tasks assigned</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                    onDragOver={e => { e.preventDefault(); setYtDragOver('unassigned-zone') }}
                    onDrop={e => {
                      e.preventDefault()
                      if (ytDragFrom === 'priority' && ytDragId) saveYtPriority(ytValidOrder.filter(i => i !== ytDragId))
                      setYtDragId(null); setYtDragOver(null); setYtDragFrom(null)
                    }}
                  >
                    {ytUnassigned.map(it => (
                      <div key={it.id} draggable
                        onDragStart={() => { setYtDragId(it.id); setYtDragFrom('unassigned') }}
                        onDragEnd={() => { setYtDragId(null); setYtDragOver(null); setYtDragFrom(null) }}
                        style={{ background:'#1a1a26', border:'1px solid '+(ytDragId===it.id ? '#ff446655' : '#2a2a3a'), borderRadius:'0.75rem', padding:'0.65rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem', cursor:'grab', opacity: ytDragId===it.id ? 0.4 : 1, transition:'all 0.1s' }}>
                        <span style={{ fontSize:'0.8rem', color:'#4a4a6a', userSelect:'none' as const }}>&#9776;</span>
                        <p style={{ fontSize:'0.8rem', fontWeight:600, color:'#f0f0ff', margin:0, flex:1 }} dangerouslySetInnerHTML={{ __html: it.label }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Priority list */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                  <p style={{ fontSize:'0.68rem', color:'#4a4a6a', margin:0 }}>{ytValidOrder.length} tasks ranked</p>
                </div>
                {ytValidOrder.length === 0 ? (
                  <div style={{ padding:'2.5rem 1.5rem', textAlign:'center', border:'2px dashed '+(ytDragOver==='priority-empty' ? '#ff6b35' : '#2a2a3a'), borderRadius:'0.875rem', background: ytDragOver==='priority-empty' ? 'rgba(255,107,53,0.05)' : 'transparent', transition:'all 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setYtDragOver('priority-empty') }}
                    onDragLeave={() => setYtDragOver(null)}
                    onDrop={e => { e.preventDefault(); if (ytDragFrom === 'unassigned' && ytDragId) saveYtPriority([ytDragId]); setYtDragId(null); setYtDragOver(null); setYtDragFrom(null) }}>
                    <p style={{ fontSize:'0.78rem', color:'#4a4a6a', margin:0 }}>Drag items here to set priority order</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                    {ytValidOrder.map((id, idx) => {
                      const it = ALL_YT_ITEMS.find(x => x.id === id)
                      if (!it) return null
                      return (
                        <div key={id}>
                          {ytDragOver === id && <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 0.25rem', opacity:0.8 }} />}
                          <div draggable
                            onDragStart={() => { setYtDragId(id); setYtDragFrom('priority') }}
                            onDragEnd={() => { setYtDragId(null); setYtDragOver(null); setYtDragFrom(null) }}
                            onDragOver={e => { e.preventDefault(); setYtDragOver(id) }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && ytDragOver === id) setYtDragOver(null) }}
                            onDrop={e => {
                              e.preventDefault()
                              if (ytDragFrom === 'unassigned' && ytDragId) { const o=[...ytValidOrder]; o.splice(idx,0,ytDragId); saveYtPriority(o) }
                              else if (ytDragFrom === 'priority' && ytDragId && ytDragId !== id) { const w=ytValidOrder.filter(i=>i!==ytDragId); w.splice(w.indexOf(id),0,ytDragId); saveYtPriority(w) }
                              setYtDragId(null); setYtDragOver(null); setYtDragFrom(null)
                            }}
                            style={{ background:'#1a1a26', border:'1px solid '+(ytDragId===id ? '#ff6b3555' : '#2a2a3a'), borderRadius:'0.75rem', padding:'0.65rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem', cursor:'grab', opacity: ytDragId===id ? 0.4 : 1, transition:'all 0.1s' }}>
                            <span style={{ fontSize:'0.65rem', fontWeight:900, color:'#ff6b35', minWidth:'1.4rem', textAlign:'center' as const, flexShrink:0 }}>#{idx+1}</span>
                            <span style={{ fontSize:'0.8rem', color:'#4a4a6a', userSelect:'none' as const }}>&#9776;</span>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:'#f0f0ff', margin:0, flex:1 }} dangerouslySetInnerHTML={{ __html: it.label }} />
                            <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveYtPriority([id, ...ytValidOrder.filter(i=>i!==id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                            <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveYtPriority([...ytValidOrder.filter(i=>i!==id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                            <button onClick={e => { e.stopPropagation(); saveYtPriority(ytValidOrder.filter(i=>i!==id)) }} style={{ background:'none', border:'none', color:'#4a4a6a', cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}>x</button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ height:'2.75rem', border:'2px dashed '+(ytDragOver==='yt-bottom' ? '#ff6b35' : '#2a2a3a'), borderRadius:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', background: ytDragOver==='yt-bottom' ? 'rgba(255,107,53,0.05)' : 'transparent' }}
                      onDragOver={e => { e.preventDefault(); setYtDragOver('yt-bottom') }}
                      onDragLeave={() => { if (ytDragOver === 'yt-bottom') setYtDragOver(null) }}
                      onDrop={e => {
                        e.preventDefault()
                        if (ytDragFrom === 'unassigned' && ytDragId) saveYtPriority([...ytValidOrder, ytDragId])
                        else if (ytDragFrom === 'priority' && ytDragId) saveYtPriority([...ytValidOrder.filter(i=>i!==ytDragId), ytDragId])
                        setYtDragId(null); setYtDragOver(null); setYtDragFrom(null)
                      }}>
                      <p style={{ fontSize:'0.67rem', color: ytDragOver==='yt-bottom' ? '#ff6b35' : '#4a4a6a', margin:0 }}>Drop here to add at end</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </main>
  )
}
