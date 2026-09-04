'use client'
import { useEffect, useState } from 'react'
import { X, ChevronRight, FileText, FolderOpen, Play, Sparkles, Clapperboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SOPS, sopForStage, productionSopIdsFor } from '@/lib/sops'
import YapSession from './YapSession'
import Storyboard from './Storyboard'

// ============================================================
// Full history / attributes view for one Content Pipeline item.
//
// The Pipeline card only ever shows the SOP note for whichever stage the
// item is CURRENTLY sitting in (STAGE_TO_SOP) -- once it advances past
// Research into Holy Trifecta, the research answers are still saved in
// content_stage_notes but drop out of view on the card. This is the single
// place to see everything decided about one item, start to finish: format/
// type, links, and every stage's note (Research answers, Trifecta title/
// thumbnail/hook decisions, assets wanted, etc.) stacked in pipeline order.
// Self-contained -- only needs an item id, fetches and saves everything
// itself, so it drops into both the Content Pipeline and the focus session
// page without either needing to pass more than that down.
// ============================================================

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const PRODUCTION_SOP_IDS = ['01','02','03','04','05','06','07','08','09','10']

type DetailItem = {
  id: string
  title: string
  pipeline_stage: string | null
  format: string | null
  video_type: string | null
  tag: string | null
  notes: string | null
  unique_angle: string | null
  revenue_note: string | null
  script_url: string | null
  drive_url: string | null
  youtube_url: string | null
  hook: string | null
  thumbnail_concept: string | null
  thumbnail_url: string | null
  seo_description: string | null
  seo_tags: string | null
}

export default function ContentItemDetail({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [item, setItem] = useState<DetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openStage, setOpenStage] = useState<string | null>(null)
  const [scriptUrl, setScriptUrl] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [hook, setHook] = useState('')
  const [thumbnailConcept, setThumbnailConcept] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoTags, setSeoTags] = useState('')
  const [showYap, setShowYap] = useState(false)
  const [showStoryboard, setShowStoryboard] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: itemData, error: itemErr }, { data: noteRows }] = await Promise.all([
        supabase.from('content_items')
          .select('id,title,pipeline_stage,format,video_type,tag,notes,unique_angle,revenue_note,script_url,drive_url,youtube_url,hook,thumbnail_concept,thumbnail_url,seo_description,seo_tags')
          .eq('id', itemId).maybeSingle(),
        supabase.from('content_stage_notes').select('sop_id,output').eq('content_item_id', itemId),
      ])
      if (cancelled) return
      if (itemErr) { setLoadErr(itemErr.message); setLoading(false); return }
      if (itemData) {
        const d = itemData as DetailItem
        setItem(d)
        setScriptUrl(d.script_url ?? '')
        setDriveUrl(d.drive_url ?? '')
        setYoutubeUrl(d.youtube_url ?? '')
        setThumbnailUrl(d.thumbnail_url ?? '')
        setHook(d.hook ?? '')
        setThumbnailConcept(d.thumbnail_concept ?? '')
        setSeoDescription(d.seo_description ?? '')
        setSeoTags(d.seo_tags ?? '')
      }
      const map: Record<string, string> = {}
      ;((noteRows ?? []) as { sop_id: string; output: string }[]).forEach(r => { map[r.sop_id] = r.output })
      setNotes(map)
      // Default-open whichever stage the item is actively working on right
      // now, or failing that the most recent stage that actually has a note.
      const currentSopId = itemData?.pipeline_stage ? sopForStage(itemData.pipeline_stage, itemData.format)?.id ?? null : null
      const sopIds = productionSopIdsFor(itemData?.format, PRODUCTION_SOP_IDS)
      const withNotes = sopIds.filter(id => map[id]?.trim())
      setOpenStage(currentSopId && map[currentSopId] ? currentSopId : (withNotes[withNotes.length - 1] ?? null))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [itemId])

  async function saveLink(field: 'script_url' | 'drive_url' | 'youtube_url' | 'thumbnail_url', value: string) {
    await supabase.from('content_items').update({ [field]: value.trim() || null }).eq('id', itemId)
  }

  async function saveField(field: 'hook' | 'thumbnail_concept' | 'seo_description' | 'seo_tags', value: string) {
    await supabase.from('content_items').update({ [field]: value.trim() || null }).eq('id', itemId)
  }

  async function saveNote(sopId: string, text: string) {
    await supabase.from('content_stage_notes')
      .upsert({ content_item_id: itemId, sop_id: sopId, output: text, updated_at: new Date().toISOString() }, { onConflict: 'content_item_id,sop_id' })
  }

  function updateNoteDraft(sopId: string, text: string) {
    setNotes(prev => ({ ...prev, [sopId]: text }))
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'36rem', maxHeight:'86vh', overflowY:'auto' as const }}>

        {loading ? (
          <div style={{ padding:'2rem', textAlign:'center', color:C.muted, fontSize:'0.85rem' }}>Loading…</div>
        ) : loadErr || !item ? (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.5rem' }}>
              <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
            </div>
            <p style={{ fontSize:'0.82rem', color:C.amber, textAlign:'center', padding:'1rem 0' }}>{loadErr ?? 'Could not find that item.'}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.75rem', marginBottom:'0.75rem' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, margin:'0 0 0.3rem' }}>{item.pipeline_stage ?? '—'}</p>
                <h3 style={{ fontSize:'1.05rem', fontWeight:800, color:C.text, margin:0, lineHeight:1.3 }}>{item.title}</h3>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={18}/></button>
            </div>

            {/* Attribute badges — the "is it a short or long-form" answer */}
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const, marginBottom:'1rem' }}>
              {item.format && <span style={{ fontSize:'0.66rem', fontWeight:700, color:C.cyan, background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'9999px', padding:'0.2rem 0.6rem' }}>{item.format}</span>}
              {item.video_type && <span style={{ fontSize:'0.66rem', fontWeight:700, color:C.purple, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:'9999px', padding:'0.2rem 0.6rem' }}>{item.video_type}</span>}
              {item.tag && <span style={{ fontSize:'0.66rem', fontWeight:700, color:C.amber, background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'9999px', padding:'0.2rem 0.6rem' }}>{item.tag}</span>}
              {!item.format && !item.video_type && !item.tag && <span style={{ fontSize:'0.72rem', color:C.muted }}>No format/type/tag set yet — decided in the Idea &amp; Validation SOP below.</span>}
            </div>

            {item.unique_angle && (
              <p style={{ fontSize:'0.76rem', color:C.purple, lineHeight:1.5, margin:'0 0 0.75rem', padding:'0.6rem 0.75rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.18)', borderRadius:'0.625rem' }}>
                &#9889; <strong>Alpha check:</strong> {item.unique_angle}
              </p>
            )}
            {item.notes && (
              <p style={{ fontSize:'0.78rem', color:C.sec, lineHeight:1.55, margin:'0 0 1rem' }}>{item.notes}</p>
            )}

            {/* Video Details -- structured Holy Trifecta / Thumbnail & SEO
                fields, editable here too so this modal is a complete picture,
                not just the Focus Session. */}
            <div style={{ marginBottom:'1.25rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              <p style={{ fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.muted, margin:0 }}>Video Details</p>
              <div>
                <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, color:C.muted, marginBottom:'0.25rem' }}>Hook</label>
                <textarea value={hook} onChange={e => setHook(e.target.value)} onBlur={() => saveField('hook', hook)}
                  placeholder="Opening line / angle, locked in Holy Trifecta" rows={2}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.74rem', lineHeight:1.5, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, color:C.muted, marginBottom:'0.25rem' }}>Thumbnail concept</label>
                <textarea value={thumbnailConcept} onChange={e => setThumbnailConcept(e.target.value)} onBlur={() => saveField('thumbnail_concept', thumbnailConcept)}
                  placeholder="Type-combo + what's in frame + accent colour, locked in Holy Trifecta" rows={2}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.74rem', lineHeight:1.5, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, color:C.muted, marginBottom:'0.25rem' }}>SEO description</label>
                <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} onBlur={() => saveField('seo_description', seoDescription)}
                  placeholder="Finalised YouTube description, from Thumbnail & SEO" rows={2}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.74rem', lineHeight:1.5, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, color:C.muted, marginBottom:'0.25rem' }}>SEO tags</label>
                <input value={seoTags} onChange={e => setSeoTags(e.target.value)} onBlur={() => saveField('seo_tags', seoTags)}
                  placeholder="Comma-separated"
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.74rem', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
            </div>

            {/* Links */}
            <div style={{ marginBottom:'1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {([
                { label:'Script', icon:<FileText size={12}/>, value:scriptUrl, set:setScriptUrl, field:'script_url' as const, ph:'Google Doc / Drive link to the script' },
                { label:'Assets', icon:<FolderOpen size={12}/>, value:driveUrl, set:setDriveUrl, field:'drive_url' as const, ph:'Google Drive folder with VO, b-roll, thumbnail' },
                { label:'Thumbnail', icon:<FileText size={12}/>, value:thumbnailUrl, set:setThumbnailUrl, field:'thumbnail_url' as const, ph:'Link to the finished thumbnail image' },
                { label:'Video', icon:<Play size={12}/>, value:youtubeUrl, set:setYoutubeUrl, field:'youtube_url' as const, ph:'Published video link' },
              ]).map(l => (
                <div key={l.field} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:C.muted, width:'5.5rem', flexShrink:0 }}>{l.icon}{l.label}</span>
                  <input
                    value={l.value} onChange={e => l.set(e.target.value)} onBlur={() => saveLink(l.field, l.value)}
                    placeholder={l.ph}
                    style={{ flex:1, padding:'0.4rem 0.6rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', outline:'none', boxSizing:'border-box' as const }}
                  />
                  {l.value && <a href={l.value} target="_blank" rel="noreferrer" style={{ flexShrink:0, color:C.cyan, display:'flex' }}><ChevronRight size={14}/></a>}
                </div>
              ))}
            </div>

            {item.revenue_note && (
              <div style={{ marginBottom:'1.25rem', padding:'0.6rem 0.75rem', background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.625rem' }}>
                <p style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.green, margin:'0 0 0.25rem' }}>Revenue attribution</p>
                <p style={{ fontSize:'0.76rem', color:C.sec, margin:0, lineHeight:1.5 }}>{item.revenue_note}</p>
              </div>
            )}

            {/* Full stage history — every SOP note this item has ever had, in order */}
            <p style={{ fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Full history</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {productionSopIdsFor(item.format, PRODUCTION_SOP_IDS).map(sopId => {
                const sop = SOPS.find(s => s.id === sopId)
                if (!sop) return null
                const note = notes[sopId] ?? ''
                const hasNote = note.trim().length > 0
                const isOpen = openStage === sopId
                const isCurrent = sopForStage(item.pipeline_stage, item.format)?.id === sopId
                return (
                  <div key={sopId} style={{ border:'1px solid '+(isCurrent ? 'rgba(0,212,255,0.3)' : C.border), borderRadius:'0.75rem', background: isCurrent ? 'rgba(0,212,255,0.03)' : 'transparent', overflow:'hidden' }}>
                    <button onClick={() => setOpenStage(isOpen ? null : sopId)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.75rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      <ChevronRight size={12} color={C.muted} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', flexShrink:0 }}/>
                      <span dangerouslySetInnerHTML={{ __html: sop.icon }} style={{ fontSize:'0.85rem', flexShrink:0 }}/>
                      <span style={{ fontSize:'0.78rem', fontWeight:700, color: hasNote ? C.text : C.muted, flex:1 }}>{sop.title}</span>
                      {isCurrent && <span style={{ fontSize:'0.6rem', fontWeight:700, color:C.cyan, textTransform:'uppercase', letterSpacing:'0.05em' }}>Current</span>}
                      {!hasNote && !isCurrent && <span style={{ fontSize:'0.65rem', color:C.muted }}>Not written yet</span>}
                    </button>
                    {isOpen && (
                      <div style={{ padding:'0 0.75rem 0.75rem' }}>
                        {sopId === '04' && (
                          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem' }}>
                            <button onClick={() => setShowYap(true)}
                              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', padding:'0.5rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.5rem', color:C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                              <Sparkles size={12}/> Yap Session
                            </button>
                            <button onClick={() => setShowStoryboard(true)}
                              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', padding:'0.5rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                              <Clapperboard size={12}/> Storyboard
                            </button>
                          </div>
                        )}
                        <textarea
                          value={note}
                          onChange={e => updateNoteDraft(sopId, e.target.value)}
                          onBlur={() => saveNote(sopId, notes[sopId] ?? '')}
                          placeholder="No notes yet for this stage — write here, or use Consult Claude on the Pipeline card while this stage is active."
                          rows={hasNote ? 6 : 3}
                          style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.76rem', lineHeight:1.55, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {showYap && item && (
        <YapSession
          itemId={itemId}
          itemTitle={item.title}
          itemContext={item.unique_angle ?? item.notes ?? undefined}
          onClose={() => setShowYap(false)}
          onSaved={outline => { updateNoteDraft('04', outline); setShowYap(false) }}
        />
      )}
      {showStoryboard && item && (
        <Storyboard
          itemId={itemId}
          itemTitle={item.title}
          itemFormat={item.format}
          driveFolderUrl={driveUrl}
          onFolderCreated={setDriveUrl}
          onClose={() => setShowStoryboard(false)}
        />
      )}
    </div>
  )
}
