'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getStageNote, saveStageNote } from '@/lib/supabase'
import { sopForStage, IDEA_VALIDATION_CHECKS } from '@/lib/sops'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check } from 'lucide-react'

const IDEA_VALIDATION_SOP_ID = 'idea_validation'
// Manual log of a Claude-chat consult (copy prompt -> paste into Claude ->
// paste the reply back here) — separate from IDEA_VALIDATION_SOP_ID, which
// stores the structured result of the in-app automated call.
const IDEA_LOG_SOP_ID = 'idea_validation_log'
type IdeaLog = { reply: string; nextSteps: string; loggedAt: string }

type ValidationCheckResult = { key: string; status: 'pass' | 'fail' | 'needs_research'; note: string }
type ValidationAlternative = { title: string; why: string; evidence: string }
type ValidationResult = {
  verdict: 'Viable' | 'Needs More Research' | 'Not Viable'
  summary: string
  checks: ValidationCheckResult[]
  model?: string
  researched?: boolean
  alternatives?: ValidationAlternative[]
}

// Models available for the "Validate" consult call — value is the exact
// Anthropic model string (whitelisted server-side in
// app/api/content/consult/route.ts), label is what shows in the picker.
const CONSULT_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', hint: 'Fastest, cheapest — good default' },
  { value: 'claude-sonnet-5',           label: 'Claude Sonnet 5',  hint: 'Stronger reasoning, still quick' },
  { value: 'claude-opus-4-8',           label: 'Claude Opus 4.8',  hint: 'Most thorough, slowest' },
  { value: 'claude-fable-5',            label: 'Claude Fable 5',   hint: 'Alternate model' },
] as const
const DEFAULT_CONSULT_MODEL = CONSULT_MODELS[0].value
function consultModelLabel(value: string): string {
  return CONSULT_MODELS.find(m => m.value === value)?.label ?? value
}

// Builds the exact system+user prompt used for idea validation. Shared by
// the in-app "Validate" call and the "Copy prompt" button — the copied text
// is fully self-contained (no app context needed) so it can be pasted into
// Claude Code, claude.ai, or any other Claude surface for a deeper manual
// pass, including running it through a skill if one applies.
//
// The method below is spelled out in full rather than referenced by name —
// "outlier evidence" and "comment-mined gap" specifically require finding
// and reading real YouTube videos/comments, not guessing from priors.
const VALIDATION_METHOD = `Validate this YouTube video idea using the following method, step by step:
1. PITCH — Can the idea be stated as one clear sentence a viewer could repeat back? If it takes a paragraph to explain, it's not ready.
2. ANGLE — Does the framing use a proven high-CTR pattern (a specific number, a contrarian claim, a curiosity gap, a direct named benefit, a before/after)? Vague or generic framing fails this.
3. ALPHA CHECK — Does this idea contain something a generic AI answer or a quick search wouldn't already give a viewer? If not, it's a "recipe" video with no edge.
4. OUTLIER EVIDENCE — Search YouTube for existing videos on this exact topic and closely adjacent topics in this niche. Identify videos that clearly overperformed relative to their channel's typical view count (outliers), note their approximate view counts, channel names, and how recent they are. This tells you whether there is proven audience demand, not just supply.
5. COMMENT-MINED GAP — Read the comments on the outlier videos found in step 4 (or the closest available videos in the niche). Look for repeated questions, complaints, or requests that existing videos do NOT answer well. That unmet demand is the gap this new video should fill.
6. VIDEO TYPE / FUNNEL FIT — Does the format (how-to, listicle, case study, explainer, testimonial/interview) match a sensible role in the content funnel — how-tos and explainers pull search traffic, listicles are passive top-of-funnel reach, case studies build authority, testimonials/interviews convert?
7. REVENUE-TIER AWARENESS — Is this idea aligned with a monetizable tier appropriate to the channel's current stage (ads, affiliate, product, service, community), or is it pure vanity content with no path to revenue?

Tool use: if you have live web/YouTube search available in this environment, you MUST actually use it for steps 4 and 5 — search, open real results, and cite what you found (approximate titles, view counts, channel names, and specific comment themes) in your notes for those checks. Only mark a check "needs_research" if you genuinely have no search capability here — never fabricate statistics, video titles, or comments.`

function buildValidationPrompt(item: ContentItem): { systemPrompt: string; userPrompt: string; combined: string } {
  const systemPrompt = 'You are a strict YouTube idea validator for SoundMoney, a channel on Austrian economics and sound money. ' + VALIDATION_METHOD +
    '\n\nNever invent outlier video statistics, comment data, or facts you did not actually find. Return ONLY valid JSON matching the schema described, no markdown fences, no commentary outside the JSON.'
  const userPrompt = `Video idea title: ${item.title}\n` +
    (item.video_type ? `Video type: ${item.video_type}\n` : '') +
    (item.format ? `Format: ${item.format}\n` : '') +
    (item.unique_angle ? `Unique angle / alpha: ${item.unique_angle}\n` : '') +
    (item.notes ? `Notes (may include outlier stats, comment research, pitch, etc.): ${item.notes}\n` : '') +
    `\nEvaluate this idea against exactly these checks, in this order:\n` +
    IDEA_VALIDATION_CHECKS.map((c, i) => `${i + 1}. [${c.key}] ${c.label} — ${c.hint}`).join('\n') +
    `\n\nReturn JSON exactly in this shape:\n` +
    `{"researched":true|false,"verdict":"Viable"|"Needs More Research"|"Not Viable","summary":"one or two sentences","checks":[{"key":"pitch","status":"pass"|"fail"|"needs_research","note":"one sentence, cite what you found if you searched"}, ... one entry per check above, same order, same keys],"alternatives":[{"title":"an alternative idea title","why":"why this angle is more likely to work","evidence":"the specific outlier video, comment theme, or proven pattern this is based on — or say 'no live search available, based on established niche patterns' if you could not research"}]}\n\n` +
    `"researched" should be true only if you actually used live web/YouTube search for steps 4 and 5, false if you had no search capability and relied on general knowledge.\n\n` +
    `Verdict rule: "Not Viable" only if the core idea is fundamentally weak (no angle, already well-covered with nothing new, pitch doesn't hold together). "Needs More Research" if the idea itself is sound but one or more checks are needs_research (e.g. missing outlier stats or comment data). "Viable" only if nothing is needs_research or failing.\n\n` +
    `Alternatives rule: if verdict is NOT "Viable", "alternatives" is REQUIRED — give 2 to 4 concrete alternative angles or ideas, similar to the original topic, that are more likely to work based on what you found (or, absent search, on well-established patterns in this niche). Each alternative must have real "evidence" backing it, not a generic guess. If verdict IS "Viable", you may return an empty alternatives array.`
  const combined = systemPrompt + '\n\n---\n\n' + userPrompt +
    '\n\nUse whatever research tools you have (web search, YouTube search, a research skill) to actually complete steps 4 and 5 rather than guessing — that is the whole point of running this through a Claude surface with tools attached. Reply with the JSON described above only.'
  return { systemPrompt, userPrompt, combined }
}

// Short prompt for the "Copy prompt" button — meant to be pasted into a
// Claude chat (Claude Code, claude.ai, Cowork) that has the installed
// "youtube-idea-validator" skill. Rather than re-deriving the checklist
// inline (which can drift from the actual skill and doesn't get Claude's
// real research tools reliably invoked), this just names the skill and
// hands over the idea's details — the skill itself carries the full method,
// the research requirement, and the evidence-backed-alternatives rule.
function buildSkillInvokePrompt(item: ContentItem): string {
  const lines = [
    'Use the youtube-idea-validator skill to validate this YouTube video idea.',
    '',
    'Channel: SoundMoney — Austrian economics and sound money, roughly 15k subscribers.',
    `Title: ${item.title}`,
  ]
  if (item.video_type) lines.push(`Video type: ${item.video_type}`)
  if (item.format) lines.push(`Format: ${item.format}`)
  if (item.unique_angle) lines.push(`Unique angle / alpha so far: ${item.unique_angle}`)
  lines.push(`Description: ${item.notes?.trim() ? item.notes : '(nothing written yet — work from the title alone and flag that in the report)'}`)
  lines.push('')
  lines.push('Actually search for comparable videos and read their comments rather than estimating — give me the full report with a verdict, the checklist, and evidence-backed alternatives if you don\'t land on Viable.')
  return lines.join('\n')
}

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6',
}

// ── Aligned with Production SOPs + Shane Hummus Holy Trifecta ──────────────
const PIPELINE_STAGES = [
  { key:'✅ Validated',        color:'#22c55e', bg:'rgba(34,197,94,0.08)',   tip:'Angle confirmed. One-line pitch written. Folder created.' },
  { key:'📚 Research',         color:'#8b5cf6', bg:'rgba(139,92,246,0.08)',  tip:'60-90 min deep dive. Wild stats + story arc found.' },
  { key:'🎯 Holy Trifecta',    color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  tip:'Title + Thumbnail concept + Hook decided BEFORE scripting.' },
  { key:'✍️ Script',           color:'#00d4ff', bg:'rgba(0,212,255,0.06)',   tip:'Full script written, read aloud, timed. [MEME] + [B-ROLL] tagged.' },
  { key:'🎨 Assets',           color:'#f97316', bg:'rgba(249,115,22,0.08)',  tip:'All memes, b-roll, charts gathered and organised in folders.' },
  { key:'🎙️ Voiceover',       color:'#10b981', bg:'rgba(16,185,129,0.08)',  tip:'VO recorded section-by-section. Files labelled. Re-recorded flats.' },
  { key:'✂️ Editing',          color:'#ec4899', bg:'rgba(236,72,153,0.08)', tip:'Full edit done. 2x-speed test passed. Music, SFX, captions added.' },
  { key:'🖼️ Thumbnail & SEO', color:'#f472b6', bg:'rgba(244,114,182,0.08)',tip:'Thumbnail passes 2-sec test. Title, description, tags all written.' },
  { key:'☁️ Scheduled',        color:'#00ff88', bg:'rgba(0,255,136,0.06)',   tip:'Uploaded private. End screens + cards added. Scheduled for peak time.' },
  { key:'📣 Live',             color:'#ff4466', bg:'rgba(255,68,102,0.1)',   tip:'Published. Community post done. Reddit seeded within 30 min.' },
  { key:'📊 Post-Published',   color:'#64748b', bg:'rgba(100,116,139,0.1)', tip:'Short clipped. 48hr analytics checked. CTR + retention logged.' },
]

const IDEA_STAGE = { key:'💡 Idea', color:'#4a4a6a', bg:'rgba(74,74,106,0.12)' }
const ALL_STAGES = [IDEA_STAGE, ...PIPELINE_STAGES]
const STAGE_KEYS  = ALL_STAGES.map(s => s.key)

const FORMATS = ['Long-form', 'Short', 'Both', 'Podcast clip']

// Which funnel role a video plays — from Dave Jeltema / Shane Hummus content-system videos:
// how-tos pull search traffic, listicles are passive top-of-funnel, case studies build
// authority, testimonials/interviews convert. Optional — leave blank if it doesn't apply.
const VIDEO_TYPES = ['How-To', 'Listicle', 'Case Study', 'Explainer', 'Testimonial/Interview']

type ContentItem = {
  id: string
  notion_id: string | null
  title: string
  pipeline_stage: string | null
  format: string | null
  yt_length: string | null
  tag: string | null
  due_date: string | null
  status: string
  link: string | null
  notes: string | null
  notion_url: string | null
  created_at?: string
  video_type: string | null
  unique_angle: string | null
  revenue_note: string | null
  is_active_focus: boolean
}

type View = 'ideas' | 'pipeline' | 'list'

function stageStyle(key: string | null) {
  return ALL_STAGES.find(s => s.key === key) ?? { color:C.muted, bg:'transparent' }
}

function StageChip({ stage }: { stage: string | null }) {
  const s = stageStyle(stage)
  if (!stage) return null
  return (
    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', whiteSpace:'nowrap' as const }}>
      {stage}
    </span>
  )
}

// ── Move stage modal ────────────────────────────────────────────────────────
function MoveModal({ item, onMove, onClose }: { item:ContentItem; onMove:(s:string)=>void; onClose:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'22rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0 }}>Move to stage</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 1rem', lineHeight:1.4 }}>{item.title}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
          {ALL_STAGES.map(s => (
            <button key={s.key} onClick={() => onMove(s.key)} style={{
              textAlign:'left', padding:'0.55rem 0.875rem',
              background: item.pipeline_stage === s.key ? s.bg : C.card,
              border: '1px solid ' + (item.pipeline_stage === s.key ? s.color+'55' : C.border),
              borderRadius:'0.625rem', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight:600, color: item.pipeline_stage === s.key ? s.color : C.sec,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span>{s.key}</span>
              {item.pipeline_stage === s.key && <span style={{ fontSize:'0.6rem', color:s.color }}>current</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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

const VERDICT_STYLE: Record<ValidationResult['verdict'], { color: string; bg: string; border: string }> = {
  'Viable':              { color:'#22c55e', bg:'rgba(34,197,94,0.1)',  border:'rgba(34,197,94,0.3)' },
  'Needs More Research': { color:C.amber,   bg:'rgba(255,184,0,0.1)',  border:'rgba(255,184,0,0.3)' },
  'Not Viable':          { color:C.red,     bg:'rgba(255,68,102,0.1)', border:'rgba(255,68,102,0.3)' },
}

function CheckIcon({ status }: { status: ValidationCheckResult['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={13} color="#22c55e"/>
  if (status === 'fail') return <XCircle size={13} color={C.red}/>
  return <HelpCircle size={13} color={C.amber}/>
}

function IdeaDetailModal({ item, result, loading, msg, ideaLog, ideaLogMsg, onSaveField, onSaveLog, onCreateIdeaFromAlternative, onRun, onPromote, onClose }: {
  item: ContentItem; result: ValidationResult | null; loading: boolean; msg: string | null
  ideaLog: IdeaLog | null; ideaLogMsg: string | null
  onSaveField: (patch: Partial<Pick<ContentItem, 'title' | 'notes'>>) => void
  onSaveLog: (reply: string, nextSteps: string) => void
  onCreateIdeaFromAlternative: (alt: ValidationAlternative) => Promise<boolean>
  onRun: (model: string, webSearch: boolean) => void; onPromote: () => void; onClose: () => void
}) {
  const vs = result ? VERDICT_STYLE[result.verdict] : null
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.notes ?? '')
  const [modelKey, setModelKey] = useState(result?.model ?? DEFAULT_CONSULT_MODEL)
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

// ── Add idea modal ──────────────────────────────────────────────────────────
function AddIdeaModal({ onAdd, onClose }: { onAdd:(title:string,format:string,notes:string,videoType:string,uniqueAngle:string)=>Promise<void>; onClose:()=>void }) {
  const [title,  setTitle]  = useState('')
  const [format, setFormat] = useState('Long-form')
  const [notes,  setNotes]  = useState('')
  const [videoType, setVideoType] = useState('')
  const [uniqueAngle, setUniqueAngle] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    await onAdd(title.trim(), format, notes.trim(), videoType, uniqueAngle.trim())
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'26rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Lightbulb size={16} color={C.amber}/> New idea
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Title / Working idea</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              autoFocus placeholder="e.g. Why the Cantillon Effect makes the rich richer"
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.85rem', outline:'none', boxSizing:'border-box' as const }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Format</label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{ padding:'0.35rem 0.75rem', background:format===f?'rgba(0,212,255,0.1)':C.card, border:'1px solid '+(format===f?C.cyan:C.border), borderRadius:'9999px', color:format===f?C.cyan:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Video type <span style={{ fontWeight:400 }}>(optional — which funnel role this plays)</span></label>
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
              {VIDEO_TYPES.map(v => (
                <button key={v} onClick={() => setVideoType(videoType===v?'':v)} style={{ padding:'0.35rem 0.75rem', background:videoType===v?'rgba(139,92,246,0.12)':C.card, border:'1px solid '+(videoType===v?C.purple:C.border), borderRadius:'9999px', color:videoType===v?C.purple:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Alpha check <span style={{ fontWeight:400 }}>— what does this have that a generic AI answer or the top existing videos don&apos;t?</span></label>
            <textarea
              value={uniqueAngle} onChange={e => setUniqueAngle(e.target.value)} rows={2}
              placeholder="e.g. original data pull, contrarian take, historical parallel nobody else has used, a real number nobody else calculated..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
            <p style={{ fontSize:'0.68rem', color:C.muted, margin:'0.35rem 0 0' }}>If you can&apos;t fill this in, the idea is probably a recipe &mdash; something AI or a search engine already answers well. Find the edge before you validate it.</p>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Notes / angle / hook idea <span style={{ fontWeight:400 }}>(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Any early thoughts on the angle, hook, or why this topic matters..."
              style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
            />
          </div>

          <button onClick={submit} disabled={!title.trim() || saving} style={{
            width:'100%', padding:'0.75rem',
            background: title.trim() && !saving ? 'linear-gradient(135deg,'+C.amber+',#d97706)' : C.card,
            border:'none', borderRadius:'0.75rem', color: title.trim() && !saving ? '#000' : C.muted,
            fontWeight:800, fontSize:'0.9rem', cursor:title.trim() && !saving ? 'pointer' : 'not-allowed',
            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
          }}>
            <Plus size={15}/>{saving ? 'Saving...' : 'Add to ideas bank'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Focus pin star ──────────────────────────────────────────────────────────
// Pins up to 2 items as the Home page's "active focus" videos/shorts. Capped
// at 2 in the app layer (see toggleFocus in the main page component below).
function FocusStar({ active, atCap, onToggle }: { active:boolean; atCap:boolean; onToggle:()=>void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      disabled={!active && atCap}
      title={active ? 'Unpin from Home focus' : atCap ? 'Already 2 pinned — unpin one first' : 'Pin as active focus on Home'}
      style={{
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        width:'1.375rem', height:'1.375rem', borderRadius:'0.4rem',
        background: active ? 'rgba(255,184,0,0.14)' : 'transparent',
        border:'1px solid '+(active ? 'rgba(255,184,0,0.4)' : C.border),
        color: active ? C.amber : C.muted,
        cursor: (!active && atCap) ? 'not-allowed' : 'pointer',
        opacity: (!active && atCap) ? 0.4 : 1,
        padding:0,
      }}>
      <Star size={11} fill={active ? 'currentColor' : 'none'}/>
    </button>
  )
}

// ── Pipeline card ───────────────────────────────────────────────────────────
function PipelineCard({ item, onMove, onSaveRevenue, onToggleFocus, focusAtCap }: { item:ContentItem; onMove:()=>void; onSaveRevenue:(note:string)=>void; onToggleFocus:()=>void; focusAtCap:boolean }) {
  const s = stageStyle(item.pipeline_stage)
  const [revenue, setRevenue] = useState(item.revenue_note ?? '')
  const isPostPublished = item.pipeline_stage === '📊 Post-Published'
  const sop = sopForStage(item.pipeline_stage)
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [noteLoaded, setNoteLoaded] = useState(false)
  const [consulting, setConsulting] = useState(false)
  const [noteMsg, setNoteMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || !sop || noteLoaded) return
    getStageNote(item.id, sop.id).then(({ output, error }) => {
      if (error) setNoteMsg(error)
      else setNote(output ?? '')
      setNoteLoaded(true)
    })
  }, [expanded, sop, item.id, noteLoaded])

  async function saveNote(text: string) {
    if (!sop) return
    const { error } = await saveStageNote(item.id, sop.id, text)
    if (error) setNoteMsg(error)
  }

  async function consultClaude() {
    if (!sop) return
    setConsulting(true)
    setNoteMsg(null)
    const systemPrompt = 'You are a YouTube production assistant for SoundMoney, a channel on Austrian economics and sound money. You draft concrete, ready-to-use output for one pipeline stage at a time — never generic advice, always specific to the video described. Keep output tight and scannable, using the checklist as your brief. Write in plain text (no markdown headers), short paragraphs or a short list where useful.'
    const userPrompt = `Video title: ${item.title}\n` +
      (item.video_type ? `Video type: ${item.video_type}\n` : '') +
      (item.format ? `Format: ${item.format}\n` : '') +
      (item.unique_angle ? `Unique angle: ${item.unique_angle}\n` : '') +
      (item.notes ? `Existing notes: ${item.notes}\n` : '') +
      (note ? `Work already drafted for this stage:\n${note}\n` : '') +
      `\nCurrent pipeline stage: ${sop.title}\nWhat this stage needs (checklist, strip the HTML tags mentally):\n` +
      sop.steps.map((st, i) => (i + 1) + '. ' + st.replace(/<[^>]+>/g, '')).join('\n') +
      `\n\nDraft the actual output for this stage for this specific video — e.g. if this is Idea & Validation, give the angle/pitch/comment-mining notes; if it's Holy Trifecta, give 3 title options + thumbnail concept + hook; if it's Scripting, give the outline or opening lines. Use what you know about the video above. Where a fact is missing, write [FILL IN: what's needed] rather than inventing it.`
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt }),
      })
      const data = await res.json()
      if (data?.error) { setNoteMsg('API error: ' + JSON.stringify(data.error)); return }
      const raw = data?.content?.[0]?.text ?? ''
      if (!raw) { setNoteMsg('Empty response from Claude.'); return }
      setNote(raw)
      await saveNote(raw)
    } catch (e) {
      setNoteMsg('Consult failed: ' + String(e))
    } finally {
      setConsulting(false)
    }
  }

  return (
    <div style={{ background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.875rem', padding:'0.75rem', marginBottom:'0.4rem' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', marginBottom:'0.4rem' }}>
        <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, lineHeight:1.35, flex:1 }}>{item.title}</p>
        <FocusStar active={item.is_active_focus} atCap={focusAtCap} onToggle={onToggleFocus}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap' as const, marginBottom:'0.4rem' }}>
        {item.format && <span style={{ fontSize:'0.6rem', color:C.muted, background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.format}</span>}
        {item.video_type && <span style={{ fontSize:'0.6rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.video_type}</span>}
        {item.tag && <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{item.tag}</span>}
      </div>
      {item.unique_angle && <p style={{ fontSize:'0.65rem', color:C.purple, margin:'0 0 0.3rem', lineHeight:1.4 }}>&#9889; {item.unique_angle.slice(0,90)}{item.unique_angle.length>90?'…':''}</p>}
      {item.notes && <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.45, fontStyle:'italic' }}>{item.notes.slice(0,80)}{item.notes.length>80?'…':''}</p>}
      {isPostPublished && (
        <div style={{ marginBottom:'0.4rem' }}>
          <label style={{ display:'block', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, marginBottom:'0.2rem' }}>Revenue attribution</label>
          <input
            value={revenue} onChange={e => setRevenue(e.target.value)} onBlur={() => onSaveRevenue(revenue)}
            placeholder="e.g. $210 AdSense in 30d, or link clicks from UTM"
            style={{ width:'100%', padding:'0.35rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.68rem', outline:'none', boxSizing:'border-box' as const }}
          />
        </div>
      )}
      <div style={{ display:'flex', gap:'0.3rem' }}>
        <button onClick={onMove} style={{ flex:1, padding:'0.3rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
          Move stage <ChevronRight size={10}/>
        </button>
        {sop && (
          <button onClick={() => setExpanded(e => !e)} style={{ padding:'0.3rem 0.5rem', background: expanded ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)', border:'1px solid '+(expanded ? 'rgba(139,92,246,0.3)' : C.border), borderRadius:'0.5rem', color: expanded ? C.purple : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
            SOP &amp; AI <ChevronDown size={10} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
          </button>
        )}
      </div>

      {expanded && sop && (
        <div style={{ marginTop:'0.5rem', paddingTop:'0.5rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.68rem', fontWeight:700, color:C.purple, margin:'0 0 0.3rem' }}>{sop.icon ? <span dangerouslySetInnerHTML={{ __html: sop.icon + ' ' }}/> : null}{sop.title}</p>
          <ul style={{ margin:'0 0 0.5rem', paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.15rem' }}>
            {sop.steps.map((st, i) => (
              <li key={i} style={{ fontSize:'0.65rem', color:C.sec, lineHeight:1.4 }} dangerouslySetInnerHTML={{ __html: st }}/>
            ))}
          </ul>

          <button onClick={consultClaude} disabled={consulting} style={{ width:'100%', marginBottom:'0.4rem', padding:'0.4rem', background: consulting ? C.surface : 'rgba(0,212,255,0.1)', border:'1px solid '+(consulting ? C.border : 'rgba(0,212,255,0.3)'), borderRadius:'0.5rem', color: consulting ? C.muted : C.cyan, fontWeight:700, cursor: consulting ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.68rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
            <Sparkles size={11}/>{consulting ? 'Consulting Claude…' : 'Consult Claude'}
          </button>

          {noteMsg && <p style={{ fontSize:'0.62rem', color:C.amber, margin:'0 0 0.4rem', lineHeight:1.4 }}>{noteMsg}</p>}

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => saveNote(note)}
            placeholder="Consult Claude above, or write this stage's notes yourself…"
            rows={4}
            style={{ width:'100%', padding:'0.5rem 0.6rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.7rem', lineHeight:1.5, resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ContentPage() {
  const router = useRouter()
  const [items,      setItems]      = useState<ContentItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<View>('ideas')
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [focusMsg,   setFocusMsg]   = useState<string | null>(null)
  const [validatingItem, setValidatingItem] = useState<ContentItem | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [ideaLog, setIdeaLog] = useState<IdeaLog | null>(null)
  const [ideaLogMsg, setIdeaLogMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .neq('archived', true)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function moveStage(item: ContentItem, stage: string) {
    setMoveTarget(null)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, pipeline_stage: stage } : i))
    await supabase.from('content_items').update({ pipeline_stage: stage }).eq('id', item.id)
  }

  async function addIdea(title: string, format: string, notes: string, videoType: string, uniqueAngle: string) {
    const { data } = await supabase
      .from('content_items')
      .insert({ title, pipeline_stage:'💡 Idea', format, notes: notes || null, video_type: videoType || null, unique_angle: uniqueAngle || null, status:'active', archived: false })
      .select()
      .single()
    if (data) setItems(prev => [data, ...prev])
    setShowAdd(false)
  }

  // Turns one of Claude's validation alternatives into its own idea in the
  // Ideas Bank — inherits format/video type from the idea it was suggested
  // under, "why" becomes the description, "evidence" becomes the alpha check
  // (it's exactly the kind of edge that field is for).
  async function addIdeaFromAlternative(parent: ContentItem, alt: ValidationAlternative): Promise<boolean> {
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: alt.title,
        pipeline_stage: '💡 Idea',
        format: parent.format,
        notes: alt.why || null,
        video_type: parent.video_type,
        unique_angle: alt.evidence || null,
        status: 'active',
        archived: false,
      })
      .select()
      .single()
    if (error || !data) return false
    setItems(prev => [data, ...prev])
    return true
  }

  async function saveRevenueNote(item: ContentItem, note: string) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, revenue_note: note } : i))
    await supabase.from('content_items').update({ revenue_note: note || null }).eq('id', item.id)
  }

  const focusCount = items.filter(i => i.is_active_focus).length

  async function toggleFocus(item: ContentItem) {
    if (!item.is_active_focus && focusCount >= 2) return // capped in the UI too, this is a safety net
    const next = !item.is_active_focus
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: next } : i))
    const { error } = await supabase.from('content_items').update({ is_active_focus: next }).eq('id', item.id)
    if (error) {
      // Revert the optimistic update — most likely cause is migration
      // 018_content_focus.sql not having been run yet (is_active_focus
      // column doesn't exist), so surface that clearly instead of failing silently.
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active_focus: !next } : i))
      setFocusMsg(
        error.message?.toLowerCase().includes('is_active_focus')
          ? "Setup needed: run supabase/migrations/018_content_focus.sql against your database before pinning works."
          : 'Could not save — ' + error.message
      )
    }
  }

  async function promoteToValidated(item: ContentItem) {
    await moveStage(item, '✅ Validated')
  }

  async function saveIdeaField(item: ContentItem, patch: Partial<Pick<ContentItem, 'title' | 'notes'>>) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i))
    setValidatingItem(prev => prev && prev.id === item.id ? { ...prev, ...patch } : prev)
    await supabase.from('content_items').update(patch).eq('id', item.id)
  }

  async function openValidate(item: ContentItem) {
    setValidatingItem(item)
    setValidationResult(null)
    setValidationMsg(null)
    setIdeaLog(null)
    setIdeaLogMsg(null)
    const { output, error } = await getStageNote(item.id, IDEA_VALIDATION_SOP_ID)
    if (error) { setValidationMsg(error) } else if (output) {
      try { setValidationResult(JSON.parse(output) as ValidationResult) } catch { /* stale/invalid — ignore, user can re-run */ }
    }
    const { output: logOutput, error: logError } = await getStageNote(item.id, IDEA_LOG_SOP_ID)
    if (logError) { setIdeaLogMsg(logError); return }
    if (logOutput) {
      try { setIdeaLog(JSON.parse(logOutput) as IdeaLog) } catch { /* stale/invalid — ignore */ }
    }
  }

  async function saveIdeaLog(item: ContentItem, reply: string, nextSteps: string) {
    const log: IdeaLog = { reply, nextSteps, loggedAt: new Date().toISOString() }
    const { error } = await saveStageNote(item.id, IDEA_LOG_SOP_ID, JSON.stringify(log))
    if (error) { setIdeaLogMsg(error); return }
    setIdeaLog(log)
    setIdeaLogMsg(null)
  }

  async function runValidation(item: ContentItem, model: string, webSearch: boolean) {
    setValidationLoading(true)
    setValidationMsg(null)
    const { systemPrompt, userPrompt } = buildValidationPrompt(item)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model, webSearch }),
      })
      const data = await res.json()
      if (data?.error) { setValidationMsg('API error: ' + JSON.stringify(data.error)); return }
      // With web search enabled, Claude's response can include tool_use /
      // web_search_tool_result blocks alongside the text — concatenate every
      // text block rather than assuming the answer is in content[0].
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n')
        .trim()
      if (!raw) { setValidationMsg('Empty response from Claude.'); return }
      let clean = raw.replace(/```json|```/g, '').trim()
      // If there's commentary around the JSON despite instructions, pull out
      // the first {...} block rather than failing to parse.
      if (!clean.startsWith('{')) {
        const match = clean.match(/\{[\s\S]*\}/)
        if (match) clean = match[0]
      }
      const parsed = JSON.parse(clean) as ValidationResult
      const result: ValidationResult = { ...parsed, model }
      setValidationResult(result)
      await saveStageNote(item.id, IDEA_VALIDATION_SOP_ID, JSON.stringify(result))
    } catch (e) {
      setValidationMsg('Validation failed: ' + String(e))
    } finally {
      setValidationLoading(false)
    }
  }

  const ideas    = items.filter(i => i.pipeline_stage === '💡 Idea' || !i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))
  const pipeline = items.filter(i => i.pipeline_stage && STAGE_KEYS.includes(i.pipeline_stage) && i.pipeline_stage !== '💡 Idea')
  const liveCount = items.filter(i => i.pipeline_stage === '📣 Live').length

  const byStage = PIPELINE_STAGES.map(s => ({
    ...s,
    items: items.filter(i => i.pipeline_stage === s.key),
  }))

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ padding:'1.5rem 2rem 1rem', borderBottom:'1px solid '+C.border, background:'linear-gradient(160deg,rgba(255,107,53,0.05) 0%,transparent 100%)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
            <div>
              <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.8rem', fontFamily:'inherit', marginBottom:'0.5rem', padding:0 }}>
                <ChevronLeft size={14}/> Home
              </button>
              <h1 style={{ fontSize:'clamp(1.3rem,3vw,1.75rem)', fontWeight:900, margin:'0 0 0.15rem', letterSpacing:'-0.02em' }}>
                &#127909; YouTube Pipeline
              </h1>
              <p style={{ fontSize:'0.8rem', color:C.sec, margin:0 }}>
                {ideas.length} ideas &bull; {pipeline.length} in production &bull; {liveCount} live
              </p>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' as const }}>
              {/* View switcher */}
              <div style={{ display:'flex', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', overflow:'hidden' }}>
                {([
                  { v:'ideas',    icon:<Lightbulb size={12}/>,  label:'Ideas' },
                  { v:'pipeline', icon:<LayoutGrid size={12}/>, label:'Pipeline' },
                  { v:'list',     icon:<List size={12}/>,       label:'All' },
                ] as const).map(({ v, icon, label }) => (
                  <button key={v} onClick={() => setView(v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.8rem', background:view===v?C.surface:'transparent', border:'none', color:view===v?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
                    {icon}{label}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'linear-gradient(135deg,'+C.amber+',#d97706)', border:'none', borderRadius:'0.625rem', color:'#000', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:800 }}>
                <Plus size={14}/>New idea
              </button>
            </div>
          </div>

          {/* Pipeline stage legend */}
          {view === 'pipeline' && (
            <div style={{ marginTop:'0.875rem', display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              {PIPELINE_STAGES.map(s => (
                <div key={s.key} title={s.tip} style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.62rem', color:s.color, background:s.bg, border:'1px solid '+s.color+'30', borderRadius:'9999px', padding:'0.15rem 0.5rem', cursor:'default' }}>
                  {s.key}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'1.5rem 2rem', maxWidth:'1400px', margin:'0 auto' }}>
        {focusMsg && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:'0.75rem' }}>
            <p style={{ fontSize:'0.78rem', color:C.amber, margin:0, lineHeight:1.5, flex:1 }}>{focusMsg}</p>
            <button onClick={() => setFocusMsg(null)} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </div>
        )}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:C.muted, padding:'2rem 0' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.orange, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            Loading pipeline...
          </div>
        ) : view === 'ideas' ? (

          /* ── IDEAS BANK ── */
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, margin:'0 0 0.2rem' }}>&#128161; Ideas Bank</h2>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0 }}>{ideas.length} ideas &mdash; validate before moving to production</p>
              </div>
              <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.625rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                <Plus size={13}/>Add idea
              </button>
            </div>

            {ideas.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem 1rem', color:C.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.5rem', opacity:0.4 }}>&#128161;</div>
                <p style={{ margin:0, fontSize:'0.85rem' }}>No ideas yet. Add the first one.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' as const }}>
                <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:'0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid '+C.border }}>
                      {['Title','Type','Format','Alpha (unique angle)','Notes / Angle','Added','Actions'].map(h => (
                        <th key={h} style={{ padding:'0.5rem 0.875rem', textAlign:'left' as const, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.muted, whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map(item => (
                      <tr key={item.id} style={{ borderBottom:'1px solid '+C.border+'60' }}>
                        <td style={{ padding:'0.75rem 0.875rem', fontWeight:700, color:C.text, maxWidth:'240px' }}>
                          <div
                            onClick={() => openValidate(item)}
                            title="Open idea — view/edit and validate"
                            style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', cursor:'pointer' }}
                          >
                            <span style={{ lineHeight:1.4, textDecoration:'underline', textDecorationColor:'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecorationColor = C.muted)}
                              onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                            >{item.title}</span>
                          </div>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.video_type
                            ? <span style={{ fontSize:'0.65rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.video_type}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          {item.format
                            ? <span style={{ fontSize:'0.68rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.15rem 0.5rem', fontWeight:700 }}>{item.format}</span>
                            : <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.purple, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.unique_angle || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.sec, maxWidth:'260px' }}>
                          <span style={{ lineHeight:1.5 }}>{item.notes || <span style={{ color:C.muted }}>—</span>}</span>
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', color:C.muted, whiteSpace:'nowrap' as const, fontSize:'0.72rem' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—'}
                        </td>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                            <button onClick={() => openValidate(item)} title="Open the idea-validation checklist" style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.65rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.5rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:700 }}>
                              <Sparkles size={11}/>Validate
                            </button>
                            <button onClick={() => setMoveTarget(item)} style={{ padding:'0.3rem 0.5rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem' }}>
                              Move
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : view === 'pipeline' ? (

          /* ── PIPELINE KANBAN ── */
          <div>
            <p style={{ fontSize:'0.75rem', color:C.muted, margin:'0 0 1.25rem' }}>
              Hover a stage chip to see the SOP checklist for that step. {pipeline.length} videos in active production.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:'0.625rem', alignItems:'start' }}>
              {byStage.map(stage => (
                <div key={stage.key} style={{ background:stage.bg, border:'1px solid '+stage.color+'28', borderRadius:'1rem', padding:'0.875rem' }}>
                  <div style={{ marginBottom:'0.75rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:800, color:stage.color }}>{stage.key}</span>
                      <span style={{ fontSize:'0.62rem', color:stage.color, background:stage.color+'18', borderRadius:'9999px', padding:'0.1rem 0.375rem', fontWeight:700 }}>{stage.items.length}</span>
                    </div>
                    <p style={{ fontSize:'0.6rem', color:C.muted, margin:0, lineHeight:1.45 }}>{stage.tip}</p>
                  </div>
                  {stage.items.length === 0 ? (
                    <p style={{ fontSize:'0.65rem', color:C.muted, textAlign:'center', padding:'0.75rem 0', margin:0 }}>empty</p>
                  ) : (
                    stage.items.map(item => <PipelineCard key={item.id} item={item} onMove={() => setMoveTarget(item)} onSaveRevenue={note => saveRevenueNote(item, note)} onToggleFocus={() => toggleFocus(item)} focusAtCap={focusCount >= 2}/>)
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : (

          /* ── ALL / LIST ── */
          <div>
            <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1rem' }}>{items.length} total videos across all stages</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              {ALL_STAGES.map(stage => {
                const group = items.filter(i => i.pipeline_stage === stage.key || (stage.key === '💡 Idea' && (!i.pipeline_stage || !STAGE_KEYS.includes(i.pipeline_stage ?? ''))))
                if (group.length === 0) return null
                return (
                  <div key={stage.key} style={{ marginBottom:'0.5rem' }}>
                    <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:stage.color, margin:'0 0 0.35rem' }}>
                      {stage.key} <span style={{ fontWeight:500, color:C.muted }}>({group.length})</span>
                    </p>
                    {group.map(item => (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 0.875rem', background:C.card, border:'1px solid '+(item.is_active_focus ? 'rgba(255,184,0,0.35)' : C.border), borderRadius:'0.75rem', marginBottom:'0.25rem' }}>
                        <FocusStar active={item.is_active_focus} atCap={focusCount >= 2} onToggle={() => toggleFocus(item)}/>
                        <p style={{ flex:1, fontSize:'0.83rem', fontWeight:600, color:C.text, margin:0 }}>{item.title}</p>
                        {item.format && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                        {item.due_date && <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{item.due_date}</span>}
                        <button onClick={() => setMoveTarget(item)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', padding:'0.2rem 0.5rem', flexShrink:0 }}>Move</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {moveTarget && <MoveModal item={moveTarget} onMove={s => moveStage(moveTarget, s)} onClose={() => setMoveTarget(null)}/>}
      {showAdd    && <AddIdeaModal onAdd={addIdea} onClose={() => setShowAdd(false)}/>}
      {validatingItem && (
        <IdeaDetailModal
          item={validatingItem}
          result={validationResult}
          loading={validationLoading}
          msg={validationMsg}
          ideaLog={ideaLog}
          ideaLogMsg={ideaLogMsg}
          onSaveField={patch => saveIdeaField(validatingItem, patch)}
          onSaveLog={(reply, nextSteps) => saveIdeaLog(validatingItem, reply, nextSteps)}
          onCreateIdeaFromAlternative={alt => addIdeaFromAlternative(validatingItem, alt)}
          onRun={(model, webSearch) => runValidation(validatingItem, model, webSearch)}
          onPromote={() => { promoteToValidated(validatingItem); setValidatingItem(null) }}
          onClose={() => setValidatingItem(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}
