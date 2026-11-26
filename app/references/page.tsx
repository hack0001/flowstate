'use client'
// Reference Bank — store Shorts and long-form videos you want to learn from, mark the parts
// worth copying (in/out, tags, notes, a still) and attach those clips to Motion Studio scenes.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Plus, Upload, Youtube, Trash2, Scissors, Play, Repeat, X, Search, Film, Library, Link2 } from 'lucide-react'
import { RefPlayer, type RefPlayerHandle } from '@/components/motion/RefPlayer'
import {
  CLIP_TAGS, listReferences, addReference, updateReference, deleteReference, uploadReferenceFile, signedUrls,
  listClips, saveClip, deleteClip, parseYouTubeId, fmtTime, type MotionReference, type ReferenceClip,
} from '@/lib/references'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  teal:'#2FB8AC', gold:'#B8935A', red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}
const FPS = 30
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.5rem 0.65rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box',
}
const btn = (accent = false, danger = false): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:6, padding:'0.45rem 0.75rem', borderRadius:'0.5rem', cursor:'pointer',
  border:'1px solid '+(accent ? C.teal : danger ? 'rgba(255,68,102,0.4)' : C.border),
  background: accent ? 'rgba(47,184,172,0.12)' : C.card, color: accent ? C.teal : danger ? C.red : C.text,
  fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap',
})
const label: React.CSSProperties = { fontSize:'0.66rem', fontWeight:700, color:C.sec, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' }
const chip = (on: boolean): React.CSSProperties => ({
  padding:'0.25rem 0.55rem', borderRadius:999, fontSize:'0.7rem', cursor:'pointer', fontFamily:'inherit',
  border:'1px solid '+(on ? C.teal : C.border), background: on ? 'rgba(47,184,172,0.14)' : 'transparent', color: on ? C.teal : C.sec,
})
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
      {CLIP_TAGS.map(t => {
        const on = value.includes(t)
        return <button key={t} type="button" style={chip(on)} onClick={() => onChange(on ? value.filter(x => x !== t) : [...value, t])}>{t}</button>
      })}
    </div>
  )
}

// Reads duration/size from a local file before upload, so Shorts are detected automatically.
function probe(file: File): Promise<{ duration: number; width: number; height: number } | null> {
  return new Promise(res => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true
    const url = URL.createObjectURL(file)
    v.onloadedmetadata = () => { res({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }); URL.revokeObjectURL(url) }
    v.onerror = () => { res(null); URL.revokeObjectURL(url) }
    v.src = url
  })
}

function AddPanel({ onAdded, onClose }: { onAdded: (r: MotionReference) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<{ duration: number; width: number; height: number } | null>(null)
  const [yt, setYt] = useState('')
  const [title, setTitle] = useState('')
  const [creator, setCreator] = useState('')
  const [format, setFormat] = useState<'short' | 'long'>('short')
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [pct, setPct] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const pick = async (f: File | null) => {
    setFile(f); setErr(null)
    if (!f) return
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    const m = await probe(f); setMeta(m)
    if (m) setFormat(m.height > m.width || m.duration <= 75 ? 'short' : 'long')
    if (f.size > 50 * 1024 * 1024) setErr(`This file is ${(f.size / 1048576).toFixed(0)} MB. Supabase Free allows 50 MB per file, so it will only upload on Pro (or with a higher limit set). For long-form, a YouTube link or a trimmed excerpt works better.`)
  }

  const submit = async () => {
    setErr(null)
    if (mode === 'youtube') {
      const id = parseYouTubeId(yt)
      if (!id) { setErr('That doesn\'t look like a YouTube link.'); return }
      const isShort = /\/shorts\//.test(yt)
      const { reference, error } = await addReference({
        title: title.trim() || 'YouTube reference', format: isShort ? 'short' : format, source: 'youtube', storage_path: null,
        youtube_id: id, creator: creator.trim() || null, duration_s: null, width: null, height: null, tags, notes: notes.trim() || null,
      })
      if (error || !reference) { setErr(error); return }
      onAdded(reference); return
    }
    if (!file) { setErr('Choose a video file first.'); return }
    setPct(0)
    const { path, error } = await uploadReferenceFile(file, setPct)
    if (error || !path) { setErr(error); setPct(null); return }
    const { reference, error: e2 } = await addReference({
      title: title.trim() || file.name, format, source: 'upload', storage_path: path, youtube_id: null,
      creator: creator.trim() || null, duration_s: meta?.duration ?? null, width: meta?.width ?? null, height: meta?.height ?? null,
      tags, notes: notes.trim() || null,
    })
    setPct(null)
    if (e2 || !reference) { setErr(e2); return }
    onAdded(reference)
  }

  return (
    <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid '+C.border, background:C.surface }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
        <button style={btn(mode === 'upload')} onClick={() => setMode('upload')}><Upload size={14} />Upload video</button>
        <button style={btn(mode === 'youtube')} onClick={() => setMode('youtube')}><Youtube size={14} />YouTube link</button>
        <div style={{ flex:1 }} />
        <button style={{ ...btn(), padding:'0.35rem' }} onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        <div>
          {mode === 'upload' ? (
            <>
              <span style={label}>Video file</span>
              <input type="file" accept="video/*" onChange={e => pick(e.target.files?.[0] ?? null)} style={{ ...inputStyle, padding:'0.4rem' }} />
              {meta && <div style={{ fontSize:'0.7rem', color:C.sec, marginTop:4 }}>{fmtTime(meta.duration)} · {meta.width}×{meta.height} · {(file!.size / 1048576).toFixed(1)} MB</div>}
            </>
          ) : (
            <>
              <span style={label}>YouTube URL (video or Short)</span>
              <input style={inputStyle} value={yt} onChange={e => setYt(e.target.value)} placeholder="https://youtube.com/shorts/…" />
            </>
          )}
        </div>
        <div><span style={label}>Title</span><input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="What is it?" /></div>
        <div><span style={label}>Creator / channel</span><input style={inputStyle} value={creator} onChange={e => setCreator(e.target.value)} placeholder="Optional" /></div>
        <div>
          <span style={label}>Format</span>
          <div style={{ display:'flex', gap:6 }}>
            <button style={btn(format === 'short')} onClick={() => setFormat('short')}>Short (vertical)</button>
            <button style={btn(format === 'long')} onClick={() => setFormat('long')}>Long form</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop:12 }}><span style={label}>What it&apos;s good for</span><TagPicker value={tags} onChange={setTags} /></div>
      <div style={{ marginTop:12 }}><span style={label}>Notes</span><textarea style={{ ...inputStyle, minHeight:54, resize:'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why you saved it" /></div>
      {err && <div style={{ color:C.red, fontSize:'0.78rem', marginTop:10 }}>{err}</div>}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:12 }}>
        <button style={btn(true)} onClick={submit} disabled={pct !== null}><Plus size={14} />{pct !== null ? `Uploading ${pct}%` : 'Add to bank'}</button>
        {pct !== null && <div style={{ flex:1, height:6, background:C.card, borderRadius:3, overflow:'hidden' }}><div style={{ width:pct + '%', height:'100%', background:C.teal }} /></div>}
      </div>
    </div>
  )
}

export default function ReferenceBankPage() {
  return <Suspense fallback={<div style={{ minHeight:'100vh', background:C.bg }} />}><ReferenceBank /></Suspense>
}

function ReferenceBank() {
  const router = useRouter()
  const params = useSearchParams()
  const player = useRef<RefPlayerHandle>(null)
  const [mounted, setMounted] = useState(false)
  const [refs, setRefs] = useState<MotionReference[]>([])
  const [clips, setClips] = useState<ReferenceClip[]>([])           // all clips (small table)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'library' | 'clips'>('library')
  const [adding, setAdding] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const [filterFormat, setFilterFormat] = useState<'all' | 'short' | 'long'>('all')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [q, setQ] = useState('')
  // marking
  const [t, setT] = useState(0)
  const [inS, setInS] = useState<number | null>(null)
  const [outS, setOutS] = useState<number | null>(null)
  const [loop, setLoop] = useState<{ start: number; end: number } | null>(null)
  const [clipLabel, setClipLabel] = useState('')
  const [clipTags, setClipTags] = useState<string[]>([])
  const [clipNotes, setClipNotes] = useState('')
  const [editId, setEditId] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    const [{ references, error }, { clips, error: e2 }] = await Promise.all([listReferences(), listClips()])
    setRefs(references); setClips(clips); setErr(error ?? e2)
    const u = await signedUrls([...references.map(r => r.storage_path ?? ''), ...clips.map(c => c.still_path ?? '')])
    setUrls(u)
  }, [])
  useEffect(() => { load() }, [load])

  // Deep link: /references?ref=<id>&clip=<id>
  useEffect(() => {
    const r = params.get('ref'); if (r) setSelId(r)
    const c = params.get('clip')
    if (c) { const cl = clips.find(x => x.id === c); if (cl) setLoop({ start: cl.start_s, end: cl.end_s }) }
  }, [params, clips])

  const sel = refs.find(r => r.id === selId) ?? null
  const selClips = useMemo(() => clips.filter(c => c.reference_id === selId).sort((a, b) => a.start_s - b.start_s), [clips, selId])
  const clipCount = (id: string) => clips.filter(c => c.reference_id === id).length

  const resetMark = () => { setInS(null); setOutS(null); setClipLabel(''); setClipTags([]); setClipNotes(''); setEditId(undefined); setLoop(null) }
  const open = (id: string, clip?: ReferenceClip) => {
    setSelId(id); setView('library'); resetMark()
    if (clip) setLoop({ start: clip.start_s, end: clip.end_s })
  }

  const markIn = () => { const now = player.current?.getTime() ?? 0; setInS(now); if (outS !== null && outS <= now) setOutS(null) }
  const markOut = () => { const now = player.current?.getTime() ?? 0; if (inS === null || now > inS) setOutS(now) }
  const step = (frames: number) => { player.current?.pause(); player.current?.seek(Math.max(0, (player.current?.getTime() ?? 0) + frames / FPS)) }
  const toggle = () => player.current?.isPaused() ? player.current?.play() : player.current?.pause()

  const save = async () => {
    if (!sel || inS === null || outS === null) return
    setSaving(true)
    let still: Blob | null = null
    if (sel.source === 'upload' && !editId) {
      // Capture the frame at the in point (seek, wait for the frame, grab it).
      player.current?.pause(); player.current?.seek(inS)
      await new Promise(r => setTimeout(r, 350))
      still = await player.current?.still() ?? null
    }
    const { clip, error } = await saveClip({
      id: editId, reference_id: sel.id, label: clipLabel.trim() || `${clipTags[0] ?? 'Clip'} at ${fmtTime(inS)}`,
      start_s: +inS.toFixed(3), end_s: +outS.toFixed(3), tags: clipTags, notes: clipNotes.trim() || null,
    }, still)
    setSaving(false)
    if (error || !clip) { setErr(error); return }
    resetMark(); load()
  }
  const edit = (c: ReferenceClip) => {
    setEditId(c.id); setInS(c.start_s); setOutS(c.end_s); setClipLabel(c.label); setClipTags(c.tags); setClipNotes(c.notes ?? '')
    setLoop({ start: c.start_s, end: c.end_s })
  }
  const removeClip = async (c: ReferenceClip) => {
    if (!window.confirm(`Delete clip "${c.label}"?`)) return
    const { error } = await deleteClip(c); if (error) setErr(error); load()
  }
  const removeRef = async (r: MotionReference) => {
    if (!window.confirm(`Delete "${r.title}" and its ${clipCount(r.id)} clips? Uploaded files are removed too.`)) return
    const { error } = await deleteReference(r, clips.filter(c => c.reference_id === r.id)); if (error) setErr(error)
    setSelId(null); load()
  }

  // Keyboard: I / O mark, space play-pause, , . step a frame, Enter save, L loop, Esc clear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (!sel || el.closest('input, textarea, select')) return
      const k = e.key.toLowerCase()
      if (k === 'i') markIn()
      else if (k === 'o') markOut()
      else if (k === ' ') { e.preventDefault(); toggle() }
      else if (k === ',') step(e.shiftKey ? -10 : -1)
      else if (k === '.') step(e.shiftKey ? 10 : 1)
      else if (k === 'l' && inS !== null && outS !== null) setLoop(l => l ? null : { start: inS, end: outS })
      else if (k === 'enter') save()
      else if (k === 'escape') resetMark()
      else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const visibleRefs = refs.filter(r =>
    (filterFormat === 'all' || r.format === filterFormat) &&
    (!filterTags.length || filterTags.some(t => r.tags.includes(t) || clips.some(c => c.reference_id === r.id && c.tags.includes(t)))) &&
    (!q || (r.title + ' ' + (r.creator ?? '') + ' ' + (r.notes ?? '')).toLowerCase().includes(q.toLowerCase())))
  const visibleClips = clips.filter(c => {
    const r = refs.find(x => x.id === c.reference_id)
    return r && (filterFormat === 'all' || r.format === filterFormat) && (!filterTags.length || filterTags.some(t => c.tags.includes(t))) &&
      (!q || (c.label + ' ' + (c.notes ?? '') + ' ' + r.title).toLowerCase().includes(q.toLowerCase()))
  })
  const thumbFor = (r: MotionReference, c?: ReferenceClip) =>
    (c?.still_path && urls[c.still_path]) || (r.youtube_id ? ytThumb(r.youtube_id) : null)

  if (!mounted) return <div style={{ minHeight:'100vh', background:C.bg }} />

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0.9rem 1.25rem', borderBottom:'1px solid '+C.border, flexWrap:'wrap' }}>
        <button onClick={() => router.push('/')} style={{ ...btn(), padding:'0.4rem' }} aria-label="Back"><ChevronLeft size={16} /></button>
        <div style={{ fontWeight:800, fontSize:'1rem' }}>Reference Bank</div>
        <div style={{ color:C.sec, fontSize:'0.78rem' }}>{refs.length} videos · {clips.length} clips</div>
        <div style={{ flex:1 }} />
        <button style={btn(view === 'library')} onClick={() => setView('library')}><Library size={14} />Library</button>
        <button style={btn(view === 'clips')} onClick={() => { setView('clips'); setSelId(null) }}><Scissors size={14} />All clips</button>
        <button style={btn()} onClick={() => router.push('/motion')}><Film size={14} />Motion Studio</button>
        <button style={btn(true)} onClick={() => setAdding(a => !a)}><Plus size={14} />Add reference</button>
      </div>
      {err && <div style={{ padding:'0.5rem 1.25rem', fontSize:'0.78rem', color:C.red, borderBottom:'1px solid '+C.border }}>{err}</div>}
      {adding && <AddPanel onClose={() => setAdding(false)} onAdded={r => { setAdding(false); load().then(() => open(r.id)) }} />}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', padding:'0.65rem 1.25rem', borderBottom:'1px solid '+C.border, flexWrap:'wrap' }}>
        <div style={{ position:'relative', width:220 }}>
          <Search size={13} style={{ position:'absolute', left:9, top:10, color:C.muted }} />
          <input style={{ ...inputStyle, paddingLeft:28 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search" />
        </div>
        {(['all', 'short', 'long'] as const).map(f => <button key={f} style={chip(filterFormat === f)} onClick={() => setFilterFormat(f)}>{f === 'all' ? 'All' : f === 'short' ? 'Shorts' : 'Long form'}</button>)}
        <span style={{ width:1, height:18, background:C.border }} />
        {CLIP_TAGS.map(t => <button key={t} style={chip(filterTags.includes(t))} onClick={() => setFilterTags(v => v.includes(t) ? v.filter(x => x !== t) : [...v, t])}>{t}</button>)}
      </div>

      {view === 'clips' ? (
        <div style={{ padding:'1rem 1.25rem', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
          {visibleClips.length === 0 && <div style={{ color:C.sec, fontSize:'0.85rem' }}>No clips yet. Open a video in the Library and mark the parts you like with I and O.</div>}
          {visibleClips.map(c => {
            const r = refs.find(x => x.id === c.reference_id)!
            const th = thumbFor(r, c)
            return (
              <button key={c.id} onClick={() => open(r.id, c)} style={{ textAlign:'left', background:C.card, border:'1px solid '+C.border, borderRadius:10, overflow:'hidden', cursor:'pointer', padding:0, color:C.text, fontFamily:'inherit' }}>
                <div style={{ aspectRatio:'16 / 9', background:'#000', display:'grid', placeItems:'center' }}>
                  {th ? <img src={th} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <Scissors size={20} color={C.muted} />}
                </div>
                <div style={{ padding:'0.55rem 0.65rem' }}>
                  <div style={{ fontWeight:700, fontSize:'0.8rem' }}>{c.label}</div>
                  <div style={{ fontSize:'0.68rem', color:C.sec, marginTop:2 }}>{r.title} · {fmtTime(c.start_s)} · {(c.end_s - c.start_s).toFixed(1)}s</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>{c.tags.map(t => <span key={t} style={{ ...chip(true), cursor:'default', fontSize:'0.62rem' }}>{t}</span>)}</div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="refs-grid" style={{ display:'grid', gridTemplateColumns:'minmax(220px,280px) 1fr', alignItems:'start' }}>
          {/* Library list */}
          <div style={{ borderRight:'1px solid '+C.border, padding:'0.75rem', maxHeight:'calc(100vh - 120px)', overflowY:'auto', position:'sticky', top:0 }}>
            {visibleRefs.length === 0 && <div style={{ color:C.sec, fontSize:'0.8rem', padding:'0.5rem' }}>Nothing here yet. Click <b>Add reference</b> to upload a video or paste a YouTube link.</div>}
            {visibleRefs.map(r => {
              const th = thumbFor(r)
              return (
                <button key={r.id} onClick={() => open(r.id)} style={{
                  display:'flex', gap:8, width:'100%', textAlign:'left', padding:'0.45rem', marginBottom:4, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                  background: r.id === selId ? 'rgba(47,184,172,0.12)' : 'transparent', border:'1px solid '+(r.id === selId ? C.teal : 'transparent'), color:C.text,
                }}>
                  <div style={{ width:56, height:40, borderRadius:5, background:'#000', flexShrink:0, overflow:'hidden', display:'grid', placeItems:'center' }}>
                    {th ? <img src={th} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : r.source === 'youtube' ? <Youtube size={14} color={C.muted} /> : <Film size={14} color={C.muted} />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize:'0.66rem', color:C.sec }}>{r.format === 'short' ? 'Short' : 'Long'} · {clipCount(r.id)} clips{r.duration_s ? ' · ' + fmtTime(r.duration_s).replace(/\.\d+$/, '') : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detail */}
          <div style={{ padding:'1rem 1.25rem', minWidth:0 }}>
            {!sel ? (
              <div style={{ color:C.sec, fontSize:'0.85rem', lineHeight:1.7, maxWidth:560 }}>
                <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>How it works</div>
                1. Add a Short or long-form video (upload, or a YouTube link).<br />
                2. Open it, play to a moment you like, press <b>I</b> for the start and <b>O</b> for the end.<br />
                3. Tag it (transition, text, data…), say what to take from it, press <b>Enter</b> to save the clip.<br />
                4. In Motion Studio, attach clips to a scene to watch them beside your preview, and copy a recreation brief to build that move.
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                  <div style={{ fontWeight:800 }}>{sel.title}</div>
                  {sel.creator && <div style={{ color:C.sec, fontSize:'0.78rem' }}>· {sel.creator}</div>}
                  <div style={{ flex:1 }} />
                  {sel.youtube_id && <a href={`https://youtu.be/${sel.youtube_id}`} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration:'none' }}><Link2 size={13} />YouTube</a>}
                  <button style={btn(false, true)} onClick={() => removeRef(sel)}><Trash2 size={13} />Delete</button>
                </div>
                <div className="refs-detail" style={{ display:'grid', gridTemplateColumns: sel.format === 'short' ? 'minmax(240px,360px) 1fr' : 'minmax(0,1fr) minmax(300px,380px)', gap:16, alignItems:'start' }}>
                  <div>
                    <RefPlayer
                      key={sel.id} ref={player} reference={sel} src={sel.storage_path ? urls[sel.storage_path] : undefined}
                      loop={loop} onTime={setT}
                      onMeta={m => { if (!sel.duration_s && m.duration) updateReference(sel.id, { duration_s: m.duration, ...(m.width ? { width: m.width, height: m.height } : {}) }) }}
                    />
                    {/* Timeline with clip ranges */}
                    <Timeline duration={sel.duration_s ?? player.current?.getDuration() ?? 0} t={t} inS={inS} outS={outS} clips={selClips} onSeek={s => player.current?.seek(s)} onPick={c => setLoop({ start: c.start_s, end: c.end_s })} />
                  </div>

                  <div style={{ display:'grid', gap:12, alignContent:'start' }}>
                    {/* Marker */}
                    <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:10, padding:'0.8rem' }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                        <span style={{ ...label, marginBottom:0 }}>{editId ? 'Edit clip' : 'Mark a clip'}</span>
                        <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'0.85rem' }}>{fmtTime(t)}</span>
                        <span style={{ color:C.muted, fontSize:'0.68rem' }}>frame {Math.round(t * FPS)}</span>
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                        <button style={btn()} onClick={() => step(-1)} title="Back 1 frame (,)">−1f</button>
                        <button style={btn()} onClick={toggle} title="Play / pause (space)"><Play size={13} /></button>
                        <button style={btn()} onClick={() => step(1)} title="Forward 1 frame (.)">+1f</button>
                        <button style={btn(inS !== null)} onClick={markIn} title="Set in (I)">In {inS !== null ? fmtTime(inS) : '—'}</button>
                        <button style={btn(outS !== null)} onClick={markOut} title="Set out (O)">Out {outS !== null ? fmtTime(outS) : '—'}</button>
                        <button style={btn(!!loop)} disabled={inS === null || outS === null} onClick={() => setLoop(l => l ? null : { start: inS!, end: outS! })} title="Loop in→out (L)"><Repeat size={13} />Loop</button>
                      </div>
                      <span style={label}>Label</span>
                      <input style={inputStyle} value={clipLabel} onChange={e => setClipLabel(e.target.value)} placeholder="e.g. Whip-pan into stat card" />
                      <div style={{ marginTop:10 }}><span style={label}>Tags</span><TagPicker value={clipTags} onChange={setClipTags} /></div>
                      <div style={{ marginTop:10 }}><span style={label}>What to take from it</span>
                        <textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={clipNotes} onChange={e => setClipNotes(e.target.value)} placeholder="e.g. Number counts up while the card slides in from the right, ~10 frames, slight overshoot" />
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
                        <button style={btn(true)} disabled={inS === null || outS === null || saving} onClick={save}><Scissors size={13} />{saving ? 'Saving…' : editId ? 'Update clip' : 'Save clip'}</button>
                        {(inS !== null || editId) && <button style={btn()} onClick={resetMark}>Clear</button>}
                        {inS !== null && outS !== null && <span style={{ fontSize:'0.7rem', color:C.sec }}>{(outS - inS).toFixed(2)} s · {Math.round((outS - inS) * FPS)} frames</span>}
                      </div>
                      <div style={{ fontSize:'0.66rem', color:C.muted, marginTop:8 }}>Keys: I in · O out · space play · , . frame step (shift ×10) · L loop · Enter save · Esc clear</div>
                    </div>

                    {/* Clips in this video */}
                    <div>
                      <span style={label}>Clips in this video ({selClips.length})</span>
                      {selClips.length === 0 && <div style={{ color:C.muted, fontSize:'0.78rem' }}>None yet.</div>}
                      <div style={{ display:'grid', gap:6 }}>
                        {selClips.map(c => {
                          const th = thumbFor(sel, c)
                          const playing = loop && loop.start === c.start_s && loop.end === c.end_s
                          return (
                            <div key={c.id} style={{ display:'flex', gap:8, alignItems:'center', background:C.card, border:'1px solid '+(playing ? C.teal : C.border), borderRadius:8, padding:6 }}>
                              <div style={{ width:64, height:40, background:'#000', borderRadius:5, overflow:'hidden', flexShrink:0 }}>{th && <img src={th} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:'0.78rem', fontWeight:600 }}>{c.label}</div>
                                <div style={{ fontSize:'0.66rem', color:C.sec }}>{fmtTime(c.start_s)} → {fmtTime(c.end_s)} · {c.tags.join(', ')}</div>
                                {c.notes && <div style={{ fontSize:'0.68rem', color:C.muted, marginTop:2 }}>{c.notes}</div>}
                              </div>
                              <button style={{ ...btn(!!playing), padding:'0.3rem 0.5rem' }} onClick={() => { setLoop(playing ? null : { start: c.start_s, end: c.end_s }); if (!playing) player.current?.play() }} title="Loop this clip"><Repeat size={12} /></button>
                              <button style={{ ...btn(), padding:'0.3rem 0.5rem' }} onClick={() => edit(c)}>Edit</button>
                              <button style={{ ...btn(false, true), padding:'0.3rem' }} onClick={() => removeClip(c)} aria-label="Delete clip"><Trash2 size={12} /></button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`.ref-yt iframe{position:absolute;inset:0;width:100%;height:100%}
        @media (max-width: 900px){ .refs-grid, .refs-detail { grid-template-columns: 1fr !important; } .refs-grid > div { position: static !important; max-height: none !important; border: none !important; } }`}</style>
    </div>
  )
}

function Timeline({ duration, t, inS, outS, clips, onSeek, onPick }: {
  duration: number; t: number; inS: number | null; outS: number | null; clips: ReferenceClip[]
  onSeek: (s: number) => void; onPick: (c: ReferenceClip) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  if (!duration) return null
  const pct = (s: number) => `${Math.min(100, Math.max(0, (s / duration) * 100))}%`
  return (
    <div style={{ marginTop:10 }}>
      <div ref={bar} onClick={e => { const r = bar.current!.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * duration) }}
        style={{ position:'relative', height:28, background:C.card, border:'1px solid '+C.border, borderRadius:6, cursor:'pointer' }}>
        {clips.map(c => (
          <div key={c.id} title={c.label} onClick={e => { e.stopPropagation(); onPick(c) }}
            style={{ position:'absolute', top:4, bottom:4, left:pct(c.start_s), width:`max(3px, calc(${pct(c.end_s)} - ${pct(c.start_s)}))`, background:'rgba(184,147,90,0.55)', borderRadius:3 }} />
        ))}
        {inS !== null && <div style={{ position:'absolute', top:0, bottom:0, left:pct(inS), width: outS !== null ? `calc(${pct(outS)} - ${pct(inS)})` : 2, background:'rgba(47,184,172,0.35)', borderLeft:'2px solid '+C.teal }} />}
        <div style={{ position:'absolute', top:-3, bottom:-3, left:pct(t), width:2, background:C.text }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:C.muted, marginTop:3 }}>
        <span>0:00</span><span>gold = saved clips · teal = current mark</span><span>{fmtTime(duration).replace(/\.\d+$/, '')}</span>
      </div>
    </div>
  )
}
