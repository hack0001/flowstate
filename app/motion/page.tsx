'use client'
// Motion Studio — edit a Remotion template's content and watch it live.
// The template code lives in motion/templates/*; this page only edits its content JSON,
// saves it to Supabase (motion_projects) and hands you the props file + render command.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Player, type PlayerRef } from '@remotion/player'
import { ChevronLeft, Save, Download, Copy, Trash2, FolderOpen, Plus, RotateCcw, Check } from 'lucide-react'
import { KineticShort, type ShortContent } from '@/motion/templates/kinetic-short/KineticShort'
import { KINETIC_SHORT } from '@/motion/templates/kinetic-short/meta'
import { ICON_NAMES } from '@/motion/system/icons'
import { SceneReferences } from '@/components/motion/SceneReferences'
import { listMotionProjects, saveMotionProject, deleteMotionProject, type MotionProject } from '@/lib/motion'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  teal:'#2FB8AC', gold:'#B8935A', red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}
const T = KINETIC_SHORT
const ICONS = new Set<string>(ICON_NAMES as readonly string[])
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x))

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.45rem 0.6rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box',
}
const btn = (accent = false): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:6, padding:'0.45rem 0.75rem', borderRadius:'0.5rem', cursor:'pointer',
  border:'1px solid '+(accent ? C.teal : C.border), background: accent ? 'rgba(47,184,172,0.12)' : C.card,
  color: accent ? C.teal : C.text, fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit',
})
const label: React.CSSProperties = { fontSize:'0.66rem', fontWeight:700, color:C.sec, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }

// Turn a content key into a readable label: "hlWords" → "hl words", "bIcon" → "b icon".
const human = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()

// Generic editor for any JSON value. Shapes it understands:
// string (icon names get a dropdown), number, boolean, arrays of anything, objects (incl. media slots {label, src, video}).
function ValueEditor({ name, value, onChange, depth = 0 }: { name: string; value: unknown; onChange: (v: unknown) => void; depth?: number }) {
  if (typeof value === 'string') {
    if (ICONS.has(value) || /icon$/i.test(name)) {
      return (
        <select style={{ ...inputStyle, cursor:'pointer' }} value={value} onChange={e => onChange(e.target.value)}>
          {(ICON_NAMES as readonly string[]).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      )
    }
    const long = value.length > 48
    return long
      ? <textarea style={{ ...inputStyle, minHeight:60, resize:'vertical', lineHeight:1.5 }} value={value} onChange={e => onChange(e.target.value)} />
      : <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />
  }
  if (typeof value === 'number') {
    return <input type="number" style={inputStyle} value={value} onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
  }
  if (typeof value === 'boolean') {
    return <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:'0.8rem', color:C.text }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /> {value ? 'yes' : 'no'}
    </label>
  }
  if (Array.isArray(value)) {
    return (
      <div style={{ display:'grid', gap:6, paddingLeft: depth ? 8 : 0, borderLeft: depth ? '1px solid '+C.border : 'none' }}>
        {value.map((v, i) => (
          <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
            <span style={{ fontSize:'0.66rem', color:C.muted, width:16, paddingTop:9 }}>{i + 1}</span>
            <div style={{ flex:1 }}>
              <ValueEditor name={name} value={v} depth={depth + 1} onChange={nv => { const a = [...value]; a[i] = nv; onChange(a) }} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const isSlot = 'label' in obj
    // Media slots: make sure a src field is always editable even when the preset left it out.
    const entries = Object.entries(isSlot && !('src' in obj) ? { ...obj, src: '' } : obj)
    return (
      <div style={{ display:'grid', gap:8, padding: depth ? '8px 10px' : 0, background: depth ? C.surface : 'transparent', borderRadius:8, border: depth ? '1px solid '+C.border : 'none' }}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <div style={label}>{human(k)}{isSlot && k === 'src' ? ' · file in public/, e.g. motion/media/clip.mp4' : ''}</div>
            <ValueEditor name={k} value={v} depth={depth + 1} onChange={nv => {
              const next = { ...obj, [k]: nv }
              if (isSlot && k === 'src' && nv === '') delete next.src
              onChange(next)
            }} />
          </div>
        ))}
      </div>
    )
  }
  return <span style={{ color:C.muted, fontSize:'0.75rem' }}>(empty)</span>
}

export default function MotionStudio() {
  const router = useRouter()
  const player = useRef<PlayerRef>(null)
  const [content, setContent] = useState<ShortContent>(() => clone(T.presets[0].content))
  const [presetId, setPresetId] = useState(T.presets[0].id)
  const [scene, setScene] = useState('s1')
  const [name, setName] = useState('Untitled short')
  const [projectId, setProjectId] = useState<string | undefined>()
  const [projects, setProjects] = useState<MotionProject[]>([])
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  // Reference Bank clips attached per scene: { s4: [clipId, …] }
  const [refs, setRefs] = useState<Record<string, string[]>>({})
  // Player + editor are browser-only; skip server prerender to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const refresh = async () => {
    const { projects, error } = await listMotionProjects()
    setProjects(projects)
    if (error) setStatus({ msg: error, err: true })
  }
  useEffect(() => { refresh() }, [])

  const sc = T.scenes.find(s => s.key === scene)!
  const seek = (key: string) => {
    setScene(key)
    const s = T.scenes.find(x => x.key === key)
    // Land a little into the scene so its elements are visible rather than mid-fade.
    if (s && player.current) player.current.seekTo(Math.min(s.to - 1, s.from + Math.round((s.to - s.from) * 0.6)))
  }
  const inputProps = useMemo(() => ({ content }), [content])
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'short'

  const save = async () => {
    setSaving(true)
    const { project, error } = await saveMotionProject({ id: projectId, name, template: T.id, content, refs })
    setSaving(false)
    if (error || !project) { setStatus({ msg: error ?? 'Save failed', err: true }); return }
    setProjectId(project.id)
    setStatus({ msg: 'Saved ' + project.name })
    refresh()
  }
  const load = (p: MotionProject) => {
    setContent(p.content as ShortContent); setRefs(p.refs ?? {}); setName(p.name); setProjectId(p.id); setShowProjects(false)
    setStatus({ msg: 'Loaded ' + p.name })
  }
  const remove = async (p: MotionProject) => {
    if (!window.confirm('Delete "' + p.name + '"?')) return
    const { error } = await deleteMotionProject(p.id)
    if (error) { setStatus({ msg: error, err: true }); return }
    if (p.id === projectId) setProjectId(undefined)
    refresh()
  }
  const startFrom = (id: string) => {
    const p = T.presets.find(x => x.id === id)!
    setPresetId(id); setContent(clone(p.content)); setRefs({}); setProjectId(undefined); setName(p.name)
  }
  const downloadProps = () => {
    const blob = new Blob([JSON.stringify({ content }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = slug + '.json'; a.click()
    URL.revokeObjectURL(a.href)
  }
  const cmd = `npm run motion:render -- KineticShort out/${slug}.mp4 --props=./${slug}.json --crf=18`
  const copyCmd = async () => { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  const setSceneContent = (v: unknown) => setContent(c => ({ ...c, [scene]: v } as ShortContent))
  const resetScene = () => {
    const p = T.presets.find(x => x.id === presetId)!
    setSceneContent(clone((p.content as Record<string, unknown>)[scene]))
  }

  if (!mounted) return <div style={{ minHeight:'100vh', background:C.bg }} />

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0.9rem 1.25rem', borderBottom:'1px solid '+C.border, flexWrap:'wrap' }}>
        <button onClick={() => router.push('/')} style={{ ...btn(), padding:'0.4rem' }} aria-label="Back"><ChevronLeft size={16} /></button>
        <div style={{ fontWeight:800, fontSize:'1rem' }}>Motion Studio</div>
        <div style={{ color:C.sec, fontSize:'0.78rem' }}>{T.name}</div>
        <div style={{ flex:1 }} />
        <input style={{ ...inputStyle, width:220 }} value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
        <button style={btn(true)} onClick={save} disabled={saving}><Save size={14} />{saving ? 'Saving…' : projectId ? 'Save' : 'Save new'}</button>
        <button style={btn()} onClick={() => setShowProjects(s => !s)}><FolderOpen size={14} />Projects ({projects.length})</button>
      </div>

      {status && (
        <div style={{ padding:'0.5rem 1.25rem', fontSize:'0.78rem', color: status.err ? C.red : C.teal, borderBottom:'1px solid '+C.border }}>
          {status.msg}
        </div>
      )}

      {showProjects && (
        <div style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid '+C.border, background:C.surface }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
            <span style={label}>Start new from</span>
            {T.presets.map(p => <button key={p.id} style={btn(p.id === presetId && !projectId)} onClick={() => { startFrom(p.id); setShowProjects(false) }}><Plus size={12} />{p.name}</button>)}
          </div>
          {projects.length === 0 && <div style={{ color:C.sec, fontSize:'0.8rem' }}>No saved projects yet.</div>}
          <div style={{ display:'grid', gap:6 }}>
            {projects.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'0.45rem 0.6rem', background:C.card, borderRadius:8, border:'1px solid '+(p.id === projectId ? C.teal : C.border) }}>
                <button onClick={() => load(p)} style={{ flex:1, textAlign:'left', background:'none', border:'none', color:C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem' }}>
                  {p.name} <span style={{ color:C.muted, fontSize:'0.7rem' }}>· {new Date(p.updated_at).toLocaleString()}</span>
                </button>
                <button onClick={() => remove(p)} style={{ ...btn(), padding:'0.3rem' }} aria-label="Delete"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body: scenes | editor | preview */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(180px,220px) minmax(280px,1fr) minmax(300px,420px)', gap:0, alignItems:'start' }} className="motion-grid">
        <div style={{ borderRight:'1px solid '+C.border, padding:'0.75rem', position:'sticky', top:0, maxHeight:'100vh', overflowY:'auto' }}>
          <div style={label}>Scenes</div>
          {T.scenes.map((s, i) => (
            <button key={s.key} onClick={() => seek(s.key)} style={{
              display:'block', width:'100%', textAlign:'left', padding:'0.45rem 0.55rem', marginBottom:3, borderRadius:7, cursor:'pointer', fontFamily:'inherit',
              background: s.key === scene ? 'rgba(47,184,172,0.12)' : 'transparent', border:'1px solid '+(s.key === scene ? C.teal : 'transparent'),
              color: s.key === scene ? C.text : C.sec, fontSize:'0.76rem', lineHeight:1.3,
            }}>
              <span style={{ color: s.key === scene ? C.teal : C.muted, fontWeight:700, marginRight:6 }}>{String(i + 1).padStart(2, '0')}</span>
              {s.name}
              <div style={{ fontSize:'0.64rem', color:C.muted, marginTop:2 }}>{(s.from / 30).toFixed(1)}s – {(s.to / 30).toFixed(1)}s</div>
            </button>
          ))}
        </div>

        <div style={{ padding:'1rem 1.25rem', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ fontWeight:700 }}>{sc.name}</div>
            <div style={{ flex:1 }} />
            <button style={btn()} onClick={resetScene} title="Reset this scene to the preset"><RotateCcw size={13} />Reset scene</button>
          </div>
          <ValueEditor name={scene} value={(content as Record<string, unknown>)[scene]} onChange={setSceneContent} />
          <div style={{ marginTop:18, color:C.muted, fontSize:'0.72rem', lineHeight:1.6 }}>
            Text auto-shrinks to fit. Keep lines short: the template is built for 1–4 words per line.
            Media: put files in <code>public/motion/media/</code> and set the slot&apos;s src to <code>motion/media/yourfile.mp4</code>; tick video for clips.
          </div>
          <SceneReferences
            key={scene}
            sceneKey={scene} sceneName={sc.name} projectName={name}
            sceneContent={(content as Record<string, unknown>)[scene]}
            attached={refs[scene] ?? []}
            onChange={ids => setRefs(r => ({ ...r, [scene]: ids }))}
          />
        </div>

        <div style={{ borderLeft:'1px solid '+C.border, padding:'1rem', position:'sticky', top:0 }}>
          <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid '+C.border, background:'#000' }}>
            <Player
              ref={player}
              component={KineticShort}
              inputProps={inputProps}
              durationInFrames={T.durationInFrames}
              compositionWidth={T.width}
              compositionHeight={T.height}
              fps={T.fps}
              controls
              loop
              acknowledgeRemotionLicense
              style={{ width:'100%', aspectRatio:'9 / 16' }}
            />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            <button style={btn()} onClick={downloadProps}><Download size={14} />Props JSON</button>
            <button style={btn()} onClick={copyCmd}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy render command'}</button>
          </div>
          <div style={{ marginTop:8, fontSize:'0.68rem', color:C.muted, lineHeight:1.5, wordBreak:'break-all' }}>
            Save the JSON in the repo root, then run:<br /><code style={{ color:C.sec }}>{cmd}</code>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .motion-grid { grid-template-columns: 1fr !important; } .motion-grid > div { position: static !important; max-height: none !important; border: none !important; } }`}</style>
    </div>
  )
}
