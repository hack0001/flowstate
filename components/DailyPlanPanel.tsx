'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, CheckCircle2, Circle, ArrowUp, ArrowDown, Clock3, SkipForward, RefreshCw } from 'lucide-react'
import {
  getDailyPlan, generateDailyPlan, clearDailyPlan, updatePlanItem, reorderPlan, rescheduleItem,
  getDailyPlanSettings, saveDailyPlanSettings, toDateStr,
  type DailyPlanItem, type DailyPlanSettings, SECTION_LABEL,
} from '@/lib/dailyPlan'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const SECTION_COLOR: Record<string, string> = {
  youtube: '#ff4466', etsy: '#f97316', tasks: '#00ff88', x: '#00d4ff', vault: '#8b5cf6',
}

function fmtMins(m: number): string {
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60), r = m % 60
  return r === 0 ? h + 'h' : h + 'h ' + r + 'm'
}

// Renders and (optionally) lets you edit the generated daily plan for a
// given date. `editable=true` on the Evening page (tomorrow's draft);
// `editable=false` on Home (today's locked-in plan, read-only + done toggle).
export default function DailyPlanPanel({ date, editable, clickThrough }: { date: string; editable: boolean; clickThrough?: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<DailyPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [settings, setSettings] = useState<DailyPlanSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const plan = await getDailyPlan(date)
    setItems(plan.filter(i => i.status !== 'rescheduled'))
    setLoading(false)
    return plan
  }, [date])

  useEffect(() => { load() }, [load])
  useEffect(() => { getDailyPlanSettings().then(setSettings) }, [])

  const autoGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const rows = await generateDailyPlan(date)
      setItems(rows)
    } catch {
      // Likely migration 020 not run yet — fail quietly, empty state explains it
    }
    setGenerating(false)
  }, [date])

  useEffect(() => {
    if (editable && !loading && items.length === 0 && !generating) { autoGenerate() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, loading])

  async function regenerate() {
    setGenerating(true)
    await clearDailyPlan(date)
    try {
      const rows = await generateDailyPlan(date)
      setItems(rows)
    } catch {}
    setGenerating(false)
  }

  async function toggleDone(item: DailyPlanItem) {
    const next = item.status === 'done' ? 'planned' : 'done'
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i))
    await updatePlanItem(item.id, { status: next })
  }

  async function skip(item: DailyPlanItem) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'skipped' } : i))
    await updatePlanItem(item.id, { status: 'skipped' })
  }

  async function reschedule(item: DailyPlanItem) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await rescheduleItem(item, toDateStr(d))
  }

  function move(item: DailyPlanItem, dir: -1 | 1) {
    const idx = items.findIndex(i => i.id === item.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= items.length) return
    const next = [...items]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setItems(next)
    reorderPlan(next)
  }

  async function editMinutes(item: DailyPlanItem, minutes: number) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, minutes } : i))
    await updatePlanItem(item.id, { minutes })
  }

  async function saveSettings() {
    if (!settings) return
    await saveDailyPlanSettings(settings)
    setShowSettings(false)
  }

  const totalMins = items.filter(i => i.status !== 'skipped').reduce((s, i) => s + i.minutes, 0)

  if (loading || generating) {
    return <p style={{ fontSize:'0.8rem', color:C.muted }}>{generating ? 'Building your plan…' : 'Loading…'}</p>
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.6rem' }}>
        <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:0, display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <Clock3 size={12}/>{fmtMins(totalMins)} planned
        </p>
        {editable && (
          <div style={{ display:'flex', gap:'0.4rem' }}>
            <button onClick={() => setShowSettings(s => !s)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.3rem 0.5rem', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.65rem', fontFamily:'inherit' }}>
              <Settings2 size={11}/>Weighting
            </button>
            <button onClick={regenerate} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.3rem 0.5rem', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.65rem', fontFamily:'inherit' }}>
              <RefreshCw size={11}/>Regenerate
            </button>
          </div>
        )}
      </div>

      {editable && showSettings && settings && (
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem', marginBottom:'0.75rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
            <label style={{ fontSize:'0.68rem', color:C.sec, flex:1 }}>Total working minutes/day</label>
            <input type="number" value={settings.total_minutes} onChange={e => setSettings({ ...settings, total_minutes: Number(e.target.value) })}
              style={{ width:'4.5rem', padding:'0.3rem 0.4rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem' }}/>
          </div>
          {(['pct_youtube','pct_etsy','pct_tasks','pct_x','pct_vault'] as const).map(k => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.35rem' }}>
              <label style={{ fontSize:'0.68rem', color:C.sec, flex:1 }}>{SECTION_LABEL[k.replace('pct_','') as keyof typeof SECTION_LABEL]} %</label>
              <input type="number" value={settings[k]} onChange={e => setSettings({ ...settings, [k]: Number(e.target.value) })}
                style={{ width:'4.5rem', padding:'0.3rem 0.4rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem' }}/>
            </div>
          ))}
          <button onClick={saveSettings} style={{ width:'100%', marginTop:'0.4rem', padding:'0.4rem', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'0.5rem', color:C.green, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem' }}>
            Save &amp; regenerate next time
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p style={{ fontSize:'0.8rem', color:C.muted, lineHeight:1.5 }}>
          {editable
            ? 'Nothing generated yet — add priority items in Vault, Tasks, Etsy, X, or pin YouTube videos in the Content Pipeline, then reopen this page.'
            : 'No plan for today yet — generate tomorrow\'s plan from the Evening routine.'}
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
          {items.map((item, i) => {
            const color = SECTION_COLOR[item.section] ?? C.muted
            const isDone = item.status === 'done'
            const isSkipped = item.status === 'skipped'
            return (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.55rem 0.7rem',
                background:C.card, border:'1px solid '+(isDone||isSkipped?C.border:color+'33'), borderRadius:'0.65rem',
                opacity:isSkipped?0.45:1,
                cursor: clickThrough && !editable ? 'pointer' : 'default',
              }}
                onClick={() => { if (clickThrough && !editable) router.push(item.section === 'youtube' ? '/content-focus' : '/' + (item.section === 'x' ? 'x' : item.section)) }}
              >
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, flexShrink:0 }}/>
                {!editable ? (
                  <button onClick={e => { e.stopPropagation(); toggleDone(item) }} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', color:isDone?C.green:C.muted, padding:0, flexShrink:0 }}>
                    {isDone ? <CheckCircle2 size={15}/> : <Circle size={15}/>}
                  </button>
                ) : (
                  <span style={{ fontSize:'0.6rem', color:C.muted, fontWeight:700, width:'0.9rem', flexShrink:0 }}>{i+1}</span>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.62rem', color, fontWeight:700, margin:'0 0 0.1rem', textTransform:'uppercase', letterSpacing:'0.04em' }}>{SECTION_LABEL[item.section]}</p>
                  <p style={{ fontSize:'0.78rem', color:C.text, margin:0, textDecoration:isDone?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</p>
                </div>
                {editable ? (
                  <input type="number" value={item.minutes} onChange={e => editMinutes(item, Number(e.target.value))}
                    style={{ width:'3rem', padding:'0.2rem 0.3rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.sec, fontFamily:'inherit', fontSize:'0.68rem', flexShrink:0 }}/>
                ) : (
                  <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{fmtMins(item.minutes)}</span>
                )}
                {editable && (
                  <div style={{ display:'flex', gap:'0.15rem', flexShrink:0 }}>
                    <button onClick={() => move(item, -1)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'2px' }}><ArrowUp size={12}/></button>
                    <button onClick={() => move(item, 1)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'2px' }}><ArrowDown size={12}/></button>
                    <button onClick={() => skip(item)} title="Skip today" style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', padding:'2px' }}><SkipForward size={12}/></button>
                    <button onClick={() => reschedule(item)} title="Push to next day" style={{ background:'none', border:'none', color:C.cyan, cursor:'pointer', display:'flex', padding:'2px', fontSize:'0.6rem', fontWeight:700 }}>&#8594;</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
