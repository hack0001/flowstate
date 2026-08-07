'use client'
import { useEffect, useState } from 'react'

// Focus World house progression: mud hut -> dream palace (10 stages)
// Grows with cumulative focus minutes today (localStorage key: focus_mins_YYYY-MM-DD)
// Images live in /public/images/focus-world/stage-01.webp .. stage-10.webp
//
// Shared copy of app/workflow/[id]/focus/FoodProgress.tsx, used by the
// YouTube-Pipeline-driven focus session at app/content-focus. Duplicated
// rather than imported cross-route to avoid touching the original working
// file (this codebase's OneDrive sync has previously failed to delete/move
// files cleanly — see lib/sops.ts for the same reasoning applied to SOPS).

const STAGES = [
  { mins: 0,   label: 'A humble start',    sub: 'just getting going',        img: '/images/focus-world/stage-01.webp' },
  { mins: 10,  label: 'Settling in',       sub: 'the fire is lit',           img: '/images/focus-world/stage-02.webp' },
  { mins: 20,  label: 'Building it up',    sub: 'momentum building',         img: '/images/focus-world/stage-03.webp' },
  { mins: 35,  label: 'A proper home',     sub: 'you’re in the zone',        img: '/images/focus-world/stage-04.webp' },
  { mins: 50,  label: 'Room to grow',      sub: 'excellent session',         img: '/images/focus-world/stage-05.webp' },
  { mins: 70,  label: 'Backyard oasis',    sub: 'outstanding focus',         img: '/images/focus-world/stage-06.webp' },
  { mins: 90,  label: 'Living well',       sub: 'a serious day’s work',      img: '/images/focus-world/stage-07.webp' },
  { mins: 120, label: 'The good life',     sub: 'elite-level focus',         img: '/images/focus-world/stage-08.webp' },
  { mins: 150, label: 'Estate status',     sub: 'legendary day',             img: '/images/focus-world/stage-09.webp' },
  { mins: 180, label: 'The dream palace',  sub: 'Tom is locked in',          img: '/images/focus-world/stage-10.webp' },
]

function getStage(mins: number) {
  let s = 0
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (mins >= STAGES[i].mins) { s = i; break }
  }
  return s
}

function toDateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

const NEXT_AT = STAGES.slice(1).map(s => s.mins).concat([Infinity])

export default function FoodProgress({ sessionMins, large, onClick }: { sessionMins: number; large?: boolean; onClick?: () => void }) {
  const [storedMins, setStoredMins] = useState(0)

  useEffect(() => {
    try {
      const key = 'focus_mins_' + toDateStr()
      const v = parseInt(localStorage.getItem(key) ?? '0', 10)
      setStoredMins(isNaN(v) ? 0 : v)
    } catch {}
  }, [])

  // Save to localStorage whenever sessionMins changes
  useEffect(() => {
    if (sessionMins <= 0) return
    try {
      const key = 'focus_mins_' + toDateStr()
      const v = parseInt(localStorage.getItem(key) ?? '0', 10)
      const base = isNaN(v) ? 0 : v
      localStorage.setItem(key, String(Math.max(base, sessionMins)))
    } catch {}
  }, [sessionMins])

  const total = storedMins + sessionMins
  const stage = getStage(total)
  const stageInfo = STAGES[stage]
  const nextMins = NEXT_AT[stage]
  const toNext = nextMins === Infinity ? null : nextMins - total
  const isMax = stage >= STAGES.length - 1

  const accentColor = stage >= 9 ? '#ffb800' : stage >= 7 ? '#8b5cf6' : stage >= 5 ? '#00ff88' : stage >= 3 ? '#00d4ff' : '#4a4a6a'

  const imgSize = large ? '180px' : '90px'

  return (
    <div onClick={onClick} title={onClick ? 'Click to restart this focus session' : undefined} style={{
      background:'#12121a', border:'1px solid '+(isMax?'rgba(255,184,0,0.3)':'#2a2a3a'),
      borderRadius:'1rem', padding: large ? '1.25rem 1.5rem' : '0.875rem 1rem',
      boxShadow: isMax ? '0 0 20px rgba(255,184,0,0.1)' : 'none',
      transition:'all 0.5s ease',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display:'flex', flexDirection: large ? 'column' : 'row', alignItems:'center', gap: large ? '0.5rem' : '0.875rem', textAlign: large ? 'center' : 'left' }}>
        {/* House scene */}
        <div style={{ width:imgSize, height:imgSize, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stageInfo.img} alt={stageInfo.label} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
        </div>

        {/* Info */}
        <div style={{ flex: large ? 'none' : 1, minWidth:0, width: large ? '100%' : 'auto', maxWidth: large ? '320px' : 'none' }}>
          <p style={{ fontSize: large ? '0.7rem' : '0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:accentColor, margin:'0 0 0.15rem' }}>
            Today&apos;s reward
          </p>
          <p style={{ fontSize: large ? '1.15rem' : '0.85rem', fontWeight:800, color:'#f0f0ff', margin:'0 0 0.1rem', lineHeight:1.2 }}>
            {stageInfo.label}
          </p>
          <p style={{ fontSize: large ? '0.78rem' : '0.68rem', color:'#8888aa', margin:'0 0 0.4rem' }}>
            {stageInfo.sub} &mdash; {total}min focused
          </p>
          {/* Progress to next stage */}
          {toNext !== null && (
            <div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{
                  height:'100%',
                  width: Math.min(100, (total / nextMins) * 100) + '%',
                  background:'linear-gradient(90deg,'+accentColor+',#0099cc)',
                  borderRadius:'2px', transition:'width 1s ease',
                }}/>
              </div>
              <p style={{ fontSize:'0.6rem', color:'#4a4a6a', margin:'0.2rem 0 0' }}>
                {toNext} more min &rarr; next stage
              </p>
            </div>
          )}
          {toNext === null && (
            <p style={{ fontSize:'0.68rem', color:'#ffb800', fontWeight:700, margin:0 }}>
              &#127881; Maximum achieved
            </p>
          )}
          {onClick && (
            <p style={{ fontSize:'0.6rem', color:'#4a4a6a', margin:'0.4rem 0 0', fontStyle:'italic' }}>
              Click to restart this session
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
