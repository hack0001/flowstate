'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Copy, ExternalLink, Volume2, VolumeX, Play, Pause, SkipForward, RefreshCw } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task } from '@/types'
import { sounds } from '@/lib/sounds'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useCelebration } from '@/hooks/useCelebration'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }
const TIPS = [
  { tip:'One task. One screen. One focus.', science:'Task-switching costs 23 minutes of recovery time.' },
  { tip:'Done beats perfect. Ship it.', science:'Perfectionism is procrastination with better PR.' },
  { tip:'Momentum is a superpower.', science:'Completing small tasks triggers dopamine.' },
  { tip:'The next 25 minutes are all that exist.', science:'Pomodoro technique removes decision fatigue.' },
]

function Ring({ progress, phase }: { progress: number; phase: string }) {
  const r = 57, circ = 2 * Math.PI * r
  const color = phase==='work' ? C.cyan : phase==='shortBreak' ? C.green : C.purple
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke={C.border} strokeWidth="6" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}
        style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset 1s linear' }} />
    </svg>
  )
}

export default function FocusPage() {
  const router = useRouter()
  const { id: sid } = useParams() as { id: string }
  const sp = useSearchParams()
  const initTask = sp.get('task')
  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [taskIdx, setTaskIdx] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [justDone, setJustDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length))
  const { celebrate } = useCelebration()

  const allTasks: Task[] = stages.flatMap(s => s.tasks ?? [])
  const task = allTasks[taskIdx] ?? null
  const curStage = task ? stages.find(s => s.tasks?.some(t => t.id===task.id)) : null
  const isDone = task ? doneIds.has(task.id) : false
  const totalDone = allTasks.filter(t => doneIds.has(t.id)).length
  const prog = allTasks.length ? totalDone/allTasks.length : 0

  const onWork = useCallback(() => { if(soundOn) sounds.playTimerEnd(); celebrate('task') }, [soundOn, celebrate])
  const onBreak = useCallback(() => { if(soundOn) sounds.playBreakStart() }, [soundOn])
  const pom = usePomodoro({ onWorkComplete: onWork, onBreakComplete: onBreak })

  useEffect(() => { sounds.setEnabled(soundOn) }, [soundOn])

  useEffect(() => {
    async function load() {
      try {
        const s = await getSession(sid)
        setSession(s)
        const st = await getStagesForWorkflow(s.workflow_type_id)
        const validSt = st ?? []
        setStages(validSt)
        const c = await getCompletions(sid)
        const ids = new Set((c ?? []).map((x: { task_id: string }) => x.task_id))
        setDoneIds(ids)
        const flat: Task[] = validSt.flatMap((stage: Stage) => stage.tasks ?? [])
        const target = initTask ? flat.findIndex(t => t.id===initTask) : flat.findIndex(t => !ids.has(t.id))
        if (target >= 0) setTaskIdx(target)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [sid, initTask])

  async function markDone() {
    if (!task || isDone) return
    sounds.playTaskComplete()
    const arr = Array.from(doneIds); arr.push(task.id)
    const next = new Set(arr)
    setDoneIds(next); setJustDone(true)
    await completeTask(sid, task.id, pom.pomodorosCompleted)
    const stageDone = (curStage?.tasks ?? []).every(t => next.has(t.id))
    setTimeout(() => { if(stageDone) { sounds.playStageComplete(); celebrate('stage') } else { celebrate('task') } }, 100)
    setTimeout(() => {
      setJustDone(false)
      const nx = allTasks.findIndex((t,i) => i>taskIdx && !next.has(t.id))
      if(nx>=0) setTaskIdx(nx)
    }, 1200)
  }

  const phaseColor = pom.phase==='work' ? C.cyan : pom.phase==='shortBreak' ? C.green : C.purple
  const phaseLabel = pom.phase==='work' ? 'Focus Time' : pom.phase==='shortBreak' ? 'Short Break' : 'Long Break'
  const tip = TIPS[tipIdx]

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg, color:C.sec, gap:'0.75rem' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }} />
      Loading...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid '+C.border }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => router.push('/workflow/'+sid)} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}><ArrowLeft size={15} />Overview</button>
          <span style={{ color:C.border }}>|</span>
          <span style={{ fontSize:'0.875rem', color:C.sec, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'300px' }}>{session?.title}</span>
        </div>
        <button onClick={() => setSoundOn(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}>
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid '+C.border }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.375rem' }}>
          <span style={{ fontSize:'0.75rem', color:C.muted }}>{curStage?.name ?? 'Overview'}</span>
          <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.cyan }}>{totalDone}/{allTasks.length} tasks</span>
        </div>
        <div style={{ height:'6px', background:C.border, borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:(prog*100)+'%', background:'linear-gradient(90deg,'+C.cyan+','+C.purple+')', borderRadius:'3px', transition:'width 0.6s ease' }} />
        </div>
      </div>

      <div style={{ flex:1, display:'flex', gap:'1.5rem', padding:'1.5rem', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'280px', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {task ? (
            <>
              <div style={{ background:isDone?'rgba(0,255,136,0.04)':C.card, border:'1px solid '+(isDone?'rgba(0,255,136,0.4)':C.border), borderRadius:'1rem', padding:'1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>Task {taskIdx+1} of {allTasks.length}</span>
                  {isDone && <span style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'9999px', background:'rgba(0,255,136,0.15)', color:C.green }}><CheckCircle2 size={10} />Complete</span>}
                </div>
                <h1 style={{ fontSize:'clamp(1.2rem,2.5vw,1.75rem)', fontWeight:900, color:C.text, lineHeight:1.25, marginBottom:'0.5rem' }}>{task.title}</h1>
                <p style={{ fontSize:'0.875rem', color:C.sec }}>{task.description}</p>
              </div>
              <div style={{ flex:1, background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.5rem', display:'flex', flexDirection:'column' }}>
                <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'1rem' }}>Instructions</p>
                <pre style={{ fontSize:'0.875rem', whiteSpace:'pre-wrap', lineHeight:1.7, color:C.sec, fontFamily:'inherit', flex:1 }}>{task.instructions}</pre>
                {(task.has_prompt||task.resource_url) && (
                  <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.5rem', paddingTop:'1rem', borderTop:'1px solid '+C.border, flexWrap:'wrap' }}>
                    {task.has_prompt && task.prompt_text && (
                      <button onClick={() => { navigator.clipboard.writeText(task.prompt_text!); sounds.playClick(); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
                        style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.875rem', padding:'0.5rem 1rem', borderRadius:'0.75rem', background:copied?'rgba(0,255,136,0.15)':'rgba(139,92,246,0.1)', color:copied?C.green:'#8b5cf6', border:'1px solid '+(copied?'rgba(0,255,136,0.3)':'rgba(139,92,246,0.3)'), cursor:'pointer', fontFamily:'inherit' }}>
                        <Copy size={13} />{copied?'Copied!':'Copy Claude Prompt'}
                      </button>
                    )}
                    {task.resource_url && (
                      <a href={task.resource_url} target="_blank" rel="noopener noreferrer"
                        style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.875rem', padding:'0.5rem 1rem', borderRadius:'0.75rem', background:'rgba(0,212,255,0.1)', color:C.cyan, border:'1px solid rgba(0,212,255,0.2)', textDecoration:'none' }}>
                        <ExternalLink size={13} />Open Resource
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <button onClick={() => setTaskIdx(i=>Math.max(0,i-1))} disabled={taskIdx===0}
                  style={{ padding:'0.875rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center', opacity:taskIdx===0?0.3:1 }}>
                  <ChevronLeft size={20} />
                </button>
                <button onClick={markDone} disabled={isDone||justDone}
                  style={{ flex:1, padding:'1rem', border:isDone?'1px solid rgba(0,255,136,0.3)':'none', borderRadius:'0.75rem', fontWeight:700, fontSize:'1rem', cursor:isDone?'default':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', background:isDone?'rgba(0,255,136,0.15)':'linear-gradient(135deg,'+C.green+',#00cc6a)', color:isDone?C.green:'#000', boxShadow:isDone?'none':'0 4px 20px rgba(0,255,136,0.3)' }}>
                  {isDone ? <><CheckCircle2 size={18} />Done</> : justDone ? 'Great work!' : 'Mark Complete'}
                </button>
                <button onClick={() => setTaskIdx(i=>Math.min(allTasks.length-1,i+1))} disabled={taskIdx===allTasks.length-1}
                  style={{ padding:'0.875rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center', opacity:taskIdx===allTasks.length-1?0.3:1 }}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex:1, background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem', textAlign:'center' }}>
              <div>
                <div style={{ fontSize:'4rem', marginBottom:'1rem' }}>All done!</div>
                <h2 style={{ fontSize:'1.5rem', fontWeight:900, color:C.green, marginBottom:'0.5rem' }}>All tasks complete!</h2>
                <p style={{ color:C.sec }}>Time to publish.</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ width:'280px', flexShrink:0, display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:phaseColor, marginBottom:'0.75rem' }}>{phaseLabel}</p>
            <div style={{ position:'relative', marginBottom:'0.75rem' }}>
              <Ring progress={pom.progress} phase={pom.phase} />
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'1.5rem', fontWeight:900, fontFamily:'monospace', color:C.text }}>{pom.formattedTime}</span>
                <span style={{ fontSize:'0.7rem', color:C.muted }}>#{pom.pomodorosCompleted+1}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.375rem', marginBottom:'1rem' }}>
              {[0,1,2,3].map(i=><div key={i} style={{ width:'0.5rem', height:'0.5rem', borderRadius:'50%', background:i<(pom.pomodorosCompleted%4)?C.cyan:C.border }} />)}
            </div>
            <div style={{ display:'flex', gap:'0.5rem', width:'100%' }}>
              <button onClick={() => pom.isRunning?pom.pause():pom.start()}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.375rem', padding:'0.5rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.875rem' }}>
                {pom.isRunning?<Pause size={14}/>:<Play size={14}/>}{pom.isRunning?'Pause':'Start'}
              </button>
              <button onClick={() => pom.reset()} style={{ padding:'0.5rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center' }}><RefreshCw size={14}/></button>
              <button onClick={() => pom.skip()} style={{ padding:'0.5rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', display:'flex', alignItems:'center' }}><SkipForward size={14}/></button>
            </div>
            {pom.isBreak && <p style={{ fontSize:'0.75rem', textAlign:'center', color:C.green, marginTop:'0.75rem' }}>{pom.phase==='shortBreak'?'Step away. Breathe.':'Longer break - walk around.'}</p>}
          </div>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.5rem' }}>Focus Tip</p>
            <p style={{ fontWeight:600, fontSize:'0.875rem', color:C.text, marginBottom:'0.375rem' }}>{tip.tip}</p>
            <p style={{ fontSize:'0.75rem', lineHeight:1.5, color:C.muted }}>{tip.science}</p>
          </div>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Progress</p>
            {stages.map(s=>{
              const ts=s.tasks??[]; const d=ts.filter(t=>doneIds.has(t.id)).length; const p=ts.length?d/ts.length*100:0; const active=s.id===curStage?.id
              return (
                <div key={s.id} style={{ marginBottom:'0.625rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                    <span style={{ fontSize:'0.75rem', color:active?C.cyan:C.muted, fontWeight:active?600:400 }}>{s.name}</span>
                    <span style={{ fontSize:'0.75rem', color:C.muted }}>{d}/{ts.length}</span>
                  </div>
                  <div style={{ height:'3px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:p+'%', background:'linear-gradient(90deg,'+C.cyan+','+C.purple+')', borderRadius:'2px', transition:'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
