'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Circle, RotateCcw, Tv } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

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

const HEALTH_ITEMS = [
  { id:'peak',      label:'Publish at peak times', note:'YouTube Analytics &rarr; Audience tab &mdash; confirm you are hitting peak active hours and adjust schedule if not' },
  { id:'playlists', label:'Review playlist structure monthly', note:'Add new videos to the right playlists as the catalogue grows' },
  { id:'tags',      label:'Update tags on older videos periodically', note:'Move to more specific long-tail phrases as you learn what your audience searches' },
  { id:'realtime',  label:'Check real-time analytics within 2 hours of every publish', note:'Make it a habit, not an afterthought' },
  { id:'audit',     label:'Audit the channel regularly as a product', note:'Ask: who is this for and why &mdash; not just: what content can I make' },
]

const LS_KEY = 'flowstate_yt_creation'

function loadCreationState(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {}
  return new Set(INITIAL_CREATION)
}

function CheckItem({
  id, label, note, checked, onToggle, accent,
}: { id: string; label: string; note: string; checked: boolean; onToggle: (id: string) => void; accent: string }) {
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
        {checked
          ? <CheckCircle size={18} />
          : <Circle size={18} />
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{
          fontSize:'0.875rem', fontWeight:600, margin:'0 0 0.2rem',
          color: checked ? C.green : C.text,
          transition:'color 0.15s',
          textDecoration: checked ? 'line-through' : 'none',
          opacity: checked ? 0.75 : 1,
        }} dangerouslySetInnerHTML={{ __html: label }} />
        <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}
          dangerouslySetInnerHTML={{ __html: note }} />
      </div>
    </button>
  )
}

export default function YouTubePage() {
  const router = useRouter()
  const [creation, setCreation] = useState<Set<string>>(new Set(INITIAL_CREATION))
  const [health, setHealth] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCreation(loadCreationState())
    setMounted(true)
  }, [])

  function toggleCreation(id: string) {
    setCreation(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch {}
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

  function resetHealth() { setHealth(new Set()) }

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
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex:1 }} />
          <Tv size={18} color={C.red} />
          <span style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>YouTube</span>
        </div>
        <div style={{ maxWidth:'900px', margin:'0.75rem auto 0' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>Channel Checklists</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 0' }}>Setup guide and recurring health checks</p>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth:'900px', margin:'0 auto', padding:'2rem',
        display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'2rem',
        opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease',
      }}>

        {/* Channel Creation Checklist */}
        <section style={{ animation:'fadeInUp 0.35s ease both' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ fontSize:'1.1rem', fontWeight:800, margin:'0 0 0.2rem', color:C.text }}>Channel Creation</h2>
              <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>One-time setup checklist</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <span style={{ fontSize:'1.4rem', fontWeight:900, color: creationPct === 100 ? C.green : C.amber }}>
                {creationPct}%
              </span>
              <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{creation.size}/{CREATION_ITEMS.length} done</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:'2px', transition:'width 0.4s ease',
              background: creationPct === 100
                ? 'linear-gradient(90deg,'+C.green+',#00cc6a)'
                : 'linear-gradient(90deg,'+C.amber+',#cc8800)',
              width: creationPct+'%',
            }} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {CREATION_ITEMS.map(item => (
              <CheckItem
                key={item.id}
                id={item.id}
                label={item.label}
                note={item.note}
                checked={creation.has(item.id)}
                onToggle={toggleCreation}
                accent={C.green}
              />
            ))}
          </div>

          {creationPct === 100 && (
            <div style={{ marginTop:'1rem', padding:'0.875rem 1rem', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', textAlign:'center' }}>
              <p style={{ fontSize:'0.875rem', fontWeight:700, color:C.green, margin:0 }}>Channel fully set up &#10003;</p>
            </div>
          )}
        </section>

        {/* Channel Health Check */}
        <section style={{ animation:'fadeInUp 0.45s ease both' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ fontSize:'1.1rem', fontWeight:800, margin:'0 0 0.2rem', color:C.text }}>Health Check</h2>
              <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Recurring review reminders</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              {health.size > 0 && (
                <button onClick={resetHealth} style={{
                  display:'flex', alignItems:'center', gap:'0.3rem',
                  background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem',
                  color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem',
                  padding:'0.3rem 0.6rem',
                }}>
                  <RotateCcw size={11} /> Reset
                </button>
              )}
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:'1.4rem', fontWeight:900, color: healthPct === 100 ? C.green : C.cyan }}>
                  {healthPct}%
                </span>
                <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{health.size}/{HEALTH_ITEMS.length} checked</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:'2px', transition:'width 0.4s ease',
              background: healthPct === 100
                ? 'linear-gradient(90deg,'+C.green+',#00cc6a)'
                : 'linear-gradient(90deg,'+C.cyan+',#0099cc)',
              width: healthPct+'%',
            }} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {HEALTH_ITEMS.map(item => (
              <CheckItem
                key={item.id}
                id={item.id}
                label={item.label}
                note={item.note}
                checked={health.has(item.id)}
                onToggle={toggleHealth}
                accent={C.cyan}
              />
            ))}
          </div>

          {healthPct === 100 && (
            <div style={{ marginTop:'1rem', padding:'0.875rem 1rem', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'0.875rem', textAlign:'center' }}>
              <p style={{ fontSize:'0.875rem', fontWeight:700, color:C.cyan, margin:0 }}>All checks done &mdash; reset when you run this again</p>
            </div>
          )}

          {/* Tip */}
          <div style={{ marginTop:'1.5rem', padding:'0.875rem 1rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:'0.875rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.purple, margin:'0 0 0.3rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Tip</p>
            <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.55 }}>
              Run the health check once a month after reviewing your analytics. It should take under 20 minutes.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
