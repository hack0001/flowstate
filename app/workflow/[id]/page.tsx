'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight, Copy, ExternalLink, Zap } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask, uncompleteTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task } from '@/types'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', amber:'#ffb800', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

function fmt(s: number) { const m=Math.floor(s/60), sec=s%60; return m>0?`${m}m ${sec}s`:`${sec}s` }

export default function WorkflowPage() {
  const router = useRouter()
  const { id: sid } = useParams() as { id: string }
  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [activeIdx, setActiveIdx] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { celebrate } = useCelebration()

  const allTasks: Task[] = stages.flatMap(s => s.tasks ?? [])
  const totalDone = allTasks.filter(t => doneIds.has(t.id)).length
  const prog = allTasks.length ? totalDone/allTasks.length : 0
  const stage = stages[activeIdx]
  const stageTasks: Task[] = stage?.tasks ?? []
  const stageDoneCount = stageTasks.filter(t => doneIds.has(t.id)).length

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
        // Jump to first incomplete stage
        const flat: Task[] = validSt.flatMap((st2: Stage) => st2.tasks ?? [])
        const firstInc = flat.find(t => !ids.has(t.id))
        if (firstInc) {
          const si = validSt.findIndex((st2: Stage) => st2.tasks?.some((t: Task) => t.id===firstInc.id))
          if (si >= 0) setActiveIdx(si)
        }
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [sid])

  const toggleTask = useCallback(async (task: Task) => {
    const wasDone = doneIds.has(task.id)
    if (!wasDone) {
      sounds.playTaskComplete()
      const next = new Set(Array.from(doneIds).concat(task.id))
      setDoneIds(next)
      await completeTask(sid, task.id, 0, 0)
      const allStageDone = stageTasks.every(t => next.has(t.id))
      if (allStageDone) { sounds.playStageComplete(); celebrate('stage') } else { celebrate('task') }
    } else {
      const next = new Set(Array.from(doneIds).filter(id => id !== task.id))
      setDoneIds(next)
      await uncompleteTask(sid, task.id)
    }
  }, [doneIds, sid, stageTasks, celebrate])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg, color:C.sec, gap:'0.75rem' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:C.bg, padding:'1.5rem', maxWidth:'64rem', margin:'0 auto' }}>
      {/* Back */}
      <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit', marginBottom:'1.5rem' }}>
        <ArrowLeft size={15}/>Home
      </button>

      {/* Title + overall progress */}
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'clamp(1.4rem,3vw,2rem)', fontWeight:900, color:C.text, marginBottom:'0.5rem' }}>{session?.title}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.5rem' }}>
          <span style={{ fontSize:'0.875rem', color:C.sec }}>{totalDone} / {allTasks.length} tasks complete</span>
          <span style={{ fontSize:'0.875rem', fontWeight:700, color:C.cyan }}>{Math.round(prog*100)}%</span>
        </div>
        <div style={{ height:'6px', background:C.border, borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:(prog*100)+'%', background:'linear-gradient(90deg,'+C.cyan+','+C.purple+')', borderRadius:'3px', transition:'width 0.6s ease' }}/>
        </div>
      </div>

      {/* Stage pills */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', overflowX:'auto', paddingBottom:'0.25rem' }}>
        {stages.map((s,i) => {
          const ts=s.tasks??[]; const d=ts.filter(t=>doneIds.has(t.id)).length; const done=d===ts.length&&ts.length>0; const active=i===activeIdx
          return (
            <button key={s.id} onClick={() => setActiveIdx(i)}
              style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.4rem 0.875rem', borderRadius:'9999px', fontSize:'0.8rem', fontWeight:active?700:400, border:'1px solid '+(active?C.cyan:done?'rgba(0,255,136,0.4)':C.border), background:active?'rgba(0,212,255,0.1)':done?'rgba(0,255,136,0.05)':'transparent', color:active?C.cyan:done?C.green:C.sec, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {done && <CheckCircle2 size={12}/>}{s.name}
              <span style={{ fontSize:'0.7rem', opacity:0.7 }}>{d}/{ts.length}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
        {/* Task list */}
        <div style={{ flex:1, minWidth:'280px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ fontWeight:800, fontSize:'1.1rem', color:C.text }}>{stage?.name}</h2>
              <p style={{ fontSize:'0.75rem', color:C.sec }}>{stage?.description} &middot; {stageDoneCount}/{stageTasks.length} done</p>
            </div>
            <button onClick={() => {
              const firstInc = stageTasks.find(t => !doneIds.has(t.id))
              const ti = allTasks.findIndex(t => t.id===firstInc?.id)
              router.push('/workflow/'+sid+'/focus'+(ti>=0?'?task='+firstInc!.id:''))
            }} style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 1rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit' }}>
              <Zap size={13}/>Focus Mode
            </button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {stageTasks.map(task => {
              const done = doneIds.has(task.id); const exp = expanded===task.id
              return (
                <div key={task.id} style={{ background:C.card, border:'1px solid '+(done?'rgba(0,255,136,0.3)':exp?C.cyan:C.border), borderRadius:'0.875rem', overflow:'hidden', transition:'border-color 0.2s' }}>
                  <div onClick={() => setExpanded(exp?null:task.id)} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem', cursor:'pointer' }}>
                    <button onClick={e => { e.stopPropagation(); toggleTask(task) }}
                      style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', display:'flex', color:done?C.green:C.muted, padding:0 }}>
                      {done ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:600, fontSize:'0.9rem', color:done?C.muted:C.text, textDecoration:done?'line-through':'none' }}>{task.title}</p>
                      <p style={{ fontSize:'0.75rem', color:C.muted }}>{task.description}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
                      <span style={{ fontSize:'0.7rem', color:C.muted }}>{task.estimated_minutes ?? 10}m</span>
                      <span style={{ color:C.muted, fontSize:'0.75rem' }}>{exp?'^':'v'}</span>
                    </div>
                  </div>
                  {exp && (
                    <div style={{ padding:'0 1rem 1rem', borderTop:'1px solid '+C.border }}>
                      <pre style={{ fontSize:'0.85rem', whiteSpace:'pre-wrap', lineHeight:1.7, color:C.sec, fontFamily:'inherit', margin:'0.75rem 0' }}>{task.instructions}</pre>
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        {task.has_prompt && task.prompt_text && (
                          <button onClick={() => { navigator.clipboard.writeText(task.prompt_text!); setCopied(task.id); setTimeout(()=>setCopied(null),2000) }}
                            style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8rem', padding:'0.4rem 0.875rem', borderRadius:'0.625rem', background:copied===task.id?'rgba(0,255,136,0.15)':'rgba(139,92,246,0.1)', color:copied===task.id?C.green:'#8b5cf6', border:'1px solid '+(copied===task.id?'rgba(0,255,136,0.3)':'rgba(139,92,246,0.3)'), cursor:'pointer', fontFamily:'inherit' }}>
                            <Copy size={12}/>{copied===task.id?'Copied!':'Copy Prompt'}
                          </button>
                        )}
                        {task.resource_url && (
                          <a href={task.resource_url} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8rem', padding:'0.4rem 0.875rem', borderRadius:'0.625rem', background:'rgba(0,212,255,0.1)', color:C.cyan, border:'1px solid rgba(0,212,255,0.2)', textDecoration:'none' }}>
                            <ExternalLink size={12}/>Resource
                          </a>
                        )}
                        <button onClick={() => router.push('/workflow/'+sid+'/focus?task='+task.id)}
                          style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8rem', padding:'0.4rem 0.875rem', borderRadius:'0.625rem', background:'rgba(0,212,255,0.08)', color:C.cyan, border:'1px solid rgba(0,212,255,0.2)', cursor:'pointer', fontFamily:'inherit' }}>
                          <Zap size={12}/>Focus on this
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Stage nav */}
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.5rem' }}>
            <button onClick={() => setActiveIdx(i=>Math.max(0,i-1))} disabled={activeIdx===0}
              style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.875rem', opacity:activeIdx===0?0.3:1 }}>
              <ChevronLeft size={15}/>Prev
            </button>
            <button onClick={() => setActiveIdx(i=>Math.min(stages.length-1,i+1))} disabled={activeIdx===stages.length-1}
              style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.875rem', opacity:activeIdx===stages.length-1?0.3:1 }}>
              Next<ChevronRight size={15}/>
            </button>
          </div>
        </div>

        {/* Stats sidebar */}
        <div style={{ width:'240px', flexShrink:0 }}>
          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>All Stages</p>
            {stages.map((s,i) => {
              const ts=s.tasks??[]; const d=ts.filter(t=>doneIds.has(t.id)).length; const p=ts.length?d/ts.length*100:0
              return (
                <div key={s.id} style={{ marginBottom:'0.625rem', cursor:'pointer' }} onClick={() => setActiveIdx(i)}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
                    <span style={{ fontSize:'0.75rem', color:i===activeIdx?C.cyan:C.muted, fontWeight:i===activeIdx?600:400 }}>{s.name}</span>
                    <span style={{ fontSize:'0.7rem', color:C.muted }}>{d}/{ts.length}</span>
                  </div>
                  <div style={{ height:'3px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:p+'%', background:'linear-gradient(90deg,'+C.cyan+','+C.purple+')', borderRadius:'2px' }}/>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.75rem' }}>Time Estimates</p>
            {stages.map(s => {
              const ts=s.tasks??[]; const total=ts.reduce((a,t)=>a+(t.estimated_minutes??10),0); const done=ts.filter(t=>doneIds.has(t.id)); const saved=done.reduce((a,t)=>a+(t.estimated_minutes??10),0)
              return (
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                  <span style={{ fontSize:'0.75rem', color:C.muted }}>{s.name}</span>
                  <span style={{ fontSize:'0.75rem', color:C.sec }}>{fmt(saved*60)} / {fmt(total*60)}</span>
                </div>
              )
            })}
            <div style={{ borderTop:'1px solid '+C.border, paddingTop:'0.5rem', marginTop:'0.5rem', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.text }}>Total</span>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.cyan }}>{fmt(allTasks.reduce((a,t)=>a+(t.estimated_minutes??10),0)*60)}</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
