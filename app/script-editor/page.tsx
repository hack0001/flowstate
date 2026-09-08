'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveFocusVideos, type ActiveFocusVideo } from '@/lib/supabase'
import { ChevronLeft, RefreshCw, Wand2, Search, Plus, Check, AlertCircle, FileEdit } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

// Models available for the "Ask Claude" calls — same whitelist as the
// Content Pipeline's Consult button (app/api/content/consult/route.ts).
const MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — fast' },
  { value: 'claude-sonnet-5',           label: 'Sonnet 5 — stronger' },
  { value: 'claude-opus-4-8',           label: 'Opus 4.8 — most thorough' },
] as const

type Snapshot = { docId: string; title: string; text: string; endIndex: number }
type Tool = 'rewrite' | 'find_replace' | 'append'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.6rem 0.8rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none',
  boxSizing:'border-box',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, resize:'vertical' as const, lineHeight:1.6 }

async function consult(systemPrompt: string, userPrompt: string, model: string): Promise<{ text: string; error: string | null }> {
  try {
    const res = await fetch('/api/content/consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt, model }),
    })
    const data = await res.json()
    if (data?.error) return { text: '', error: 'API error: ' + JSON.stringify(data.error) }
    const raw = (data?.content ?? [])
      .filter((b: { type: string; text?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('\n').trim()
    if (!raw) return { text: '', error: 'Empty response from Claude.' }
    return { text: raw, error: null }
  } catch (e) {
    return { text: '', error: 'Request failed: ' + String(e) }
  }
}

export default function ScriptEditorPage() {
  const router = useRouter()
  const [videos, setVideos] = useState<ActiveFocusVideo[]>([])
  const [docUrl, setDocUrl] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [model, setModel] = useState<string>(MODELS[1].value)
  const [tool, setTool] = useState<Tool>('rewrite')

  // Rewrite tool
  const [instruction, setInstruction] = useState('')
  const [proposedText, setProposedText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState<string | null>(null)

  // Find & replace tool
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)

  // Append tool
  const [appendInstruction, setAppendInstruction] = useState('')
  const [appendProposed, setAppendProposed] = useState('')

  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  useEffect(() => {
    getActiveFocusVideos().then(({ videos }) => setVideos(videos.filter(v => v.script_url)))
  }, [])

  const loadDoc = useCallback(async (url: string) => {
    if (!url.trim()) return
    setLoadingDoc(true)
    setLoadErr(null)
    setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs?url=' + encodeURIComponent(url.trim()))
      const data = await res.json()
      if (data?.error) { setLoadErr(String(data.error)); setSnapshot(null) }
      else { setSnapshot(data); setProposedText(''); setAppendProposed('') }
    } catch (e) {
      setLoadErr('Failed to load: ' + String(e))
    } finally {
      setLoadingDoc(false)
    }
  }, [])

  async function generateRewrite() {
    if (!snapshot || !instruction.trim()) return
    setGenerating(true)
    setGenMsg(null)
    const systemPrompt = "You are editing a YouTube script live, alongside the writer, in a Google Doc. You'll get the CURRENT FULL TEXT of the doc and an instruction for what to change. Return ONLY the complete, updated full text of the document -- no commentary, no markdown fences, no preamble, no explanation before or after. Keep it plain text (no markdown headers/bullets) matching the doc's existing style. Leave anything not related to the instruction exactly as it was, unless the instruction clearly asks for a full rewrite."
    const userPrompt = 'CURRENT DOCUMENT TEXT:\n"""\n' + snapshot.text + '\n"""\n\nINSTRUCTION: ' + instruction.trim()
    const { text, error } = await consult(systemPrompt, userPrompt, model)
    if (error) setGenMsg(error)
    else setProposedText(text)
    setGenerating(false)
  }

  async function generateAppend() {
    if (!snapshot || !appendInstruction.trim()) return
    setGenerating(true)
    setGenMsg(null)
    const systemPrompt = "You are helping write a YouTube script live, alongside the writer, in a Google Doc. You'll get the CURRENT FULL TEXT of the doc (for context/voice/continuity) and an instruction for a new section to add at the END of the doc. Return ONLY the new section's text to append -- no commentary, no markdown fences, no repeating the existing text. Plain text, matching the doc's existing style and voice."
    const userPrompt = 'CURRENT DOCUMENT TEXT (for context only -- do not repeat it):\n"""\n' + snapshot.text + '\n"""\n\nWhat to add at the end: ' + appendInstruction.trim()
    const { text, error } = await consult(systemPrompt, userPrompt, model)
    if (error) setGenMsg(error)
    else setAppendProposed(text)
    setGenerating(false)
  }

  async function applyReplaceAll() {
    if (!snapshot || !proposedText.trim()) return
    setApplying(true)
    setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace_all', url: docUrl, text: proposedText }),
      })
      const data = await res.json()
      if (data?.error) setApplyMsg('Failed: ' + String(data.error))
      else { setApplyMsg('Applied to the doc.'); loadDoc(docUrl) }
    } catch (e) {
      setApplyMsg('Failed: ' + String(e))
    } finally {
      setApplying(false)
    }
  }

  async function applyFindReplace() {
    if (!findText.trim()) return
    setApplying(true)
    setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find_replace', url: docUrl, find: findText, replace: replaceText, matchCase }),
      })
      const data = await res.json()
      if (data?.error) setApplyMsg('Failed: ' + String(data.error))
      else { setApplyMsg(data.occurrencesChanged + ' occurrence(s) changed.'); loadDoc(docUrl) }
    } catch (e) {
      setApplyMsg('Failed: ' + String(e))
    } finally {
      setApplying(false)
    }
  }

  async function applyAppend() {
    if (!appendProposed.trim()) return
    setApplying(true)
    setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append', url: docUrl, text: '\n' + appendProposed }),
      })
      const data = await res.json()
      if (data?.error) setApplyMsg('Failed: ' + String(data.error))
      else { setApplyMsg('Appended to the doc.'); setAppendProposed(''); setAppendInstruction(''); loadDoc(docUrl) }
    } catch (e) {
      setApplyMsg('Failed: ' + String(e))
    } finally {
      setApplying(false)
    }
  }

  const TAB_META: Record<Tool, { icon: React.ReactNode; label: string }> = {
    rewrite:       { icon:<Wand2 size={13}/>,   label:'Rewrite with Claude' },
    find_replace:  { icon:<Search size={13}/>,  label:'Quick find & replace' },
    append:        { icon:<Plus size={13}/>,    label:'Append new section' },
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ padding:'1.75rem 2rem 1.25rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(0,212,255,0.08) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.6rem' }}>
            <ChevronLeft size={14}/> Home
          </button>
          <h1 style={{ fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:900, margin:'0 0 0.2rem', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <FileEdit size={22} color={C.cyan}/> Script Editor
          </h1>
          <p style={{ fontSize:'0.82rem', color:C.sec, margin:0 }}>
            Real in-place edits to a Google Doc — Claude drafts the change, you review it, then it's applied directly. No copy-pasting.
          </p>
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem 3rem' }}>
        {/* Doc picker */}
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem', marginBottom:'1.25rem' }}>
          <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Google Doc link</label>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://docs.google.com/document/d/..." style={inputStyle}/>
            <button onClick={() => loadDoc(docUrl)} disabled={loadingDoc || !docUrl.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0 1rem', background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.625rem', color:C.cyan, cursor: loadingDoc ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, whiteSpace:'nowrap' as const }}>
              <RefreshCw size={13} style={{ animation: loadingDoc ? 'spin 1s linear infinite' : 'none' }}/> {loadingDoc ? 'Loading' : 'Load'}
            </button>
          </div>
          {videos.length > 0 && (
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const, marginTop:'0.6rem' }}>
              {videos.map(v => (
                <button key={v.id} onClick={() => { setDocUrl(v.script_url ?? ''); loadDoc(v.script_url ?? '') }} style={{ fontSize:'0.68rem', padding:'0.25rem 0.6rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', color:C.sec, cursor:'pointer', fontFamily:'inherit' }}>
                  {v.title}
                </button>
              ))}
            </div>
          )}
          {loadErr && (
            <p style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.75rem', color:C.red, margin:'0.6rem 0 0' }}><AlertCircle size={13}/> {loadErr}</p>
          )}
          {loadErr === null && !snapshot && (
            <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.6rem 0 0', lineHeight:1.5 }}>
              First time using this doc? Share it with the service account email in your Google Drive setup (Editor access) — same as SOUND MONEY HQ.
            </p>
          )}
        </div>

        {snapshot && (
          <>
            {/* Current doc preview */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem', marginBottom:'1.25rem' }}>
              <p style={{ fontSize:'0.8rem', fontWeight:800, color:C.text, margin:'0 0 0.5rem' }}>{snapshot.title}</p>
              <div style={{ maxHeight:'220px', overflowY:'auto' as const, background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', padding:'0.75rem 0.875rem' }}>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, whiteSpace:'pre-wrap' as const, lineHeight:1.6 }}>{snapshot.text || '(empty document)'}</p>
              </div>
            </div>

            {/* Tool tabs */}
            <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem' }}>
              {(Object.keys(TAB_META) as Tool[]).map(t => (
                <button key={t} onClick={() => setTool(t)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.9rem', borderRadius:'0.625rem', border:'1px solid '+(tool === t ? C.cyan : C.border), background: tool === t ? 'rgba(0,212,255,0.1)' : 'transparent', color: tool === t ? C.cyan : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                  {TAB_META[t].icon} {TAB_META[t].label}
                </button>
              ))}
            </div>

            {tool === 'rewrite' && (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
                <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="What do you want changed? e.g. 'Tighten the intro to 3 sentences' or 'Make the hook punchier'" style={{ ...textareaStyle, minHeight:60, flex:1 }}/>
                </div>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                  <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <button onClick={generateRewrite} disabled={generating || !instruction.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:C.purple, cursor: generating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                    <Wand2 size={13}/> {generating ? 'Thinking...' : 'Ask Claude'}
                  </button>
                </div>
                {genMsg && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem' }}>{genMsg}</p>}
                {proposedText && (
                  <>
                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', margin:'0.5rem 0 0.4rem' }}>Proposed text — edit freely before applying</label>
                    <textarea value={proposedText} onChange={e => setProposedText(e.target.value)} style={{ ...textareaStyle, minHeight:220 }}/>
                    <button onClick={applyReplaceAll} disabled={applying} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1.2rem', marginTop:'0.75rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.625rem', color:'#000', cursor: applying ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:800 }}>
                      <Check size={14}/> {applying ? 'Applying...' : 'Apply to Google Doc'}
                    </button>
                  </>
                )}
              </div>
            )}

            {tool === 'find_replace' && (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Find</label>
                <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="Exact text to find" style={{ ...inputStyle, marginBottom:'0.75rem' }}/>
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Replace with</label>
                <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replacement text (leave blank to delete)" style={{ ...inputStyle, marginBottom:'0.75rem' }}/>
                <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.75rem', color:C.sec, marginBottom:'0.75rem', cursor:'pointer' }}>
                  <input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)}/> Match case
                </label>
                <button onClick={applyFindReplace} disabled={applying || !findText.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1.2rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.625rem', color:'#000', cursor: applying ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:800 }}>
                  <Check size={14}/> {applying ? 'Applying...' : 'Replace in Google Doc'}
                </button>
              </div>
            )}

            {tool === 'append' && (
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem' }}>
                <textarea value={appendInstruction} onChange={e => setAppendInstruction(e.target.value)} placeholder="What should the new section say? e.g. 'Write the outro, mention subscribing and the next video'" style={{ ...textareaStyle, minHeight:60, marginBottom:'0.75rem' }}/>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                  <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <button onClick={generateAppend} disabled={generating || !appendInstruction.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:C.purple, cursor: generating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                    <Wand2 size={13}/> {generating ? 'Thinking...' : 'Ask Claude'}
                  </button>
                </div>
                {genMsg && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem' }}>{genMsg}</p>}
                {appendProposed && (
                  <>
                    <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', margin:'0.5rem 0 0.4rem' }}>Proposed new section — edit freely before applying</label>
                    <textarea value={appendProposed} onChange={e => setAppendProposed(e.target.value)} style={{ ...textareaStyle, minHeight:140 }}/>
                    <button onClick={applyAppend} disabled={applying} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem 1.2rem', marginTop:'0.75rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.625rem', color:'#000', cursor: applying ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:800 }}>
                    <Check size={14}/> {applying ? 'Applying...' : 'Append to Google Doc'}
                    </button>
                  </>
                )}
              </div>
            )}

            {applyMsg && <p style={{ fontSize:'0.78rem', color: applyMsg.startsWith('Failed') ? C.red : C.green, marginTop:'0.9rem' }}>{applyMsg}</p>}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        input:focus, select:focus, textarea:focus { border-color: ${C.cyan} !important; }
        button:hover { opacity:0.85; }
        textarea { font-family:inherit; }
      `}</style>
    </main>
  )
}
