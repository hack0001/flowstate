'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, Folder, FileText, ExternalLink, Copy, Check, Loader2, ChevronRight, FolderPlus, Home } from 'lucide-react'
import { getDriveFolderMap, setContentItemDriveFolder, type DriveFolderMap } from '@/lib/supabase'

// ============================================================
// Brand Assets — a live browser into Tom's "SOUND MONEY HQ" Drive folder
// (admin@derivativemedia.co.uk), surfaced in the Scripting and Storyboard
// stages of the Focus Session so brand assets/templates are one click away
// while writing/boarding, instead of alt-tabbing to Drive and hunting.
//
// Reads live via /api/drive/browse (server-side service account, see
// lib/googleDrive.ts) — nothing is copied or cached, so it's always current
// with whatever's actually in Drive. Also offers "Create Drive project
// folder" for the current video, which replicates the
// 07_PROJECTS/TEMPLATE_TO_COPY_001_XXX skeleton into LONGFORM or SHORTS
// (via /api/drive/create-project-folder) and saves the link on the item.
// ============================================================

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  modifiedTime?: string
}

type Crumb = { id: string; name: string }

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export default function BrandAssets({ itemId, itemTitle, itemFormat, driveFolderUrl, onFolderCreated, onClose }: {
  itemId: string
  itemTitle: string
  itemFormat?: string | null
  driveFolderUrl?: string | null
  onFolderCreated?: (url: string) => void
  onClose: () => void
}) {
  const [map, setMap] = useState<DriveFolderMap | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [stack, setStack] = useState<Crumb[]>([])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [folderUrl, setFolderUrl] = useState<string | null>(driveFolderUrl ?? null)

  const loadFolder = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/drive/browse?folderId=' + encodeURIComponent(folderId))
      const data = await res.json()
      if (data.error) { setError(data.error); setFiles([]) }
      else setFiles(data.files ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const { map: m, error: err } = await getDriveFolderMap()
      if (err) { setMapError(err); setLoading(false); return }
      setMap(m)
      if (m?.root_folder_id) {
        setStack([{ id: m.root_folder_id, name: 'SOUND MONEY HQ' }])
        await loadFolder(m.root_folder_id)
      } else {
        setLoading(false)
      }
    })()
  }, [loadFolder])

  function navigateTo(id: string, name: string) {
    setStack(s => [...s, { id, name }])
    loadFolder(id)
  }

  function navigateToCrumb(idx: number) {
    const next = stack.slice(0, idx + 1)
    setStack(next)
    loadFolder(next[next.length - 1].id)
  }

  function jump(folderId: string | null | undefined, name: string) {
    if (!folderId) return
    setStack([{ id: (map?.root_folder_id ?? folderId), name: 'SOUND MONEY HQ' }, { id: folderId, name }])
    loadFolder(folderId)
  }

  async function copyLink(file: DriveFile) {
    if (!file.webViewLink) return
    try {
      await navigator.clipboard.writeText(file.webViewLink)
      setCopiedId(file.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* clipboard unavailable — Open link still works */ }
  }

  async function createProjectFolder() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/drive/create-project-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: itemId, title: itemTitle, format: itemFormat }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setCreating(false); return }
      setFolderUrl(data.url)
      await setContentItemDriveFolder(itemId, data.id, data.url)
      onFolderCreated?.(data.url)
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const quickLinks: { label: string; folderId: string | null | undefined }[] = map ? [
    { label: 'Brand kit', folderId: map.brand_folder_id },
    { label: 'Asset library', folderId: map.asset_library_folder_id },
    { label: 'Premiere templates', folderId: map.premiere_templates_folder_id },
  ] : []

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:80, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', width:'100%', maxWidth:'42rem', height:'82vh', maxHeight:'46rem', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
          <div>
            <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Brand Assets</h3>
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.15rem 0 0' }}>SOUND MONEY HQ — live from Drive</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>

        {mapError && <p style={{ fontSize:'0.7rem', color:C.red, margin:'0.6rem 1.25rem 0', lineHeight:1.4 }}>{mapError}</p>}

        {!mapError && (
          <div style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0, display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            <div style={{ display:'flex', flexWrap:'wrap' as const, gap:'0.4rem' }}>
              {quickLinks.map(q => (
                <button key={q.label} disabled={!q.folderId} onClick={() => jump(q.folderId, q.label)}
                  style={{ padding:'0.3rem 0.65rem', borderRadius:'9999px', fontSize:'0.68rem', fontWeight:700, cursor: q.folderId ? 'pointer' : 'not-allowed', background:C.card, border:'1px solid '+C.border, color: q.folderId ? C.cyan : C.muted }}>
                  {q.label}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' as const }}>
              {folderUrl ? (
                <a href={folderUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', fontSize:'0.7rem', fontWeight:700, color:C.green, textDecoration:'none' }}>
                  <ExternalLink size={12}/> Open this video's project folder
                </a>
              ) : (
                <button onClick={createProjectFolder} disabled={creating}
                  style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.35rem 0.7rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, cursor: creating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                  {creating ? <Loader2 size={12} className="spin"/> : <FolderPlus size={12}/>} Create Drive project folder
                </button>
              )}
            </div>
          </div>
        )}

        {stack.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap' as const, gap:'0.2rem', padding:'0.6rem 1.25rem 0', flexShrink:0 }}>
            {stack.map((c, i) => (
              <span key={c.id} style={{ display:'flex', alignItems:'center', gap:'0.2rem' }}>
                {i > 0 && <ChevronRight size={11} color={C.muted}/>}
                <button onClick={() => navigateToCrumb(i)}
                  style={{ background:'none', border:'none', color: i === stack.length - 1 ? C.text : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight: i === stack.length - 1 ? 700 : 500, padding:'0.1rem 0.2rem', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                  {i === 0 && <Home size={10}/>} {c.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p style={{ fontSize:'0.7rem', color:C.red, margin:'0.5rem 1.25rem 0', lineHeight:1.4 }}>{error}</p>}

        <div style={{ flex:1, overflowY:'auto' as const, padding:'0.75rem 1.25rem 1rem', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
          {loading ? (
            <p style={{ fontSize:'0.8rem', color:C.muted, textAlign:'center', padding:'1.5rem 0' }}>Loading…</p>
          ) : files.length === 0 ? (
            <p style={{ fontSize:'0.78rem', color:C.muted, textAlign:'center', padding:'1.5rem 0' }}>Empty folder.</p>
          ) : (
            files.map(f => {
              const isFolder = f.mimeType === FOLDER_MIME
              return (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.5rem 0.6rem', borderRadius:'0.6rem', background:C.card, border:'1px solid '+C.border }}>
                  {isFolder ? <Folder size={15} color={C.amber}/> : <FileText size={15} color={C.cyan}/>}
                  {isFolder ? (
                    <button onClick={() => navigateTo(f.id, f.name)}
                      style={{ flex:1, textAlign:'left', background:'none', border:'none', color:C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:600, padding:0 }}>
                      {f.name}
                    </button>
                  ) : (
                    <span style={{ flex:1, color:C.text, fontSize:'0.78rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                  )}
                  {!isFolder && f.webViewLink && (
                    <>
                      <button onClick={() => copyLink(f)} title="Copy link" style={{ background:'none', border:'none', color: copiedId === f.id ? C.green : C.muted, cursor:'pointer', display:'flex' }}>
                        {copiedId === f.id ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                      <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" title="Open in Drive" style={{ color:C.muted, display:'flex' }}>
                        <ExternalLink size={14}/>
                      </a>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin 0.8s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
