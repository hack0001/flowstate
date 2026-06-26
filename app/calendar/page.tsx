'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Sparkles, Sun, Star } from 'lucide-react'
import { NOTION_LINKS } from '@/lib/notion'
import type { NotionTask, NotionEvent, NotionContent } from '@/lib/notion'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800', red:'#ff4444', orange:'#ff8c00', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Label = 'focus' | 'high-priority' | 'important' | 'urgent' | 'habit' | 'admin'
const LABELS: { id: Label; color: string; bg: string }[] = [
  { id:'focus',         color:C.cyan,   bg:'rgba(0,212,255,0.12)' },
  { id:'high-priority', color:C.red,    bg:'rgba(255,68,68,0.12)' },
  { id:'important',     color:C.amber,  bg:'rgba(255,184,0,0.12)' },
  { id:'urgent',        color:C.orange, bg:'rgba(255,140,0,0.12)' },
  { id:'habit',         color:C.green,  bg:'rgba(0,255,136,0.12)' },
  { id:'admin',         color:C.purple, bg:'rgba(139,92,246,0.12)' },
]
const LABEL_MAP: Record<Label,number> = { focus:100,'high-priority':85,important:70,urgent:75,habit:50,admin:30 }

// Map Notion fields -> default FlowState labels
function defaultLabels(item: DayItem): Label[] {
  const out: Label[] = []
  if (item.type==='task') {
    if (item.focus==='Deep Work') out.push('focus')
    if (item.priority==='High') out.push('high-priority')
    if (item.priority==='Medium') out.push('important')
    if (item.category==='Work') out.length===0 && out.push('admin')
  }
  return out
}

type DayItem = (NotionTask | NotionEvent | NotionContent) & { labels?: Label[] }

const TIME_SLOTS: Record<Label, string> = {
  habit: '07:00', focus: '09:00', 'high-priority': '11:00',
  important: '13:30', urgent: '15:00', admin: '16:30',
}
const DURATION: Record<string, number> = {
  '60 min +': 70, '30-60 min': 45, '15-30 min': 25, '< 15 min': 15,
}

function tidyAlgorithm(items: DayItem[]): { item: DayItem; slot: string; dur: number }[] {
  const scored = items.map(item => {
    const lbls = item.labels ?? defaultLabels(item)
    const score = lbls.length ? Math.max(...lbls.map(l => LABEL_MAP[l])) : 40
    const topLabel: Label = lbls.length ? lbls.reduce((a,b) => LABEL_MAP[a]>LABEL_MAP[b]?a:b) : 'admin'
    const dur = item.type==='task' && item.timeCommitment ? (DURATION[item.timeCommitment] ?? 30) : 30
    return { item, score, topLabel, dur }
  }).sort((a,b) => b.score - a.score)

  // Assign slots greedily, no overlap
  const used: { start: number; end: number }[] = []
  const blockStart = (label: Label) => {
    const [h,m] = (TIME_SLOTS[label] ?? '09:00').split(':').map(Number)
    return h*60+m
  }
  return scored.map(({ item, topLabel, dur }) => {
    let start = blockStart(topLabel)
    // Find next free slot
    let safe = false
    while (!safe) {
      safe = !used.some(u => start < u.end && start + dur > u.start)
      if (!safe) start += 15
    }
    used.push({ start, end: start+dur })
    const h = Math.floor(start/60), m = start%60
    const slot = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    return { item, slot, dur }
  }).sort((a,b) => a.slot.localeCompare(b.slot))
}

function LabelPill({ id, active, onClick }: { id: Label; active: boolean; onClick: () => void }) {
  const l = LABELS.find(x=>x.id===id)!
  return (
    <button onClick={onClick} style={{ padding:'0.15rem 0.5rem', borderRadius:'9999px', fontSize:'0.65rem', fontWeight:700, border:'1px solid '+(active?l.color:'transparent'), background:active?l.bg:'transparent', color:active?l.color:C.muted, cursor:'pointer', fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.06em' }}>
      {id}
    </button>
  )
}

function ItemCard({ item, onToggleLabel }: { item: DayItem; onToggleLabel: (id: string, label: Label) => void }) {
  const labels: Label[] = item.labels ?? defaultLabels(item)
  const typeColor = item.type==='task' ? C.cyan : item.type==='event' ? C.amber : C.purple
  const done = item.type==='task' && item.done==='Done'
  return (
    <div style={{ background:C.surface, border:'1px solid '+C.border, borderLeft:'3px solid '+typeColor, borderRadius:'0.75rem', padding:'0.875rem', marginBottom:'0.625rem', opacity:done?0.5:1 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.5rem' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:typeColor }}>{item.type}</span>
          <p style={{ fontWeight:600, fontSize:'0.875rem', color:done?C.muted:C.text, textDecoration:done?'line-through':'none', marginTop:'0.1rem' }}>{item.title}</p>
          {item.type==='task' && <p style={{ fontSize:'0.7rem', color:C.muted, marginTop:'0.15rem' }}>{item.timeCommitment ?? ''} {item.focus ? '| '+item.focus : ''}</p>}
          {item.type==='content' && <p style={{ fontSize:'0.7rem', color:C.muted, marginTop:'0.15rem' }}>{item.status} {item.format ? '| '+item.format : ''}</p>}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, marginLeft:'0.5rem', flexShrink:0 }}><ExternalLink size={12}/></a>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem' }}>
        {LABELS.map(l => (
          <LabelPill key={l.id} id={l.id} active={labels.includes(l.id)} onClick={() => onToggleLabel(item.id, l.id)} />
        ))}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [dayItems, setDayItems] = useState<DayItem[]>([])
  const [content, setContent] = useState<NotionContent[]>([])
  const [labelMap, setLabelMap] = useState<Record<string, Label[]>>({})
  const [loading, setLoading] = useState(false)
  const [noToken, setNoToken] = useState(false)
  const [mode, setMode] = useState<'list'|'tidy'>('list')
  const [tidyResult, setTidyResult] = useState<{ item: DayItem; slot: string; dur: number }[]>([])

  const year = cur.getFullYear()
  const month = cur.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const dateStr = (d: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const isToday = (d: number) => dateStr(d) === today.toISOString().split('T')[0]
  const contentDots = (d: number) => content.filter(c => c.date === dateStr(d))

  // Fetch content for month
  useEffect(() => {
    fetch(`/api/notion/content?year=${year}&month=${month+1}`)
      .then(r => r.json())
      .then(d => { if (d.content) setContent(d.content) })
      .catch(() => {})
  }, [year, month])

  // Fetch day items
  const loadDay = useCallback(async (day: number) => {
    setLoading(true); setMode('list')
    const date = dateStr(day)
    try {
      const r = await fetch(`/api/notion/today?date=${date}`)
      const d = await r.json()
      if (d.error?.includes('NOTION_TOKEN')) { setNoToken(true); setDayItems([]); setLoading(false); return }
      const items: DayItem[] = [
        ...(d.tasks ?? []),
        ...(d.events ?? []),
        ...content.filter(c => c.date === date),
      ].map(item => ({ ...item, labels: labelMap[item.id] }))
      setDayItems(items)
      setNoToken(false)
    } catch { setNoToken(true) }
    setLoading(false)
  }, [content, labelMap, year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDay(selectedDay) }, [selectedDay]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleLabel(id: string, label: Label) {
    setLabelMap(prev => {
      const cur = prev[id] ?? defaultLabels(dayItems.find(i=>i.id===id)!)
      const next = cur.includes(label) ? cur.filter(l=>l!==label) : [...cur, label]
      const updated = { ...prev, [id]: next }
      setDayItems(items => items.map(i => i.id===id ? { ...i, labels: next } : i))
      return updated
    })
  }

  function runTidy() {
    const result = tidyAlgorithm(dayItems)
    setTidyResult(result)
    setMode('tidy')
  }

  // Build calendar grid
  const cells: { day: number; cur: boolean }[] = []
  for (let i=firstDay-1; i>=0; i--) cells.push({ day: daysInPrev-i, cur: false })
  for (let i=1; i<=daysInMonth; i++) cells.push({ day: i, cur: true })
  while (cells.length < 42) cells.push({ day: cells.length-daysInMonth-firstDay+2, cur: false })

  const selDateLabel = `${MONTHS[month]} ${selectedDay}, ${year}`

  return (
    <main style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2rem', borderBottom:'1px solid '+C.border, flexWrap:'wrap', gap:'0.75rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}>
            <ArrowLeft size={15}/>Home
          </button>
          <span style={{ color:C.border }}>|</span>
          <span style={{ fontWeight:800, fontSize:'1rem', color:C.text }}>Content Calendar</span>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => router.push('/morning')}
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.75rem', color:C.amber, cursor:'pointer', fontSize:'0.8rem', fontWeight:700, fontFamily:'inherit' }}>
            <Sun size={13}/>Morning Viz
          </button>
          <a href={NOTION_LINKS.daily} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, textDecoration:'none', fontSize:'0.8rem', fontWeight:600 }}>
            <ExternalLink size={13}/>Open Notion
          </a>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', gap:0, overflow:'hidden', flexWrap:'wrap' }}>
        {/* Left: Calendar */}
        <div style={{ flex:1, minWidth:'320px', padding:'1.5rem', borderRight:'1px solid '+C.border, overflowY:'auto' }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <button onClick={() => setCur(new Date(year, month-1, 1))} style={{ padding:'0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', display:'flex' }}><ChevronLeft size={15}/></button>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ fontSize:'1.3rem', fontWeight:800, color:C.text }}>{MONTHS[month]} {year}</h2>
              <button onClick={() => { setCur(new Date(today.getFullYear(),today.getMonth(),1)); setSelectedDay(today.getDate()) }}
                style={{ fontSize:'0.7rem', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>Today</button>
            </div>
            <button onClick={() => setCur(new Date(year, month+1, 1))} style={{ padding:'0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', display:'flex' }}><ChevronRight size={15}/></button>
          </div>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', color:C.muted, padding:'0.25rem 0' }}>{d}</div>)}
          </div>
          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
            {cells.map((cell, i) => {
              const dots = cell.cur ? contentDots(cell.day) : []
              const todayCell = cell.cur && isToday(cell.day)
              const sel = cell.cur && selectedDay===cell.day
              return (
                <button key={i} onClick={() => cell.cur && setSelectedDay(cell.day)}
                  style={{ aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', paddingTop:'0.375rem', borderRadius:'0.625rem', border:'1px solid '+(sel?C.cyan:todayCell?'rgba(0,212,255,0.3)':'transparent'), background:sel?'rgba(0,212,255,0.1)':todayCell?'rgba(0,212,255,0.04)':'transparent', cursor:cell.cur?'pointer':'default', fontFamily:'inherit' }}>
                  <span style={{ fontSize:'0.8rem', fontWeight:todayCell||sel?700:400, color:!cell.cur?C.muted:todayCell||sel?C.cyan:C.text }}>{cell.day}</span>
                  {dots.length>0 && (
                    <div style={{ display:'flex', gap:'2px', marginTop:'2px', justifyContent:'center' }}>
                      {dots.slice(0,3).map((_,j) => <div key={j} style={{ width:'4px', height:'4px', borderRadius:'50%', background:C.purple }}/>)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ marginTop:'1.5rem', padding:'1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
            <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.625rem' }}>Label Priority</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
              {LABELS.map(l => (
                <div key={l.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:l.color, flexShrink:0 }}/>
                  <span style={{ fontSize:'0.75rem', color:C.sec, textTransform:'capitalize' }}>{l.id}</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.65rem', color:C.muted }}>{LABEL_MAP[l.id]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Day panel */}
        <div style={{ width:'380px', flexShrink:0, display:'flex', flexDirection:'column', borderRight:'1px solid '+C.border }}>
          {/* Day header */}
          <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>{selDateLabel}</p>
              <p style={{ fontSize:'0.875rem', color:C.sec, marginTop:'0.1rem' }}>{dayItems.length} item{dayItems.length!==1?'s':''}</p>
            </div>
            <button onClick={runTidy} disabled={dayItems.length===0}
              style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 1rem', background:'linear-gradient(135deg,'+C.cyan+','+C.purple+')', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:800, fontSize:'0.8rem', cursor:dayItems.length===0?'not-allowed':'pointer', fontFamily:'inherit', opacity:dayItems.length===0?0.4:1 }}>
              <Sparkles size={13}/>Tidy My Day
            </button>
          </div>

          {/* View toggle */}
          {dayItems.length>0 && (
            <div style={{ display:'flex', padding:'0.75rem 1.5rem', gap:'0.375rem', borderBottom:'1px solid '+C.border }}>
              {(['list','tidy'] as const).map(v => (
                <button key={v} onClick={() => setMode(v)}
                  style={{ padding:'0.3rem 0.75rem', borderRadius:'0.5rem', fontSize:'0.75rem', fontWeight:600, border:'1px solid '+(mode===v?C.cyan:C.border), background:mode===v?'rgba(0,212,255,0.1)':'transparent', color:mode===v?C.cyan:C.sec, cursor:'pointer', fontFamily:'inherit' }}>
                  {v==='list'?'All Items':'Organised Day'}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.5rem' }}>
            {loading && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:C.sec, padding:'2rem 0' }}>
                <div style={{ width:'1rem', height:'1rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
                Loading from Notion...
              </div>
            )}
            {!loading && noToken && (
              <div style={{ padding:'1.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem' }}>
                <p style={{ fontWeight:700, color:C.amber, marginBottom:'0.5rem' }}>Notion not connected</p>
                <p style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6, marginBottom:'1rem' }}>
                  Add <code style={{ background:C.surface, padding:'0.1rem 0.3rem', borderRadius:'0.25rem', fontSize:'0.75rem' }}>NOTION_TOKEN</code> to your Vercel environment variables to pull in your tasks and events.
                </p>
                <p style={{ fontSize:'0.75rem', color:C.muted, lineHeight:1.6 }}>
                  1. Go to notion.so/my-integrations{'\n'}
                  2. Create integration, copy token{'\n'}
                  3. Share your Tasks + Events databases with it{'\n'}
                  4. Add to Vercel env vars
                </p>
              </div>
            )}
            {!loading && !noToken && dayItems.length===0 && (
              <div style={{ textAlign:'center', padding:'2.5rem 0', color:C.muted }}>
                <p>No tasks or events for this day.</p>
                <a href={NOTION_LINKS.daily} target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', color:C.cyan, textDecoration:'none', marginTop:'0.5rem' }}>
                  Add in Notion<ExternalLink size={10}/>
                </a>
              </div>
            )}
            {!loading && !noToken && mode==='list' && dayItems.map(item => (
              <ItemCard key={item.id} item={item} onToggleLabel={toggleLabel} />
            ))}
            {!loading && !noToken && mode==='tidy' && tidyResult.length>0 && (
              <div>
                <p style={{ fontSize:'0.7rem', color:C.muted, marginBottom:'1rem', lineHeight:1.5 }}>
                  Organised by priority. Habits first, deep focus in the morning, admin batched at the end.
                </p>
                {tidyResult.map(({ item, slot, dur }, i) => {
                  const labels: Label[] = item.labels ?? defaultLabels(item)
                  const topLabel = labels.length ? labels.reduce((a,b) => LABEL_MAP[a]>LABEL_MAP[b]?a:b) : 'admin'
                  const lStyle = LABELS.find(l=>l.id===topLabel)!
                  return (
                    <div key={i} style={{ display:'flex', gap:'0.75rem', marginBottom:'0.625rem', alignItems:'flex-start' }}>
                      <div style={{ width:'44px', flexShrink:0, textAlign:'right' }}>
                        <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.sec }}>{slot}</span>
                      </div>
                      <div style={{ width:'3px', background:lStyle.color, borderRadius:'2px', flexShrink:0, marginTop:'4px', alignSelf:'stretch' }}/>
                      <div style={{ flex:1, background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', padding:'0.625rem 0.75rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', marginBottom:'0.2rem' }}>
                          <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', color:lStyle.color, background:lStyle.bg, padding:'0.1rem 0.4rem', borderRadius:'9999px' }}>{topLabel}</span>
                          <span style={{ fontSize:'0.65rem', color:C.muted }}>{dur} min</span>
                        </div>
                        <p style={{ fontSize:'0.85rem', fontWeight:600, color:C.text }}>{item.title}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Far right: upcoming content */}
        <div style={{ flex:1, minWidth:'220px', padding:'1.5rem', overflowY:'auto' }}>
          <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'1rem' }}>Scheduled Content</p>
          {content.length===0 && <p style={{ fontSize:'0.8rem', color:C.muted }}>No content scheduled this month.</p>}
          {content.sort((a,b) => (a.date??'').localeCompare(b.date??'')).map(c => (
            <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none', marginBottom:'0.625rem' }}>
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem', cursor:'pointer' }}
                onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.purple}}
                onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                  <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:c.status==='Live'?C.green:c.status==='Scheduled'?C.cyan:c.status==='In Progress'?C.amber:C.muted }}>{c.status}</span>
                  {c.format && <span style={{ fontSize:'0.65rem', color:C.muted }}>{c.format}</span>}
                </div>
                <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, lineHeight:1.3 }}>{c.title}</p>
                {c.date && <p style={{ fontSize:'0.7rem', color:C.muted, marginTop:'0.2rem' }}>{new Date(c.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>}
              </div>
            </a>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
