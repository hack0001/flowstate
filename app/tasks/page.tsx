'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Search, X, CheckSquare, Download, Plus, Edit3, Trash2, Zap, TrendingUp, ChevronDown, BookOpen } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

// Local-date helpers for the reschedule quick-picks — avoid toISOString's
// UTC shift, which can land on the wrong day near midnight.
function toDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function addMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth()+n); return r }

// Reschedule quick-picks shown in the task modal. "Later this week" and
// "Next week" assume a Monday-start week (matching the Calendar page);
// "Next month" / "2 months" are straight date offsets, not month starts.
function rescheduleOptions(from: Date = new Date()): { label: string; date: string }[] {
  const dow = from.getDay() // 0=Sun..6=Sat
  const daysLeftInWeek = dow === 0 ? 0 : 7 - dow
  const laterThisWeekStep = Math.min(2, Math.max(1, daysLeftInWeek))
  const daysUntilNextMonday = ((8 - dow) % 7) || 7
  return [
    { label: 'Later this week', date: toDateStr(addDays(from, laterThisWeekStep)) },
    { label: 'Next week', date: toDateStr(addDays(from, daysUntilNextMonday)) },
    { label: 'Next month', date: toDateStr(addMonths(from, 1)) },
    { label: '2 months from now', date: toDateStr(addMonths(from, 2)) },
  ]
}

const TYPE_META: Record<string, { color: string }> = {
  'Flow':       { color: '#00d4ff' },
  'Personal':   { color: '#8b5cf6' },
  'Admin':      { color: '#4a4a6a' },
  'Quick Task': { color: '#ffb800' },
  'Recurring':  { color: '#00ff88' },
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'Not started': { color:'#4a4a6a', bg:'rgba(74,74,106,0.15)' },
  'In progress': { color:'#00d4ff', bg:'rgba(0,212,255,0.1)' },
  'Done':        { color:'#00ff88', bg:'rgba(0,255,136,0.1)' },
}
const STATUS_CYCLE: Record<string, string> = {
  'Not started': 'In progress',
  'In progress': 'Done',
  'Done': 'Not started',
}

const TYPES    = ['All', 'No Type', 'Flow', 'Personal', 'Admin', 'Quick Task', 'Recurring']
const STATUSES = ['All', 'Not started', 'In progress', 'Done']
const TASK_TYPES = ['Flow', 'Personal', 'Admin', 'Quick Task', 'Recurring']
const URGENCY_OPTS = ['', 'Urgent', 'Not Urgent']
const IMPORTANCE_OPTS = ['', 'Moved the Needle', 'Important', 'Not Important']
const PRIORITY_OPTS = ['', 'High', 'Medium', 'Low']
const TIME_OPTS = ['', 'Quick (< 15 min)', 'Short (15–30 min)', 'Medium (30–60 min)', 'Long (1–2 hrs)', 'Deep (2+ hrs)']
const SORTS = [
  { key: 'created_at_desc', label: 'Newest first' },
  { key: 'created_at_asc',  label: 'Oldest first' },
  { key: 'deadline_asc',    label: 'Deadline (soonest)' },
  { key: 'task_type',       label: 'Category' },
  { key: 'urgency',         label: 'Urgency first' },
]

const MARGINAL_GAINS = [
  { icon:'&#128693;', title:'Change your lycra', detail:'British Cycling switched to a thinner, lighter lycra suit — 0.1% faster. The aggregation of hundreds of changes like this won them 8 Olympic golds in 4 years.' },
  { icon:'&#128295;', title:'Prepare your workspace before you sit', detail:'Spend 2 minutes clearing your desk and opening only the tabs you need. The friction-free start adds up to 20+ extra focused minutes per day.' },
  { icon:'&#128169;', title:'Eat the frog before coffee', detail:'Mark your hardest task as a Frog and do it first — before email, before Slack, before anything. David Goins: the hardest action first is the identity of elite performers.' },
  { icon:'&#128200;', title:'Write the outcome, not the action', detail:'"Email John about project" fails. "Get sign-off from John on Phase 2 brief" wins. Specific task language = specific mental clarity = faster execution.' },
  { icon:'&#9749;', title:'Make the next action frictionless', detail:'Fill the kettle the night before. Set your running shoes by the door. The 1% habit trick: reduce activation energy to near zero for the behaviours you want.' },
  { icon:'&#128337;', title:'Use a 25-minute commitment, not a to-do', detail:'Replace "work on report" with "write 3 paragraphs in the next 25 minutes." Time-boxing a task converts intention into action 73% more often.' },
  { icon:'&#128064;', title:'Close every tab before switching tasks', detail:'Context switching costs 23 minutes of focus recovery per interruption. Closing all tabs before starting a new task is the single highest-leverage focus habit.' },
  { icon:'&#128203;', title:'Review your tasks the night before', detail:'James Clear: decisions made at night are made by a well-rested brain. Writing tomorrow\'s 3 priorities takes 3 minutes and removes all morning friction.' },
  { icon:'&#128170;', title:'Anchor habits to existing triggers', detail:'Atomic Habits: habit stacking. "After I close my laptop, I do 5 pull-ups." The existing behaviour becomes the trigger. No willpower required.' },
  { icon:'&#127968;', title:'Optimise your sleep position', detail:'British Cycling hired a sleep coach. Better pillows, darker rooms, consistent bed times. Sleep improvement alone produced measurable performance gains within 2 weeks.' },
  { icon:'&#128336;', title:'Single-task the first 90 minutes', detail:'Your brain is in peak cognitive state within 90 minutes of waking. No meetings, no email, no Slack in this window. Guard it like it is your most valuable asset.' },
  { icon:'&#128640;', title:'Take Action within 5 seconds', detail:'Mel Robbins: if you have an impulse to act on a goal, you must physically move within 5 seconds or your brain will kill the idea. Count 5-4-3-2-1 and go.' },
]

type Task = {
  id: string
  notion_id: string | null
  title: string
  status: string
  due_date: string | null
  task_type: string | null
  urgency: string | null
  importance: string | null
  time_commitment: string | null
  is_frog: boolean
  priority: string | null
  notion_url: string | null
  archived: boolean
  created_at: string
  from_vault: boolean
}

type DraftTask = {
  id?: string
  title: string
  status: string
  task_type: string
  urgency: string
  importance: string
  time_commitment: string
  due_date: string
  priority: string
  is_frog: boolean
  notion_url: string
}

const EMPTY_DRAFT: DraftTask = {
  title: '', status: 'Not started', task_type: '', urgency: '',
  importance: '', time_commitment: '', due_date: '', priority: '',
  is_frog: false, notion_url: '',
}

function taskToDraft(t: Task): DraftTask {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    task_type: t.task_type ?? '',
    urgency: t.urgency ?? '',
    importance: t.importance ?? '',
    time_commitment: t.time_commitment ?? '',
    due_date: t.due_date ?? '',
    priority: t.priority ?? '',
    is_frog: t.is_frog,
    notion_url: t.notion_url ?? '',
  }
}

function StatusBadge({ status, onClick }: { status: string; onClick?: (e: React.MouseEvent) => void }) {
  const m = STATUS_META[status] ?? STATUS_META['Not started']
  return (
    <span
      onClick={onClick}
      title={onClick ? 'Click to cycle status' : undefined}
      style={{
        fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const,
        color:m.color, background:m.bg, border:'1px solid '+m.color+'40',
        borderRadius:'9999px', padding:'0.12rem 0.45rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect:'none' as const,
      }}
    >
      {status}
    </span>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const m = TYPE_META[type] ?? { color: C.muted }
  return (
    <span style={{
      fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' as const,
      color:m.color, background:m.color+'18', border:'1px solid '+m.color+'40',
      borderRadius:'9999px', padding:'0.12rem 0.45rem',
    }}>
      {type}
    </span>
  )
}

function sortTasks(tasks: Task[], sort: string): Task[] {
  return [...tasks].sort((a, b) => {
    if (sort === 'created_at_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'created_at_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'deadline_asc') {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    if (sort === 'task_type') return (a.task_type ?? 'z').localeCompare(b.task_type ?? 'z')
    if (sort === 'urgency') return (a.urgency === 'Urgent' ? 0 : 1) - (b.urgency === 'Urgent' ? 0 : 1)
    return 0
  })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none',
  boxSizing:'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor:'pointer', appearance:'none' as const }

function TaskDrawer({
  draft, setDraft, onSave, onClose, saving,
}: {
  draft: DraftTask
  setDraft: (d: DraftTask) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  const set = (k: keyof DraftTask, v: string | boolean) => setDraft({ ...draft, [k]: v })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100 }} />
      {/* Panel */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'min(480px,100vw)',
        background:C.surface, borderLeft:'1px solid '+C.border,
        zIndex:101, display:'flex', flexDirection:'column', overflowY:'auto',
      }}>
        {/* Header */}
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, flex:1 }}>
            {draft.id ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
            <X size={18}/>
          </button>
        </div>

        {/* Take Action prompt — new tasks only */}
        {!draft.id && (
          <div style={{ padding:'0.75rem 1.5rem', background:'rgba(255,107,0,0.06)', borderBottom:'1px solid rgba(255,107,0,0.15)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.25rem' }}>
              <Zap size={13} color='#ff6b00'/>
              <span style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b00', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>Take Action Immediately</span>
            </div>
            <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.5 }}>
              People who achieve success do the hard things first. Do not plan to do this — schedule it now.
            </p>
          </div>
        )}

        {/* Form */}
        <div style={{ padding:'1.25rem 1.5rem', flex:1 }}>
          <Field label="Title *">
            <input
              autoFocus
              value={draft.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Do 5 pull-ups when I close my laptop at my desk"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) onSave() }}
            />
          </Field>
          {/* Specificity hint */}
          {!draft.id && (
            <div style={{ marginTop:'-0.65rem', marginBottom:'1rem', padding:'0.6rem 0.75rem', background:'rgba(255,184,0,0.06)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.5rem' }}>
              <p style={{ fontSize:'0.72rem', color:C.amber, margin:0, lineHeight:1.5 }}>
                <strong>Be specific and actionable.</strong> Bad: &#34;Exercise&#34; &#8594; Good: &#34;Do 5 pull-ups when I close my laptop and I&#39;m next to my desk&#34;
              </p>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <Field label="Status">
              <select value={draft.status} onChange={e => set('status', e.target.value)} style={selectStyle}>
                {['Not started','In progress','Done'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={draft.task_type} onChange={e => set('task_type', e.target.value)} style={selectStyle}>
                <option value="">None</option>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <Field label="Urgency">
              <select value={draft.urgency} onChange={e => set('urgency', e.target.value)} style={selectStyle}>
                {URGENCY_OPTS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={draft.priority} onChange={e => set('priority', e.target.value)} style={selectStyle}>
                {PRIORITY_OPTS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Importance">
            <select value={draft.importance} onChange={e => set('importance', e.target.value)} style={selectStyle}>
              {IMPORTANCE_OPTS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
            </select>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <Field label="Time Commitment">
              <select value={draft.time_commitment} onChange={e => set('time_commitment', e.target.value)} style={selectStyle}>
                {TIME_OPTS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
              </select>
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                value={draft.due_date}
                onChange={e => set('due_date', e.target.value)}
                style={{ ...inputStyle, colorScheme:'dark' }}
              />
            </Field>
          </div>

          <div style={{ marginTop:'-0.65rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.65rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.06em', margin:'0 0 0.4rem' }}>Reschedule</p>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              {rescheduleOptions().map(o => (
                <button key={o.label} type="button" onClick={() => set('due_date', o.date)}
                  title={o.date}
                  style={{
                    padding:'0.35rem 0.65rem', borderRadius:'0.5rem', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:600, cursor:'pointer',
                    background: draft.due_date === o.date ? 'rgba(0,212,255,0.12)' : C.card,
                    border:'1px solid '+(draft.due_date === o.date ? C.cyan : C.border),
                    color: draft.due_date === o.date ? C.cyan : C.sec,
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Notion URL">
            <input
              value={draft.notion_url}
              onChange={e => set('notion_url', e.target.value)}
              placeholder="https://notion.so/..."
              style={inputStyle}
            />
          </Field>

          {/* Frog toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem', background:C.card, borderRadius:'0.75rem', marginBottom:'1rem', cursor:'pointer' }}
            onClick={() => set('is_frog', !draft.is_frog)}>
            <div style={{
              width:36, height:20, borderRadius:10, background: draft.is_frog ? '#ff6b35' : C.border,
              position:'relative', transition:'background 0.2s', flexShrink:0,
            }}>
              <div style={{
                position:'absolute', top:3, left: draft.is_frog ? 18 : 3, width:14, height:14,
                borderRadius:'50%', background:'#fff', transition:'left 0.2s',
              }}/>
            </div>
            <span style={{ fontSize:'0.85rem', color:C.text }}>&#128293; Mark as Frog (eat the frog first)</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid '+C.border, display:'flex', gap:'0.75rem', flexShrink:0 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.title.trim()}
            style={{
              flex:1, padding:'0.75rem', background: C.cyan, border:'none',
              borderRadius:'0.75rem', color:'#000', fontWeight:800, fontSize:'0.9rem',
              cursor: saving || !draft.title.trim() ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', opacity: saving || !draft.title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : draft.id ? 'Save Changes' : 'Add Task'}
          </button>
          <button onClick={onClose} style={{ padding:'0.75rem 1.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState('deadline_asc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<DraftTask>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [showGains, setShowGains] = useState(false)
  const [gainIdx, setGainIdx] = useState(() => Math.floor(Math.random() * MARGINAL_GAINS.length))
  const [toast, setToast] = useState<string|null>(null)
  const [priorityView, setPriorityView] = useState(false)
  const [tPriorityOrder, setTPriorityOrder] = useState<string[]>([])
  const [tGroupByType, setTGroupByType] = useState(false)
  const [tDragId, setTDragId] = useState<string|null>(null)
  const [tDragOver, setTDragOver] = useState<string|null>(null)
  const [tDragFrom, setTDragFrom] = useState<'unassigned'|'priority'|null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('master_tasks')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    if (error) setImportMsg('Load error: ' + error.message)
    setTasks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let tPLsLoaded = false
    let tLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_tasks')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setTPriorityOrder(ids); tPLsLoaded = true; tLocalIds = ids } }
    } catch {}
    async function init() {
      const [, { data: pdata }] = await Promise.all([
        load(),
        supabase.from('priority_lists').select('ordered_ids').eq('key', 'tasks_priority').single()
      ])
      if (pdata?.ordered_ids && Array.isArray(pdata.ordered_ids) && (pdata.ordered_ids as string[]).length > 0) {
        const ids = pdata.ordered_ids as string[]
        setTPriorityOrder(ids)
        try { localStorage.setItem('fs_p_tasks', JSON.stringify(ids)) } catch {}
      } else if (tPLsLoaded) {
        supabase.from('priority_lists').upsert({ key: 'tasks_priority', ordered_ids: tLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      } else {
        const { data: ids } = await supabase.from('master_tasks').select('id').neq('archived', true).order('created_at', { ascending: false })
        if (ids && ids.length > 0) {
          const allIds = (ids as { id: string }[]).map(t => t.id)
          setTPriorityOrder(allIds)
          try { localStorage.setItem('fs_p_tasks', JSON.stringify(allIds)) } catch {}
          supabase.from('priority_lists').upsert({ key: 'tasks_priority', ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
        }
      }
    }
    init()
  }, [load])

  function saveTPriority(order: string[]) {
    const y = window.scrollY
    setTPriorityOrder(order)
    try { localStorage.setItem('fs_p_tasks', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: 'tasks_priority', ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  async function handleImport() {
    setImporting(true); setImportMsg('')
    try {
      const r = await fetch('/api/import', { method: 'POST' })
      const d = await r.json()
      const taskCount = d.tasks?.imported ?? 0
      const vaultCount = d.vault?.imported ?? 0
      const taskErr = d.tasks?.error
      const vaultErr = d.vault?.error
      if (taskErr || vaultErr) {
        setImportMsg(taskErr ?? vaultErr ?? 'Import error')
      } else {
        setImportMsg('Imported ' + taskCount + ' tasks + ' + vaultCount + ' vault items')
        await load()
      }
    } catch (e) {
      setImportMsg('Failed: ' + String(e))
    }
    setImporting(false)
    setTimeout(() => setImportMsg(''), 6000)
  }

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setDrawerOpen(true)
  }

  function openEdit(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(taskToDraft(task))
    setDrawerOpen(true)
  }

  async function saveDrawer() {
    if (!draft.title.trim()) return
    setSaving(true)
    const payload = {
      title: draft.title.trim(),
      status: draft.status,
      task_type: draft.task_type || null,
      urgency: draft.urgency || null,
      importance: draft.importance || null,
      time_commitment: draft.time_commitment || null,
      due_date: draft.due_date || null,
      priority: draft.priority || null,
      is_frog: draft.is_frog,
      notion_url: draft.notion_url || null,
    }
    if (draft.id) {
      await supabase.from('master_tasks').update(payload).eq('id', draft.id)
      setTasks(prev => prev.map(t => t.id === draft.id ? { ...t, ...payload } : t))
    } else {
      const { error: insertError } = await supabase
        .from('master_tasks').insert({ ...payload, archived: false })
      if (!insertError) await load()
    }
    setSaving(false)
    setDrawerOpen(false)
  }

  async function archiveTask(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Archive this task?')) return
    await supabase.from('master_tasks').update({ archived: true }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function convertToVault(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const { error } = await supabase.from('vault_items').insert({
      title: task.title,
      status: 'To Read',
      archived: false,
      category: null,
    })
    if (!error) {
      await supabase.from('master_tasks').delete().eq('id', task.id)
      setTasks(prev => prev.filter(t => t.id !== task.id))
      if (expanded === task.id) setExpanded(null)
      setToast('Moved to vault: ' + task.title.slice(0, 40))
      setTimeout(() => setToast(null), 3000)
    }
  }

  async function cycleStatus(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const next = STATUS_CYCLE[task.status] ?? 'Not started'
    await supabase.from('master_tasks').update({ status: next }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = sortTasks(
    tasks.filter(t => {
      if (typeFilter === 'No Type' && t.task_type) return false
      if (typeFilter !== 'All' && typeFilter !== 'No Type' && t.task_type !== typeFilter) return false
      if (statusFilter !== 'All' && t.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          (t.task_type ?? '').toLowerCase().includes(q) ||
          (t.urgency ?? '').toLowerCase().includes(q) ||
          (t.priority ?? '').toLowerCase().includes(q)
        )
      }
      return true
    }),
    sort
  )

  const typeCounts: Record<string, number> = {}
  tasks.forEach(t => { if (t.task_type) typeCounts[t.task_type] = (typeCounts[t.task_type] ?? 0) + 1 })
  typeCounts['No Type'] = tasks.filter(t => !t.task_type).length
  const statusCounts: Record<string, number> = {}
  tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1 })

  const activeCount  = tasks.filter(t => t.status !== 'Done').length
  const frogCount    = tasks.filter(t => t.is_frog).length
  const urgentCount  = tasks.filter(t => t.urgency === 'Urgent').length
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Done').length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>

      {/* Quote + Take Action banner */}
      <div style={{ background:'linear-gradient(135deg,rgba(255,107,0,0.12) 0%,rgba(255,68,102,0.06) 100%)', borderBottom:'1px solid rgba(255,107,0,0.2)', padding:'0.75rem 2rem' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
            <Zap size={15} color='#ff6b00'/>
            <span style={{ fontSize:'0.8rem', color:'#ff9a4a', fontStyle:'italic', fontWeight:500 }}>
              &#8220;People who achieve success do the hard things first.&#8221;
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em', color:'#ff6b00', textTransform:'uppercase' as const }}>Take Action Immediately</span>
            <span style={{ fontSize:'0.65rem', color:C.muted }}>&#8212; it separates you from 99%</span>
          </div>
        </div>
      </div>

      {/* 1% Better Every Day panel */}
      <div style={{ background:'rgba(0,255,136,0.03)', borderBottom:'1px solid rgba(0,255,136,0.12)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 2rem' }}>
          <button onClick={() => setShowGains(g => !g)} style={{ display:'flex', alignItems:'center', gap:'0.6rem', width:'100%', background:'none', border:'none', padding:'0.7rem 0', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}>
            <TrendingUp size={14} color={C.green}/>
            <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.green }}>1% Better Every Day</span>
            <span style={{ fontSize:'0.7rem', color:C.muted, flex:1 }}>Marginal gains compound. Small changes &#8594; massive results.</span>
            <ChevronDown size={14} color={C.muted} style={{ transform: showGains ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
          </button>
          {showGains && (
            <div style={{ paddingBottom:'1rem' }}>
              {/* Featured tip (random, rotates) */}
              <div style={{ background:C.card, border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', padding:'1rem 1.25rem', marginBottom:'1rem', display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                <span style={{ fontSize:'1.5rem', flexShrink:0 }} dangerouslySetInnerHTML={{ __html: MARGINAL_GAINS[gainIdx].icon }}/>
                <div>
                  <p style={{ fontSize:'0.82rem', fontWeight:800, color:C.green, margin:'0 0 0.35rem' }}>{MARGINAL_GAINS[gainIdx].title}</p>
                  <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.6 }}>{MARGINAL_GAINS[gainIdx].detail}</p>
                  <button onClick={() => setGainIdx(i => (i + 1) % MARGINAL_GAINS.length)} style={{ background:'none', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.5rem', color:C.green, fontSize:'0.7rem', padding:'0.25rem 0.625rem', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
                    Next tip &#8594;
                  </button>
                </div>
              </div>
              {/* All tips grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'0.5rem' }}>
                {MARGINAL_GAINS.map((g, i) => (
                  <div key={i} onClick={() => setGainIdx(i)} style={{ background: i === gainIdx ? 'rgba(0,255,136,0.06)' : C.surface, border:'1px solid '+(i === gainIdx ? 'rgba(0,255,136,0.25)' : C.border), borderRadius:'0.625rem', padding:'0.625rem 0.875rem', cursor:'pointer', transition:'all 0.15s' }}>
                    <p style={{ fontSize:'0.72rem', fontWeight:700, color: i === gainIdx ? C.green : C.text, margin:'0 0 0.15rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <span dangerouslySetInnerHTML={{ __html: g.icon }}/>{g.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,212,255,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em' }}>
                &#9989; Master Tasks
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {activeCount} active &mdash; {tasks.length} total
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
              {importMsg && (
                <span style={{ fontSize:'0.72rem', color: importMsg.startsWith('Fail') || importMsg.startsWith('Import error') ? C.red : C.green, fontWeight:600 }}>
                  {importMsg}
                </span>
              )}
              <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.875rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.75rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                <Plus size={14}/> New Task
              </button>
              <button onClick={handleImport} disabled={importing} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.875rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'0.75rem', color:C.green, cursor:importing?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700, opacity:importing?0.6:1 }}>
                <Download size={13} style={{ animation:importing?'spin 1s linear infinite':'none' }}/>
                {importing ? 'Importing...' : 'Import CSV'}
              </button>
              <label style={{ fontSize:'0.7rem', color:C.muted, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Sort</label>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ padding:'0.5rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', cursor:'pointer' }}>
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Stats chips */}
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
            {urgentCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{urgentCount} urgent</span>
              </div>
            )}
            {frogCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)', borderRadius:'9999px' }}>
                <span style={{ fontSize:'0.75rem' }}>&#128293;</span>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#ff6b35' }}>{frogCount} frog{frogCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {overdueCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.75rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.18)', borderRadius:'9999px' }}>
                <span style={{ fontSize:'0.75rem' }}>&#9888;</span>
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.red }}>{overdueCount} overdue</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginTop:'1rem' }}>
            <Search size={15} color={C.muted} style={{ position:'absolute', left:'0.875rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
              style={{ width:'100%', padding:'0.65rem 2.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', color:C.text, fontFamily:'inherit', fontSize:'0.88rem', boxSizing:'border-box', outline:'none' }}/>
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'0.875rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={14}/></button>}
          </div>

          {/* Filter pills */}
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.875rem', alignItems:'center' }}>
            {TYPES.map(type => {
              const active = typeFilter === type
              const count = type === 'All' ? tasks.length : (typeCounts[type] ?? 0)
              if (type === 'No Type') {
                if (count === 0) return null
                return (
                  <button key={type} onClick={() => setTypeFilter(type)} style={{
                    padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                    fontSize:'0.72rem', fontWeight:700,
                    background: active ? C.amber + '18' : C.card,
                    border: '1px solid ' + (active ? C.amber + '50' : C.amber + '30'),
                    color: active ? C.amber : C.amber,
                  }}>
                    &#9888; {type} <span style={{ opacity:0.6 }}>({count})</span>
                  </button>
                )
              }
              if (type !== 'All' && count === 0) return null
              const m = type !== 'All' ? TYPE_META[type] : null
              return (
                <button key={type} onClick={() => setTypeFilter(type)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.72rem', fontWeight:700,
                  background: active ? (m?.color ?? C.cyan) + '18' : C.card,
                  border: '1px solid ' + (active ? (m?.color ?? C.cyan) + '50' : C.border),
                  color: active ? (m?.color ?? C.cyan) : C.sec,
                }}>
                  {type} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
            <span style={{ width:'1px', height:'20px', background:C.border, display:'inline-block', margin:'0 0.15rem' }}/>
            {STATUSES.map(s => {
              const active = statusFilter === s
              const sm = s !== 'All' ? STATUS_META[s] : null
              const count = s === 'All' ? tasks.length : (statusCounts[s] ?? 0)
              if (s !== 'All' && count === 0) return null
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.72rem', fontWeight:700,
                  background: active ? (sm?.bg ?? 'rgba(255,255,255,0.06)') : C.card,
                  border: '1px solid ' + (active ? (sm?.color ?? C.border)+'60' : C.border),
                  color: active ? (sm?.color ?? C.text) : C.sec,
                }}>
                  {s} <span style={{ opacity:0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'1.5rem 2rem' }}>

        {/* View toggle */}
        {!loading && tasks.length > 0 && (() => {
          const activeTasks = tasks.filter(t => t.status !== 'Done')
          const tValidOrder = tPriorityOrder.filter(id => activeTasks.some(t => t.id === id))
          const tUnassigned = activeTasks.filter(t => !tValidOrder.includes(t.id))
          return (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
              <button onClick={() => setPriorityView(false)} style={{ padding:'0.35rem 0.875rem', borderRadius:'9999px', border:'1px solid '+(priorityView ? C.border : C.cyan+'60'), background: priorityView ? 'transparent' : 'rgba(0,212,255,0.1)', color: priorityView ? C.muted : C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s' }}>
                All Tasks
              </button>
              <button onClick={() => setPriorityView(true)} style={{ padding:'0.35rem 0.875rem', borderRadius:'9999px', border:'1px solid '+(priorityView ? '#ff6b3560' : C.border), background: priorityView ? 'rgba(255,107,53,0.1)' : 'transparent', color: priorityView ? '#ff6b35' : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                Priority View
                {tUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>{tUnassigned.length}</span>}
              </button>
            </div>
          )
        })()}

        {/* Priority view */}
        {priorityView && !loading && (() => {
          const activeTasks = tasks.filter(t => t.status !== 'Done')
          const tValidOrder = tPriorityOrder.filter(id => activeTasks.some(t => t.id === id))
          const tAssigned = new Set(tValidOrder)
          const tUnassigned = activeTasks.filter(t => !tAssigned.has(t.id))
          return (
            <div>
              {/* Unassigned */}
              <div style={{ marginBottom:'2rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                  {tUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{tUnassigned.length}</span>}
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into priority list to rank</p>
                </div>
                {tUnassigned.length === 0 ? (
                  <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                    <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All tasks assigned</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                    onDragOver={e => { e.preventDefault(); setTDragOver('unassigned-zone') }}
                    onDrop={e => {
                      e.preventDefault()
                      if (tDragFrom === 'priority' && tDragId) saveTPriority(tValidOrder.filter(i => i !== tDragId))
                      setTDragId(null); setTDragOver(null); setTDragFrom(null)
                    }}
                  >
                    {tUnassigned.map(task => {
                      const needsSetup = task.from_vault && !task.task_type && !task.urgency && !task.priority
                      return (
                        <div key={task.id} draggable
                          onDragStart={() => { setTDragId(task.id); setTDragFrom('unassigned') }}
                          onDragEnd={() => { setTDragId(null); setTDragOver(null); setTDragFrom(null) }}
                          style={{ background:C.card, border:'1px solid '+(tDragId===task.id ? C.red+'55' : needsSetup ? C.amber+'50' : C.border), borderRadius:'0.75rem', padding:'0.65rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem', cursor:'grab', opacity:tDragId===task.id?0.4:1, transition:'all 0.1s' }}>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{task.title}</p>
                            <div style={{ display:'flex', gap:'0.3rem', marginTop:'0.2rem', flexWrap:'wrap' }}>
                              {task.from_vault && <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', fontSize:'0.55rem', fontWeight:800, color:C.purple, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}><BookOpen size={8}/>Vault</span>}
                              {needsSetup && <span style={{ fontSize:'0.55rem', fontWeight:800, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>Needs setup</span>}
                              {task.task_type ? <TypeBadge type={task.task_type}/> : !needsSetup && <span style={{ fontSize:'0.55rem', fontWeight:800, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>No type</span>}
                              <StatusBadge status={task.status}/>
                              {task.urgency === 'Urgent' && <span style={{ fontSize:'0.58rem', color:C.red, border:'1px solid '+C.red+'40', borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>Urgent</span>}
                            </div>
                          </div>
                          <button type="button" draggable={false} onClick={e => convertToVault(task, e)} style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:C.purple, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.68rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.25rem' }} title="Send to Vault">
                            <BookOpen size={10}/> Vault
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Priority list */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem', flexWrap:'wrap' as const }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{tValidOrder.length} tasks ranked{tGroupByType ? ' — grouped by type' : ''}</p>
                  <button type="button" onClick={() => setTGroupByType(g => !g)} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.7rem', borderRadius:'0.5rem', border:'1px solid '+(tGroupByType ? C.purple : C.border), background:tGroupByType ? 'rgba(139,92,246,0.12)' : 'transparent', color:tGroupByType ? C.purple : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:700 }}>
                    Group by type
                  </button>
                </div>
                {tGroupByType && tValidOrder.some(id => { const t = tasks.find(x=>x.id===id); return t && !t.task_type }) && (
                  <div style={{ marginBottom:'0.6rem', fontSize:'0.68rem', color:C.amber }}>
                    &#9888; Some tasks in this list have no type assigned &mdash; see &ldquo;No type assigned&rdquo; group below.
                  </div>
                )}
                {tValidOrder.length === 0 ? (
                  <div style={{ padding:'2.5rem 1.5rem', textAlign:'center', border:'2px dashed '+(tDragOver==='t-priority-empty' ? '#ff6b35' : C.border), borderRadius:'0.875rem', background:tDragOver==='t-priority-empty'?'rgba(255,107,53,0.05)':'transparent', transition:'all 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setTDragOver('t-priority-empty') }}
                    onDragLeave={() => setTDragOver(null)}
                    onDrop={e => { e.preventDefault(); if (tDragFrom==='unassigned'&&tDragId) saveTPriority([tDragId]); setTDragId(null); setTDragOver(null); setTDragFrom(null) }}>
                    <p style={{ fontSize:'0.78rem', color:C.muted, margin:0 }}>Drag tasks here to set priority order</p>
                  </div>
                ) : (() => {
                  const renderRow = (id: string, idx: number, draggableOn: boolean) => {
                    const task = tasks.find(t => t.id === id)
                    if (!task) return null
                    const needsSetup = task.from_vault && !task.task_type && !task.urgency && !task.priority
                    return (
                      <div key={id}>
                        {draggableOn && tDragOver === id && <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 0.25rem', opacity:0.8 }} />}
                        <div draggable={draggableOn}
                          onDragStart={draggableOn ? (() => { setTDragId(id); setTDragFrom('priority') }) : undefined}
                          onDragEnd={draggableOn ? (() => { setTDragId(null); setTDragOver(null); setTDragFrom(null) }) : undefined}
                          onDragOver={draggableOn ? (e => { e.preventDefault(); setTDragOver(id) }) : undefined}
                          onDragLeave={draggableOn ? (e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && tDragOver===id) setTDragOver(null) }) : undefined}
                          onDrop={draggableOn ? (e => {
                            e.preventDefault()
                            if (tDragFrom==='unassigned'&&tDragId) { const o=[...tValidOrder]; o.splice(idx,0,tDragId); saveTPriority(o) }
                            else if (tDragFrom==='priority'&&tDragId&&tDragId!==id) { const w=tValidOrder.filter(i=>i!==tDragId); w.splice(w.indexOf(id),0,tDragId); saveTPriority(w) }
                            setTDragId(null); setTDragOver(null); setTDragFrom(null)
                          }) : undefined}
                          style={{ background:C.card, border:'1px solid '+(draggableOn && tDragId===id?'#ff6b3555':needsSetup?C.amber+'50':C.border), borderRadius:'0.75rem', padding:'0.65rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem', cursor: draggableOn ? 'grab' : 'default', opacity:draggableOn && tDragId===id?0.4:1, transition:'all 0.1s' }}>
                          <span style={{ fontSize:'0.65rem', fontWeight:900, color:'#ff6b35', minWidth:'1.4rem', textAlign:'center' as const, flexShrink:0 }}>#{idx+1}</span>
                          {draggableOn && <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>}
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{task.title}</p>
                            <div style={{ display:'flex', gap:'0.3rem', marginTop:'0.2rem', flexWrap:'wrap' }}>
                              {task.from_vault && <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', fontSize:'0.55rem', fontWeight:800, color:C.purple, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}><BookOpen size={8}/>Vault</span>}
                              {needsSetup && <span style={{ fontSize:'0.55rem', fontWeight:800, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>Needs setup</span>}
                              {task.task_type ? <TypeBadge type={task.task_type}/> : !needsSetup && <span style={{ fontSize:'0.55rem', fontWeight:800, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>No type</span>}
                              <StatusBadge status={task.status}/>
                              {task.urgency === 'Urgent' && <span style={{ fontSize:'0.58rem', color:C.red, border:'1px solid '+C.red+'40', borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>Urgent</span>}
                            </div>
                          </div>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveTPriority([id, ...tValidOrder.filter(i=>i!==id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveTPriority([...tValidOrder.filter(i=>i!==id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button type="button" draggable={false} onClick={e => convertToVault(task, e)} style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:C.purple, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.68rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.25rem' }} title="Send to Vault">
                            <BookOpen size={10}/> Vault
                          </button>
                          <button onClick={e => { e.stopPropagation(); saveTPriority(tValidOrder.filter(i=>i!==id)) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0 }}>x</button>
                        </div>
                      </div>
                    )
                  }

                  if (tGroupByType) {
                    const groups: Record<string, string[]> = {}
                    const order: string[] = []
                    tValidOrder.forEach(id => {
                      const task = tasks.find(t => t.id === id)
                      const key = task?.task_type || 'No type assigned'
                      if (!groups[key]) { groups[key] = []; order.push(key) }
                      groups[key].push(id)
                    })
                    order.sort((a, b) => a === 'No type assigned' ? -1 : b === 'No type assigned' ? 1 : 0)
                    return (
                      <div style={{ display:'flex', flexDirection:'column' as const, gap:'1.1rem' }}>
                        {order.map(key => {
                          const meta = key !== 'No type assigned' ? TYPE_META[key] : null
                          const color = meta ? meta.color : C.amber
                          return (
                            <div key={key}>
                              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
                                <span style={{ fontSize:'0.68rem', fontWeight:800, color, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>{key}</span>
                                <span style={{ fontSize:'0.62rem', color:C.muted }}>({groups[key].length})</span>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                                {groups[key].map(id => renderRow(id, tValidOrder.indexOf(id), false))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  return (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                    {tValidOrder.map((id, idx) => renderRow(id, idx, true))}
                    <div style={{ height:'2.75rem', border:'2px dashed '+(tDragOver==='t-bottom'?'#ff6b35':C.border), borderRadius:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', background:tDragOver==='t-bottom'?'rgba(255,107,53,0.05)':'transparent' }}
                      onDragOver={e => { e.preventDefault(); setTDragOver('t-bottom') }}
                      onDragLeave={() => { if (tDragOver==='t-bottom') setTDragOver(null) }}
                      onDrop={e => {
                        e.preventDefault()
                        if (tDragFrom==='unassigned'&&tDragId) saveTPriority([...tValidOrder,tDragId])
                        else if (tDragFrom==='priority'&&tDragId) saveTPriority([...tValidOrder.filter(i=>i!==tDragId),tDragId])
                        setTDragId(null); setTDragOver(null); setTDragFrom(null)
                      }}>
                      <p style={{ fontSize:'0.67rem', color:tDragOver==='t-bottom'?'#ff6b35':C.muted, margin:0 }}>Drop here to add at end</p>
                    </div>
                  </div>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {priorityView ? null : loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 1rem', color:C.muted }}>
            <CheckSquare size={40} style={{ marginBottom:'1rem', opacity:0.3 }}/>
            <p style={{ fontSize:'1rem', color:C.sec, marginBottom:'0.5rem', fontWeight:700 }}>No tasks yet</p>
            <p style={{ fontSize:'0.82rem', marginBottom:'2rem', lineHeight:1.6 }}>Add one manually or import from CSV.</p>
            <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={openNew} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.cyan+',#0099bb)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:800, fontSize:'0.95rem', cursor:'pointer', fontFamily:'inherit' }}>
                <Plus size={18}/> Add First Task
              </button>
              <button onClick={handleImport} disabled={importing} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.875rem 2rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.875rem', color:'#000', fontWeight:800, fontSize:'0.95rem', cursor:importing?'not-allowed':'pointer', fontFamily:'inherit', opacity:importing?0.6:1 }}>
                <Download size={18}/> {importing ? 'Importing...' : 'Import from CSV'}
              </button>
            </div>
            {importMsg && <p style={{ marginTop:'1rem', fontSize:'0.8rem', color: importMsg.startsWith('Fail') ? C.red : C.green, fontWeight:600 }}>{importMsg}</p>}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            <p>No tasks match your filters.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:'0.72rem', color:C.muted, marginBottom:'1rem' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
              {filtered.map(task => {
                const isExp = expanded === task.id
                const typeM = task.task_type ? TYPE_META[task.task_type] : null
                const isOverdue = task.due_date && task.due_date < today && task.status !== 'Done'
                const needsSetup = task.from_vault && !task.task_type && !task.urgency && !task.priority
                return (
                  <div key={task.id} onClick={() => setExpanded(isExp ? null : task.id)}
                    style={{
                      background:C.card,
                      border:'1px solid '+(isExp?(typeM?.color??C.cyan)+'40':needsSetup?C.amber+'50':C.border),
                      borderRadius:'1rem', padding:'1rem', cursor:'pointer',
                      transition:'border-color 0.2s ease',
                      boxShadow: isExp ? '0 0 18px '+(typeM?.color??C.cyan)+'12' : needsSetup ? '0 0 12px rgba(255,184,0,0.08)' : 'none',
                    }}>

                    {/* Top row: type badge + frog + vault badges + status (click-to-cycle) */}
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                      <TypeBadge type={task.task_type}/>
                      {task.is_frog && <span style={{ fontSize:'0.85rem' }}>&#128293;</span>}
                      {task.from_vault && <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', fontSize:'0.55rem', fontWeight:800, color:C.purple, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}><BookOpen size={8}/>Vault</span>}
                      {needsSetup && <span style={{ fontSize:'0.55rem', fontWeight:800, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>&#9888; Setup</span>}
                      <span style={{ marginLeft:'auto' }}>
                        <StatusBadge status={task.status} onClick={e => cycleStatus(task, e)}/>
                      </span>
                    </div>

                    <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.4rem', lineHeight:1.35 }}>{task.title}</h3>

                    {task.due_date && (
                      <p style={{ fontSize:'0.7rem', color:isOverdue?C.red:C.muted, margin:'0 0 0.4rem', fontWeight:isOverdue?700:400 }}>
                        &#128197; {isOverdue ? 'Overdue: ' : ''}{task.due_date}
                      </p>
                    )}

                    <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
                      {task.urgency && (
                        <span style={{ fontSize:'0.58rem', color:task.urgency==='Urgent'?C.red:C.muted, border:'1px solid '+(task.urgency==='Urgent'?C.red:C.border), borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.urgency}
                        </span>
                      )}
                      {task.importance && (
                        <span style={{ fontSize:'0.58rem', color:task.importance==='Moved the Needle'||task.importance==='Important'?C.green:C.muted, border:'1px solid '+(task.importance==='Moved the Needle'||task.importance==='Important'?C.green:C.border), borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.importance === 'Moved the Needle' || task.importance === 'Important' ? 'High Impact' : 'Low Impact'}
                        </span>
                      )}
                      {task.time_commitment && (
                        <span style={{ fontSize:'0.58rem', color:C.muted, border:'1px solid '+C.border, borderRadius:'0.25rem', padding:'0.1rem 0.3rem', lineHeight:1.5 }}>
                          {task.time_commitment}
                        </span>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExp && (
                      <div style={{ marginTop:'0.875rem', paddingTop:'0.875rem', borderTop:'1px solid '+C.border }}>
                        {task.priority && (
                          <span style={{ fontSize:'0.62rem', color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.375rem', padding:'0.2rem 0.5rem', fontWeight:700, display:'inline-block', marginBottom:'0.6rem' }}>
                            {task.priority} priority
                          </span>
                        )}
                        <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 0.875rem', lineHeight:1.5 }}>
                          Added {new Date(task.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                        </p>

                        {/* Action buttons */}
                        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                          <button
                            onClick={e => openEdit(task, e)}
                            style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}
                          >
                            <Edit3 size={12}/> Edit
                          </button>
                          <button
                            onClick={e => convertToVault(task, e)}
                            style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'0.625rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}
                          >
                            <BookOpen size={12}/> &#8594; Vault
                          </button>
                          <button
                            onClick={e => archiveTask(task.id, e)}
                            style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.875rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'0.625rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700, marginLeft:'auto' }}
                          >
                            <Trash2 size={12}/> Archive
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <TaskDrawer
          draft={draft}
          setDraft={setDraft}
          onSave={saveDrawer}
          onClose={() => setDrawerOpen(false)}
          saving={saving}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)', background:C.purple, color:'#fff', padding:'0.75rem 1.5rem', borderRadius:'0.875rem', fontWeight:800, fontSize:'0.82rem', zIndex:200, boxShadow:'0 4px 24px rgba(139,92,246,0.35)', display:'flex', alignItems:'center', gap:'0.5rem', whiteSpace:'nowrap' }}>
          <BookOpen size={14}/> {toast}
        </div>
      )}

      <style>{`
        input:focus, select:focus { border-color: ${C.cyan} !important; }
        button:hover { opacity:0.85; }
        select { appearance:none; }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </main>
  )
}
