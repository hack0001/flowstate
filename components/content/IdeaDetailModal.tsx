'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown, FileText, MessageSquare, Tv, ExternalLink, Trash2 } from 'lucide-react'
import { C } from '@/lib/theme'
import { FORMATS, VIDEO_TYPES, ContentItem } from '@/lib/contentTypes'
import { IdeaLog, ValidationCheckResult, ValidationAlternative, ValidationResult, CONSULT_MODELS, DEFAULT_CONSULT_MODEL, consultModelLabel, buildSkillInvokePrompt } from '@/lib/contentIdeas'

// ── Idea detail + validate modal ────────────────────────────────────────────
// Click an idea to open this: title + description up top (editable, saved
// on blur). Two ways to get it checked:
//  1. Consult Claude directly (primary) — copy a prompt that invokes the
//     installed "youtube-idea-validator" skill, paste it into a Claude chat
//     with real research tools, then paste the reply + your next steps back
//     here so there's a saved log against the idea.
//  2. Quick automated check (secondary, collapsed by default) — calls
//     Claude from inside the app itself. Faster, but has less room to
//     actually browse than a full Claude Code/chat session does.

export const VERDICT_STYLE: Record<ValidationResult['verdict'], { color: string; bg: string; border: string }> = {
  'Viable':              { color:'#22c55e', bg:'rgba(34,197,94,0.1)',  border:'rgba(34,197,94,0.3)' },
  'Needs More Research': { color:C.amber,   bg:'rgba(255,184,0,0.1)',  border:'rgba(255,184,0,0.3)' },
  'Not Viable':          { color:C.red,     bg:'rgba(255,68,102,0.1)', border:'rgba(255,68,102,0.3)' },
}

export function CheckIcon({ status }: { status: ValidationCheckResult['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={13} color="#22c55e"/>
  if (status === 'fail') return <XCircle size={13} color={C.red}/>
  return <HelpCircle size={13} color={C.amber}/>
}

export function IdeaDetailModal({ item, result, loading, msg, ideaLog, ideaLogMsg, onSaveField, onSaveLog, onCreateIdeaFromAlternative, onRun, onPromote, onClose }: {
  item: ContentItem; result: ValidationResult | null; loading: boolean; msg: string | null
  ideaLog: IdeaLog | null; ideaLogMsg: string | null
  onSaveField: (patch: Partial<Pick<ContentItem, 'title' | 'notes' | 'format' | 'video_type' | 'unique_angle'>>) => void
  onSaveLog: (reply: string, nextSteps: string) => void
  onCreateIdeaFromAlternative: (alt: ValidationAlternative) => Promise<boolean>
  onRun: (model: string, webSearch: boolean) => void; onPromote: () => void; onClose: () => void
}) {
  const vs = result ? VERDICT_STYLE[result.verdict] : null
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.notes ?? '')
  const [format, setFormat] = useState(item.format ?? 'Long-form')
  const [videoType, setVideoType] = useState(item.video_type ?? '')
  const [uniqueAngle, setUniqueAngle] = useState(item.unique_angle ?? '')
  const [modelKey, setModelKey] = useState<string>(result?.model ?? DEFAULT_CONSULT_MODEL)
  const [webSearch, setWebSearch] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showAutoCheck, setShowAutoCheck] = useState(false)
  const [replyDraft, setReplyDraft] = useState(ideaLog?.reply ?? '')
  const [nextStepsDraft, setNextStepsDraft] = useState(ideaLog?.nextSteps ?? '')
  const [logSaved, setLogSaved] = useState(false)
  const [altStatus, setAltStatus] = useState<Record<number, 'creating' | 'created' | 'error'>>({})

  async function sendAltToIdeas(idx: number, alt: ValidationAlternative) {
    setAltStatus(prev => ({ ...prev, [idx]: 'creating' }))
    const ok = await onCreateIdeaFromAlternative(alt)
    setAltStatus(prev => ({ ...prev, [idx]: ok ? 'created' : 'error' }))
  }

  async function copyPrompt() {
    const prompt = buildSkillInvokePrompt({ ...item, title, notes: description })
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — nothing we can do silently, leave copied state off
    }
  }

  function saveLog() {
    onSaveLog(replyDraft, nextStepsDraft)
    setLogSaved(true)
    setTimeout(() => setLogSaved(false), 2000)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'32rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.4rem' }}><Lightbulb size={14} color={C.amber}/>Idea</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Title</label>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== item.title) onSaveField({ title: title.trim() }) }}
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.9rem', fontWeight:700, outline:'none', boxSizing:'border-box' as const }}
          />
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Format</label>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
            {FORMATS.map(f => (
              <button key={f} onClick={() => { setFormat(f); onSaveField({ format: f }) }} style={{ padding:'0.35rem 0.75rem', background:format===f?'rgba(0,212,255,0.1)':C.card, border:'1px solid '+(format===f?C.cyan:C.border), borderRadius:'9999px', color:format===f?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Video type <span style={{ fontWeight:400 }}>(optional — which funnel role this plays)</span></label>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
            {VIDEO_TYPES.map(v => (
              <button key={v} onClick={() => { const next = videoType===v?'':v; setVideoType(next); onSaveField({ video_type: next || null }) }} style={{ padding:'0.35rem 0.75rem', background:videoType===v?'rgba(139,92,246,0.12)':C.card, border:'1px solid '+(videoType===v?C.purple:C.border), borderRadius:'9999px', color:videoType===v?C.purple:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Alpha check <span style={{ fontWeight:400 }}>— what does this have that a generic AI answer or the top existing videos don&apos;t?</span></label>
          <textarea
            value={uniqueAngle} onChange={e => setUniqueAngle(e.target.value)}
            onBlur={() => { if (uniqueAngle !== (item.unique_angle ?? '')) onSaveField({ unique_angle: uniqueAngle || null }) }}
            rows={2} placeholder="e.g. original data pull, contrarian take, historical parallel nobody else has used, a real number nobody else calculated..."
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
          />
        </div>

        <div style={{ marginBottom:'1.25rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Description — what should this video be about?</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            onBlur={() => { if (description !== (item.notes ?? '')) onSaveField({ notes: description }) }}
            rows={4} placeholder="What it covers, the angle, the hook, any outlier stats or comment research you've already found..."
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const, lineHeight:1.5 }}
          />
        </div>

        {/* ── Consult Claude (primary flow) ── */}
        <div style={{ marginBottom:'1.5rem', padding:'1rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.875rem' }}>
          <h4 style={{ fontSize:'0.78rem', fontWeight:800, color:C.text, margin:'0 0 0.35rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <Sparkles size={13} color={C.cyan}/>Consult Claude
          </h4>
          <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0 0 0.75rem', lineHeight:1.5 }}>
            Copy the prompt, paste it into a Claude chat (Claude Code, claude.ai, Cowork) — it invokes the installed <strong>youtube-idea-validator</strong> skill, which actually searches YouTube and reads comments and gives you evidence-backed alternatives if it disagrees. Paste the reply back below to keep a log against this idea.
          </p>
          <button onClick={copyPrompt} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:copied?'rgba(34,197,94,0.12)':C.card, border:'1px solid '+(copied?'rgba(34,197,94,0.4)':C.border), borderRadius:'0.625rem', color:copied?'#22c55e':C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700, marginBottom:'0.875rem' }}>
            {copied ? <Check size={13}/> : <Copy size={13}/>}{copied ? 'Copied — go paste it into Claude' : 'Copy prompt for Claude'}
          </button>

          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Claude&apos;s reply</label>
          <textarea
            value={replyDraft} onChange={e => setReplyDraft(e.target.value)}
            rows={6} placeholder="Paste Claude's full validation report here..."
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const, lineHeight:1.5, marginBottom:'0.75rem' }}
          />

          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Next steps — how to move forward</label>
          <textarea
            value={nextStepsDraft} onChange={e => setNextStepsDraft(e.target.value)}
            rows={3} placeholder="e.g. go with alternative #2, needs comment research before greenlighting, promote to Validated..."
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.78rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const, lineHeight:1.5, marginBottom:'0.75rem' }}
          />

          {ideaLogMsg && <p style={{ fontSize:'0.7rem', color:C.amber, margin:'0 0 0.5rem' }}>{ideaLogMsg}</p>}
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <button onClick={saveLog} disabled={!replyDraft.trim() && !nextStepsDraft.trim()} style={{ padding:'0.45rem 0.9rem', background:logSaved?'rgba(34,197,94,0.12)':'rgba(0,212,255,0.1)', border:'1px solid '+(logSaved?'rgba(34,197,94,0.4)':'rgba(0,212,255,0.3)'), borderRadius:'0.5rem', color:logSaved?'#22c55e':C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.74rem', fontWeight:700 }}>
              {logSaved ? 'Saved' : 'Save log'}
            </button>
            {ideaLog && <span style={{ fontSize:'0.65rem', color:C.muted }}>Last logged {new Date(ideaLog.loggedAt).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
          </div>
        </div>

        {/* ── Quick automated check (secondary, collapsed) ── */}
        <button onClick={() => setShowAutoCheck(v => !v)} style={{ display:'flex', alignItems:'center', gap:'0.35rem', background:'none', border:'none', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, padding:0, marginBottom: showAutoCheck ? '0.75rem' : '1.25rem' }}>
          <ChevronDown size={12} style={{ transform: showAutoCheck ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.15s' }}/>
          Or run a quick automated check in-app instead
        </button>

        {showAutoCheck && (<>
        {msg && <p style={{ fontSize:'0.72rem', color:C.amber, margin:'0 0 0.75rem', lineHeight:1.4 }}>{msg}</p>}

        {/* Model picker — which Claude model runs the Validate call */}
        <div style={{ marginBottom:'0.875rem' }}>
          <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Model</label>
          <select
            value={modelKey} onChange={e => setModelKey(e.target.value)} disabled={loading}
            title={CONSULT_MODELS.find(m => m.value === modelKey)?.hint}
            style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600, outline:'none', boxSizing:'border-box' as const, cursor:loading?'not-allowed':'pointer' }}
          >
            {CONSULT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label} — {m.hint}</option>)}
          </select>
        </div>

        {/* Web search toggle — lets Claude actually look up comparable YouTube videos + comments */}
        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', cursor:loading?'not-allowed':'pointer', fontSize:'0.76rem', color:C.sec }}>
          <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} disabled={loading} style={{ width:'0.9rem', height:'0.9rem' }}/>
          Search the web while validating (finds comparable YouTube videos + reads their comments for steps 4 &amp; 5)
        </label>

        {!result && !loading && (
          <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1rem', lineHeight:1.5 }}>
            Validate runs the full 7-step method — pitch, angle, alpha check, outlier evidence, comment-mined gap, video type/funnel fit, revenue tier — using {consultModelLabel(modelKey)}{webSearch ? ', with live web search for the outlier and comment checks' : ''}. If it doesn&apos;t agree the idea is viable it will suggest evidence-backed alternatives. For deeper research than this app can do itself, use Consult Claude above instead.
          </p>
        )}

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', color:C.muted, padding:'1.5rem 0', justifyContent:'center' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.cyan, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            {webSearch ? 'Searching YouTube and consulting ' : 'Consulting '}{consultModelLabel(modelKey)}…
          </div>
        )}

        {result && !loading && (
          <>
            <div style={{ background:vs!.bg, border:'1px solid '+vs!.border, borderRadius:'0.75rem', padding:'0.75rem 1rem', marginBottom:'0.5rem' }}>
              <p style={{ fontSize:'0.85rem', fontWeight:800, color:vs!.color, margin:'0 0 0.25rem' }}>{result.verdict}</p>
              <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.4 }}>{result.summary}</p>
            </div>
            <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0 0 1rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
              Checked with {consultModelLabel(result.model ?? modelKey)}
              {result.researched
                ? <span style={{ color:'#22c55e', fontWeight:700 }}>&bull; used live web search</span>
                : <span style={{ color:C.amber, fontWeight:700 }}>&bull; no live search — outlier/comment checks are estimates, verify with Consult Claude above</span>}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginBottom:'1.25rem' }}>
              {IDEA_VALIDATION_CHECKS.map(c => {
                const r = result.checks.find(x => x.key === c.key)
                return (
                  <div key={c.key} style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem' }}>
                    <div style={{ marginTop:'0.1rem', flexShrink:0 }}><CheckIcon status={r?.status ?? 'needs_research'}/></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.74rem', fontWeight:700, color:C.text, margin:'0 0 0.15rem' }}>{c.label}</p>
                      <p style={{ fontSize:'0.7rem', color:C.sec, margin:0, lineHeight:1.4 }}>{r?.note ?? 'Not evaluated.'}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {result.verdict !== 'Viable' && (
              <div style={{ marginBottom:'1.25rem' }}>
                <p style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.amber, margin:'0 0 0.5rem' }}>
                  &#9889; Alternatives more likely to work
                </p>
                {(!result.alternatives || result.alternatives.length === 0) ? (
                  <p style={{ fontSize:'0.74rem', color:C.muted, margin:0, lineHeight:1.4 }}>No alternatives returned — re-run with web search on to get evidence-backed suggestions.</p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                    {result.alternatives.map((a, i) => {
                      const status = altStatus[i]
                      return (
                        <div key={i} style={{ padding:'0.6rem 0.75rem', background:'rgba(255,184,0,0.06)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'0.5rem' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem' }}>
                            <p style={{ fontSize:'0.78rem', fontWeight:700, color:C.text, margin:'0 0 0.2rem', flex:1 }}>{a.title}</p>
                            <button
                              onClick={() => sendAltToIdeas(i, a)}
                              disabled={status === 'creating' || status === 'created'}
                              title="Create this alternative as its own idea in the Ideas Bank"
                              style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexShrink:0, padding:'0.25rem 0.55rem', background: status === 'created' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(status === 'created' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.4rem', color: status === 'created' ? '#22c55e' : C.amber, cursor: (status === 'creating' || status === 'created') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.64rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                            >
                              {status === 'created' ? <Check size={11}/> : <Plus size={11}/>}
                              {status === 'creating' ? 'Adding…' : status === 'created' ? 'Added to Ideas' : 'Send to Ideas'}
                            </button>
                          </div>
                          <p style={{ fontSize:'0.72rem', color:C.sec, margin:'0 0 0.3rem', lineHeight:1.4 }}>{a.why}</p>
                          <p style={{ fontSize:'0.66rem', color:C.amber, margin:0, lineHeight:1.4 }}>Evidence: {a.evidence}</p>
                          {status === 'error' && <p style={{ fontSize:'0.64rem', color:C.red, margin:'0.3rem 0 0' }}>Couldn&apos;t save — try again.</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', flexWrap:'wrap' as const }}>
          <button onClick={() => onRun(modelKey, webSearch)} disabled={loading} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.cyan, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, opacity:loading?0.5:1 }}>
            <Sparkles size={13}/>{result ? 'Re-run Validation' : 'Validate'}
          </button>
        </div>
        </>)}

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', flexWrap:'wrap' as const, marginTop:'1rem' }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Close</button>
          {result && result.verdict !== 'Not Viable' && item.pipeline_stage !== '✅ Validated' && (
            <button onClick={onPromote} style={{ padding:'0.5rem 1.25rem', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', borderRadius:'0.625rem', color:'#000', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>
              Mark Validated &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

