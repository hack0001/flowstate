'use client'
// Motion Studio: reference clips attached to the selected scene, looping beside the editor,
// plus a picker over the whole Reference Bank and a "recreation brief" for building the move.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Copy, Check, Search, Scissors, ExternalLink } from 'lucide-react'
import { RefPlayer } from '@/components/motion/RefPlayer'
import { CLIP_TAGS, listReferences, listClips, signedUrls, fmtTime, recreationBrief, type MotionReference, type ReferenceClip } from '@/lib/references'

const C = { bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a', teal:'#2FB8AC', red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a' }
const btn = (accent = false): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:6, padding:'0.4rem 0.7rem', borderRadius:'0.5rem', cursor:'pointer',
  border:'1px solid '+(accent ? C.teal : C.border), background: accent ? 'rgba(47,184,172,0.12)' : C.card,
  color: accent ? C.teal : C.text, fontSize:'0.76rem', fontWeight:600, fontFamily:'inherit',
})
const chip = (on: boolean): React.CSSProperties => ({
  padding:'0.22rem 0.5rem', borderRadius:999, fontSize:'0.68rem', cursor:'pointer', fontFamily:'inherit',
  border:'1px solid '+(on ? C.teal : C.border), background: on ? 'rgba(47,184,172,0.14)' : 'transparent', color: on ? C.teal : C.sec,
})

export function SceneReferences({ sceneKey, sceneName, sceneContent, projectName, attached, onChange }: {
  sceneKey: string; sceneName: string; sceneContent: unknown; projectName: string
  attached: string[]; onChange: (ids: string[]) => void
}) {
  const [refs, setRefs] = useState<MotionReference[]>([])
  const [clips, setClips] = useState<ReferenceClip[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    (async () => {
      const [{ references, error }, { clips, error: e2 }] = await Promise.all([listReferences(), listClips()])
      setRefs(references); setClips(clips); setErr(error ?? e2)
      setUrls(await signedUrls([...references.map(r => r.storage_path ?? ''), ...clips.map(c => c.still_path ?? '')]))
    })()
  }, [])

  const byId = useMemo(() => Object.fromEntries(refs.map(r => [r.id, r])), [refs])
  const mine = attached.map(id => clips.find(c => c.id === id)).filter(Boolean) as ReferenceClip[]
  const thumb = (c: ReferenceClip) => (c.still_path && urls[c.still_path]) || (byId[c.reference_id]?.youtube_id ? `https://i.ytimg.com/vi/${byId[c.reference_id].youtube_id}/mqdefault.jpg` : null)
  const pool = clips.filter(c => !attached.includes(c.id) && (!tags.length || tags.some(t => c.tags.includes(t))) &&
    (!q || (c.label + ' ' + (c.notes ?? '') + ' ' + (byId[c.reference_id]?.title ?? '')).toLowerCase().includes(q.toLowerCase())))

  const copyBrief = async () => {
    await navigator.clipboard.writeText(recreationBrief({ project: projectName, sceneKey, sceneName, sceneContent, clips: mine.map(c => ({ ...c, ref: byId[c.reference_id] })) }))
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ marginTop:22, paddingTop:16, borderTop:'1px solid '+C.border }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <div style={{ fontWeight:700, fontSize:'0.88rem' }}>References for this scene</div>
        <span style={{ color:C.muted, fontSize:'0.72rem' }}>{mine.length} attached</span>
        <div style={{ flex:1 }} />
        <button style={btn()} onClick={() => setPicking(true)}><Plus size={13} />Attach clip</button>
        <button style={btn(mine.length > 0)} disabled={!mine.length} onClick={copyBrief} title="Copy a brief to paste to Claude so it can build this move into the template">
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy recreation brief'}
        </button>
      </div>
      {err && <div style={{ color:C.red, fontSize:'0.75rem', marginBottom:8 }}>{err}</div>}
      {mine.length === 0 && (
        <div style={{ color:C.muted, fontSize:'0.76rem', lineHeight:1.6 }}>
          Attach clips from your <Link href="/references" style={{ color:C.teal }}>Reference Bank</Link> to see the move you&apos;re aiming for while you edit.
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
        {mine.map(c => {
          const r = byId[c.reference_id]
          if (!r) return null
          return (
            <div key={c.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:10, overflow:'hidden' }}>
              <RefPlayer reference={r} src={r.storage_path ? urls[r.storage_path] : undefined} loop={{ start: c.start_s, end: c.end_s }} autoPlay muted controls={false} style={{ borderRadius:0, maxHeight:'260px' }} />
              <div style={{ padding:'0.5rem 0.6rem' }}>
                <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.78rem' }}>{c.label}</div>
                    <div style={{ fontSize:'0.66rem', color:C.sec }}>{r.title} · {fmtTime(c.start_s)} · {(c.end_s - c.start_s).toFixed(1)}s</div>
                  </div>
                  <Link href={`/references?ref=${r.id}&clip=${c.id}`} style={{ color:C.sec }} title="Open in Reference Bank"><ExternalLink size={13} /></Link>
                  <button onClick={() => onChange(attached.filter(x => x !== c.id))} style={{ background:'none', border:'none', color:C.sec, cursor:'pointer', padding:0 }} aria-label="Detach"><X size={14} /></button>
                </div>
                {c.notes && <div style={{ fontSize:'0.68rem', color:C.muted, marginTop:4, lineHeight:1.45 }}>{c.notes}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {picking && (
        <div onClick={() => setPicking(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:50, display:'grid', placeItems:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'min(920px,100%)', maxHeight:'85vh', overflow:'auto', background:C.surface, border:'1px solid '+C.border, borderRadius:12, padding:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ fontWeight:700 }}>Attach to: {sceneName}</div>
              <div style={{ flex:1 }} />
              <button onClick={() => setPicking(false)} style={{ ...btn(), padding:'0.3rem' }} aria-label="Close"><X size={14} /></button>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
              <div style={{ position:'relative', width:200 }}>
                <Search size={13} style={{ position:'absolute', left:9, top:9, color:C.muted }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clips" style={{ width:'100%', padding:'0.42rem 0.6rem 0.42rem 28px', background:C.card, border:'1px solid '+C.border, borderRadius:8, color:C.text, fontFamily:'inherit', fontSize:'0.8rem', boxSizing:'border-box' }} />
              </div>
              {CLIP_TAGS.map(t => <button key={t} style={chip(tags.includes(t))} onClick={() => setTags(v => v.includes(t) ? v.filter(x => x !== t) : [...v, t])}>{t}</button>)}
            </div>
            {pool.length === 0 && <div style={{ color:C.sec, fontSize:'0.8rem' }}>{clips.length ? 'No matching clips.' : <>No clips yet. Mark some in the <Link href="/references" style={{ color:C.teal }}>Reference Bank</Link>.</>}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
              {pool.map(c => {
                const th = thumb(c), r = byId[c.reference_id]
                return (
                  <button key={c.id} onClick={() => { onChange([...attached, c.id]); setPicking(false) }} style={{ textAlign:'left', padding:0, background:C.card, border:'1px solid '+C.border, borderRadius:10, overflow:'hidden', cursor:'pointer', color:C.text, fontFamily:'inherit' }}>
                    <div style={{ aspectRatio:'16 / 9', background:'#000', display:'grid', placeItems:'center' }}>
                      {th ? <img src={th} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <Scissors size={18} color={C.muted} />}
                    </div>
                    <div style={{ padding:'0.45rem 0.55rem' }}>
                      <div style={{ fontWeight:700, fontSize:'0.76rem' }}>{c.label}</div>
                      <div style={{ fontSize:'0.64rem', color:C.sec }}>{r?.title} · {(c.end_s - c.start_s).toFixed(1)}s · {c.tags.join(', ')}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
