'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  green:'#00ff88', purple:'#8b5cf6', red:'#ff4466', amber:'#f59e0b',
  teal:'#14b8a6', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

type Entry = {
  month: string
  num: number
  start: string[]
  stop: string[]
  evergreen: string[]
  deadlines: { label: string; note: string }[]
}

const CALENDAR: Entry[] = [
  {
    month: 'January', num: 1,
    start: ['Spring Break', 'St. Patrick\'s Day', 'International Women\'s Day', 'Easter'],
    stop:  ['Mardi Gras', 'Valentine\'s Day', '100th Day of School', 'Black History Month'],
    evergreen: ['Bachelorettes', 'Mother/Daughter Trips', 'Spring sports', 'Summer cruises'],
    deadlines: [
      { label: 'Valentine\'s Day', note: 'List by Jan 2' },
      { label: 'Mardi Gras', note: 'List by Jan 5' },
      { label: '100th Day of School', note: 'List by Jan 8' },
      { label: 'Black History Month', note: 'List by Jan 11' },
    ],
  },
  {
    month: 'February', num: 2,
    start: ['Autism Awareness', 'Earth Day', 'Cinco de Mayo', 'Teacher Appreciation', 'Nurse Appreciation'],
    stop:  ['Spring Break', 'International Women\'s Day', 'St. Patrick\'s Day', 'Easter'],
    evergreen: ['Camping/outdoors', 'State/country pride', 'Family vacation/travel', 'Medical professions'],
    deadlines: [
      { label: 'Int\'l Women\'s Day', note: 'List by Feb 1' },
      { label: 'St. Patrick\'s Day', note: 'List by Feb 9' },
      { label: 'Easter', note: 'List by Feb 18' },
    ],
  },
  {
    month: 'March', num: 3,
    start: ['Last Day of School', 'Mother\'s Day', 'Graduation (HS/College)', 'Memorial Day'],
    stop:  ['Autism Awareness', 'Cinco de Mayo', 'Earth Day', 'Teacher Appreciation', 'Nurse Appreciation'],
    evergreen: ['Homesteading', 'Hobby farming', 'Teacher professions (grade level + support staff)'],
    deadlines: [
      { label: 'Autism Awareness', note: 'List by Mar 1' },
      { label: 'Earth Day', note: 'List by Mar 11' },
      { label: 'Nurse Appreciation', note: 'List by Mar 19' },
      { label: 'Teacher Appreciation', note: 'List by Mar 25' },
      { label: 'Cinco de Mayo', note: 'List by Mar 28' },
    ],
  },
  {
    month: 'April', num: 4,
    start: ['4th of July', 'Pride Month', 'Juneteenth', 'Summer camp/vacations'],
    stop:  ['Memorial Day', 'Last Day of School', 'Mother\'s Day', 'Graduation (HS/College)', 'Father\'s Day'],
    evergreen: ['Baby Showers', 'Pregnancy Announcement', 'Baby/Child Milestones', 'Social justice/advocacy'],
    deadlines: [
      { label: 'Mother\'s Day', note: 'List by Apr 2' },
      { label: 'Last Day of School / Graduation', note: 'List by Apr 5' },
      { label: 'Memorial Day', note: 'List by Apr 15' },
      { label: 'Father\'s Day', note: 'List by Apr 30' },
    ],
  },
  {
    month: 'May', num: 5,
    start: ['Christmas in July', 'Political/Vote'],
    stop:  ['4th of July', 'Pride Month', 'Juneteenth', 'Summer camp/vacations'],
    evergreen: ['Bachelors/groomsmen', 'Family reunions', 'Summer sports', 'Wedding anniversaries'],
    deadlines: [
      { label: 'Pride Month', note: 'List by May 1' },
      { label: 'Juneteenth', note: 'List by May 6' },
      { label: 'Summer Vacation', note: 'List by May 17' },
      { label: '4th of July', note: 'List by May 29' },
    ],
  },
  {
    month: 'June', num: 6,
    start: ['Back to School', 'Class of 20XX', 'Grandparents Day'],
    stop:  ['Christmas in July', 'Political/Vote'],
    evergreen: ['Bachelors/groomsmen', 'Fall sports', 'Fantasy football'],
    deadlines: [
      { label: 'Christmas in July', note: 'List by Jun 3' },
      { label: 'Political/Vote', note: 'List by Jun 28' },
    ],
  },
  {
    month: 'July', num: 7,
    start: ['Halloween', 'Thanksgiving', 'Christmas', 'World Mental Health Day', 'Banned Book Week'],
    stop:  ['Back to School', 'Class of 20XX', 'Grandparents Day'],
    evergreen: ['Mental health professions', 'Bookish/book lovers'],
    deadlines: [
      { label: 'Back to School', note: 'List by Jul 1' },
      { label: 'Class of 20XX', note: 'List by Jul 25' },
      { label: 'Grandparents Day', note: 'List by Jul 28' },
    ],
  },
  {
    month: 'August', num: 8,
    start: ['Fall designs', 'Midwifery Week', 'Hanukkah', 'Kwanzaa'],
    stop:  ['World Mental Health Day', 'Banned Book Week'],
    evergreen: ['Zodiac/astrology', 'Cancer awareness', 'Sports parents/coaches'],
    deadlines: [
      { label: 'Banned Book Week', note: 'List by Aug 9' },
      { label: 'World Mental Health Day', note: 'List by Aug 14' },
    ],
  },
  {
    month: 'September', num: 9,
    start: ['Winter designs', 'Winter sports', 'Veteran\'s Day'],
    stop:  ['Halloween', 'Thanksgiving', 'Fall designs', 'Midwifery Week'],
    evergreen: ['Faith-based/Christian', 'Pet ownership', 'New/first home owners', 'Sister/cousin trips'],
    deadlines: [
      { label: 'Midwifery Week', note: 'List by Sep 1' },
      { label: 'Halloween', note: 'List by Sep 5' },
      { label: 'Fall Designs', note: 'List by Sep 13' },
      { label: 'Thanksgiving', note: 'List by Sep 23' },
    ],
  },
  {
    month: 'October', num: 10,
    start: ['Christmas + Evergreen designs (continue)'],
    stop:  ['Winter sports', 'Veteran\'s Day'],
    evergreen: ['Winter sports', 'Allied health professions', 'Winter cruises'],
    deadlines: [
      { label: 'Veteran\'s Day', note: 'List by Oct 1' },
      { label: 'Winter Sports', note: 'List by Oct 18' },
    ],
  },
  {
    month: 'November', num: 11,
    start: ['New Years (next year)', 'Martin Luther King Jr Day'],
    stop:  ['Kwanzaa', 'Hanukkah', 'Christmas'],
    evergreen: ['Birthday milestones (30s, 40s, etc)', 'Indoor hobbies (knitting, gaming)'],
    deadlines: [
      { label: 'Hanukkah', note: 'List by Nov 4' },
      { label: 'Kwanzaa', note: 'List by Nov 5' },
      { label: 'Christmas', note: 'List by Nov 22' },
    ],
  },
  {
    month: 'December', num: 12,
    start: ['Valentine\'s Day', 'Mardi Gras', '100th Day of School', 'Black History Month'],
    stop:  ['New Years', 'Martin Luther King Jr Day'],
    evergreen: ['Engagement/bridal', 'Wedding/honeymoon', 'Fitness/wellness'],
    deadlines: [
      { label: 'New Years', note: 'List by Dec 1' },
      { label: 'Martin Luther King Jr Day', note: 'List by Dec 9' },
    ],
  },
]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function currentMonthNum() {
  return new Date().getMonth() + 1
}

export default function NicheCalendarPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<number>(currentMonthNum())

  const entry = CALENDAR.find(e => e.num === selected)!

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>

      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(20,184,166,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit' }}>
            <ArrowLeft size={14}/> Home
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Calendar size={16} color={C.teal}/>
            <span style={{ fontSize:'0.95rem', fontWeight:800, color:C.teal }}>Niche Calendar</span>
          </div>
          <div style={{ width:'60px' }}/>
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'2rem 1.5rem' }}>

        {/* Intro note */}
        <p style={{ fontSize:'0.78rem', color:C.muted, textAlign:'center', marginBottom:'1.75rem', lineHeight:1.6 }}>
          List 6-8 weeks before the event. Dates below are listing deadlines, not event dates.
        </p>

        {/* Month selector */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', justifyContent:'center', marginBottom:'2rem' }}>
          {CALENDAR.map(e => (
            <button
              key={e.num}
              onClick={() => setSelected(e.num)}
              style={{
                padding:'0.4rem 0.85rem',
                borderRadius:'9999px',
                border:'1px solid '+(selected === e.num ? C.teal : C.border),
                background: selected === e.num ? 'rgba(20,184,166,0.12)' : 'transparent',
                color: selected === e.num ? C.teal : C.sec,
                fontFamily:'inherit', fontWeight: selected === e.num ? 700 : 500,
                fontSize:'0.78rem', cursor:'pointer',
                transition:'all 0.15s',
              }}
            >
              {MONTH_NAMES[e.num - 1]}
              {e.num === currentMonthNum() && (
                <span style={{ marginLeft:'0.3rem', fontSize:'0.6rem', color:C.green }}>now</span>
              )}
            </button>
          ))}
        </div>

        {/* Month card */}
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', overflow:'hidden', animation:'fadeIn 0.25s ease both' }}>

          {/* Month header */}
          <div style={{ padding:'1.25rem 1.75rem', borderBottom:'1px solid '+C.border, background:'rgba(20,184,166,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, letterSpacing:'-0.02em' }}>{entry.month}</h2>
            <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>2024 / recurring</span>
          </div>

          {/* Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>

            {/* START */}
            <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border, borderBottom:'1px solid '+C.border }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.green }}/>
                <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.green }}>Start listing</span>
              </div>
              <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                {entry.start.map((s, i) => (
                  <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.start.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* STOP */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>Wind down</span>
              </div>
              <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                {entry.stop.map((s, i) => (
                  <li key={i} style={{ fontSize:'0.82rem', color:C.text, padding:'0.25rem 0', borderBottom: i < entry.stop.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* EVERGREEN */}
            <div style={{ padding:'1.25rem 1.5rem', borderRight:'1px solid '+C.border }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.85rem' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.teal }}/>
                <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.teal }}>Evergreen ideas</span>
              </div>
              <ul style={{ margin:0, padding:0, listStyle:'none' }}>
                {entry.evergreen.map((s, i) => (
                  <li key={i} style={{ fontSize:'0.82rem', color:C.sec, padding:'0.25rem 0', borderBottom: i < entry.evergreen.length-1 ? '1px solid '+C.border : 'none', lineHeight:1.4 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* DEADLINES */}
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
                {CALENDAR.map((e, idx) => (
                  <tr
                    key={e.num}
                    onClick={() => setSelected(e.num)}
                    style={{
                      background: selected === e.num ? 'rgba(20,184,166,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      borderLeft: selected === e.num ? '2px solid '+C.teal : '2px solid transparent',
                      cursor:'pointer',
                      transition:'background 0.15s',
                    }}
                  >
                    <td style={{ padding:'0.65rem 1rem', borderBottom:'1px solid '+C.border, fontWeight:700, color: selected === e.num ? C.teal : C.text, whiteSpace:'nowrap' }}>
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

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        tr:hover { background: rgba(20,184,166,0.04) !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
