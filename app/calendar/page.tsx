'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, CalendarDays } from 'lucide-react'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

// Set your Notion calendar URL here
const NOTION_URL = 'https://www.notion.so'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Platform colours for content type dots
const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#FF0000', Twitter: '#1DA1F2', Instagram: '#E1306C',
  LinkedIn: '#0077B5', TikTok: '#69C9D0', Reel: '#833AB4', Short: '#FF4444',
}

// Example events - replace with Notion API data
type CalEvent = { date: string; title: string; platform: string; done: boolean }
const SAMPLE_EVENTS: CalEvent[] = []

export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const year = cur.getFullYear()
  const month = cur.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const isCurMonth = month === today.getMonth() && year === today.getFullYear()

  const eventsForDay = (d: number) => {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return SAMPLE_EVENTS.filter(e => e.date === key)
  }

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : []
  const selectedDateStr = selectedDay ? `${MONTHS[month]} ${selectedDay}, ${year}` : null

  function prev() { setCur(new Date(year, month - 1, 1)) }
  function next() { setCur(new Date(year, month + 1, 1)) }

  // Build calendar grid
  const cells: { day: number; cur: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, cur: false })
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, cur: true })
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, cur: false })

  return (
    <main style={{ minHeight:'100vh', background:C.bg }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2rem', borderBottom:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}>
            <ArrowLeft size={15}/>Home
          </button>
          <span style={{ color:C.border }}>|</span>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <CalendarDays size={16} color={C.cyan}/>
            <span style={{ fontWeight:700, color:C.text }}>Content Calendar</span>
          </div>
        </div>
        <a href={NOTION_URL} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, textDecoration:'none', fontSize:'0.875rem', fontWeight:600 }}
          onMouseOver={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.cyan; el.style.color=C.cyan }}
          onMouseOut={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=C.border; el.style.color=C.sec }}>
          <ExternalLink size={13}/>Open in Notion
        </a>
      </div>

      <div style={{ padding:'2rem', maxWidth:'72rem', margin:'0 auto', display:'flex', gap:'2rem', flexWrap:'wrap' }}>
        {/* Calendar */}
        <div style={{ flex:1, minWidth:'320px' }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
            <button onClick={prev} style={{ padding:'0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', display:'flex' }}><ChevronLeft size={16}/></button>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ fontSize:'1.4rem', fontWeight:800, color:C.text, marginBottom:'0.1rem' }}>{MONTHS[month]}</h2>
              <p style={{ fontSize:'0.8rem', color:C.muted }}>{year}</p>
            </div>
            <button onClick={next} style={{ padding:'0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', display:'flex' }}><ChevronRight size={16}/></button>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0.25rem', marginBottom:'0.5rem' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', color:C.muted, padding:'0.25rem 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0.25rem' }}>
            {cells.map((cell, i) => {
              const events = cell.cur ? eventsForDay(cell.day) : []
              const todayCell = cell.cur && isToday(cell.day)
              const selectedCell = cell.cur && selectedDay === cell.day
              return (
                <button key={i}
                  onClick={() => cell.cur && setSelectedDay(cell.day)}
                  style={{ aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'0.375rem 0.25rem', borderRadius:'0.625rem', border:'1px solid '+(selectedCell ? C.cyan : todayCell ? 'rgba(0,212,255,0.4)' : 'transparent'), background:selectedCell ? 'rgba(0,212,255,0.1)' : todayCell ? 'rgba(0,212,255,0.05)' : 'transparent', cursor:cell.cur ? 'pointer' : 'default', fontFamily:'inherit', transition:'all 0.15s' }}
                  onMouseEnter={e=>{ if(cell.cur && !selectedCell && !todayCell) (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.03)' }}
                  onMouseLeave={e=>{ if(cell.cur && !selectedCell && !todayCell) (e.currentTarget as HTMLButtonElement).style.background='transparent' }}>
                  <span style={{ fontSize:'0.825rem', fontWeight:todayCell?800:400, color:!cell.cur ? C.muted : todayCell ? C.cyan : C.text }}>{cell.day}</span>
                  {events.length > 0 && (
                    <div style={{ display:'flex', gap:'2px', marginTop:'3px', flexWrap:'wrap', justifyContent:'center' }}>
                      {events.slice(0,3).map((ev,j) => (
                        <div key={j} style={{ width:'5px', height:'5px', borderRadius:'50%', background:PLATFORM_COLORS[ev.platform] ?? C.purple }}/>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          {!isCurMonth && (
            <button onClick={() => { setCur(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today.getDate()) }}
              style={{ marginTop:'1rem', padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit' }}>
              Back to today
            </button>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width:'280px', flexShrink:0 }}>
          {/* Selected day */}
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>
              {selectedDateStr ?? 'Select a day'}
            </p>
            {selectedEvents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'1.5rem 0' }}>
                <p style={{ color:C.muted, fontSize:'0.875rem' }}>No content scheduled</p>
                <a href={NOTION_URL} target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', marginTop:'0.75rem', fontSize:'0.75rem', color:C.cyan, textDecoration:'none' }}>
                  Schedule in Notion <ExternalLink size={11}/>
                </a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {selectedEvents.map((ev,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem', background:C.surface, borderRadius:'0.625rem', border:'1px solid '+C.border }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, background:PLATFORM_COLORS[ev.platform] ?? C.purple }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:ev.done ? C.muted : C.text, textDecoration:ev.done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</p>
                      <p style={{ fontSize:'0.7rem', color:C.muted }}>{ev.platform}</p>
                    </div>
                    {ev.done && <span style={{ fontSize:'0.65rem', color:C.green, fontWeight:700 }}>Done</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Upcoming</p>
            {SAMPLE_EVENTS.length === 0 ? (
              <p style={{ color:C.muted, fontSize:'0.8rem', lineHeight:1.6 }}>
                Connect Notion to see your scheduled content here. Click &ldquo;Open in Notion&rdquo; to manage your calendar.
              </p>
            ) : (
              SAMPLE_EVENTS.slice(0,5).map((ev,i) => (
                <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start', marginBottom:'0.625rem' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:PLATFORM_COLORS[ev.platform] ?? C.purple, marginTop:'5px', flexShrink:0 }}/>
                  <div>
                    <p style={{ fontSize:'0.8rem', color:C.text, fontWeight:500 }}>{ev.title}</p>
                    <p style={{ fontSize:'0.7rem', color:C.muted }}>{ev.date} &middot; {ev.platform}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Platform legend */}
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Platforms</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
              {Object.entries(PLATFORM_COLORS).map(([name, color]) => (
                <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.7rem', color:C.sec }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, display:'inline-block' }}/>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
