'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Trash2, GripVertical, Wand2, Loader2, AlertTriangle } from 'lucide-react'
import { supabase, getStageNote } from '@/lib/supabase'
import { SCRIPT_PACING_TARGET_SECONDS, SPEAKING_WORDS_PER_SECOND } from '@/lib/sops'

// ============================================================
// Storyboard — turns a finished script into a shot-by-shot, color-coded
// list of blocks (VO / on-screen text / b-roll / screenshot / animation /
// image / meme / SFX), so every visual decision gets made once, up front,
// instead of re-litigated block-by-block in Premiere. The running asset
// checklist at the bottom answers "what do I need to go collect/build
// before I sit down to edit" — screenshots to grab, b-roll to find, memes
// to source, animations to build.
//
// Retention pacing check: each block IS a visual/cut, so its estimated
// speaking time (word count / SPEAKING_WORDS_PER_SECOND) doubles as "how
// long this shot holds before the next cut." Any block estimated to run
// past SCRIPT_PACING_TARGET_SECONDS (shared with the Scripting SOP's
// pacing rule, lib/sops.ts) gets flagged — that's a stretch of script that
// implies a static shot longer than the retention target, and should be
// split into two blocks with a cut between them.
//
// Persisted to content_storyboard_blocks (many rows per item, ordered by
// sort_order). Saves use a delete-then-reinsert-full-list pattern rather
// than diffing — simplest correct approach for a list this size (dozens of
// rows, not thousands), and it's how reordering, adding, and deleting all
// naturally converge to one save path.
// ============================================================

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', pink:'#ff6b9d', blue:'#4d9fff', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

export type AssetType = 'vo' | 'text' | 'broll' | 'screenshot' | 'animation' | 'image' | 'meme' | 'sfx'

type Block = { id: string; text: string; asset_type: AssetType; note: string }

const ASSET_TYPES: { key: AssetType; label: string; color: string }[] = [
  { key: 'vo',         label: 'VO only',    color: C.sec },
  { key: 'text',       label: 'On-screen text', color: C.cyan },
  { key: 'broll',      label: 'B-roll',     color: C.green },
  { key: 'screenshot', label: 'Screenshot', color: C.amber },
  { key: 'animation',  label: 'Animation',  color: C.purple },
  { key: 'image',      label: 'Image',      color: C.blue },
  { key: 'meme',       label: 'Meme',       color: C.pink },
  { key: 'sfx',        label: 'SFX',        color: C.red },
]

function assetMeta(t: AssetType) { return ASSET_TYPES.find(a => a.key === t) ?? ASSET_TYPES[0] }
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Estimated speaking time for a block's text, at the same natural-delivery
// rate assumed by the Scripting SOP's pacing rule (lib/sops.ts). This is
// what gets compared against SCRIPT_PACING_TARGET_SECONDS to flag a block
// that would hold the same shot too long without a cut.
function estimateSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return words / SPEAKING_WORDS_PER_SECOND
}

// Naive script-to-blocks splitter: one block per line/sentence-ish chunk,
// defaulting everything to 'vo' — the point isn't a perfect first pass,
// it's giving you a full block for every line of the script so nothing gets
// skipped, ready for you to re-tag each one by what's actually on screen.
function splitScriptToBlocks(script: string): Block[] {
  const lines = script
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^#|^---/.test(l))
  return lines.map(text => ({ id: uid(), text, asset_type: 'vo' as AssetType, note: '' }))
}

export default function Storyboard({ itemId, itemTitle, onClose }: {
  itemId: string
  itemTitle: string
  onClose: () => void
}) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('content_storyboard_blocks')
      .select('id,text,asset_type,note')
      .eq('content_item_id', itemId)
      .order('sort_order', { ascending: true })
    if (err) { setError('Failed to load: ' + err.message); setLoading(false); return }
    setBlocks((data ?? []).map(b => ({ id: b.id, text: b.text ?? '', asset_type: (b.asset_type ?? 'vo') as AssetType, note: b.note ?? '' })))
    setLoading(false)
  }, [itemId])

  useEffect(() => { load() }, [load])

  function markDirty(next: Block[]) { setBlocks(next); setDirty(true) }

  function addBlock(afterId?: string) {
    const fresh: Block = { id: uid(), text: '', asset_type: 'vo', note: '' }
    if (!afterId) { markDirty([...blocks, fresh]); return }
    const idx = blocks.findIndex(b => b.id === afterId)
    const next = [...blocks]
    next.splice(idx + 1, 0, fresh)
    markDirty(next)
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    markDirty(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  function removeBlock(id: string) {
    markDirty(blocks.filter(b => b.id !== id))
  }

  function onDragStart(id: string) { setDragId(id) }
  function onDragOver(overId: string, e: React.DragEvent) {
    e.preventDefault()
    if (!dragId || dragId === overId) return
    const from = blocks.findIndex(b => b.id === dragId)
    const to = blocks.findIndex(b => b.id === overId)
    if (from === -1 || to === -1) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setBlocks(next)
    setDirty(true)
  }
  function onDragEnd() { setDragId(null) }

  async function importFromScript() {
    setImporting(true)
    setError(null)
    try {
      const { output, error: err } = await getStageNote(itemId, '04')
      if (err) { setError(err); setImporting(false); return }
      if (!output || !output.trim()) { setError('No Scripting stage note found yet — write or generate the script first.'); setImporting(false); return }
      const imported = splitScriptToBlocks(output)
      if (imported.length === 0) { setError('Script note was empty.'); setImporting(false); return }
      markDirty([...blocks, ...imported])
    } catch (e) {
      setError('Import failed: ' + String(e))
    } finally {
      setImporting(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const { error: delErr } = await supabase.from('content_storyboard_blocks').delete().eq('content_item_id', itemId)
      if (delErr) { setError('Save failed: ' + delErr.message); setSaving(false); return }
      const rows = blocks
        .filter(b => b.text.trim().length > 0)
        .map((b, i) => ({ content_item_id: itemId, sort_order: i, text: b.text, asset_type: b.asset_type, note: b.note || null }))
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('content_storyboard_blocks').insert(rows)
        if (insErr) { setError('Save failed: ' + insErr.message); setSaving(false); return }
      }
      setDirty(false)
      await load()
    } catch (e) {
      setError('Save failed: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  const counts = ASSET_TYPES.map(a => ({ ...a, count: blocks.filter(b => b.asset_type === a.key && b.text.trim()).length }))
    .filter(a => a.key !== 'vo' && a.count > 0)

  const longBlockCount = blocks.filter(b => b.text.trim() && estimateSeconds(b.text) > SCRIPT_PACING_TARGET_SECONDS).length

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:75, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', width:'100%', maxWidth:'46rem', height:'88vh', maxHeight:'50rem', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
          <div>
            <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Storyboard</h3>
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.15rem 0 0' }}>{itemTitle}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {dirty && <span style={{ fontSize:'0.65rem', color:C.amber, fontWeight:700 }}>Unsaved</span>}
            <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
          </div>
        </div>

        {counts.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap' as const, gap:'0.4rem', padding:'0.75rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
            {counts.map(a => (
              <span key={a.key} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.25rem 0.6rem', borderRadius:'9999px', background:a.color+'18', border:'1px solid '+a.color+'40', fontSize:'0.68rem', fontWeight:700, color:a.color }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:a.color }}/>
                {a.count} {a.label}
              </span>
            ))}
          </div>
        )}

        {longBlockCount > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0, background:C.amber+'0d' }}>
            <AlertTriangle size={12} color={C.amber}/>
            <span style={{ fontSize:'0.68rem', fontWeight:700, color:C.amber }}>
              {longBlockCount} block{longBlockCount === 1 ? '' : 's'} run{longBlockCount === 1 ? 's' : ''} past ~{SCRIPT_PACING_TARGET_SECONDS}s — split for a cut (flagged below)
            </span>
          </div>
        )}

        {error && <p style={{ fontSize:'0.7rem', color:C.red, margin:'0.6rem 1.25rem 0', lineHeight:1.4 }}>{error}</p>}

        <div style={{ flex:1, overflowY:'auto' as const, padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {loading ? (
            <p style={{ fontSize:'0.8rem', color:C.muted, textAlign:'center', padding:'1.5rem 0' }}>Loading…</p>
          ) : blocks.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2rem 1rem', color:C.muted, fontSize:'0.78rem', lineHeight:1.6 }}>
              No blocks yet. Import your script from the Scripting stage, or add blocks manually.
            </div>
          ) : (
            blocks.map(b => {
              const meta = assetMeta(b.asset_type)
              const seconds = estimateSeconds(b.text)
              const isLong = b.text.trim().length > 0 && seconds > SCRIPT_PACING_TARGET_SECONDS
              return (
                <div key={b.id}
                  draggable
                  onDragStart={() => onDragStart(b.id)}
                  onDragOver={e => onDragOver(b.id, e)}
                  onDragEnd={onDragEnd}
                  style={{
                    display:'flex', gap:'0.5rem', alignItems:'flex-start',
                    padding:'0.6rem', borderRadius:'0.75rem',
                    background: meta.color+'0d', border:'1px solid '+(isLong ? C.amber+'80' : meta.color+'35'),
                    opacity: dragId === b.id ? 0.4 : 1,
                  }}>
                  <div style={{ cursor:'grab', color:C.muted, paddingTop:'0.35rem', flexShrink:0 }}><GripVertical size={14}/></div>
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.35rem', minWidth:0 }}>
                    <textarea
                      value={b.text}
                      onChange={e => updateBlock(b.id, { text: e.target.value })}
                      placeholder="Line from the script…"
                      rows={Math.min(4, Math.max(1, Math.ceil(b.text.length / 60)))}
                      style={{ width:'100%', boxSizing:'border-box' as const, padding:'0.4rem 0.5rem', background:C.card, border:'1px solid '+(isLong ? C.amber+'60' : C.border), borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', lineHeight:1.5, outline:'none', resize:'vertical' as const }}
                    />
                    {isLong && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', alignSelf:'flex-start', padding:'0.15rem 0.5rem', borderRadius:'9999px', background:C.amber+'18', border:'1px solid '+C.amber+'50', fontSize:'0.62rem', fontWeight:700, color:C.amber }}>
                        <AlertTriangle size={10}/> ~{Math.round(seconds)}s — split for a cut (target: new visual every ~{SCRIPT_PACING_TARGET_SECONDS}s)
                      </span>
                    )}
                    <div style={{ display:'flex', flexWrap:'wrap' as const, gap:'0.3rem', alignItems:'center' }}>
                      {ASSET_TYPES.map(a => (
                        <button key={a.key} onClick={() => updateBlock(b.id, { asset_type: a.key })}
                          style={{
                            padding:'0.2rem 0.5rem', borderRadius:'9999px', fontSize:'0.62rem', fontWeight:700, cursor:'pointer',
                            background: b.asset_type === a.key ? a.color+'2a' : 'transparent',
                            border:'1px solid '+(b.asset_type === a.key ? a.color+'70' : C.border),
                            color: b.asset_type === a.key ? a.color : C.muted,
                          }}>
                          {a.label}
                        </button>
                      ))}
                      <input
                        value={b.note}
                        onChange={e => updateBlock(b.id, { note: e.target.value })}
                        placeholder="note (optional)"
                        style={{ flex:1, minWidth:'6rem', padding:'0.2rem 0.5rem', background:'transparent', border:'none', borderBottom:'1px solid '+C.border, color:C.sec, fontFamily:'inherit', fontSize:'0.68rem', outline:'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flexShrink:0 }}>
                    <button onClick={() => addBlock(b.id)} title="Insert block below" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><Plus size={14}/></button>
                    <button onClick={() => removeBlock(b.id)} title="Delete block" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><Trash2 size={14}/></button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding:'0.875rem 1.25rem', borderTop:'1px solid '+C.border, flexShrink:0, display:'flex', gap:'0.5rem' }}>
          <button onClick={() => addBlock()} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.55rem 0.8rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
            <Plus size={13}/> Add block
          </button>
          <button onClick={importFromScript} disabled={importing} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.55rem 0.8rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, cursor: importing ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
            {importing ? <Loader2 size={13} className="spin"/> : <Wand2 size={13}/>} Import from script
          </button>
          <div style={{ flex:1 }}/>
          <button onClick={save} disabled={saving || !dirty}
            style={{ padding:'0.55rem 1.1rem', background: dirty ? C.green : C.card, border:'1px solid '+(dirty ? 'rgba(0,255,136,0.4)' : C.border), borderRadius:'0.625rem', color: dirty ? '#000' : C.muted, cursor: (saving || !dirty) ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:800 }}>
            {saving ? 'Saving…' : 'Save storyboard'}
          </button>
        </div>
      </div>
      <style>{`.spin { animation: spin 0.8s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
