'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle2, Circle, Repeat, Droplets, Bell, BellOff } from 'lucide-react'
import { getDailyChecklistState, setDailyChecklistItem } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316',
}

const SESSIONS = [
  {
    id:'morning', time:'Morning', cue:'After breakfast or coffee', color:C.amber,
    moves:[
      { id:'tib', label:'Tib raises', reps:'x 25', note:'Stand with heels on the floor, lift the front of your feet repeatedly. Strengthens tibialis anterior &#8212; the #1 defence against shin splints and knee strain.' },
    ],
  },
  {
    id:'midday', time:'Midday', cue:'Lunch break or desk break', color:C.cyan,
    moves:[
      { id:'calf-lean', label:'Leaning calf raise', reps:'x 25', note:'Lean into a wall at an angle, full range of motion heel-to-toe. Hits the gastrocnemius through a longer range than standard raises.' },
      { id:'calf-bent', label:'Bent-knee calf raise', reps:'x 25', note:'Slight knee bend (about 20&#176;). This shifts the load to the soleus &#8212; the deeper calf muscle that most people never train.' },
    ],
  },
  {
    id:'afternoon', time:'Afternoon', cue:'3&#8211;4pm or before dinner', color:C.green,
    moves:[
      { id:'stepdown', label:'Step-downs', reps:'x 25', note:'Stand on a step, slowly lower the opposite heel toward the floor. Slow and controlled. Trains single-leg quad strength and patellar tracking &#8212; the most direct path to pain-free knees.' },
      { id:'split', label:'Split squat', reps:'x 5 each side', note:'Front shin vertical, rear knee lowers toward the floor. Start shallow and build range over weeks. Builds quad and hip flexor strength simultaneously.' },
    ],
  },
]

const HAIR_STEPS = [
  'Mix 1 egg yolk + 3 tbsp whole milk. Beat until combined.',
  'Apply to dry hair, working from roots to ends. Massage into scalp for 2 minutes.',
  'Cover with a shower cap. Leave 20&#8211;30 minutes.',
  'Rinse with cool water first &#8212; hot water cooks the egg. Then shampoo as normal.',
  'Face bonus: apply any leftover egg white as a face mask. Leave 10 min, rinse cool.',
]

const JUMP_MOVES = [
  { move:'Jump rope', detail:'3 min continuous, or 30s on / 10s off &#215; 6' },
  { move:'High knee raises', detail:'30 sec &#215; 3 &#8212; drive the knee up, pump the arms hard' },
  { move:'Side-to-side hops', detail:'20 each side &#8212; builds lateral ankle stability' },
]

const TRAINING_DAYS = [1, 4] // Monday=1, Thursday=4

// Session time windows (hour, inclusive start → exclusive end)
const SESSION_WINDOWS = [
  { id:'morning',   from:6,  to:12 },
  { id:'midday',    from:12, to:15 },
  { id:'afternoon', from:15, to:23 },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isTrainingDay() {
  return TRAINING_DAYS.includes(new Date().getDay())
}

function isSaturday() {
  return new Date().getDay() === 6
}

function currentSessionId(): string | null {
  const h = new Date().getHours()
  const w = SESSION_WINDOWS.find(w => h >= w.from && h < w.to)
  return w ? w.id : null
}

function nextSession() {
  const d = new Date().getDay()
  if (d < 1 || d > 4) return 'Monday'
  if (d < 4) return 'Thursday'
  return 'Monday'
}

function scheduleNotifs() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  const day = new Date().getDay()

  function fireAt(h: number, m: number, title: string, body: string) {
    const target = new Date(); target.setHours(h, m, 0, 0)
    const ms = target.getTime() - Date.now()
    if (ms > 0 && ms < 14 * 60 * 60 * 1000) {
      setTimeout(() => { new Notification(title, { body, silent:false }) }, ms)
    }
  }

  if (day === 1 || day === 4) {
    fireAt(9,  0, '💪 Morning movement', 'Tib raises x25 — 60 seconds, do it now')
    fireAt(12, 0, '💪 Midday movement',  'Leaning calf raise x25 + Bent-knee calf raise x25')
    fireAt(15, 0, '💪 Afternoon movement','Step-downs x25 + Split squat x5 each side')
  }
  if (day === 6) {
    fireAt(9, 0, '🧖 Saturday ritual', 'Hair & face — milk, egg, 30 min. Instructions in the app.')
  }
}

export default function PhysicalPage() {
  const router = useRouter()
  const [done, setDone]           = useState<Record<string, boolean>>({})
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [nowSession, setNowSession] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const training = isTrainingDay()

  useEffect(() => {
    getDailyChecklistState('physical', todayStr()).then(({ state }) => setDone(state))

    // Notification permission state
    if (typeof Notification === 'undefined') {
      setNotifPerm('unsupported')
    } else {
      setNotifPerm(Notification.permission)
      if (Notification.permission === 'granted') scheduleNotifs()
    }

    // Tick current session every minute
    setNowSession(currentSessionId())
    timerRef.current = setInterval(() => setNowSession(currentSessionId()), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted') scheduleNotifs()
  }

  function toggle(id: string) {
    setDone(prev => {
      const nextDone = !prev[id]
      setDailyChecklistItem('physical', id, todayStr(), nextDone)
      return { ...prev, [id]: nextDone }
    })
  }

  const allMoves = SESSIONS.flatMap(s => s.moves)
  const doneCount = allMoves.filter(m => done[m.id]).length
  const allDone = doneCount === allMoves.length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'0.875rem 2rem', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:'820px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'0.8rem', fontFamily:'inherit', padding:0 }}>
            <ChevronLeft size={15}/> Home
          </button>
          <span style={{ fontWeight:900, fontSize:'1rem', letterSpacing:'-0.01em' }}>Physical</span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'0.7rem', color:C.muted }}>Mon &amp; Thu &bull; Saturdays</span>
            {notifPerm === 'unsupported' ? null : notifPerm === 'granted' ? (
              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.7rem', color:C.green }}>
                <Bell size={12}/> Reminders on
              </span>
            ) : notifPerm === 'denied' ? (
              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.7rem', color:C.muted }}>
                <BellOff size={12}/> Blocked in browser
              </span>
            ) : (
              <button onClick={requestNotifPermission} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.7rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'9999px', color:C.green, fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:'inherit' }}>
                <Bell size={12}/> Enable reminders
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'820px', margin:'0 auto', padding:'2rem' }}>

        {/* Training day status banner */}
        {training ? (
          <div style={{ marginBottom:'2rem', padding:'1rem 1.25rem', background:allDone ? 'rgba(0,255,136,0.05)' : 'rgba(255,184,0,0.04)', border:'1px solid '+(allDone ? 'rgba(0,255,136,0.2)' : 'rgba(255,184,0,0.15)'), borderRadius:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <span style={{ fontSize:'0.73rem', fontWeight:800, color:allDone ? C.green : C.amber }}>
                {allDone ? 'All done today &#8212; great session' : `Knee routine &#8212; ${doneCount} / ${allMoves.length} done today`}
              </span>
              <span style={{ fontSize:'0.67rem', color:C.muted }}>Resets tomorrow</span>
            </div>
            <div style={{ height:'5px', background:C.border, borderRadius:'9999px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${allMoves.length ? (doneCount / allMoves.length) * 100 : 0}%`, background:allDone ? C.green : C.amber, borderRadius:'9999px', transition:'width 0.3s' }}/>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom:'2rem', padding:'0.875rem 1.25rem', background:'rgba(74,74,106,0.1)', border:'1px solid '+C.border, borderRadius:'1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <Repeat size={15} color={C.muted}/>
            <span style={{ fontSize:'0.8rem', color:C.sec }}>
              Knee routine is on <strong style={{ color:C.text }}>Monday</strong> and <strong style={{ color:C.text }}>Thursday</strong>.
              Next session: <strong style={{ color:C.text }}>{nextSession()}</strong>.
            </span>
          </div>
        )}

        {/* Knee health routine */}
        <div style={{ marginBottom:'2.5rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.25rem' }}>Knee Health Routine</p>
          <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1rem' }}>Split through the day &#8212; tick each off as you do it</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
            {SESSIONS.map(session => (
              <div key={session.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', overflow:'hidden' }}>
                <div style={{ padding:'0.7rem 1.25rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.75rem', background: training && nowSession===session.id ? session.color+'10' : undefined }}>
                  <div style={{ width:'3px', height:'22px', background:session.color, borderRadius:'9999px', flexShrink:0 }}/>
                  <span style={{ fontSize:'0.82rem', fontWeight:800, color:session.color }}>{session.time}</span>
                  <span style={{ fontSize:'0.72rem', color:C.muted }}>{session.cue}</span>
                  {training && nowSession===session.id && (
                    <span style={{ marginLeft:'auto', fontSize:'0.62rem', fontWeight:900, letterSpacing:'0.1em', textTransform:'uppercase', background:session.color, color:'#000', borderRadius:'9999px', padding:'0.15rem 0.55rem' }}>NOW</span>
                  )}
                </div>
                <div style={{ padding:'0.375rem 0' }}>
                  {session.moves.map(move => (
                    <button
                      key={move.id}
                      onClick={() => training && toggle(move.id)}
                      style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:'0.875rem', padding:'0.75rem 1.25rem', background:'none', border:'none', cursor:training ? 'pointer' : 'default', fontFamily:'inherit', textAlign:'left', opacity:done[move.id] ? 0.5 : 1, transition:'opacity 0.2s' }}
                    >
                      {done[move.id]
                        ? <CheckCircle2 size={18} color={session.color} style={{ flexShrink:0, marginTop:'2px' }}/>
                        : <Circle size={18} color={training ? session.color : C.border} style={{ flexShrink:0, marginTop:'2px' }}/>}
                      <div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:'0.5rem', marginBottom:'0.2rem' }}>
                          <span style={{ fontSize:'0.86rem', fontWeight:700, color:done[move.id] ? C.muted : C.text, textDecoration:done[move.id] ? 'line-through' : 'none' }}>{move.label}</span>
                          <span style={{ fontSize:'0.8rem', fontWeight:800, color:session.color }}>{move.reps}</span>
                        </div>
                        <p style={{ fontSize:'0.73rem', color:C.sec, margin:0, lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html: move.note }}/>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'0.875rem', padding:'0.75rem 1rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.18)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.75rem', color:C.purple, fontWeight:700, margin:'0 0 0.2rem' }}>Why this sequence?</p>
            <p style={{ fontSize:'0.73rem', color:C.sec, margin:0, lineHeight:1.6 }}>This is the core of Ben Patrick&#39;s &ldquo;Knees Over Toes&rdquo; protocol &#8212; building the tibialis, soleus, and quad through full range of motion. People with knee pain almost always have weak tibs and underdeveloped step-down strength. Two sessions a week is enough to see change within 4&#8211;6 weeks.</p>
          </div>
        </div>

        {/* Ankle flexibility reference */}
        <div style={{ marginBottom:'2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.25rem' }}>Ankle Flexibility</p>
          <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.125rem' }}>Daily &#8212; 3 minutes, any time. Built into morning routine.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[
              { move:'Ankle circles', detail:'10 slow circles clockwise + 10 anticlockwise, each foot. Sit on floor or chair, lift foot and draw full circles. Lubricates the joint.', color:C.amber },
              { move:'Wall ankle leans', detail:'Stand facing a wall, toes 5cm away. Lean knee forward over toes as far as possible without heel lifting. Hold 2 sec. x10 each foot. Builds dorsiflexion &#8212; the single most important ankle movement for squatting.', color:C.cyan },
              { move:'Foot alphabet', detail:'Sitting with leg extended, trace A&#8211;Z with your foot using the biggest letters you can make. Works the full range of ankle motion. Each foot.', color:C.green },
              { move:'Deep squat hold', detail:'Already in morning routine &#8212; 2 minutes. The deepest ankle flexibility work. If heels rise, hold a doorframe for stability and gradually work toward flat-footed.', color:C.purple },
            ].map((item, i) => (
              <div key={i} style={{ padding:'0.75rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.75rem', borderLeft:'3px solid '+item.color }}>
                <span style={{ fontSize:'0.82rem', fontWeight:700, color:item.color }}>{item.move}</span>
                <p style={{ fontSize:'0.75rem', color:C.sec, margin:'0.2rem 0 0', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: item.detail }}/>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.875rem 0 0', fontStyle:'italic' }}>Ankle dorsiflexion drives everything &#8212; squat depth, walking gait, knee tracking. 3 minutes daily compounds fast.</p>
        </div>

        {/* Movement / Jumping */}
        <div style={{ marginBottom:'2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>Movement &#8212; Jump Rope &amp; Rebounding</p>

          <div style={{ padding:'1rem 1.25rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.875rem', marginBottom:'1.25rem' }}>
            <p style={{ fontSize:'0.88rem', fontWeight:800, color:C.cyan, margin:'0 0 0.25rem' }}>
              &ldquo;When you stop jumping, you start dying.&rdquo;
            </p>
            <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, fontStyle:'italic' }}>Russian fitness tradition &#8212; movement as medicine</p>
          </div>

          <p style={{ fontSize:'0.82rem', color:C.sec, lineHeight:1.7, margin:'0 0 0.875rem' }}>
            Jumping and rebounding activate the <strong style={{ color:C.text }}>lymphatic system</strong> &#8212; your body&#39;s waste disposal network. Unlike blood, lymph has no pump; it moves only when you move. Skipping is the most efficient way to drive it. Soviet sports medicine treated jump rope not as a warm-up but as a discipline in its own right.
          </p>
          <p style={{ fontSize:'0.82rem', color:C.sec, lineHeight:1.7, margin:'0 0 1.25rem' }}>
            Even 5 minutes builds coordination, bone density, and cardiovascular fitness faster than most gym work &#8212; especially if you&#39;ve been sedentary. Add it to the start of any gym session, or do it standalone on any morning.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {JUMP_MOVES.map((item, i) => (
              <div key={i} style={{ display:'flex', gap:'1rem', alignItems:'baseline', padding:'0.5rem 0', borderBottom: i < JUMP_MOVES.length - 1 ? '1px solid '+C.border : 'none' }}>
                <span style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, minWidth:'150px' }}>{item.move}</span>
                <span style={{ fontSize:'0.77rem', color:C.muted }} dangerouslySetInnerHTML={{ __html: item.detail }}/>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.73rem', color:C.muted, margin:'0.875rem 0 0', fontStyle:'italic' }}>Atomic habit rule: start with 1 minute, every gym day. Build from there. Consistency over intensity.</p>
        </div>

        {/* Flexibility circuit */}
        <div style={{ marginBottom:'2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.25rem' }}>Flexibility Circuit</p>
          <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.125rem' }}>Daily or post-training &#8212; ~10 minutes. Work in order, hold each position.</p>

          {/* Why it matters */}
          <div style={{ padding:'0.875rem 1rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.18)', borderRadius:'0.75rem', marginBottom:'1.125rem' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, color:C.purple, margin:'0 0 0.3rem' }}>Why flexibility training matters</p>
            <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.65 }}>
              Muscles contract and shorten with use. Without deliberate lengthening work, joint range of motion decreases over years &#8212; limiting squat depth, posture, and athletic output. Flexibility work also lowers injury risk by ensuring the muscle can absorb load through its full range, not just the shortened position you happen to use at a desk. These five stretches target the most commonly restricted areas in men: calf/soleus, groin, and hip flexors.
            </p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {[
              {
                name:'Straight-leg calf stretch',
                target:'Gastrocnemius',
                hold:'30 sec each leg',
                color:C.amber,
                how:'Stand facing a wall. Place one foot back, heel flat on floor, leg straight. Lean into the wall until you feel a strong pull through the calf. Keep the heel down. The further back the foot, the less intense &#8212; find the edge of discomfort.',
              },
              {
                name:'Bent-knee calf stretch',
                target:'Soleus (deep calf)',
                hold:'30 sec each leg',
                color:C.orange,
                how:'Same wall position, but bend the back knee slightly (10&#8211;20&#176;). This drops the load from the gastrocnemius to the soleus &#8212; the deeper muscle that most people never stretch. You will feel it lower and deeper than the straight-leg version.',
              },
              {
                name:'Horse stance',
                target:'Inner groin, hip adductors',
                hold:'60&#8211;90 sec',
                color:C.cyan,
                how:'Stand with feet wide (wider than shoulder-width), toes angled out at 45&#176;. Sink your hips straight down as low as possible. Keep your back upright. Place hands on knees and gently press outward to increase the stretch. This is the most direct path to hip width and groin opening.',
              },
              {
                name:'Butterfly stretch',
                target:'Inner groin, hip rotators',
                hold:'60 sec &#8212; breathe into it',
                color:C.green,
                how:'Sit on the floor, bring the soles of your feet together and pull them toward your groin. Sit tall &#8212; do not round the lower back. Gently press knees toward the floor with your elbows. On each exhale, let gravity do the work. Do not force it. The stretch deepens with breath, not pressure.',
              },
              {
                name:'Pancake stretch',
                target:'Hamstrings, inner thighs, lower back',
                hold:'60&#8211;90 sec',
                color:C.purple,
                how:'Sit with legs extended as wide as possible (a V shape on the floor). Sit tall with a straight back. Hinge forward from the hips &#8212; not by rounding the spine &#8212; and walk your hands out in front of you. The goal is to get your chest toward the floor. This is a long-term project: it will be tight for months. Hold where you can breathe.',
              },
            ].map((item, i) => (
              <div key={i} style={{ padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem', borderLeft:'3px solid '+item.color }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.85rem', fontWeight:800, color:item.color }}>{item.name}</span>
                  <span style={{ fontSize:'0.68rem', color:C.muted, fontStyle:'italic' }}>{item.target}</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.72rem', fontWeight:700, color:C.text, flexShrink:0 }}>{item.hold}</span>
                </div>
                <p style={{ fontSize:'0.77rem', color:C.sec, margin:0, lineHeight:1.65 }} dangerouslySetInnerHTML={{ __html: item.how }}/>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.875rem 0 0', fontStyle:'italic', lineHeight:1.6 }}>
            Consistency beats intensity. A gentle daily hold is more effective than an occasional aggressive stretch. Flexibility responds to frequency, not force.
          </p>
        </div>

        {/* Lower back */}
        <div style={{ marginBottom:'2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.25rem' }}>Lower Back</p>
          <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.125rem' }}>2&ndash;3 times per week &bull; Training days or standalone &bull; 3 sets each</p>

          <div style={{ padding:'0.875rem 1rem', background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.18)', borderRadius:'0.75rem', marginBottom:'1.125rem' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, color:C.orange, margin:'0 0 0.3rem' }}>Why lower back work matters</p>
            <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.65 }}>
              The lower back (erector spinae and multifidus) is the anchor for almost every movement &#8212; squats, deadlifts, carrying, sitting, standing. Weakness here shows up as pain and poor posture. These three exercises build it directly through its full range without loading the spine. Do them consistently and lower back discomfort drops fast.
            </p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {[
              {
                name:'Lower back raises',
                target:'Erector spinae, multifidus',
                reps:'3 &#215; 15&ndash;20',
                color:C.orange,
                how:'Lie face down on the floor, hands clasped behind your head or at your sides. Squeeze your glutes and lift your chest and upper body off the floor. Hold at the top for 1 second. Lower slowly. The lift comes from the lower back &#8212; do not yank with the neck or jerk up. Full range: from fully flat to as high as your back allows.',
              },
              {
                name:'Reverse lower back raises',
                target:'Lower lumbar, glutes, hamstrings',
                reps:'3 &#215; 10&ndash;15',
                color:C.amber,
                how:'Lie face down on a bench or table with your hips at the edge and legs hanging down. Hold the surface firmly. Keeping legs straight, raise both legs up until they are parallel with your back. Squeeze at the top, lower slowly. No bench: lie prone on the floor, arms extended forward, and lift both legs simultaneously off the floor. The reverse direction of the back raise &#8212; hits the lower lumbar from the other angle.',
              },
              {
                name:'Split squats',
                target:'Quads, glutes, hip flexors, spinal stabilisers',
                reps:'3 &#215; 8 each side',
                color:C.green,
                how:'Step one foot well forward, one foot back. Lower the rear knee toward the floor keeping the front shin roughly vertical. The lower back must stay upright and tall &#8212; if it rounds you have gone too deep. The split stance forces the core and lower back to stabilise through the movement, making it as much a back exercise as a leg one. Add dumbbells once bodyweight is comfortable. Also in the afternoon knee routine.',
              },
            ].map((item, i) => (
              <div key={i} style={{ padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem', borderLeft:'3px solid '+item.color }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:'0.75rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.85rem', fontWeight:800, color:item.color }}>{item.name}</span>
                  <span style={{ fontSize:'0.68rem', color:C.muted, fontStyle:'italic' }}>{item.target}</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.72rem', fontWeight:700, color:C.text, flexShrink:0 }} dangerouslySetInnerHTML={{ __html: item.reps }}/>
                </div>
                <p style={{ fontSize:'0.77rem', color:C.sec, margin:0, lineHeight:1.65 }} dangerouslySetInnerHTML={{ __html: item.how }}/>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.875rem 0 0', fontStyle:'italic', lineHeight:1.6 }}>
            Start light, go slow, full range of motion. Lower back muscles respond better to higher reps and controlled tempo than to loading heavy. Pain-free and consistent beats heavy and sporadic.
          </p>
        </div>

        {/* Hair + face ritual */}
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
            <Droplets size={18} color={C.amber}/>
            <div>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.15rem' }}>Weekly &#8212; Hair &amp; Face Ritual</p>
              <p style={{ fontSize:'0.73rem', color:C.muted, margin:0 }}>Once per week &bull; ~30 minutes &bull; Reminder set for Saturdays</p>
            </div>
          </div>

          <div style={{ padding:'1rem 1.25rem', background:'rgba(255,184,0,0.04)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.875rem', marginBottom:'1.25rem' }}>
            <p style={{ fontSize:'0.78rem', fontWeight:700, color:C.amber, margin:'0 0 0.5rem' }}>Why milk and egg? The old science.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', fontSize:'0.77rem', color:C.sec, lineHeight:1.65 }}>
              <p style={{ margin:0 }}>
                <strong style={{ color:C.text }}>Egg yolk</strong> is rich in biotin, sulfur amino acids (cysteine, methionine), and lecithin &#8212; the literal building blocks of keratin, which is what your hair is made of. Applied directly, they strengthen the shaft from the inside out.
              </p>
              <p style={{ margin:0 }}>
                <strong style={{ color:C.text }}>Whole milk</strong> contains lactic acid (a gentle exfoliant for the scalp), casein proteins that coat each hair fibre and reduce frizz, and natural fats that condition without synthetic emollients.
              </p>
              <p style={{ margin:0 }}>
                This is what people used before commercial shampoo. Modern products often strip the scalp with surfactants, then add silicones to compensate. Milk and egg do the same job without the chemical cycle.
              </p>
            </div>
          </div>

          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.75rem' }}>How to do it</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem', marginBottom:'1rem' }}>
            {HAIR_STEPS.map((step, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.875rem' }}>
                <span style={{ width:'22px', height:'22px', borderRadius:'50%', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:900, color:C.amber, flexShrink:0, marginTop:'1px' }}>
                  {i + 1}
                </span>
                <p style={{ fontSize:'0.8rem', color:C.text, margin:0, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: step }}/>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.73rem', color:C.muted, margin:0, fontStyle:'italic', lineHeight:1.6 }}>
            Always rinse with cool or lukewarm water first &#8212; hot water denatures the egg protein and makes it sticky. You can add a few drops of rosemary oil to the mix for extra scalp circulation.
          </p>
        </div>

      </div>
    </main>
  )
}
