'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMusicLibrary, addMusicTrack, updateMusicTrack, deleteMusicTrack,
  MUSIC_GENRES, type MusicGenre, type MusicTrack,
} from '@/lib/supabase'
import { ChevronLeft, Plus, X, ExternalLink, Edit3, Trash2, CheckCircle2, Circle, Youtube, Globe, Music, Disc3 } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', pink:'#ff4fa3',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

// Mood/genre colors, used consistently for badges/filters.
const GENRE_META: Record<MusicGenre, { color: string; emoji: string }> = {
  'Trending / Viral': { color:'#ff4fa3', emoji:'🔥' },
  'Phonk':            { color:'#8b5cf6', emoji:'🥶' },
  'Lo-fi / Chill':    { color:'#00d4ff', emoji:'🌙' },
  'Cinematic / Epic':  { color:'#f59e0b', emoji:'🎬' },
  'Upbeat / Pop':     { color:'#00ff88', emoji:'⚡' },
  'Other':            { color:'#8888aa', emoji:'🎵' },
}

function trackKind(url: string): 'YouTube' | 'TikTok' | 'Website' {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube'
  if (/tiktok\.com/i.test(url)) return 'TikTok'
  return 'Website'
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.6rem 0.8rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none',
  boxSizing:'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor:'pointer', appearance:'none' as const }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize:'vertical' as const, minHeight:70, lineHeight:1.6 }

type Draft = { id?: string; genre: MusicGenre; title: string; url: string; artist: string; notes: string }
const EMPTY_DRAFT: Draft = { genre:'Trending / Viral', title:'', url:'', artist:'', notes:'' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TrackDrawer({
  draft, setDraft, onSave, onClose, saving,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100 }}/>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'min(480px,100vw)',
        background:C.surface, borderLeft:'1px solid '+C.border,
        zIndex:101, display:'flex', flexDirection:'column', overflowY:'auto',
      }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, flex:1 }}>
            {draft.id ? 'Edit Track' : 'New Track'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'0.25rem' }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding:'1.25rem 1.5rem', flex:1 }}>
          <Field label="Genre / Mood">
            <select value={draft.genre} onChange={e => setDraft({ ...draft, genre: e.target.value as MusicGenre })} style={selectStyle}>
              {MUSIC_GENRES.map(g => <option key={g} value={g}>{GENRE_META[g].emoji} {g}</option>)}
            </select>
          </Field>

          <Field label="Track name *">
            <input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Vem Pere Reka (Slowed)" style={inputStyle}/>
          </Field>

          <Field label="Link *">
            <input value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://youtube.com/... or a TikTok sound link" style={inputStyle}/>
          </Field>

          <Field label="Artist">
            <input value={draft.artist} onChange={e => setDraft({ ...draft, artist: e.target.value })} placeholder="Optional" style={inputStyle}/>
          </Field>

          <Field label="Notes">
            <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Where you'd use it, vibe, other versions..." style={textareaStyle}/>
          </Field>
        </div>

        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid '+C.border, display:'flex', gap:'0.75rem', flexShrink:0 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.title.trim() || !draft.url.trim()}
            style={{
              flex:1, padding:'0.75rem', background:'linear-gradient(135deg,'+C.pink+',#c026a3)', border:'none',
              borderRadius:'0.75rem', color:'#000', fontWeight:800, fontSize:'0.9rem',
              cursor: saving || !draft.title.trim() || !draft.url.trim() ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', opacity: saving || !draft.title.trim() || !draft.url.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : draft.id ? 'Save Changes' : 'Add Track'}
          </button>
          <button onClick={onClose} style={{ padding:'0.75rem 1.25rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

export default function MusicPage() {
  const router = useRouter()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [genreFilter, setGenreFilter] = useState<MusicGenre | 'All'>('All')
  const [showUsed, setShowUsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { tracks, error } = await getMusicLibrary()
    setTracks(tracks)
    setErrMsg(error)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setDrawerOpen(true)
  }

  function openEdit(t: MusicTrack) {
    setDraft({ id:t.id, genre:t.genre, title:t.title, url:t.url, artist:t.artist ?? '', notes:t.notes ?? '' })
    setDrawerOpen(true)
  }

  async function saveDrawer() {
    if (!draft.title.trim() || !draft.url.trim()) return
    setSaving(true)
    if (draft.id) {
      const { error } = await updateMusicTrack(draft.id, { genre:draft.genre, title:draft.title.trim(), url:draft.url.trim(), artist:draft.artist.trim() || undefined, notes:draft.notes.trim() || undefined })
      if (error) setErrMsg(error)
      else setTracks(prev => prev.map(t => t.id === draft.id ? { ...t, genre:draft.genre, title:draft.title.trim(), url:draft.url.trim(), artist:draft.artist.trim() || null, notes:draft.notes.trim() || null } : t))
    } else {
      const { track, error } = await addMusicTrack(draft.genre, draft.title, draft.url, draft.artist, draft.notes)
      if (error) setErrMsg(error)
      else if (track) setTracks(prev => [track, ...prev])
    }
    setSaving(false)
    setDrawerOpen(false)
  }

  async function toggleUsed(t: MusicTrack) {
    const nextStatus = t.status === 'Used' ? 'Saved' : 'Used'
    setTracks(prev => prev.map(x => x.id === t.id ? { ...x, status: nextStatus } : x)) // optimistic
    const { error } = await updateMusicTrack(t.id, { status: nextStatus })
    if (error) setErrMsg(error)
  }

  async function removeTrack(id: string) {
    if (!confirm('Remove this track?')) return
    setTracks(prev => prev.filter(t => t.id !== id)) // optimistic
    const { error } = await deleteMusicTrack(id)
    if (error) setErrMsg(error)
  }

  const genreCounts: Record<string, number> = {}
  tracks.forEach(t => { if (t.status !== 'Used') genreCounts[t.genre] = (genreCounts[t.genre] ?? 0) + 1 })

  const visible = tracks
    .filter(t => showUsed ? t.status === 'Used' : t.status !== 'Used')
    .filter(t => genreFilter === 'All' || t.genre === genreFilter)

  const savedCount = tracks.filter(t => t.status !== 'Used').length
  const usedCount = tracks.filter(t => t.status === 'Used').length

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(255,79,163,0.08) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap' as const, gap:'1rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Disc3 size={22} color={C.pink}/> Music Library
              </h1>
              <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
                {savedCount} saved &mdash; {usedCount} used
              </p>
            </div>
            <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:'rgba(255,79,163,0.12)', border:'1px solid rgba(255,79,163,0.3)', borderRadius:'0.75rem', color:C.pink, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, alignSelf:'flex-end' }}>
              <Plus size={14}/> New Track
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'1.5rem 2rem' }}>
        {errMsg && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.amber, margin:0, lineHeight:1.5, flex:1 }}>{errMsg}</p>
            <button onClick={() => setErrMsg(null)} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </div>
        )}

        {/* Saved / Used toggle */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem' }}>
          <button onClick={() => setShowUsed(false)} style={{ padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(!showUsed ? C.pink : C.border), background:!showUsed ? 'rgba(255,79,163,0.12)' : 'transparent', color:!showUsed ? C.pink : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
            Saved {savedCount > 0 && <span style={{ opacity:0.7 }}>({savedCount})</span>}
          </button>
          <button onClick={() => setShowUsed(true)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 1rem', borderRadius:'0.625rem', border:'1px solid '+(showUsed ? C.green : C.border), background:showUsed ? 'rgba(0,255,136,0.08)' : 'transparent', color:showUsed ? C.green : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
            Used {usedCount > 0 && <span style={{ opacity:0.7 }}>({usedCount})</span>}
          </button>
        </div>

        {/* Genre filter pills */}
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const, marginBottom:'1.75rem' }}>
          {(['All', ...MUSIC_GENRES] as const).map(g => {
            const active = genreFilter === g
            const meta = g !== 'All' ? GENRE_META[g] : null
            const count = g === 'All' ? (showUsed ? usedCount : savedCount) : (showUsed ? tracks.filter(t => t.status === 'Used' && t.genre === g).length : (genreCounts[g] ?? 0))
            return (
              <button key={g} onClick={() => setGenreFilter(g)} style={{
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.3rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.72rem', fontWeight:700,
                background: active ? (meta?.color ?? C.pink) + '18' : C.card,
                border: '1px solid ' + (active ? (meta?.color ?? C.pink) + '50' : C.border),
                color: active ? (meta?.color ?? C.pink) : C.sec,
                transition:'all 0.15s',
              }}>
                {meta?.emoji} {g} <span style={{ opacity:0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ color:C.muted, fontSize:'0.85rem' }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
            {tracks.length === 0 ? (
              <>
                <p style={{ fontSize:'1rem', color:C.sec, marginBottom:'0.5rem', fontWeight:700 }}>No tracks yet</p>
                <p style={{ fontSize:'0.8rem', marginBottom:'1rem' }}>Save a link to a trending, slowed, or otherwise useful track for your videos and Shorts.</p>
                <button onClick={openNew} style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.75rem 1.5rem', background:'linear-gradient(135deg,'+C.pink+',#c026a3)', border:'none', borderRadius:'0.875rem', color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}>
                  <Plus size={16}/> Add First Track
                </button>
              </>
            ) : (
              <p>Nothing here yet.</p>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.75rem' }}>
            {visible.map(t => {
              const meta = GENRE_META[t.genre]
              const kind = trackKind(t.url)
              const used = t.status === 'Used'
              return (
                <div key={t.id} style={{ background:C.card, border:'1px solid '+(used ? 'rgba(0,255,136,0.25)' : C.border), borderRadius:'1rem', padding:'1rem', opacity: used ? 0.75 : 1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.6rem', flexWrap:'wrap' as const }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.05em', color:meta.color, background:meta.color+'18', border:'1px solid '+meta.color+'40', borderRadius:'9999px', padding:'0.15rem 0.5rem' }}>
                      {meta.emoji} {t.genre}
                    </span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>
                      {kind === 'YouTube' ? <Youtube size={10}/> : kind === 'TikTok' ? <Music size={10}/> : <Globe size={10}/>} {kind}
                    </span>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ color:C.cyan, display:'flex', marginLeft:'auto' }}>
                      <ExternalLink size={12}/>
                    </a>
                  </div>

                  <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:'0 0 0.2rem', lineHeight:1.35, textDecoration: used ? 'line-through' : 'none' }}>{t.title}</h3>
                  {t.artist && <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.4rem' }}>{t.artist}</p>}

                  {t.notes && (
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.75rem', lineHeight:1.5 }}>{t.notes}</p>
                  )}

                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' as const }}>
                    <button onClick={() => toggleUsed(t)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.75rem', background: used ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)', border:'1px solid '+(used ? 'rgba(0,255,136,0.3)' : C.border), borderRadius:'0.5rem', color: used ? C.green : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                      {used ? <CheckCircle2 size={12}/> : <Circle size={12}/>} {used ? 'Used' : 'Mark used'}
                    </button>
                    <button onClick={() => openEdit(t)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.6rem', background:'rgba(255,79,163,0.08)', border:'1px solid rgba(255,79,163,0.25)', borderRadius:'0.5rem', color:C.pink, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                      <Edit3 size={11}/>
                    </button>
                    <button onClick={() => removeTrack(t.id)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.6rem', background:'rgba(255,68,102,0.06)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'0.5rem', color:C.red, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700, marginLeft:'auto' }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {drawerOpen && (
        <TrackDrawer
          draft={draft}
          setDraft={setDraft}
          onSave={saveDrawer}
          onClose={() => setDrawerOpen(false)}
          saving={saving}
        />
      )}

      <style>{`
        input:focus, select:focus, textarea:focus { border-color: ${C.pink} !important; }
        button:hover { opacity:0.85; }
        select { appearance:none; }
        textarea { font-family:inherit; }
      `}</style>
    </main>
  )
}
