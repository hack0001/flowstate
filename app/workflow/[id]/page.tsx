'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Zap, Target, ChevronRight, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { getSession, getStagesForWorkflow, getCompletions, completeTask, uncompleteTask } from '@/lib/supabase'
import type { WorkflowSession, Stage, Task, TaskCompletion } from '@/types'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', cyan:'#00d4ff', green:'#00ff88', purple:'#8b5cf6', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }

export default function WorkflowPage() {
  const router = useRouter()
  const { id: sessionId } = useParams() as { id: string }
  const [session, setSession] = useState<WorkflowSession | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { celebrate } = useCelebration()

  const doneIds = new Set(completions.map(c => c.task_id))
  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const totalDone = allTasks.filter(t => doneIds.has(t.id)).length
  const pct = allTasks.length ? totalDone / allTasks.length : 0

  const load = useCallback(async () => {
    try {
      const s = await getSession(sessionId)
      setSession(s)
      const st = await getStagesForWorkflow(s.workflow_type_id)
      setStages(st ?? [])
      const c = await getCompletions(sessionId)
      setCompletions(c ?? [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  async function toggleTask(task: Task) {
    if (doneIds.has(task.id)) {
      sounds.playClick()
      await uncompleteTask(sessionId, task.id)
      setCompletions(p => p.filter(c => c.task_id !== task.id))
    } else {
      sounds.playTaskComplete()
      await completeTask(sessionId, task.id)
      const next = [...completions, { id: Date.now().toString(), session_id: sessionId, task_id: task.id, completed_at: new Date().toISOString(), pomodoros_used: 0 }]
      setCompletions(next)
      const nextIds = new Set(next.map(c => c.task_id))
      const stageDone = (stages[activeIdx]?.tasks ?? []).every(t => nextIds.has(t.id))
      if (stageDone) { sounds.playStageComplete(); celebrate('stage') } else { celebrate('task') }
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg, color:C.sec, gap:'0.75rem' }}>
      <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', border:'2px solid '+C.cyan, borderTopColor:'transparent', animation:'spin 1s linear infinite' }} />
      Loading...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const stage = stages[activeIdx]
  const tasks = stage?.tasks ?? []

  return (
    <main style={{ minHeight:'100vh', maxWidth:'48rem', margin:'0 auto', padding:'2rem 1.5rem', background:C.bg }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem' }}>
        <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontSize:'0.875rem', fontFamily:'inherit' }}><ArrowLeft size={16} />Home</button>
        <button onClick={() => router.push('/workflow/'+sessionId+'/focus')} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 1.2rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.875rem' }}><Zap size={14} />Focus Mode</button>
      </div>

      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:C.text, marginBottom:'1rem' }}>{session?.title}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <div style={{ flex:1, height:'6px', background:C.border, borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:(pct*100)+'%', background:'linear-gradient(90deg,'+C.cyan+','+C.purple+')', borderRadius:'3px', transition:'width 0.6s ease' }} />
          </div>
          <span style={{ fontSize:'0.875rem', fontWeight:700, color:C.cyan }}>{totalDone}/{allTasks.length}</span>
        </div>
      </div>

      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {stages.map((s, i) => {
          const sp = s.tasks?.length ? Math.round(s.tasks.filter(t=>doneIds.has(t.id)).length/s.tasks.length*100) : 0
          const done = sp===100; const active = i===activeIdx
          return (
            <button key={s.id} onClick={() => { sounds.playClick(); setActiveIdx(i) }}
              style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', padding:'0.375rem 0.875rem', borderRadius:'9999px', fontSize:'0.875rem', fontWeight:500, border:'1px solid '+(done?'rgba(0,255,136,0.4)':active?C.cyan:C.border), background:done?'rgba(0,255,136,0.1)':active?'rgba(0,212,255,0.1)':C.surface, color:done?C.green:active?C.cyan:C.sec, cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' }}>
              {done && <CheckCircle2 size={13} />}{s.name}
              {sp>0&&!done && <span style={{ color:C.muted, fontSize:'0.75rem' }}>{sp}%</span>}
            </button>
          )
        })}
      </div>

      {stage && (
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
          <div>
            <h2 style={{ fontSize:'1.125rem', fontWeight:700, color:C.text, margin:'0 0 0.2rem' }}>{stage.name}</h2>
            <p style={{ fontSize:'0.875rem', color:C.sec }}>{stage.description}</p>
          </div>
          <span style={{ fontSize:'0.875rem', color:C.sec }}>{tasks.filter(t=>doneIds.has(t.id)).length}/{tasks.length} done</span>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'1.5rem' }}>
        {tasks.map(task => {
          const done = doneIds.has(task.id)
          const exp = expanded===task.id
          return (
            <div key={task.id} style={{ background:done?'rgba(0,255,136,0.03)':C.card, border:'1px solid '+(done?'rgba(0,255,136,0.3)':exp?C.cyan:C.border), borderRadius:'1rem', overflow:'hidden', transition:'all 0.2s' }}>
              <div onClick={() => { sounds.playClick(); setExpanded(exp?null:task.id) }} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem', cursor:'pointer' }}>
                <div onClick={e => { e.stopPropagation(); toggleTask(task) }}
                  style={{ width:'1.25rem', height:'1.25rem', borderRadius:'0.375rem', border:'2px solid '+(done?C.green:C.border), background:done?C.green:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', transition:'all 0.2s' }}>
                  {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:'0.875rem', color:done?C.muted:C.text, textDecoration:done?'line-through':'none', marginBottom:'0.15rem' }}>{task.title}</p>
                  <p style={{ fontSize:'0.75rem', color:C.sec }}>{task.description}{task.estimated_minutes?' ~'+task.estimated_minutes+'m':''}</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
                  {!done && (
                    <button onClick={e => { e.stopPropagation(); router.push('/workflow/'+sessionId+'/focus?task='+task.id) }}
                      style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', padding:'0.25rem 0.5rem', borderRadius:'0.5rem', background:'rgba(0,212,255,0.1)', color:C.cyan, border:'1px solid rgba(0,212,255,0.2)', cursor:'pointer', fontFamily:'inherit' }}>
                      <Target size={11} />Focus
                    </button>
                  )}
                  <ChevronRight size={16} color={C.muted} style={{ transform:exp?'rotate(90deg)':'none', transition:'transform 0.2s' }} />
                </div>
              </div>
              {exp && (
                <div style={{ padding:'0 1rem 1rem', borderTop:'1px solid '+C.border }}>
                  <pre style={{ fontSize:'0.875rem', whiteSpace:'pre-wrap', lineHeight:1.7, color:C.sec, fontFamily:'inherit', paddingTop:'0.75rem' }}>{task.instructions}</pre>
                  <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem', flexWrap:'wrap' }}>
                    {task.has_prompt && task.prompt_text && (
                      <button onClick={() => { navigator.clipboard.writeText(task.prompt_text!); sounds.playClick() }}
                        style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', padding:'0.375rem 0.75rem', borderRadius:'0.5rem', background:'rgba(139,92,246,0.1)', color:'#8b5cf6', border:'1px solid rgba(139,92,246,0.3)', cursor:'pointer', fontFamily:'inherit' }}>
                        <Copy size={11} />Copy Claude Prompt
                      </button>
                    )}
                    {task.resource_url && (
                      <a href={task.resource_url} target="_blank" rel="noopener noreferrer"
                        style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', padding:'0.375rem 0.75rem', borderRadius:'0.5rem', background:'rgba(0,212,255,0.1)', color:C.cyan, border:'1px solid rgba(0,212,255,0.2)', textDecoration:'none' }}>
                        <ExternalLink size={11} />Open Resource
                      </a>
                    )}
                    <button onClick={() => toggleTask(task)} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', padding:'0.375rem 0.75rem', borderRadius:'0.5rem', background:'rgba(0,255,136,0.15)', color:C.green, border:'1px solid rgba(0,255,136,0.3)', cursor:'pointer', fontFamily:'inherit' }}>
                      <CheckCircle2 size={11} />{done?'Mark Incomplete':'Mark Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <button onClick={() => setActiveIdx(i=>Math.max(0,i-1))} disabled={activeIdx===0}
          style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:600, opacity:activeIdx===0?0.3:1 }}>
          &larr; Previous
        </button>
        <button onClick={() => setActiveIdx(i=>Math.min(stages.length-1,i+1))} disabled={activeIdx===stages.length-1}
          style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontWeight:600, opacity:activeIdx===stages.length-1?0.3:1 }}>
          Next &rarr;
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )
}
