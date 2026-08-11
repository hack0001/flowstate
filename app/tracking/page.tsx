'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Flame, CheckCircle2, Circle, Trash2, Edit3, X, ChevronLeft, AlertTriangle, Trophy, Target, Sparkles } from 'lucide-react'
import { calcHabitStreak, isHabitScheduledOn } from '@/lib/habitStreak'
import { useCelebration } from '@/hooks/useCelebration'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const SCHEDULE_OPTIONS = [
  { value:'daily',    label:'Every day' },
  { value:'weekdays', label:'Weekdays only (Mon–Fri)' },
  { value:'weekends', label:'Weekends only (Sat–Sun)' },
  { value:'custom',   label:'Custom days…' },
]

const PRESET_COLORS = ['#00d4ff','#00ff88','#ffb800','#8b5cf6','#ff4466','#ff6b35','#10b981','#f472b6']

type Habit = {
  id: string
  title: string
  description: string | null
  schedule_type: string
  schedule_days: number[]
  schedule_time: string | null
  color: string
  emoji: string
  sort_order: number
  active: boolean
  created_at: string
}

type Completion = {
  id: string
  habit_id: string
  completed_date: string
}

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function todayDow() { return new Date().getDay() }

function isScheduledToday(h: Habit): boolean {
  const dow = todayDow()
  if (h.schedule_type === 'daily') return true
  if (h.schedule_type === 'weekdays') return dow >= 1 && dow <= 5
  if (h.schedule_type === 'weekends') return dow === 0 || dow === 6
  if (h.schedule_type === 'custom') return h.schedule_days.includes(dow)
  return false
}

// Schedule-aware streak math lives in lib/habitStreak.ts (shared with the
// Home page so both agree on the same number for the same habit). This is
// just a thin wrapper that builds the per-habit done-date set this page
// already has in memory.
function streakFor(habit: Habit, completions: Completion[]): number {
  const doneDates = new Set(completions.filter(c => c.habit_id === habit.id).map(c => c.completed_date))
  return calcHabitStreak(habit, doneDates)
}

// ---- Encouragement ----
// Milestones get a bigger confetti burst and a specific callout; every other
// completion still gets a small burst and a short pick from this pool, so
// ticking a habit always feels like something instead of just a checkbox.
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365]
const ENCOURAGE_MSGS = [
  "Nice one.", "That's the discipline.", "Stacking another day.", "Keep the streak alive.",
  "Small deposit, big compound.", "That's how it's done.", "One more day banked.",
  "You showed up.", "Consistency wins.", "Locked in.",
]
function milestoneMsg(title: string, streak: number): string {
  if (streak >= 100) return title + ' — ' + streak + ' days. That\'s not a habit anymore, that\'s who you are.'
  if (streak >= 30) return title + ' — ' + streak + ' days straight. Serious momentum.'
  return title + ' — ' + streak + ' day streak. Keep stacking.'
}

function isPastScheduledTime(h: Habit): boolean {
  if (!h.schedule_time) return false
  const [hh, mm] = h.schedule_time.split(':').map(Number)
  const now = new Date()
  return now.getHours() > hh || (now.getHours() === hh && now.getMinutes() > mm)
}

// ---- Add/Edit modal ----
function HabitModal({
  initial, onSave, onClose
}: {
  initial?: Partial<Habit>
  onSave: (data: Omit<Habit,'id'|'created_at'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [scheduleType, setScheduleType] = useState(initial?.schedule_type ?? 'daily')
  const [scheduleDays, setScheduleDays] = useState<number[]>(initial?.schedule_days ?? [])
  const [scheduleTime, setScheduleTime] = useState(initial?.schedule_time ?? '')
  const [color, setColor] = useState(initial?.color ?? '#00d4ff')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '')

  function toggleDay(d: number) {
    setScheduleDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      schedule_type: scheduleType,
      schedule_days: scheduleType === 'custom' ? scheduleDays : [],
      schedule_time: scheduleTime || null,
      color,
      emoji: emoji || '&#10003;',
      sort_order: initial?.sort_order ?? 0,
      active: true,
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.5rem', padding:'1.75rem', width:'100%', maxWidth:'24rem', animation:'fadeInUp 0.25s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h3 style={{ fontSize:'1rem', fontWeight:800, color:C.text, margin:0 }}>{initial?.id ? 'Edit habit' : 'New habit'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>

        {/* Title */}
        <label style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Habit</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Morning workout"
          style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.9rem', marginBottom:'0.875rem', boxSizing:'border-box' }}/>

        {/* Emoji */}
        <label style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Emoji (optional)</label>
        <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="&#128170;"
          style={{ width:'5rem', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'1.1rem', marginBottom:'0.875rem' }}/>

        {/* Schedule */}
        <label style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Schedule</label>
        <select value={scheduleType} onChange={e => setScheduleType(e.target.value)}
          style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', marginBottom:'0.75rem', boxSizing:'border-box' }}>
          {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {scheduleType === 'custom' && (
          <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.875rem', flexWrap:'wrap' }}>
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                padding:'0.3rem 0.6rem', borderRadius:'0.5rem', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
                background: scheduleDays.includes(i) ? color : C.card,
                border: '1px solid '+(scheduleDays.includes(i) ? color : C.border),
                color: scheduleDays.includes(i) ? '#000' : C.sec,
              }}>{d}</button>
            ))}
          </div>
        )}

        {/* Time */}
        <label style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.3rem' }}>Target time (optional)</label>
        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
          style={{ width:'100%', padding:'0.6rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', marginBottom:'0.875rem', boxSizing:'border-box' }}/>

        {/* Color */}
        <label style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, display:'block', marginBottom:'0.4rem' }}>Color</label>
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width:'1.5rem', height:'1.5rem', borderRadius:'50%', background:c, cursor:'pointer',
              border: color === c ? '2px solid #fff' : '2px solid transparent',
            }}/>
          ))}
        </div>

        <button onClick={handleSave} style={{
          width:'100%', padding:'0.75rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none',
          borderRadius:'0.875rem', color:'#000', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit',
        }}>Save habit</button>
      </div>
    </div>
  )
}

// ---- Streak flame visual ----
function StreakBadge({ streak, color }: { streak: number; color: string }) {
  if (streak === 0) return null
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', background:'rgba(255,107,53,0.12)', border:'1px solid rgba(255,107,53,0.3)', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>
      <Flame size={11} color="#ff6b35" fill="#ff6b35"/>
      <span style={{ fontSize:'0.68rem', fontWeight:800, color:'#ff6b35' }}>{streak}</span>
    </div>
  )
}

// ---- Mini week dots ----
// Schedule-aware: a day this habit was never due on renders as a faint,
// near-invisible dot instead of the same dark "missed" look a genuine skip
// gets -- otherwise a Mon/Wed/Fri habit's Tue/Thu/weekend dots looked
// identical to actual misses, which was misleading at a glance.
function WeekDots({ habit, completions }: { habit: Habit; completions: Completion[] }) {
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const ds = toDateStr(d)
    const done = completions.some(c => c.habit_id === habit.id && c.completed_date === ds)
    const scheduled = isHabitScheduledOn(habit, d)
    const isToday = i === 6
    return { ds, done, scheduled, isToday }
  })
  return (
    <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
      {dots.map((dot, i) => (
        <div key={i} title={dot.ds + (dot.scheduled ? (dot.done ? ' — done' : ' — missed') : ' — not scheduled')} style={{
          width: dot.isToday ? '9px' : '7px',
          height: dot.isToday ? '9px' : '7px',
          borderRadius:'50%',
          background: dot.done ? C.green : !dot.scheduled ? 'transparent' : (dot.isToday ? C.border : '#1a1a26'),
          border: !dot.scheduled ? '1px solid rgba(255,255,255,0.06)' : dot.isToday ? '1px solid '+C.border : 'none',
          transition:'background 0.2s',
        }}/>
      ))}
    </div>
  )
}

export default function TrackingPage() {
  const router = useRouter()
  const today = toDateStr(new Date())
  const todayDowNum = todayDow()
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })

  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string; big: boolean } | null>(null)
  const toastIdRef = useRef(0)
  const { celebrate } = useCelebration()

  // Streaks need full history, not just a recent window -- a 7-day cap here
  // meant this page's own streak badges could never show more than ~7 even
  // when the real streak was much longer. This is a small personal table,
  // so fetching it all is cheap and keeps this page's numbers agreeing with
  // Home's (see lib/habitStreak.ts).
  const loadData = useCallback(async () => {
    const [{ data: habitsData }, { data: completionsData }] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('sort_order').order('created_at'),
      supabase.from('habit_completions').select('*').order('completed_date'),
    ])
    setHabits(habitsData ?? [])
    setCompletions(completionsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function showToast(text: string, big: boolean) {
    const id = ++toastIdRef.current
    setToast({ id, text, big })
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), big ? 4200 : 2600)
  }

  async function toggleCompletion(habit: Habit) {
    if (saving) return
    const already = completions.find(c => c.habit_id === habit.id && c.completed_date === today)
    setSaving(habit.id)
    if (already) {
      // Un-tick
      await supabase.from('habit_completions').delete().eq('id', already.id)
      setCompletions(prev => prev.filter(c => c.id !== already.id))
    } else {
      // Tick
      const { data } = await supabase.from('habit_completions').insert({ habit_id: habit.id, completed_date: today }).select().single()
      if (data) {
        const next = [...completions, data]
        setCompletions(next)
        const newStreak = streakFor(habit, next)
        const isMilestone = STREAK_MILESTONES.includes(newStreak)
        celebrate(isMilestone ? 'stage' : 'task')
        showToast(isMilestone ? milestoneMsg(habit.title, newStreak) : ENCOURAGE_MSGS[Math.floor(Math.random() * ENCOURAGE_MSGS.length)], isMilestone)
      }
    }
    setSaving(null)
  }

  async function saveHabit(data: Omit<Habit,'id'|'created_at'>) {
    if (editHabit) {
      await supabase.from('habits').update(data).eq('id', editHabit.id)
    } else {
      await supabase.from('habits').insert({ ...data, sort_order: habits.length })
    }
    setShowModal(false)
    setEditHabit(null)
    await loadData()
  }

  async function deleteHabit(id: string) {
    if (!confirm('Delete this habit? Completions will also be removed.')) return
    await supabase.from('habits').update({ active: false }).eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  // Today's scheduled habits
  const todayHabits = habits.filter(isScheduledToday)
  const completedToday = todayHabits.filter(h => completions.some(c => c.habit_id === h.id && c.completed_date === today))
  const missedToday = todayHabits.filter(h =>
    !completions.some(c => c.habit_id === h.id && c.completed_date === today) &&
    isPastScheduledTime(h)
  )
  const score = todayHabits.length > 0 ? Math.round((completedToday.length / todayHabits.length) * 100) : 0

  // Accountability message
  const accountabilityMsg = (() => {
    if (loading) return null
    if (todayHabits.length === 0) return null
    const now = new Date()
    const hour = now.getHours()
    if (completedToday.length === todayHabits.length) return { type:'success', msg:"All done. Excellent discipline today." }
    if (missedToday.length > 0 && hour >= 18) return { type:'warning', msg: missedToday.length + ' habit' + (missedToday.length>1?'s':'') + ' missed past their target time. No excuses — get them done or mark it as a loss.' }
    if (score < 50 && hour >= 20) return { type:'danger', msg: "You're at " + score + "% with the day nearly over. This is below standard. What went wrong and what changes tomorrow?" }
    return null
  })()

  const totalStreaks = habits.reduce((sum, h) => sum + streakFor(h, completions), 0)
  const longestStreak = habits.reduce((max, h) => Math.max(max, streakFor(h, completions)), 0)

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'inherit' }}>
      {/* Header */}
      <div style={{ padding:'1.75rem 2rem 1.5rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(139,92,246,0.06) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'860px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
            <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit' }}>
              <ChevronLeft size={14}/> Home
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.25rem', letterSpacing:'-0.02em' }}>
                &#128293; Habit Tracker
              </h1>
              <p style={{ fontSize:'0.85rem', color:C.sec, margin:0 }}>{todayLabel}</p>
            </div>
            <button onClick={() => { setEditHabit(null); setShowModal(true) }} style={{
              display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1.1rem',
              background:'linear-gradient(135deg,'+C.purple+',#6d28d9)', border:'none', borderRadius:'0.75rem',
              color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit',
            }}><Plus size={14}/> Add habit</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'860px', margin:'0 auto', padding:'1.75rem 2rem' }}>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'0.75rem', marginBottom:'2rem' }}>
          {[
            { icon:<Target size={16}/>, label:'Today', value: completedToday.length + ' / ' + todayHabits.length, color:C.cyan, sub:'habits done' },
            { icon:<Trophy size={16}/>, label:'Score', value: score + '%', color: score>=80?C.green:score>=50?C.amber:C.red, sub:score>=80?'great day':score>=50?'room to push':'needs work' },
            { icon:<Flame size={16}/>, label:'Longest streak', value: longestStreak+'d', color:'#ff6b35', sub:'consecutive days' },
            { icon:<CheckCircle2 size={16}/>, label:'Total active streaks', value: habits.filter(h=>streakFor(h,completions)>0).length+'', color:C.purple, sub:'of '+habits.length+' habits' },
          ].map((s,i) => (
            <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:s.color, marginBottom:'0.4rem' }}>
                {s.icon}
                <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.label}</span>
              </div>
              <div style={{ fontSize:'1.6rem', fontWeight:900, color:s.color, lineHeight:1.1, marginBottom:'0.15rem' }}>{s.value}</div>
              <div style={{ fontSize:'0.68rem', color:C.muted }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Accountability banner */}
        {accountabilityMsg && (
          <div style={{
            display:'flex', alignItems:'flex-start', gap:'0.75rem',
            padding:'0.875rem 1rem', borderRadius:'0.875rem', marginBottom:'1.5rem',
            background: accountabilityMsg.type==='success' ? 'rgba(0,255,136,0.06)' : accountabilityMsg.type==='warning' ? 'rgba(255,184,0,0.07)' : 'rgba(255,68,102,0.07)',
            border: '1px solid '+(accountabilityMsg.type==='success' ? 'rgba(0,255,136,0.25)' : accountabilityMsg.type==='warning' ? 'rgba(255,184,0,0.25)' : 'rgba(255,68,102,0.25)'),
          }}>
            {accountabilityMsg.type==='success'
              ? <CheckCircle2 size={16} color={C.green} style={{ flexShrink:0, marginTop:'2px' }}/>
              : <AlertTriangle size={16} color={accountabilityMsg.type==='warning'?C.amber:C.red} style={{ flexShrink:0, marginTop:'2px' }}/>}
            <p style={{ margin:0, fontSize:'0.82rem', color: accountabilityMsg.type==='success'?C.green:accountabilityMsg.type==='warning'?C.amber:C.red, fontWeight:600, lineHeight:1.5 }}>
              {accountabilityMsg.msg}
            </p>
          </div>
        )}

        {/* Today section */}
        <div style={{ marginBottom:'2rem' }}>
          <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.75rem' }}>
            Today &mdash; {DAY_FULL[todayDowNum]}
          </p>

          {loading ? (
            <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
          ) : todayHabits.length === 0 ? (
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'2rem', textAlign:'center', color:C.muted, fontSize:'0.85rem' }}>
              No habits scheduled for today. Add one above.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {todayHabits.map(habit => {
                const done = completions.some(c => c.habit_id === habit.id && c.completed_date === today)
                const missed = !done && isPastScheduledTime(habit)
                const streak = streakFor(habit, completions)
                return (
                  <div key={habit.id} style={{
                    display:'flex', alignItems:'center', gap:'1rem',
                    padding:'0.875rem 1rem',
                    background: done ? 'rgba(0,255,136,0.05)' : missed ? 'rgba(255,68,102,0.04)' : C.card,
                    border:'1px solid '+(done?'rgba(0,255,136,0.2)':missed?'rgba(255,68,102,0.2)':C.border),
                    borderRadius:'0.875rem', transition:'all 0.2s ease',
                  }}>
                    <button onClick={() => toggleCompletion(habit)} disabled={saving===habit.id}
                      style={{ background:'none', border:'none', cursor:'pointer', color: done?C.green:C.muted, display:'flex', flexShrink:0, transition:'color 0.15s' }}>
                      {done ? <CheckCircle2 size={22} fill="rgba(0,255,136,0.15)"/> : <Circle size={22}/>}
                    </button>

                    <div style={{ fontSize:'1.2rem', flexShrink:0 }}
                      dangerouslySetInnerHTML={{ __html: habit.emoji || '&#10003;' }}/>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                        <span style={{
                          fontSize:'0.88rem', fontWeight:700,
                          color: done ? C.green : missed ? C.red : C.text,
                          textDecoration: done ? 'line-through' : 'none',
                          transition:'all 0.2s',
                        }}>{habit.title}</span>
                        {streak > 0 && <StreakBadge streak={streak} color={habit.color}/>}
                        {missed && !done && (
                          <span style={{ fontSize:'0.62rem', fontWeight:700, color:C.red, background:'rgba(255,68,102,0.1)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:'9999px', padding:'0.1rem 0.4rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>Missed</span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.3rem' }}>
                        <WeekDots habit={habit} completions={completions}/>
                        {habit.schedule_time && (
                          <span style={{ fontSize:'0.65rem', color:C.muted }}>by {habit.schedule_time}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
                      <button onClick={() => { setEditHabit(habit); setShowModal(true) }}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => deleteHabit(habit.id)}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* All habits (not scheduled today) */}
        {habits.filter(h => !isScheduledToday(h)).length > 0 && (
          <div>
            <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.75rem' }}>
              Not scheduled today
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {habits.filter(h => !isScheduledToday(h)).map(habit => {
                const streak = streakFor(habit, completions)
                return (
                  <div key={habit.id} style={{
                    display:'flex', alignItems:'center', gap:'1rem', padding:'0.75rem 1rem',
                    background:C.surface, border:'1px solid '+C.border, borderRadius:'0.875rem', opacity:0.7,
                  }}>
                    <div style={{ fontSize:'1rem', flexShrink:0 }}
                      dangerouslySetInnerHTML={{ __html: habit.emoji || '&#10003;' }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <span style={{ fontSize:'0.85rem', fontWeight:600, color:C.sec }}>{habit.title}</span>
                        {streak > 0 && <StreakBadge streak={streak} color={habit.color}/>}
                      </div>
                      <div style={{ fontSize:'0.68rem', color:C.muted, marginTop:'0.2rem' }}>
                        {SCHEDULE_OPTIONS.find(o => o.value === habit.schedule_type)?.label ?? habit.schedule_type}
                        {habit.schedule_type === 'custom' && habit.schedule_days.length > 0
                          ? ' — ' + habit.schedule_days.map(d => DAYS[d]).join(', ')
                          : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
                      <button onClick={() => { setEditHabit(habit); setShowModal(true) }}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => deleteHabit(habit.id)}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <HabitModal
          initial={editHabit ?? undefined}
          onSave={saveHabit}
          onClose={() => { setShowModal(false); setEditHabit(null) }}
        />
      )}

      {/* Encouragement toast — fires on every completion (small) and gets a
          bigger, specific callout on streak milestones. */}
      {toast && (
        <div key={toast.id} style={{
          position:'fixed', left:'50%', bottom: '2rem', transform:'translateX(-50%)',
          zIndex:80, display:'flex', alignItems:'center', gap:'0.5rem',
          padding: toast.big ? '0.875rem 1.5rem' : '0.65rem 1.1rem',
          maxWidth:'min(90vw, 30rem)',
          background: toast.big ? 'linear-gradient(135deg,rgba(255,184,0,0.16),rgba(255,107,53,0.16))' : 'rgba(18,18,26,0.95)',
          border:'1px solid '+(toast.big ? 'rgba(255,184,0,0.4)' : C.border),
          borderRadius:'9999px', backdropFilter:'blur(12px)',
          boxShadow:'0 8px 28px rgba(0,0,0,0.4)',
          animation:'toastIn 0.3s ease both, toastOut 0.3s ease '+(toast.big ? '3.9s' : '2.3s')+' both',
        }}>
          {toast.big ? <Trophy size={15} color={C.amber} style={{ flexShrink:0 }}/> : <Sparkles size={13} color={C.green} style={{ flexShrink:0 }}/>}
          <span style={{ fontSize: toast.big ? '0.85rem' : '0.8rem', fontWeight:700, color: toast.big ? C.amber : C.text, lineHeight:1.4 }}>
            {toast.text}
          </span>
        </div>
      )}

      <style>{`
        @keyframes toastIn { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes toastOut { from{opacity:1} to{opacity:0} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        input, select { outline:none; }
        input:focus, select:focus { border-color: #8b5cf6 !important; }
        button:hover { opacity:0.85; }
      `}</style>
    </main>
  )
}
