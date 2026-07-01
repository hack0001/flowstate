'use client'
import { useEffect, useState } from 'react'

// Food progression: crumbs → bread → sandwich → meal → feast → banquet
// Grows with cumulative focus minutes today (localStorage key: focus_mins_YYYY-MM-DD)

const STAGES = [
  { mins: 0,   label: 'Getting started…',       sub: 'crumbs and water' },
  { mins: 15,  label: 'Bread and water',            sub: 'momentum building' },
  { mins: 30,  label: 'A proper sandwich',          sub: 'you’re in the zone' },
  { mins: 60,  label: 'A full meal',                sub: 'excellent session' },
  { mins: 90,  label: 'A feast',                    sub: 'outstanding focus' },
  { mins: 150, label: 'The banquet',                sub: 'legendary day — Tom is locked in' },
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

// ---- SVG scenes ----

// Stage 0: crumbs and a tiny water glass
function SceneCrumbs() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* plate */}
      <circle cx="90" cy="68" r="36" fill="#1a1a26" stroke="#3a3a52" strokeWidth="2"/>
      <circle cx="90" cy="68" r="28" fill="#12121a" stroke="#2a2a3a" strokeWidth="1"/>
      {/* crumbs */}
      {[[82,62],[95,70],[78,74],[101,63],[88,78]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.5} fill="#6b5b3e" opacity="0.7"/>
      ))}
      {/* water glass */}
      <rect x="30" y="44" width="18" height="30" rx="2" fill="none" stroke="#3a3a52" strokeWidth="1.5"/>
      <rect x="30" y="60" width="18" height="14" rx="0 0 2 2" fill="#00d4ff" opacity="0.18"/>
      {/* glass shine */}
      <line x1="34" y1="47" x2="34" y2="68" stroke="white" strokeWidth="0.8" opacity="0.15"/>
    </svg>
  )
}

// Stage 1: bread roll + water glass
function SceneBread() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* plate */}
      <circle cx="92" cy="68" r="36" fill="#1a1a26" stroke="#3a3a52" strokeWidth="2"/>
      <circle cx="92" cy="68" r="28" fill="#12121a" stroke="#2a2a3a" strokeWidth="1"/>
      {/* bread roll */}
      <ellipse cx="92" cy="68" rx="20" ry="13" fill="#c8a96e" stroke="#a07840" strokeWidth="1.5"/>
      <ellipse cx="92" cy="63" rx="18" ry="8" fill="#d4b57a" stroke="none"/>
      {/* bread score lines */}
      <path d="M80 64 Q92 60 104 64" fill="none" stroke="#a07840" strokeWidth="1" opacity="0.6"/>
      {/* water glass - fuller */}
      <rect x="28" y="40" width="20" height="36" rx="2" fill="none" stroke="#4a4a6a" strokeWidth="1.5"/>
      <rect x="28" y="58" width="20" height="18" rx="0 0 2 2" fill="#00d4ff" opacity="0.25"/>
      <line x1="33" y1="43" x2="33" y2="72" stroke="white" strokeWidth="0.8" opacity="0.2"/>
    </svg>
  )
}

// Stage 2: sandwich + juice cup with steam
function SceneSandwich() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* plate */}
      <circle cx="95" cy="70" r="36" fill="#1a1a26" stroke="#3a3a52" strokeWidth="2"/>
      <circle cx="95" cy="70" r="28" fill="#12121a" stroke="#2a2a3a" strokeWidth="1"/>
      {/* sandwich layers */}
      <rect x="76" y="58" width="38" height="7" rx="4" fill="#c8a96e" stroke="#a07840" strokeWidth="1"/>
      <rect x="78" y="64" width="34" height="5" rx="1" fill="#5a8c3c"/>
      <rect x="78" y="68" width="34" height="4" rx="1" fill="#c0392b" opacity="0.8"/>
      <rect x="78" y="71" width="34" height="5" rx="1" fill="#e8c97a"/>
      <rect x="76" y="75" width="38" height="7" rx="4" fill="#c8a96e" stroke="#a07840" strokeWidth="1"/>
      {/* juice cup */}
      <rect x="27" y="46" width="22" height="30" rx="3" fill="none" stroke="#4a4a6a" strokeWidth="1.5"/>
      <rect x="27" y="58" width="22" height="18" rx="0 0 3 3" fill="#ff9500" opacity="0.3"/>
      {/* cup handle */}
      <path d="M49 56 Q56 56 56 64 Q56 72 49 72" fill="none" stroke="#4a4a6a" strokeWidth="1.5"/>
      {/* steam */}
      <path d="M33 43 Q35 38 33 33" fill="none" stroke="#8888aa" strokeWidth="1" opacity="0.5"/>
      <path d="M40 42 Q42 37 40 32" fill="none" stroke="#8888aa" strokeWidth="1" opacity="0.5"/>
    </svg>
  )
}

// Stage 3: full plate with food + fork + knife + wine glass
function SceneMeal() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* plate */}
      <circle cx="85" cy="68" r="36" fill="#1a1a26" stroke="#4a4a6a" strokeWidth="2"/>
      <circle cx="85" cy="68" r="30" fill="#12121a" stroke="#2a2a3a" strokeWidth="1"/>
      {/* food sections on plate */}
      <path d="M85 68 L85 42 A26 26 0 0 1 111 68 Z" fill="#c8a96e" opacity="0.85"/>
      <path d="M85 68 L111 68 A26 26 0 0 1 85 94 Z" fill="#5a8c3c" opacity="0.85"/>
      <path d="M85 68 L85 94 A26 26 0 0 1 59 68 Z" fill="#c0392b" opacity="0.7"/>
      <path d="M85 68 L59 68 A26 26 0 0 1 85 42 Z" fill="#e8c97a" opacity="0.85"/>
      {/* fork */}
      <line x1="24" y1="38" x2="24" y2="78" stroke="#6a6a8a" strokeWidth="2" strokeLinecap="round"/>
      <line x1="21" y1="38" x2="21" y2="50" stroke="#6a6a8a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="27" y1="38" x2="27" y2="50" stroke="#6a6a8a" strokeWidth="1.5" strokeLinecap="round"/>
      {/* knife */}
      <line x1="148" y1="38" x2="148" y2="78" stroke="#6a6a8a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M148 38 Q155 48 148 54" fill="#6a6a8a" opacity="0.6"/>
      {/* wine glass */}
      <path d="M132 44 L140 44 L137 60 Q136 66 138 70 L130 70 Q132 66 131 60 Z" fill="#8b5cf6" opacity="0.3" stroke="#8b5cf6" strokeWidth="1"/>
      <ellipse cx="134" cy="44" rx="7" ry="2" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="1"/>
      <rect x="133" y="70" width="2" height="8" fill="#6a6a8a"/>
      <ellipse cx="134" cy="78" rx="5" ry="1.5" fill="none" stroke="#6a6a8a" strokeWidth="1"/>
    </svg>
  )
}

// Stage 4: main plate + side bowl + goblet
function SceneFeast() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* main plate */}
      <circle cx="75" cy="68" r="34" fill="#1a1a26" stroke="#4a4a6a" strokeWidth="2"/>
      <circle cx="75" cy="68" r="28" fill="#12121a" stroke="#2a2a3a" strokeWidth="1"/>
      {/* food on main plate */}
      <ellipse cx="75" cy="70" rx="18" ry="12" fill="#c8a96e" stroke="#a07840" strokeWidth="1"/>
      <ellipse cx="75" cy="66" rx="15" ry="8" fill="#d4b57a"/>
      <circle cx="68" cy="62" r="5" fill="#c0392b" opacity="0.8"/>
      <circle cx="80" cy="72" r="4" fill="#5a8c3c" opacity="0.9"/>
      {/* side bowl */}
      <ellipse cx="133" cy="75" rx="18" ry="10" fill="#1a1a26" stroke="#3a3a52" strokeWidth="1.5"/>
      <ellipse cx="133" cy="72" rx="15" ry="7" fill="#12121a"/>
      {/* soup in bowl */}
      <ellipse cx="133" cy="71" rx="12" ry="5" fill="#c8781a" opacity="0.4"/>
      {/* spoon */}
      <line x1="141" y1="60" x2="145" y2="78" stroke="#6a6a8a" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="140.5" cy="59" rx="3" ry="2" fill="#6a6a8a"/>
      {/* goblet */}
      <path d="M14 40 L24 40 L21 58 Q20 63 22 66 L15 66 Q17 63 16 58 Z" fill="#8b5cf6" opacity="0.35" stroke="#8b5cf6" strokeWidth="1"/>
      <ellipse cx="19" cy="40" rx="6" ry="2" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="1"/>
      <rect x="18" y="66" width="2" height="7" fill="#6a6a8a"/>
      <ellipse cx="19" cy="73" rx="5" ry="1.5" fill="none" stroke="#6a6a8a" strokeWidth="1"/>
      {/* candle */}
      <rect x="150" y="50" width="5" height="22" rx="1" fill="#f0f0ff" opacity="0.6"/>
      <path d="M152.5 47 Q151 44 152.5 41 Q154 44 152.5 47Z" fill="#ffb800"/>
      <circle cx="152.5" cy="44" r="2" fill="#ff6b35" opacity="0.6"/>
    </svg>
  )
}

// Stage 5: banquet!
function SceneBanquet() {
  return (
    <svg viewBox="0 0 160 110" style={{ width:'100%', height:'100%' }}>
      {/* table surface */}
      <rect x="5" y="78" width="150" height="6" rx="2" fill="#2a2a3a"/>
      {/* main plate (center) */}
      <circle cx="80" cy="65" r="28" fill="#1a1a26" stroke="#ffb800" strokeWidth="2"/>
      <circle cx="80" cy="65" r="23" fill="#12121a" stroke="#3a3a52" strokeWidth="1"/>
      {/* roast/main dish */}
      <ellipse cx="80" cy="66" rx="16" ry="10" fill="#a05c2a" stroke="#7a3c10" strokeWidth="1"/>
      <ellipse cx="80" cy="63" rx="12" ry="7" fill="#c8781a"/>
      {/* garnish */}
      <circle cx="73" cy="59" r="3" fill="#5a8c3c"/>
      <circle cx="88" cy="61" r="2.5" fill="#5a8c3c"/>
      {/* left plate */}
      <circle cx="30" cy="72" r="18" fill="#1a1a26" stroke="#4a4a6a" strokeWidth="1.5"/>
      <circle cx="30" cy="72" r="14" fill="#12121a"/>
      <ellipse cx="30" cy="72" rx="9" ry="6" fill="#c8a96e" opacity="0.8"/>
      <ellipse cx="30" cy="70" rx="7" ry="4" fill="#e8c97a"/>
      {/* right plate */}
      <circle cx="130" cy="72" r="18" fill="#1a1a26" stroke="#4a4a6a" strokeWidth="1.5"/>
      <circle cx="130" cy="72" r="14" fill="#12121a"/>
      <ellipse cx="130" cy="73" rx="9" ry="5" fill="#5a8c3c" opacity="0.8"/>
      <circle cx="127" cy="71" r="3" fill="#c0392b" opacity="0.7"/>
      {/* left goblet */}
      <path d="M10 38 L22 38 L18 58 Q17 63 19 67 L12 67 Q14 63 13 58 Z" fill="#00d4ff" opacity="0.25" stroke="#00d4ff" strokeWidth="1"/>
      <ellipse cx="16" cy="38" rx="7" ry="2.5" fill="#00d4ff" opacity="0.2" stroke="#00d4ff" strokeWidth="1"/>
      <rect x="15" y="67" width="2" height="8" fill="#4a4a6a"/>
      <ellipse cx="16" cy="75" rx="5" ry="1.5" fill="none" stroke="#4a4a6a" strokeWidth="1"/>
      {/* right goblet */}
      <path d="M138 38 L150 38 L146 58 Q145 63 147 67 L140 67 Q142 63 141 58 Z" fill="#8b5cf6" opacity="0.3" stroke="#8b5cf6" strokeWidth="1"/>
      <ellipse cx="144" cy="38" rx="7" ry="2.5" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="1"/>
      <rect x="143" y="67" width="2" height="8" fill="#4a4a6a"/>
      <ellipse cx="144" cy="75" rx="5" ry="1.5" fill="none" stroke="#4a4a6a" strokeWidth="1"/>
      {/* center candelabra */}
      <rect x="78" y="26" width="4" height="14" rx="1" fill="#f0f0ff" opacity="0.5"/>
      <path d="M80 23 Q78 19 80 15 Q82 19 80 23Z" fill="#ffb800"/>
      <circle cx="80" cy="18" r="2.5" fill="#ff6b35" opacity="0.5"/>
      <rect x="72" y="30" width="16" height="2" rx="1" fill="#6a6a8a"/>
      {/* extra candles on candelabra arms */}
      <rect x="72" y="22" width="3" height="9" rx="1" fill="#f0f0ff" opacity="0.4"/>
      <path d="M73.5 20 Q72 17 73.5 14 Q75 17 73.5 20Z" fill="#ffb800" opacity="0.8"/>
      <rect x="86" y="22" width="3" height="9" rx="1" fill="#f0f0ff" opacity="0.4"/>
      <path d="M87.5 20 Q86 17 87.5 14 Q89 17 87.5 20Z" fill="#ffb800" opacity="0.8"/>
      {/* sparkle stars */}
      {[[55,15],[105,18],[40,32],[120,28]].map(([x,y],i) => (
        <g key={i}>
          <line x1={x} y1={y-4} x2={x} y2={y+4} stroke="#ffb800" strokeWidth="1" opacity="0.5"/>
          <line x1={x-4} y1={y} x2={x+4} y2={y} stroke="#ffb800" strokeWidth="1" opacity="0.5"/>
        </g>
      ))}
    </svg>
  )
}

const SCENE_COMPONENTS = [SceneCrumbs, SceneBread, SceneSandwich, SceneMeal, SceneFeast, SceneBanquet]
const NEXT_AT = [15, 30, 60, 90, 150, Infinity]

export default function FoodProgress({ sessionMins }: { sessionMins: number }) {
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
  const SceneComponent = SCENE_COMPONENTS[stage]

  const accentColor = stage >= 5 ? '#ffb800' : stage >= 4 ? '#8b5cf6' : stage >= 3 ? '#00ff88' : stage >= 2 ? '#00d4ff' : '#4a4a6a'

  return (
    <div style={{
      background:'#12121a', border:'1px solid '+(stage>=5?'rgba(255,184,0,0.3)':'#2a2a3a'),
      borderRadius:'1rem', padding:'0.875rem 1rem',
      boxShadow: stage>=5 ? '0 0 20px rgba(255,184,0,0.1)' : 'none',
      transition:'all 0.5s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.875rem' }}>
        {/* SVG scene */}
        <div style={{ width:'90px', height:'66px', flexShrink:0 }}>
          <SceneComponent/>
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:accentColor, margin:'0 0 0.15rem' }}>
            Today&apos;s reward
          </p>
          <p style={{ fontSize:'0.85rem', fontWeight:800, color:'#f0f0ff', margin:'0 0 0.1rem', lineHeight:1.2 }}>
            {stageInfo.label}
          </p>
          <p style={{ fontSize:'0.68rem', color:'#8888aa', margin:'0 0 0.4rem' }}>
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
        </div>
      </div>
    </div>
  )
}
