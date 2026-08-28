'use client'
import { useEffect, useState, useRef } from 'react'
import { X, Send, Sparkles, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStageNote, saveStageNote } from '@/lib/supabase'

// ============================================================
// Yap Session — the SOP 04 "talk it out loud" step, made interactive.
//
// Instead of just an instruction ("open a Claude chat and just talk about
// the video"), this IS that chat: you type what happened, why it matters,
// what angle you're leaning toward, and Claude keeps asking follow-up
// questions (never write from a cold outline — pull the real material out
// first) until there's enough raw material for a script. Hit "Wrap up" and
// Claude turns the whole conversation into a structured outline (goal,
// deeper problem, audience avatar, story beats, tone/feel) which gets
// appended to the Scripting stage's note (content_stage_notes, sop_id '04')
// — the exact same field the Pipeline card's Produce/Consult Claude reads
// and writes, so this becomes the seed the rest of scripting builds on.
//
// Self-contained — only needs an item id + title, fetches/saves its own
// transcript (content_yap_transcripts, one row per item), so it drops into
// the Content Pipeline card or the focus session page unchanged.
// ============================================================

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

type YapMessage = { role: 'user' | 'assistant'; content: string }

const STARTER = "Tell me about this video — what happened, why does it matter, and what angle are you leaning toward? Just talk it out, don't worry about structure. I'll keep asking questions until we've pulled out the real material to write from."

function buildYapSystemPrompt(title: string, context: string): string {
  return `You are interviewing a YouTube creator about a video they're about to script, titled "${title}".${context ? `\n\nWhat's already known about it: ${context}` : ''}\n\n` +
    `Your job is the "yap session" step of their scripting process: they talk out loud about the video — what happened, why it matters, what angle they're leaning toward, what they already believe about it — and you keep asking sharp follow-up questions until you've pulled the real material out of them. Not generic facts, but their specific opinions, phrasing, and stories.\n\n` +
    `Ask ONE focused follow-up question at a time (never a list of questions). Good follow-ups: "What's the contrarian take here?", "What would a skeptic say back?", "What surprised you researching this?", "Where do you actually disagree with the mainstream take?", "What's the one thing you want someone to remember after watching?" Keep replies short — 1-3 sentences plus the question. Don't write any script or outline yet, that happens later — right now your only job is drawing out material through questions.`
}

function buildYapWrapupPrompt(title: string): string {
  return `You are turning a "yap session" interview transcript into a structured video outline for a YouTube video titled "${title}".\n\n` +
    `Read the conversation and extract: the Common Goal (what the viewer wants to feel/achieve), the Deeper Problem (the real underlying frustration), the tone/feel the creator wants, 2-4 specific opinions or stories from the creator worth keeping in their own words (quote them), and a rough story arc (character/problem -> discovery/turning point -> resolution). Write it as clear plain-text sections with short headers, not JSON, not markdown fences. Ground everything in what the creator actually said — do not invent facts or opinions they didn't express.`
}

export default function YapSession({ itemId, itemTitle, itemContext, onClose, onSaved }: {
  itemId: string
  itemTitle: string
  itemContext?: string
  onClose: () => void
  onSaved?: (outline: string) => void
}) {
  const [messages, setMessages] = useState<YapMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [wrapping, setWrapping] = useState(false)
  const [wrapped, setWrapped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('content_yap_transcripts').select('messages').eq('content_item_id', itemId).maybeSingle()
      if (cancelled) return
      setMessages(((data?.messages ?? []) as YapMessage[]))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [itemId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  async function persist(next: YapMessage[]) {
    await supabase.from('content_yap_transcripts')
      .upsert({ content_item_id: itemId, messages: next, updated_at: new Date().toISOString() }, { onConflict: 'content_item_id' })
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError(null)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setSending(true)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: buildYapSystemPrompt(itemTitle, itemContext ?? ''),
          messages: next,
          model: 'claude-sonnet-5',
        }),
      })
      const data = await res.json()
      if (data?.error) { setError('API error: ' + JSON.stringify(data.error)); setSending(false); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      if (!raw) { setError('Empty response from Claude.'); setSending(false); return }
      const withReply = [...next, { role: 'assistant' as const, content: raw }]
      setMessages(withReply)
      await persist(withReply)
    } catch (e) {
      setError('Failed: ' + String(e))
    } finally {
      setSending(false)
    }
  }

  async function wrapUp() {
    if (messages.length === 0 || wrapping) return
    setWrapping(true)
    setError(null)
    try {
      const transcriptText = messages.map(m => (m.role === 'user' ? 'Me: ' : 'Claude: ') + m.content).join('\n\n')
      const res = await fetch('/api/content/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: buildYapWrapupPrompt(itemTitle), userPrompt: transcriptText, model: 'claude-sonnet-5' }),
      })
      const data = await res.json()
      if (data?.error) { setError('API error: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      if (!raw) { setError('Empty response from Claude.'); return }
      const { output: existing } = await getStageNote(itemId, '04')
      const combined = existing?.trim() ? existing.trim() + '\n\n---\nYap session outline:\n' + raw : raw
      const { error: saveErr } = await saveStageNote(itemId, '04', combined)
      if (saveErr) { setError(saveErr); return }
      setWrapped(true)
      onSaved?.(combined)
    } catch (e) {
      setError('Wrap-up failed: ' + String(e))
    } finally {
      setWrapping(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:75, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', width:'100%', maxWidth:'34rem', height:'85vh', maxHeight:'42rem', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', borderBottom:'1px solid '+C.border, flexShrink:0 }}>
          <div>
            <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.4rem' }}><Sparkles size={14} color={C.purple}/>Yap Session</h3>
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.15rem 0 0' }}>{itemTitle}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>

        <div style={{ flex:1, overflowY:'auto' as const, padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.7rem' }}>
          {loading ? (
            <p style={{ fontSize:'0.8rem', color:C.muted, textAlign:'center', padding:'1.5rem 0' }}>Loading…</p>
          ) : (
            <>
              <div style={{ alignSelf:'flex-start', maxWidth:'85%', padding:'0.6rem 0.8rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'0.875rem 0.875rem 0.875rem 0.2rem' }}>
                <p style={{ fontSize:'0.8rem', color:C.text, margin:0, lineHeight:1.55 }}>{STARTER}</p>
              </div>
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth:'85%',
                  padding:'0.6rem 0.8rem',
                  background: m.role === 'user' ? 'rgba(0,212,255,0.1)' : 'rgba(139,92,246,0.08)',
                  border:'1px solid '+(m.role === 'user' ? 'rgba(0,212,255,0.25)' : 'rgba(139,92,246,0.2)'),
                  borderRadius: m.role === 'user' ? '0.875rem 0.875rem 0.2rem 0.875rem' : '0.875rem 0.875rem 0.875rem 0.2rem',
                }}>
                  <p style={{ fontSize:'0.8rem', color:C.text, margin:0, lineHeight:1.55, whiteSpace:'pre-wrap' as const }}>{m.content}</p>
                </div>
              ))}
              {sending && (
                <div style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'0.4rem', color:C.muted, fontSize:'0.72rem', padding:'0.3rem 0.2rem' }}>
                  <div style={{ width:'12px', height:'12px', border:'2px solid '+C.muted, borderTopColor:C.purple, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  thinking…
                </div>
              )}
              {wrapped && (
                <div style={{ alignSelf:'center', display:'flex', alignItems:'center', gap:'0.4rem', color:C.green, fontSize:'0.75rem', fontWeight:700, padding:'0.5rem 0.8rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.25)', borderRadius:'9999px' }}>
                  <CheckCircle2 size={13}/> Saved to the Scripting stage note
                </div>
              )}
              <div ref={bottomRef}/>
            </>
          )}
        </div>

        {error && <p style={{ fontSize:'0.7rem', color:C.red, margin:'0 1.25rem 0.5rem', lineHeight:1.4 }}>{error}</p>}

        <div style={{ padding:'0.875rem 1.25rem', borderTop:'1px solid '+C.border, flexShrink:0, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Just start talking about the video…"
              rows={2} disabled={sending}
              style={{ flex:1, padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', lineHeight:1.5, outline:'none', resize:'none' as const, boxSizing:'border-box' as const }}
            />
            <button onClick={send} disabled={sending || !input.trim()} title="Send (Enter)"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'2.6rem', flexShrink:0, background: input.trim() ? C.cyan : C.card, border:'none', borderRadius:'0.625rem', color: input.trim() ? '#000' : C.muted, cursor: (sending || !input.trim()) ? 'not-allowed' : 'pointer' }}>
              <Send size={15}/>
            </button>
          </div>
          <button onClick={wrapUp} disabled={messages.length === 0 || wrapping}
            style={{ padding:'0.55rem', background: messages.length === 0 ? C.card : 'rgba(0,255,136,0.08)', border:'1px solid '+(messages.length === 0 ? C.border : 'rgba(0,255,136,0.3)'), borderRadius:'0.625rem', color: messages.length === 0 ? C.muted : C.green, cursor: (messages.length === 0 || wrapping) ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
            {wrapping ? 'Summarising…' : 'Wrap up & save outline to Scripting'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
