'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getStageNote, saveStageNote } from '@/lib/supabase'
import { sopForStage, IDEA_VALIDATION_CHECKS, SOPS, type SOP } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { ChevronLeft, Plus, X, ChevronRight, Lightbulb, LayoutGrid, List, Zap, CheckCircle2, Star, ChevronDown, Sparkles, XCircle, HelpCircle, Copy, Check, ArrowUpDown } from 'lucide-react'

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
  const systemPrompt = 'You are a strict YouTube idea validator for SoundMoney.\n\n' + CHANNEL_BRIEF + '\n\n' + VALIDATION_METHOD +
    '\n\nBeyond the 7 checks, weigh the idea against the CHANNEL BRIEF above — does it fit the launch focus, use one of the proven packaging patterns, and leave room for the prescriptive "what this means for your savings" ending? Call out any mismatch explicitly in the summary.' +
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
    'Channel: SoundMoney — faceless (voiceover + visuals) wealth-protection channel. Niche hypothesis: "I help everyday savers protect their wealth from inflation and a broken money system." Austrian economics is the lens, not the topic.',
    'Strategy context: launch focus is inflation eating savings (everyday-prices frame), plus gold/hard assets and monetary-history stories. Proven packaging patterns in this niche: anxiety-question titles, history stories with a wealth lesson, contrarian takes, credible how-tos (ex-investment-manager credential). Comment research shows the unmet demand is prescriptive guidance — every video ends with a "what this means for your savings" segment. Target cadence 2-3 uploads/week.',
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

// ── "Find Ideas" — generate new ideas rather than validate an existing one ──
// Shane Hummus's opportunity-finding method, spelled out: an idea is worth
// making when there's a real video that (a) got unusually high views for
// how few subscribers its channel has — proof the topic itself pulls an
// audience, not just the creator's existing fans — AND (b) its packaging
// (title, thumbnail, or the video itself) is mediocre or bad, meaning a
// sharper version of the same topic has real headroom to outperform it.
// High views + weak execution, together, is the signal — one without the
// other isn't an opportunity (just a big channel, or just an obscure video).
type OutlierBreakdown = {
  video_title: string
  channel: string
  views: string
  subscribers: string
  view_to_sub_ratio: string
  recency: string
  packaging_gap: string
  // Which evidence type this idea is grounded in — 'ratio' (topic beat the
  // channel's own audience, the strongest signal) or 'velocity' (big
  // absolute views fast, any channel size — real demand evidence, but
  // weaker on its own since a big channel's algorithmic/audience head start
  // could be doing some of the work). Undefined/omitted = treat as ratio.
  signal_type?: 'ratio' | 'velocity'
  velocity_note?: string // e.g. "1.2M views in 3 weeks on a 2M-sub channel — fast, but large channel so weigh replicability carefully"
  channel_country?: string // e.g. "US" — channel's own declared country, empty if unknown/not declared
}
type FoundIdea = {
  title: string; description: string; video_type: string; format: string
  unique_angle: string
  pattern: string       // which proven packaging pattern this uses (Anxiety Question | History Story | Contrarian Take | Credible How-To)
  comment_gap: string   // the specific unanswered question/frustration from comments this fills
  why_now: string       // one sentence on timing — outlier recency, news cycle, seasonality
  rationale: string
  researched?: boolean
  outlier: OutlierBreakdown | null
}

// Raw outlier row from /api/content/outliers (YouTube Data API scanner).
// Same shape for both the ratio list and the velocity list — ageDays/
// viewsPerDay are what the velocity list is sorted by, but they're computed
// for every row either way.
type ScannedOutlier = {
  videoId: string; title: string; channel: string
  views: number; subscribers: number; ratio: number
  publishedAt: string; url: string; query: string
  ageDays: number; viewsPerDay: number
  channelCountry: string | null // channel's own declared country (About), not confirmed viewer geography
}

// Parse a model reply that should be JSON, surviving markdown fences,
// commentary around the object, and — the common failure — truncation at the
// output-token limit. On truncation, walks back to the last complete object/
// array boundary and closes whatever is still open, so a cut-off "ideas"
// array yields its complete entries instead of a SyntaxError.
function parseModelJson<T>(raw: string): T {
  let clean = raw.replace(/```json|```/g, '').trim()
  const firstBrace = clean.indexOf('{')
  if (firstBrace === -1) throw new Error('No JSON found in the response')
  clean = clean.slice(firstBrace)
  try { return JSON.parse(clean) as T } catch { /* try truncation repair below */ }
  const candidates: { pos: number; closers: string }[] = []
  let inStr = false, esc = false
  const stack: string[] = []
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') {
      stack.pop()
      candidates.push({ pos: i, closers: [...stack].reverse().join('') })
    }
  }
  for (let c = candidates.length - 1, tries = 0; c >= 0 && tries < 40; c--, tries++) {
    try { return JSON.parse(clean.slice(0, candidates[c].pos + 1) + candidates[c].closers) as T } catch { /* walk further back */ }
  }
  throw new Error('Response JSON was truncated beyond repair — try asking for fewer ideas')
}

// ── Hook Lab ────────────────────────────────────────────────────────────────
// Same evidence-first logic as the idea finder, pointed at hooks: take the
// verified outliers, infer the hook pattern each title implies, surface the
// patterns that recur across the winners, then generate hooks for your topic
// in those proven shapes — in the SoundMoney voice.
type HookPattern = { pattern: string; why_it_works: string; example: string }
type HookOption = { hook: string; pattern: string; emotion: string }
type HookAnalysis = { patterns: HookPattern[]; hooks: HookOption[] }

function buildHookAnalysisPrompt(outliers: ScannedOutlier[], topic: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = 'You are a YouTube hook analyst for SoundMoney.\n\n' + CHANNEL_BRIEF + '\n\n' + SCRIPT_VOICE +
    '\n\nReturn ONLY valid JSON, no markdown fences, no commentary outside the JSON.'
  const list = outliers.map(o => `- "${o.title}" — ${o.channel}, ${o.views.toLocaleString()} views, ${o.ratio}:1 view:sub`).join('\n')
  const userPrompt = `These are verified outlier videos in this niche — high views relative to subscribers, so the topic and packaging did the work, not an existing audience:\n${list}\n\n` +
    `Step 1 — for each, infer the HOOK PATTERN the title/packaging implies (e.g. loss/pain, curiosity gap, bold claim, contrarian, question, number/list, story, "you"-framed threat, authority/secret).\n` +
    `Step 2 — identify the 3 to 5 patterns that RECUR most across these winners (the common threads). For each, give a one-sentence reason it holds retention, and cite one title from the list that uses it.\n` +
    (topic.trim()
      ? `Step 3 — write 6 scroll-stopping first-line hooks for a new Short on: "${topic.trim()}". Use the recurring winning patterns, in the SOUNDMONEY SCRIPT VOICE, shock in the first second, loss/"you"-framed where it fits. Never invent statistics.\n`
      : `Step 3 — write 6 reusable first-line hook templates (leave a [TOPIC] slot) in the SOUNDMONEY SCRIPT VOICE, each built on one of the recurring patterns.\n`) +
    `\nReturn JSON exactly: {"patterns":[{"pattern":"short name","why_it_works":"one sentence","example":"a title from the list"}],"hooks":[{"hook":"the first line","pattern":"which pattern it uses","emotion":"pain|prize|desire|curiosity|anger"}]}`
  return { systemPrompt, userPrompt }
}

function formatScannedOutliers(rows: ScannedOutlier[]): string {
  return rows.map(o =>
    `- "${o.title}" — ${o.channel}${o.channelCountry ? ' [' + o.channelCountry + ']' : ''} · ${o.views.toLocaleString()} views on a ${o.subscribers.toLocaleString()}-subscriber channel (${o.ratio}:1 view:sub) · published ${o.publishedAt.slice(0, 10)} · found via "${o.query}" · ${o.url}`
  ).join('\n')
}

function formatScannedVelocity(rows: ScannedOutlier[]): string {
  return rows.map(o =>
    `- "${o.title}" — ${o.channel}${o.channelCountry ? ' [' + o.channelCountry + ']' : ''} (${o.subscribers.toLocaleString()} subs) · ${o.views.toLocaleString()} views in ${o.ageDays} days (~${o.viewsPerDay.toLocaleString()}/day) · published ${o.publishedAt.slice(0, 10)} · found via "${o.query}" · ${o.url}`
  ).join('\n')
}

function buildFindIdeasPrompt(existingTitles: string[], count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[]): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = 'You are a YouTube idea generator for SoundMoney.\n\n' + CHANNEL_BRIEF + '\n\n' + VALIDATION_METHOD +
    '\n\nThe outlier-opportunity method, in detail — this is the core of how ideas get selected, not just one check among many. There are two kinds of evidence, and both count, but they are not equally strong:\n\n' +
    '1. RATIO outliers (primary, strongest evidence) — a video that got unusually high views (100,000+) relative to how few subscribers its channel has (well under 100,000 subscribers — ideally a 5:1+ view-to-subscriber ratio), AND whose packaging is mediocre or bad — a weak title, a cluttered or low-effort thumbnail, or a video that clearly underdelivers on its own premise. That combination (proven demand + weak execution) isolates the topic from the channel: the topic itself pulled an audience beyond the creator\'s own following, and nobody has made a great version of it yet.\n\n' +
    '2. VELOCITY outliers (secondary, corroborating evidence) — a video that racked up a large absolute view count in a short window (e.g. 300,000+ views within about 2 months), REGARDLESS of channel size or ratio. Do not dismiss these just because the channel is large. A gold video that hit 1 million views in a month is real evidence the topic has broad current appeal, even on a big channel where the ratio looks unremarkable or would get filtered out — that view count did not happen by accident. The caveat: on a large channel, some of that pull is the channel\'s own subscriber base and algorithmic authority rather than the topic alone, so it is weaker proof that a smaller channel like this one could replicate it. Use velocity outliers to justify an idea when: the same topic also shows up across multiple velocity results (not just one channel\'s fluke), or a velocity outlier corroborates a weaker ratio candidate, or there is a genuine timing/news reason the topic is hot right now. When an idea rests primarily on a velocity outlier rather than a ratio outlier, say so explicitly and flag the channel size so it can be weighed accordingly — do not present it with the same confidence as a ratio outlier.\n\n' +
    'A small channel with a great video getting modest views still proves nothing on its own (that\'s just a good video, not necessarily a hungry topic) — you still need either a ratio outlier or a velocity outlier (ideally both) as evidence.\n\n' +
    'IDEA-GENERATION TECHNIQUE — combine two popular subjects: a reliable way to find a fresh angle is to take two topics that each independently pull an audience and collide them into one idea, e.g. "gold standard" + "money" -> "What is the gold standard, and how to create money?" Use this alongside the outlier method above (the combined topic still needs real outlier/velocity evidence backing it, not just being a clever mashup) when brainstorming candidate angles.\n\n' +
    'AUDIENCE GEOGRAPHY: this channel targets a predominantly American audience. Where a scanned candidate shows a country code in brackets (e.g. "[US]"), that\'s the channel\'s own declared country from its About page — a reasonable proxy for its audience, not confirmed viewer data (YouTube does not expose actual viewer geography for channels you don\'t own). Prefer candidates tagged [US] when picking which outlier/velocity evidence to build an idea on; a candidate with no country tag just means the channel never declared one, not that its audience isn\'t American — use judgment (title/thumbnail language, currency mentioned, etc.) rather than discarding it outright. If you use live web search, you may also independently judge a channel\'s likely audience from its content and say so.\n\n' +
    'Additionally, every idea you propose must:\n' +
    '- Be unambiguous about its topic in the title itself — YouTube\'s search and recommendation system needs to be able to tell what the video is about from the title/description, so a clever or vague hook must still contain a clear topical keyword or claim, not just curiosity with no subject.\n' +
    '- Genuinely fit the CHANNEL BRIEF above — the launch focus (inflation eating savings first, then gold/hard assets, monetary history, how the money system works), one of the 4 proven packaging patterns (name it), and room for the prescriptive "what this means for your savings" ending. Not just "finance" in general.\n' +
    '- Pass all 7 checks above, especially outlier evidence and comment-mined gap — do not propose an idea you have no real outlier or velocity evidence for.\n\n' +
    'Never invent outlier video statistics, comment data, or facts you did not actually find. Return ONLY valid JSON matching the schema described, no markdown fences, no commentary outside the JSON.'
  const userPrompt = `Generate ${count} new video ideas for this channel.\n` +
    (existingTitles.length > 0
      ? `Do not repeat or closely overlap with these existing ideas already in the bank:\n${existingTitles.map(t => '- ' + t).join('\n')}\n\n`
      : '') +
    (scannedOutliers && scannedOutliers.length > 0
      ? `VERIFIED RATIO OUTLIERS — fetched directly from the YouTube Data API, so these view counts, subscriber counts and ratios are REAL, not estimates. Prefer building ideas on these first; you may still use web search to judge their packaging and read around them:\n${formatScannedOutliers(scannedOutliers)}\n\n`
      : '') +
    (scannedVelocity && scannedVelocity.length > 0
      ? `VERIFIED VELOCITY CANDIDATES — also from the YouTube Data API, REAL numbers. These are videos that gained a lot of views fast REGARDLESS of channel size or ratio (so some may be on large, established channels). Treat as secondary/corroborating evidence per the method above — worth building an idea on, but flag the channel size and note it's velocity-based rather than a ratio outlier:\n${formatScannedVelocity(scannedVelocity)}\n\n`
      : '') +
    `For each idea, ground it in a real outlier or velocity video first (see the method above)${(scannedOutliers && scannedOutliers.length > 0) || (scannedVelocity && scannedVelocity.length > 0) ? ', preferably one from the verified lists' : ''}, then build the idea around beating it. Run through all 7 checks and only include ideas that would score Viable or at worst Needs More Research — do not include ideas that would fail, and do not include an idea if you cannot find genuine outlier or velocity evidence backing it.\n\n` +
    `Return JSON exactly in this shape:\n` +
    `{"ideas":[{"title":"...","description":"one or two sentences on what the video covers","video_type":"${VIDEO_TYPES.join('"|"')}"|"","format":"${FORMATS.join('"|"')}","unique_angle":"the alpha/edge — what your version does differently or better than the outlier","pattern":"Anxiety Question"|"History Story"|"Contrarian Take"|"Credible How-To","comment_gap":"the specific unanswered question or frustration from comments (or the audience insight in the brief) this idea fills — empty string if genuinely unknown","why_now":"one sentence on timing: the outlier's recency, the news cycle, or seasonality that makes this topic hot right now","rationale":"one or two sentences on why this passes the checklist and fits the channel","researched":true|false,"outlier":{"video_title":"the specific outlier/velocity video's title","channel":"its channel name","views":"approx view count, e.g. '180,000 views'","subscribers":"approx subscriber count of that channel, e.g. '8,200 subscribers'","view_to_sub_ratio":"e.g. '22:1', or 'n/a — velocity signal' if this is a velocity-based candidate","recency":"how old the video is, e.g. '4 months ago' or '3 weeks ago'","packaging_gap":"specifically what's weak about its title, thumbnail, or the video itself that your version can beat","signal_type":"ratio"|"velocity","velocity_note":"only when signal_type is velocity — one sentence naming the channel size and flagging how much of the pull might be channel authority vs topic demand, empty string otherwise"} or null if you genuinely could not find qualifying evidence}, ... ${count} entries]}\n\n` +
    `"researched" should be true only if you actually used live web/YouTube search or the verified lists above to ground this idea, false if you had neither and relied on established niche patterns instead. If "researched" is false, "outlier" should be null — do not fabricate view counts or channel names.`
  return { systemPrompt, userPrompt }
}

// ── Stage draft prompt (shared by per-stage Consult Claude + Auto-draft) ────
// One builder so a single stage consult and the full production-pack chain
// produce consistent output. priorStages lets the chain feed each stage the
// stages drafted before it (script builds on research + trifecta, etc.).
function buildStageDraftPrompt(
  item: ContentItem,
  sop: SOP,
  opts?: { existingNote?: string; priorStages?: { title: string; output: string }[] }
): { systemPrompt: string; userPrompt: string } {
  // The voice spec only applies to stages that actually produce spoken words
  // — Scripting (04) and the Holy Trifecta hook (03). Research (02), Assets
  // (05) and Thumbnail/SEO (08) are logistics, not delivery, so they stay
  // plain to avoid the model trying to write those in a comedy voice.
  const isScripting = sop.id === '04' || sop.id === '03'
  const systemPrompt = 'You are a YouTube production assistant for SoundMoney.\n\n' + CHANNEL_BRIEF +
    (isScripting ? '\n\n' + SCRIPT_VOICE : '') +
    '\n\nYou draft concrete, ready-to-use output for one pipeline stage at a time — never generic advice, always specific to the video described, always consistent with the CHANNEL BRIEF above (packaging patterns, prescriptive ending, faceless format)' +
    (isScripting ? ', and written in the SOUNDMONEY SCRIPT VOICE above' : '') +
    '. Keep output tight and scannable, using the checklist as your brief. Write in plain text (no markdown headers), short paragraphs or a short list where useful.'
  const prior = (opts?.priorStages ?? []).filter(p => p.output?.trim())
  const wantsShort = !!item.format && item.format !== 'Long-form'
  const userPrompt = `Video title: ${item.title}\n` +
    (item.video_type ? `Video type: ${item.video_type}\n` : '') +
    (item.format ? `Format: ${item.format}\n` : '') +
    (item.unique_angle ? `Unique angle: ${item.unique_angle}\n` : '') +
    (item.notes ? `Existing notes: ${item.notes}\n` : '') +
    (prior.length > 0
      ? `\nOutputs already drafted for earlier stages — build on these and stay consistent with them:\n` +
        prior.map(p => `--- ${p.title} ---\n${p.output}`).join('\n\n') + '\n'
      : '') +
    (opts?.existingNote ? `\nWork already drafted for this stage (improve and extend it rather than starting over):\n${opts.existingNote}\n` : '') +
    `\nCurrent pipeline stage: ${sop.title}\nWhat this stage needs (checklist, strip the HTML tags mentally):\n` +
    sop.steps.map((st, i) => (i + 1) + '. ' + st.replace(/<[^>]+>/g, '')).join('\n') +
    `\n\nDraft the actual output for this stage for this specific video — e.g. if this is Research, give the wild stats, the story arc, the historical parallel and the sources to verify; if it's Holy Trifecta, give 3 title options + thumbnail concept + hook; if it's Scripting, give the section outline and the full opening${wantsShort ? ', plus a 60-80 word Shorts version cut from the strongest moment' : ''}; if it's Asset Gathering, list the specific memes, b-roll shots and charts the script calls for; if it's Thumbnail & SEO, give the final title pick, thumbnail build spec, description and tags. Where a fact is missing, write [FILL IN: what's needed] rather than inventing it.`
  return { systemPrompt, userPrompt }
}

// The stages the auto-draft chain fills, in dependency order. Voiceover,
// Editing and Upload stay human — that's where the creator's voice and
// judgment go; the chain's job is to have everything ready for them.
const AUTO_DRAFT_STAGES: { sopId: string; label: string }[] = [
  { sopId: '02', label: 'Research' },
  { sopId: '03', label: 'Holy Trifecta' },
  { sopId: '04', label: 'Script' },
  { sopId: '05', label: 'Assets' },
  { sopId: '08', label: 'Thumbnail & SEO' },
]

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
  script_url: string | null
  drive_url: string | null
  youtube_url: string | null
}

// Pull the video id out of any YouTube URL shape (watch?v=, youtu.be/, /shorts/)
function extractYouTubeId(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

type YtStats = { views: number; likes: number; comments: number; publishedAt: string; title: string }

type View = 'ideas' | 'pipeline' | 'list' | 'priority'

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

// ── Find Ideas modal ────────────────────────────────────────────────────────
// Generates new video ideas from scratch (rather than validating one you
// already have) — each one is checked against the same 7-step method before
// it's proposed, grounded in real search where possible, on-topic for the
// channel, and titled so YouTube can actually tell what it's about.
function FindIdeasModal({ onGenerate, onAdd, onClose }: {
  onGenerate: (model: string, webSearch: boolean, count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[]) => Promise<{ ideas: FoundIdea[] } | { error: string }>
  onAdd: (idea: FoundIdea) => Promise<boolean>
  onClose: () => void
}) {
  // Idea generation leans on stronger reasoning (weighing outlier evidence,
  // spotting a genuine alpha angle) than a quick validation check does, so
  // this defaults higher than DEFAULT_CONSULT_MODEL (Haiku) used elsewhere.
  const [modelKey, setModelKey] = useState<string>('claude-sonnet-5')
  const [webSearch, setWebSearch] = useState(true)
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<FoundIdea[] | null>(null)
  const [addStatus, setAddStatus] = useState<Record<number, 'adding' | 'added' | 'error'>>({})
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<ScannedOutlier[] | null>(null)
  const [scanVelocity, setScanVelocity] = useState<ScannedOutlier[] | null>(null)
  const [velocityAddStatus, setVelocityAddStatus] = useState<Record<string, 'adding' | 'added' | 'error'>>({})
  const [showQueries, setShowQueries] = useState(false)
  // Filters results to channels that declared "US" as their country in About
  // (channels.list snippet.country) and biases search ranking toward the US
  // region. It's the closest proxy the public API offers — YouTube doesn't
  // expose actual viewer geography for channels you don't own — so this will
  // also drop channels that never declared a country, not just non-US ones.
  const [usOnly, setUsOnly] = useState(false)
  // One query per line, editable per scan and remembered in this browser so a
  // tuned set survives reloads. Defaults come from the channel brief.
  const [queryText, setQueryText] = useState(OUTLIER_SEED_QUERIES.join('\n'))
  const [outlierAddStatus, setOutlierAddStatus] = useState<Record<string, 'adding' | 'added' | 'error'>>({})
  const [hookTopic, setHookTopic] = useState('')
  const [hookLoading, setHookLoading] = useState(false)
  const [hookMsg, setHookMsg] = useState<string | null>(null)
  const [hookResult, setHookResult] = useState<HookAnalysis | null>(null)

  async function runHookAnalysis() {
    if (!scanResults || scanResults.length === 0) { setHookMsg('Scan for outliers first.'); return }
    setHookLoading(true)
    setHookMsg(null)
    const { systemPrompt, userPrompt } = buildHookAnalysisPrompt(scanResults, hookTopic)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model: 'claude-sonnet-5' }),
      })
      const data = await res.json()
      if (data?.error) { setHookMsg('API error: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      if (!raw) { setHookMsg('Empty response from Claude.'); return }
      setHookResult(parseModelJson<HookAnalysis>(raw))
    } catch (e) {
      setHookMsg('Hook analysis failed: ' + String(e))
    } finally {
      setHookLoading(false)
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('outlierSeedQueries')
      if (saved?.trim()) setQueryText(saved)
    } catch { /* private mode etc. — defaults are fine */ }
  }, [])

  function saveQueries(text: string) {
    setQueryText(text)
    try { localStorage.setItem('outlierSeedQueries', text) } catch { /* ignore */ }
  }

  const parsedQueries = queryText.split('\n').map(q => q.trim()).filter(Boolean)

  const [suggesting, setSuggesting] = useState(false)

  // Ask Claude for fresh search phrases that fit the channel brief — appended
  // to the topic list (deduped) rather than replacing what's already there.
  async function suggestTopics() {
    setSuggesting(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'You generate YouTube search phrases used to hunt for outlier videos.\n\n' + CHANNEL_BRIEF + '\n\nReturn ONLY valid JSON, no markdown fences, no commentary.',
          userPrompt: `Current seed topics:\n${parsedQueries.join('\n') || '(none)'}\n\nSuggest 10 NEW YouTube search phrases (2-5 words each, lowercase, no punctuation) likely to surface overperforming videos for this channel — spread across the launch focus (inflation/savings) and the secondary lanes (gold/hard assets, monetary history stories, how the money system works), mixing evergreen phrasings with timely angles. Do not repeat or trivially reword the current topics.\n\nReturn JSON exactly: {"topics":["...","..."]}`,
          model: 'claude-sonnet-5',
        }),
      })
      const data = await res.json()
      if (data?.error) { setScanMsg('Topic suggestion failed: ' + JSON.stringify(data.error)); return }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n').trim()
      const parsed = parseModelJson<{ topics: string[] }>(raw)
      const existing = new Set(parsedQueries.map(q => q.toLowerCase()))
      const fresh = (parsed.topics ?? []).map(t => t.trim()).filter(t => t && !existing.has(t.toLowerCase()))
      if (fresh.length === 0) { setScanMsg('No new topics suggested — try again.'); return }
      saveQueries([...parsedQueries, ...fresh].join('\n'))
      setShowQueries(true)
    } catch (e) {
      setScanMsg('Topic suggestion failed: ' + String(e))
    } finally {
      setSuggesting(false)
    }
  }

  // Pull real numbers from the YouTube Data API first (needs YOUTUBE_API_KEY)
  // — the resulting outlier list is handed to Claude as verified evidence so
  // ideas get built on exact view:sub ratios instead of search estimates.
  async function scan() {
    if (parsedQueries.length === 0) { setScanMsg('Add at least one search topic first.'); return }
    setScanning(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/content/outliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: parsedQueries.slice(0, 8), regionCode: 'US', countryFilter: usOnly ? 'US' : undefined }),
      })
      const data = await res.json()
      if (data?.error) { setScanMsg(String(data.error)); return }
      const rows = (data?.outliers ?? []) as ScannedOutlier[]
      const velocityRows = (data?.velocityOutliers ?? []) as ScannedOutlier[]
      setScanResults(rows)
      setScanVelocity(velocityRows)
      if (rows.length === 0 && velocityRows.length === 0) setScanMsg('Scan ran fine but found no qualifying outliers or velocity candidates — try different topics or loosen the thresholds in the API route.')
    } catch (e) {
      setScanMsg('Scan failed: ' + String(e))
    } finally {
      setScanning(false)
    }
  }

  // Send a verified outlier straight to the Ideas board — for when the topic
  // is obviously worth beating and you don't need Claude to package it first.
  // The idea keeps the outlier's real numbers as evidence; retitle it later.
  async function addOutlierToIdeas(o: ScannedOutlier) {
    setOutlierAddStatus(prev => ({ ...prev, [o.videoId]: 'adding' }))
    const months = Math.max(0, Math.round((Date.now() - new Date(o.publishedAt).getTime()) / (30 * 24 * 3600 * 1000)))
    const idea: FoundIdea = {
      title: o.title,
      description: `Beat this verified outlier (found via "${o.query}"): ${o.url} — same proven topic, sharper SoundMoney version (better packaging + the prescriptive savings ending).`,
      video_type: '', format: 'Long-form', unique_angle: '', pattern: '', comment_gap: '', why_now: '',
      rationale: 'Added directly from the YouTube Data API scan — numbers are real, packaging/angle still to be worked out.',
      researched: true,
      outlier: {
        video_title: o.title, channel: o.channel,
        views: o.views.toLocaleString() + ' views',
        subscribers: o.subscribers.toLocaleString() + ' subscribers',
        view_to_sub_ratio: `${o.ratio}:1`,
        recency: months <= 1 ? 'about a month ago' : `${months} months ago`,
        packaging_gap: '',
        channel_country: o.channelCountry ?? '',
      },
    }
    const ok = await onAdd(idea)
    setOutlierAddStatus(prev => ({ ...prev, [o.videoId]: ok ? 'added' : 'error' }))
  }

  // Same as addOutlierToIdeas but for a velocity candidate — the note is
  // explicit that this is a fast-growth signal on a channel of whatever
  // size it happened to be, not a small-channel ratio outlier, so the
  // caveat travels with the idea onto the board.
  async function addVelocityToIdeas(o: ScannedOutlier) {
    setVelocityAddStatus(prev => ({ ...prev, [o.videoId]: 'adding' }))
    const months = Math.max(0, Math.round((Date.now() - new Date(o.publishedAt).getTime()) / (30 * 24 * 3600 * 1000)))
    const idea: FoundIdea = {
      title: o.title,
      description: `Beat this verified velocity candidate (found via "${o.query}"): ${o.url} — gained ${o.views.toLocaleString()} views in ${o.ageDays} days (~${o.viewsPerDay.toLocaleString()}/day) on a ${o.subscribers.toLocaleString()}-subscriber channel. Same proven topic, sharper SoundMoney version.`,
      video_type: '', format: 'Long-form', unique_angle: '', pattern: '', comment_gap: '', why_now: '',
      rationale: 'Added directly from the YouTube Data API scan — real numbers, but this is a velocity signal (big views fast, not a small-channel ratio outlier), so weigh replicability before committing.',
      researched: true,
      outlier: {
        video_title: o.title, channel: o.channel,
        views: o.views.toLocaleString() + ' views',
        subscribers: o.subscribers.toLocaleString() + ' subscribers',
        view_to_sub_ratio: `${o.ratio}:1`,
        recency: months <= 1 ? 'about a month ago' : `${months} months ago`,
        packaging_gap: '',
        signal_type: 'velocity',
        velocity_note: `${o.subscribers.toLocaleString()}-subscriber channel — some of this pull may be channel authority/algorithm reach rather than pure topic demand; check whether the topic shows up elsewhere too before betting on it.`,
        channel_country: o.channelCountry ?? '',
      },
    }
    const ok = await onAdd(idea)
    setVelocityAddStatus(prev => ({ ...prev, [o.videoId]: ok ? 'added' : 'error' }))
  }

  async function run() {
    setLoading(true)
    setMsg(null)
    const res = await onGenerate(
      modelKey, webSearch, count,
      scanResults && scanResults.length > 0 ? scanResults : undefined,
      scanVelocity && scanVelocity.length > 0 ? scanVelocity : undefined,
    )
    if ('error' in res) setMsg(res.error)
    else setIdeas(res.ideas)
    setLoading(false)
  }

  async function addOne(idx: number, idea: FoundIdea) {
    setAddStatus(prev => ({ ...prev, [idx]: 'adding' }))
    const ok = await onAdd(idea)
    setAddStatus(prev => ({ ...prev, [idx]: ok ? 'added' : 'error' }))
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'34rem', maxHeight:'85vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:'0.4rem' }}><Sparkles size={14} color={C.cyan}/>Find Ideas</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <p style={{ fontSize:'0.76rem', color:C.muted, margin:'0 0 1rem', lineHeight:1.5 }}>
          Generates new ideas that pass the full 7-step checklist, fit the channel&apos;s niche, and are titled so YouTube can tell what they&apos;re about — not just clever hooks with no clear topic. Grounded in real search where possible, checked against your existing ideas so it doesn&apos;t repeat them, and judged from the identity of someone who already owns a successful channel here — confident and decisive, not hedged.
        </p>

        <div style={{ display:'flex', gap:'0.6rem', marginBottom:'0.875rem', flexWrap:'wrap' as const }}>
          <div style={{ flex:'1 1 12rem' }}>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>Model</label>
            <select
              value={modelKey} onChange={e => setModelKey(e.target.value)} disabled={loading}
              title={CONSULT_MODELS.find(m => m.value === modelKey)?.hint}
              style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600, outline:'none', boxSizing:'border-box' as const, cursor:loading?'not-allowed':'pointer' }}
            >
              {CONSULT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0.3rem 0 0', lineHeight:1.4 }}>
              Recommended: Sonnet or Opus for idea generation &mdash; weighing outlier evidence and finding a real alpha angle needs stronger reasoning than Haiku gives. Save Haiku for quick validation checks.
            </p>
          </div>
          <div style={{ width:'6rem' }}>
            <label style={{ display:'block', fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'0.35rem' }}>How many</label>
            <select
              value={count} onChange={e => setCount(Number(e.target.value))} disabled={loading}
              style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:600, outline:'none', boxSizing:'border-box' as const, cursor:loading?'not-allowed':'pointer' }}
            >
              {[3, 5, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', cursor:loading?'not-allowed':'pointer', fontSize:'0.76rem', color:C.sec }}>
          <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} disabled={loading} style={{ width:'0.9rem', height:'0.9rem' }}/>
          Search the web while generating (finds real outlier videos and comment gaps to ground each idea in)
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem', cursor:scanning?'not-allowed':'pointer', fontSize:'0.76rem', color:C.sec }}>
          <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} disabled={scanning} style={{ width:'0.9rem', height:'0.9rem' }}/>
          US audience only when scanning &mdash; biases search toward the US region and keeps only channels that declared "US" as their country. Note: this also drops channels that never declared a country at all, since YouTube doesn&apos;t expose real viewer geography for channels you don&apos;t own.
        </label>

        {/* ── YouTube Data API scan — exact numbers before Claude judges ── */}
        <div style={{ padding:'0.75rem', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'0.75rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' as const }}>
            <p style={{ fontSize:'0.7rem', color:C.sec, margin:0, lineHeight:1.45, flex:'1 1 16rem' }}>
              <strong style={{ color:C.green }}>Scan YouTube first (recommended)</strong> — pulls real view counts and subscriber ratios from the YouTube Data API for the channel&apos;s seed topics. Surfaces two kinds of evidence: verified <strong style={{ color:C.text }}>ratio outliers</strong> (small channel, topic beat its own audience) and verified <strong style={{ color:C.text }}>velocity candidates</strong> (big views fast on any channel size, including large ones that wouldn&apos;t clear the ratio bar) — both get handed to Claude as real evidence instead of estimates.
            </p>
            <div style={{ display:'flex', gap:'0.35rem' }}>
              <button onClick={() => setShowQueries(v => !v)} disabled={scanning} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.7rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:showQueries?C.text:C.sec, cursor:scanning?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const }}>
                <ChevronDown size={11} style={{ transform: showQueries ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>Topics ({parsedQueries.length})
              </button>
              <button onClick={scan} disabled={scanning || loading} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.8rem', background:C.card, border:'1px solid rgba(0,255,136,0.3)', borderRadius:'0.5rem', color:C.green, cursor:(scanning||loading)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const, opacity:(scanning||loading)?0.5:1 }}>
                <Zap size={11}/>{scanning ? 'Scanning…' : scanResults ? 'Re-scan' : 'Scan YouTube'}
              </button>
            </div>
          </div>
          {showQueries && (
            <div style={{ marginTop:'0.6rem' }}>
              <label style={{ display:'block', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.muted, marginBottom:'0.3rem' }}>
                Search topics — one per line, first 8 used per scan (each costs ~200 of the 10,000 daily API units). Saved in this browser.
              </label>
              <textarea
                value={queryText} onChange={e => saveQueries(e.target.value)} disabled={scanning}
                rows={6}
                style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', lineHeight:1.5, outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }}
              />
              <div style={{ display:'flex', gap:'0.35rem', marginTop:'0.3rem' }}>
                <button onClick={suggestTopics} disabled={scanning || suggesting} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.25rem 0.6rem', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.4rem', color:C.cyan, cursor:(scanning||suggesting)?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.64rem', fontWeight:700, opacity:(scanning||suggesting)?0.5:1 }}>
                  <Sparkles size={10}/>{suggesting ? 'Suggesting…' : 'Suggest topics (AI)'}
                </button>
                <button onClick={() => saveQueries(OUTLIER_SEED_QUERIES.join('\n'))} disabled={scanning} style={{ padding:'0.25rem 0.6rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.muted, cursor:scanning?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.64rem', fontWeight:600 }}>
                  Reset to channel defaults
                </button>
              </div>
            </div>
          )}
          {scanMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.5rem 0 0', lineHeight:1.4 }}>{scanMsg}</p>}
          {scanResults && scanResults.length > 0 && (
            <div style={{ marginTop:'0.6rem' }}>
              <p style={{ fontSize:'0.66rem', color:C.green, margin:'0 0 0.35rem', fontWeight:700 }}>
                {scanResults.length} verified outliers found — they&apos;ll be handed to Claude as evidence when you hit Find ideas, or add one straight to the board.
              </p>
              <div style={{ maxHeight:'11rem', overflowY:'auto' as const, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {scanResults.map(o => {
                  const st = outlierAddStatus[o.videoId]
                  return (
                    <div key={o.videoId} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.25rem 0.4rem', background:C.card, borderRadius:'0.35rem', border:'1px solid '+C.border }}>
                      <a href={o.url} target="_blank" rel="noreferrer" style={{ flex:1, fontSize:'0.66rem', color:C.sec, textDecoration:'none', lineHeight:1.4 }}>
                        <span style={{ color:C.text, fontWeight:600 }}>{o.title}</span>
                        {' '}— {o.channel}{o.channelCountry && <span style={{ color:o.channelCountry==='US'?C.green:C.muted, fontWeight:700 }}> [{o.channelCountry}]</span>} · {o.views.toLocaleString()} views / {o.subscribers.toLocaleString()} subs · <span style={{ color:C.cyan, fontWeight:700 }}>{o.ratio}:1</span>
                      </a>
                      <button
                        onClick={() => addOutlierToIdeas(o)}
                        disabled={st === 'adding' || st === 'added'}
                        title="Add this topic to the Ideas board with its verified numbers attached"
                        style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexShrink:0, padding:'0.25rem 0.5rem', background: st === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(st === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.35rem', color: st === 'added' ? '#22c55e' : C.amber, cursor:(st === 'adding' || st === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                      >
                        {st === 'added' ? <Check size={10}/> : <Plus size={10}/>}
                        {st === 'adding' ? 'Adding…' : st === 'added' ? 'Added' : 'Add'}
                      </button>
                      {st === 'error' && <span style={{ fontSize:'0.6rem', color:C.red }}>failed</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {scanVelocity && scanVelocity.length > 0 && (
            <div style={{ marginTop:'0.75rem', paddingTop:'0.65rem', borderTop:'1px solid '+C.border }}>
              <p style={{ fontSize:'0.66rem', color:C.amber, margin:'0 0 0.3rem', fontWeight:700 }}>
                {scanVelocity.length} velocity candidates — big views fast, any channel size
              </p>
              <p style={{ fontSize:'0.64rem', color:C.muted, margin:'0 0 0.35rem', lineHeight:1.4 }}>
                Didn&apos;t clear the view:sub ratio bar (often because the channel is large) but still gained a lot of views in a short window — worth investigating rather than dismissing, just weigh channel size before betting on it.
              </p>
              <div style={{ maxHeight:'11rem', overflowY:'auto' as const, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {scanVelocity.map(o => {
                  const st = velocityAddStatus[o.videoId]
                  return (
                    <div key={o.videoId} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.25rem 0.4rem', background:C.card, borderRadius:'0.35rem', border:'1px solid '+C.border }}>
                      <a href={o.url} target="_blank" rel="noreferrer" style={{ flex:1, fontSize:'0.66rem', color:C.sec, textDecoration:'none', lineHeight:1.4 }}>
                        <span style={{ color:C.text, fontWeight:600 }}>{o.title}</span>
                        {' '}— {o.channel}{o.channelCountry && <span style={{ color:o.channelCountry==='US'?C.green:C.muted, fontWeight:700 }}> [{o.channelCountry}]</span>} ({o.subscribers.toLocaleString()} subs) · {o.views.toLocaleString()} views in {o.ageDays}d · <span style={{ color:C.amber, fontWeight:700 }}>~{o.viewsPerDay.toLocaleString()}/day</span>
                      </a>
                      <button
                        onClick={() => addVelocityToIdeas(o)}
                        disabled={st === 'adding' || st === 'added'}
                        title="Add this topic to the Ideas board — flagged as a velocity signal, not a ratio outlier"
                        style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexShrink:0, padding:'0.25rem 0.5rem', background: st === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(st === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.35rem', color: st === 'added' ? '#22c55e' : C.amber, cursor:(st === 'adding' || st === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                      >
                        {st === 'added' ? <Check size={10}/> : <Plus size={10}/>}
                        {st === 'adding' ? 'Adding…' : st === 'added' ? 'Added' : 'Add'}
                      </button>
                      {st === 'error' && <span style={{ fontSize:'0.6rem', color:C.red }}>failed</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Hook Lab — analyse the scanned outliers' hook patterns ── */}
        {scanResults && scanResults.length > 0 && (
          <div style={{ padding:'0.75rem', background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.18)', borderRadius:'0.75rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.7rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.45 }}>
              <strong style={{ color:C.orange }}>Hook Lab</strong> — read the winning hook patterns across the {scanResults.length} outliers, then generate hooks for your topic in those shapes. Optional topic below (leave blank for reusable templates).
            </p>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              <input
                value={hookTopic} onChange={e => setHookTopic(e.target.value)} disabled={hookLoading}
                placeholder="Your video topic, e.g. why the gold standard was killed"
                style={{ flex:'1 1 14rem', padding:'0.45rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.72rem', outline:'none', boxSizing:'border-box' as const }}
              />
              <button onClick={runHookAnalysis} disabled={hookLoading} style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.45rem 0.85rem', background:C.card, border:'1px solid rgba(249,115,22,0.35)', borderRadius:'0.5rem', color:C.orange, cursor:hookLoading?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' as const, opacity:hookLoading?0.5:1 }}>
                <Zap size={11}/>{hookLoading ? 'Analysing…' : 'Analyse hooks'}
              </button>
            </div>
            {hookMsg && <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.5rem 0 0', lineHeight:1.4 }}>{hookMsg}</p>}
            {hookResult && (
              <div style={{ marginTop:'0.7rem', display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                <div>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.orange, margin:'0 0 0.35rem' }}>Recurring winning patterns</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {hookResult.patterns.map((p, i) => (
                      <div key={i} style={{ padding:'0.4rem 0.55rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.45rem' }}>
                        <p style={{ fontSize:'0.7rem', color:C.text, margin:0, fontWeight:700 }}>{p.pattern}</p>
                        <p style={{ fontSize:'0.66rem', color:C.sec, margin:'0.1rem 0 0', lineHeight:1.4 }}>{p.why_it_works}</p>
                        {p.example && <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0.15rem 0 0', fontStyle:'italic' }}>e.g. &ldquo;{p.example}&rdquo;</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.orange, margin:'0 0 0.35rem' }}>{hookTopic.trim() ? 'Hooks for your topic' : 'Reusable hook templates'}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {hookResult.hooks.map((h, i) => (
                      <div key={i} style={{ padding:'0.4rem 0.55rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.45rem' }}>
                        <p style={{ fontSize:'0.72rem', color:C.text, margin:0, lineHeight:1.4 }}>&ldquo;{h.hook}&rdquo;</p>
                        <div style={{ display:'flex', gap:'0.3rem', marginTop:'0.2rem', flexWrap:'wrap' as const }}>
                          {h.pattern && <span style={{ fontSize:'0.58rem', color:C.orange, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:'9999px', padding:'0.05rem 0.35rem' }}>{h.pattern}</span>}
                          {h.emotion && <span style={{ fontSize:'0.58rem', color:C.pink, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.2)', borderRadius:'9999px', padding:'0.05rem 0.35rem' }}>{h.emotion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {msg && <p style={{ fontSize:'0.72rem', color:C.amber, margin:'0 0 0.75rem', lineHeight:1.4 }}>{msg}</p>}

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', color:C.muted, padding:'1.5rem 0', justifyContent:'center' }}>
            <div style={{ width:'16px', height:'16px', border:'2px solid '+C.muted, borderTopColor:C.cyan, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            {webSearch ? 'Searching YouTube and drafting ideas…' : 'Drafting ideas…'}
          </div>
        )}

        {ideas && !loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1rem' }}>
            {ideas.map((idea, i) => {
              const status = addStatus[i]
              return (
                <div key={i} style={{ padding:'0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem', marginBottom:'0.3rem' }}>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:0, flex:1, lineHeight:1.4 }}>{idea.title}</p>
                    <button
                      onClick={() => addOne(i, idea)}
                      disabled={status === 'adding' || status === 'added'}
                      style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexShrink:0, padding:'0.3rem 0.6rem', background: status === 'added' ? 'rgba(34,197,94,0.12)' : 'rgba(255,184,0,0.1)', border:'1px solid '+(status === 'added' ? 'rgba(34,197,94,0.4)' : 'rgba(255,184,0,0.3)'), borderRadius:'0.4rem', color: status === 'added' ? '#22c55e' : C.amber, cursor: (status === 'adding' || status === 'added') ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.66rem', fontWeight:700, whiteSpace:'nowrap' as const }}
                    >
                      {status === 'added' ? <Check size={11}/> : <Plus size={11}/>}
                      {status === 'adding' ? 'Adding…' : status === 'added' ? 'Added' : 'Add to Ideas'}
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' as const, marginBottom:'0.35rem' }}>
                    {idea.pattern && <span style={{ fontSize:'0.6rem', color:C.orange, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:'9999px', padding:'0.1rem 0.4rem', fontWeight:700 }}>{idea.pattern}</span>}
                    {idea.video_type && <span style={{ fontSize:'0.6rem', color:C.purple, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{idea.video_type}</span>}
                    {idea.format && <span style={{ fontSize:'0.6rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{idea.format}</span>}
                    {idea.researched
                      ? <span style={{ fontSize:'0.6rem', color:'#22c55e', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>searched</span>
                      : <span style={{ fontSize:'0.6rem', color:C.amber, background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>pattern-based</span>}
                  </div>
                  <p style={{ fontSize:'0.74rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.4 }}>{idea.description}</p>

                  {/* Opportunity signal — the Hummus outlier breakdown: high views on a
                      low-subscriber channel with weak packaging is what makes this an
                      opportunity, not just a topic guess. Shown plainly so it's obvious
                      what evidence (or lack of it) each idea actually rests on. */}
                  <div style={{ padding:'0.55rem 0.65rem', background: idea.outlier ? (idea.outlier.signal_type === 'velocity' ? 'rgba(255,184,0,0.05)' : 'rgba(0,212,255,0.05)') : 'rgba(255,184,0,0.05)', border:'1px solid '+(idea.outlier ? (idea.outlier.signal_type === 'velocity' ? 'rgba(255,184,0,0.22)' : 'rgba(0,212,255,0.18)') : 'rgba(255,184,0,0.18)'), borderRadius:'0.5rem', marginBottom:'0.5rem' }}>
                    <p style={{ fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color: idea.outlier ? (idea.outlier.signal_type === 'velocity' ? C.amber : C.cyan) : C.amber, margin:'0 0 0.35rem' }}>
                      {idea.outlier?.signal_type === 'velocity' ? 'Opportunity signal — velocity (secondary)' : 'Opportunity signal'}
                    </p>
                    {idea.outlier ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                        <p style={{ fontSize:'0.72rem', color:C.text, margin:0, lineHeight:1.4 }}>
                          <strong>&#8220;{idea.outlier.video_title}&#8221;</strong> &mdash; {idea.outlier.channel}
                        </p>
                        <p style={{ fontSize:'0.68rem', color:C.sec, margin:0, lineHeight:1.4 }}>
                          {idea.outlier.views} on a {idea.outlier.subscribers} channel &nbsp;<span style={{ color: idea.outlier.signal_type === 'velocity' ? C.amber : C.cyan, fontWeight:700 }}>({idea.outlier.view_to_sub_ratio})</span>
                          {idea.outlier.recency && <span style={{ color:C.muted }}> &middot; {idea.outlier.recency}</span>}
                        </p>
                        {idea.outlier.signal_type === 'velocity' && idea.outlier.velocity_note && (
                          <p style={{ fontSize:'0.68rem', color:C.amber, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ fontWeight:700 }}>Caveat:</span> {idea.outlier.velocity_note}
                          </p>
                        )}
                        <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                          <span style={{ color:C.amber, fontWeight:700 }}>Packaging gap:</span> {idea.outlier.packaging_gap}
                        </p>
                        {idea.comment_gap && (
                          <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ color:C.teal, fontWeight:700 }}>Audience gap:</span> {idea.comment_gap}
                          </p>
                        )}
                        {idea.why_now && (
                          <p style={{ fontSize:'0.68rem', color:C.sec, margin:'0.15rem 0 0', lineHeight:1.4 }}>
                            <span style={{ color:C.green, fontWeight:700 }}>Why now:</span> {idea.why_now}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.4 }}>
                        No qualifying outlier found (high views + low subs + weak packaging) — this idea rests on pattern/judgment, not a confirmed precedent. Worth a closer manual check before committing.
                      </p>
                    )}
                  </div>

                  <p style={{ fontSize:'0.68rem', color:C.purple, margin:'0 0 0.3rem', lineHeight:1.4 }}>&#9889; {idea.unique_angle}</p>
                  <p style={{ fontSize:'0.66rem', color:C.muted, margin:0, lineHeight:1.4, fontStyle:'italic' }}>{idea.rationale}</p>
                  {status === 'error' && <p style={{ fontSize:'0.64rem', color:C.red, margin:'0.3rem 0 0' }}>Couldn&apos;t save — try again.</p>}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', flexWrap:'wrap' as const }}>
          <button onClick={onClose} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' }}>Close</button>
          <button onClick={run} disabled={loading} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.cyan, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, opacity:loading?0.5:1 }}>
            <Sparkles size={13}/>{ideas ? 'Find more' : 'Find ideas'}
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
function PipelineCard({ item, stats, onMove, onSaveRevenue, onToggleFocus, focusAtCap }: { item:ContentItem; stats?: YtStats; onMove:()=>void; onSaveRevenue:(note:string)=>void; onToggleFocus:()=>void; focusAtCap:boolean }) {
  const s = stageStyle(item.pipeline_stage)
  const [revenue, setRevenue] = useState(item.revenue_note ?? '')
  const [scriptUrl, setScriptUrl] = useState(item.script_url ?? '')
  const [driveUrl, setDriveUrl] = useState(item.drive_url ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(item.youtube_url ?? '')

  async function saveLink(field: 'script_url' | 'drive_url' | 'youtube_url', value: string) {
    await supabase.from('content_items').update({ [field]: value.trim() || null }).eq('id', item.id)
  }
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
    const { systemPrompt, userPrompt } = buildStageDraftPrompt(item, sop, { existingNote: note })
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

  // ── One-click production pack ─────────────────────────────────────────────
  // Runs the whole AI-draftable chain (Research → Trifecta → Script → Assets
  // → Thumbnail & SEO) in one go, each stage building on the ones before it.
  // Stages that already have a saved note are kept and used as context, never
  // overwritten — so re-running after edits only fills what's still empty.
  // The drafts land in each stage's note (and the focus session), leaving the
  // creator to review, rewrite in their own voice, record and edit.
  const [autoStage, setAutoStage] = useState<string | null>(null)
  const [autoDone, setAutoDone] = useState<string[]>([])
  const [autoMsg, setAutoMsg] = useState<string | null>(null)

  async function autoDraftAll() {
    setAutoMsg(null)
    setAutoDone([])
    const prior: { title: string; output: string }[] = []
    try {
      for (const { sopId, label } of AUTO_DRAFT_STAGES) {
        const stageSop = SOPS.find(sp => sp.id === sopId)
        if (!stageSop) continue
        setAutoStage(label)
        const { output: existing } = await getStageNote(item.id, sopId)
        if (existing?.trim()) {
          prior.push({ title: stageSop.title, output: existing })
          setAutoDone(d => [...d, label + ' ✓ (kept your version)'])
          continue
        }
        const { systemPrompt, userPrompt } = buildStageDraftPrompt(item, stageSop, { priorStages: prior })
        const res = await fetch('/api/content/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Research gets live web search for real stats/sources; the rest
          // build on it. Sonnet for quality — this chain is the video.
          body: JSON.stringify({ systemPrompt, userPrompt, model: 'claude-sonnet-5', webSearch: sopId === '02' }),
        })
        const data = await res.json()
        if (data?.error) { setAutoMsg(`Stopped at ${label}: ` + JSON.stringify(data.error)); return }
        const raw = (data?.content ?? [])
          .filter((b: { type: string; text?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text ?? '')
          .join('\n').trim()
        if (!raw) { setAutoMsg(`Stopped at ${label}: empty response.`); return }
        const { error } = await saveStageNote(item.id, sopId, raw)
        if (error) { setAutoMsg(`Stopped at ${label}: ` + error); return }
        prior.push({ title: stageSop.title, output: raw })
        setAutoDone(d => [...d, label + ' ✓'])
        // If the card's currently-open stage just got drafted, show it.
        if (sop && sop.id === sopId) { setNote(raw); setNoteLoaded(true) }
      }
      setAutoMsg('Production pack ready — open each stage, edit into your voice, tick the checklist, then record.')
    } catch (e) {
      setAutoMsg('Auto-draft failed: ' + String(e))
    } finally {
      setAutoStage(null)
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
        {item.script_url && <a href={item.script_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.cyan, background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#128221; Script</a>}
        {item.drive_url && <a href={item.drive_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.green, background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#128193; Assets</a>}
        {item.youtube_url && <a href={item.youtube_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.6rem', color:C.red, background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.2)', borderRadius:'9999px', padding:'0.1rem 0.4rem', textDecoration:'none' }}>&#9654; Watch</a>}
      </div>
      {stats && (
        <p style={{ fontSize:'0.66rem', color:C.sec, margin:'0 0 0.4rem', fontWeight:600 }}>
          &#128200; {stats.views.toLocaleString()} views &middot; {stats.likes.toLocaleString()} likes &middot; {stats.comments.toLocaleString()} comments
        </p>
      )}
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
        {!isPostPublished && (
          <button
            onClick={autoDraftAll} disabled={!!autoStage}
            title="Draft the full production pack — Research, Trifecta, Script, Assets, Thumbnail & SEO — each stage building on the last. Stages you've already written are kept."
            style={{ padding:'0.3rem 0.5rem', background: autoStage ? C.surface : 'rgba(0,255,136,0.08)', border:'1px solid '+(autoStage ? C.border : 'rgba(0,255,136,0.3)'), borderRadius:'0.5rem', color: autoStage ? C.muted : C.green, cursor: autoStage ? 'default' : 'pointer', fontFamily:'inherit', fontSize:'0.65rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
            <Zap size={10}/>{autoStage ? `Drafting ${autoStage}…` : 'Produce'}
          </button>
        )}
        {sop && (
          <button onClick={() => setExpanded(e => !e)} style={{ padding:'0.3rem 0.5rem', background: expanded ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)', border:'1px solid '+(expanded ? 'rgba(139,92,246,0.3)' : C.border), borderRadius:'0.5rem', color: expanded ? C.purple : C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
            SOP &amp; AI <ChevronDown size={10} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
          </button>
        )}
      </div>
      {(autoDone.length > 0 || autoMsg) && (
        <div style={{ marginTop:'0.4rem', padding:'0.4rem 0.5rem', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'0.5rem' }}>
          {autoDone.map((d, i) => <p key={i} style={{ fontSize:'0.62rem', color:C.sec, margin:0, lineHeight:1.5 }}>{d}</p>)}
          {autoMsg && <p style={{ fontSize:'0.62rem', color: autoMsg.startsWith('Stopped') || autoMsg.startsWith('Auto-draft failed') ? C.amber : C.green, margin: autoDone.length ? '0.2rem 0 0' : 0, lineHeight:1.5, fontWeight:600 }}>{autoMsg}</p>}
        </div>
      )}

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

          {/* Per-video links — script doc, Drive asset folder, published video */}
          <div style={{ marginTop:'0.5rem', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            {([
              { label:'Script link', value:scriptUrl, set:setScriptUrl, field:'script_url' as const, ph:'Google Doc / Drive link to the script' },
              { label:'Asset folder', value:driveUrl, set:setDriveUrl, field:'drive_url' as const, ph:'Google Drive folder with VO, b-roll, thumbnail' },
              { label:'YouTube URL', value:youtubeUrl, set:setYoutubeUrl, field:'youtube_url' as const, ph:'Published video link — enables live stats on this card' },
            ]).map(l => (
              <div key={l.field} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <span style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:C.muted, width:'5.2rem', flexShrink:0 }}>{l.label}</span>
                <input
                  value={l.value} onChange={e => l.set(e.target.value)} onBlur={() => saveLink(l.field, l.value)}
                  placeholder={l.ph}
                  style={{ flex:1, padding:'0.3rem 0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.4rem', color:C.text, fontFamily:'inherit', fontSize:'0.64rem', outline:'none', boxSizing:'border-box' as const }}
                />
              </div>
            ))}
          </div>
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
  const [showFindIdeas, setShowFindIdeas] = useState(false)
  const [focusMsg,   setFocusMsg]   = useState<string | null>(null)
  const [validatingItem, setValidatingItem] = useState<ContentItem | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [ideaLog, setIdeaLog] = useState<IdeaLog | null>(null)
  const [ideaLogMsg, setIdeaLogMsg] = useState<string | null>(null)
  const [weeklyTargets, setWeeklyTargets] = useState<{ id:string; label:string; tracking:string }[]>([])
  const [weeklyPicks, setWeeklyPicks] = useState<Record<string, string>>({}) // target_id -> content_item_id

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

  // ── This week's Long-form / Short pick ─────────────────────────────────────
  // Companion to the home page's auto-counted Weekly Targets (Shorts/Long-form
  // count published-this-week already). This lets you SELECT which specific
  // pipeline item you're actually committing to ship this week, so the home
  // page can show a title, not just a bare count.
  function weekStartStr(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const r = new Date(d)
    r.setDate(r.getDate() + diff)
    return r.getFullYear() + '-' + String(r.getMonth()+1).padStart(2,'0') + '-' + String(r.getDate()).padStart(2,'0')
  }
  const weekStart = weekStartStr()

  useEffect(() => {
    (async () => {
      const { data: targets } = await supabase.from('weekly_targets')
        .select('id,label,tracking').eq('active', true).in('tracking', ['auto_shorts', 'auto_longform'])
      setWeeklyTargets(targets ?? [])
      if (targets && targets.length > 0) {
        const { data: picks } = await supabase.from('weekly_target_picks')
          .select('target_id,content_item_id').eq('week_start', weekStart).in('target_id', targets.map(t => t.id))
        const map: Record<string, string> = {}
        for (const p of (picks ?? []) as { target_id:string; content_item_id:string|null }[]) if (p.content_item_id) map[p.target_id] = p.content_item_id
        setWeeklyPicks(map)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function setWeeklyPick(targetId: string, contentItemId: string) {
    setWeeklyPicks(prev => ({ ...prev, [targetId]: contentItemId }))
    await supabase.from('weekly_target_picks').upsert(
      { target_id: targetId, week_start: weekStart, content_item_id: contentItemId || null, updated_at: new Date().toISOString() },
      { onConflict: 'target_id,week_start' }
    )
  }

  // ── Priority order (drag-rankable) ─────────────────────────────────────────
  // Same pattern as Vault/Tasks/Etsy/X/Personal: cached in localStorage first,
  // authoritative copy in priority_lists (key 'youtube_pipeline_priority'),
  // synced on every reorder. Covers the whole pipeline (ideas through
  // pre-Live) — Live/Post-Published items don't need ranking so they're
  // excluded from the pool.
  const CONTENT_PRIORITY_KEY = 'youtube_pipeline_priority'
  const [cPriorityOrder, setCPriorityOrder] = useState<string[]>([])
  const [cDragId, setCDragId]     = useState<string|null>(null)
  const [cDragOver, setCDragOver] = useState<string|null>(null)
  const [cDragFrom, setCDragFrom] = useState<'unassigned'|'priority'|null>(null)

  useEffect(() => {
    let cLsLoaded = false
    let cLocalIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_content')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setCPriorityOrder(ids); cLsLoaded = true; cLocalIds = ids } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', CONTENT_PRIORITY_KEY).single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setCPriorityOrder(ids)
        try { localStorage.setItem('fs_p_content', JSON.stringify(ids)) } catch {}
      } else if (cLsLoaded) {
        supabase.from('priority_lists').upsert({ key: CONTENT_PRIORITY_KEY, ordered_ids: cLocalIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
  }, [])

  function saveContentPriority(order: string[]) {
    const y = window.scrollY
    setCPriorityOrder(order)
    try { localStorage.setItem('fs_p_content', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: CONTENT_PRIORITY_KEY, ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  // ── Live YouTube stats for published items ────────────────────────────────
  // One batched videos.list call (1 quota unit) for every item with a
  // youtube_url — keeps views/likes/comments visible on the cards without
  // opening Studio. Refreshes on page load.
  const [ytStats, setYtStats] = useState<Record<string, YtStats>>({})
  useEffect(() => {
    const ids = [...new Set(items.map(i => extractYouTubeId(i.youtube_url)).filter((v): v is string => !!v))]
    if (ids.length === 0) return
    fetch('/api/content/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: ids }),
    })
      .then(r => r.json())
      .then(data => { if (data?.stats) setYtStats(data.stats) })
      .catch(() => { /* stats are a nice-to-have — never block the page on them */ })
  }, [items])

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

  // Generates new ideas from scratch — same checklist + research requirement
  // as validation, just run before an idea exists rather than after.
  async function runFindIdeas(model: string, webSearch: boolean, count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[]): Promise<{ ideas: FoundIdea[] } | { error: string }> {
    const existingTitles = items.map(i => i.title).slice(0, 60)
    const { systemPrompt, userPrompt } = buildFindIdeasPrompt(existingTitles, count, scannedOutliers, scannedVelocity)
    try {
      const res = await fetch('/api/content/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, model, webSearch }),
      })
      const data = await res.json()
      if (data?.error) return { error: 'API error: ' + JSON.stringify(data.error) }
      const raw = (data?.content ?? [])
        .filter((b: { type: string; text?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n')
        .trim()
      if (!raw) return { error: 'Empty response from Claude.' }
      const parsed = parseModelJson<{ ideas: FoundIdea[] }>(raw)
      return { ideas: (parsed.ideas ?? []).filter(i => i?.title) }
    } catch (e) {
      return { error: 'Generation failed: ' + String(e) }
    }
  }

  async function addFoundIdea(idea: FoundIdea): Promise<boolean> {
    // ContentItem has no dedicated outlier field, so fold the opportunity
    // breakdown into unique_angle — it's exactly the "why this has an edge"
    // evidence that field is for, and keeps it visible once the idea is a
    // normal Ideas Bank row.
    const outlierNote = idea.outlier
      ? `${idea.outlier.signal_type === 'velocity' ? 'Velocity signal' : 'Outlier'}: "${idea.outlier.video_title}" (${idea.outlier.channel}) — ${idea.outlier.views} on a ${idea.outlier.subscribers} channel (${idea.outlier.view_to_sub_ratio} view:sub)${idea.outlier.recency ? ', ' + idea.outlier.recency : ''}. Packaging gap: ${idea.outlier.packaging_gap}${idea.outlier.velocity_note ? ' Caveat: ' + idea.outlier.velocity_note : ''}`
      : null
    const patternNote = idea.pattern ? `Pattern: ${idea.pattern}` : null
    const gapNote = idea.comment_gap ? `Comment gap: ${idea.comment_gap}` : null
    const whyNowNote = idea.why_now ? `Why now: ${idea.why_now}` : null
    const uniqueAngle = [idea.unique_angle, patternNote, outlierNote, gapNote, whyNowNote].filter(Boolean).join('\n\n') || null
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: idea.title,
        pipeline_stage: '💡 Idea',
        format: idea.format || 'Long-form',
        notes: idea.description || null,
        video_type: idea.video_type || null,
        unique_angle: uniqueAngle,
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

  async function saveIdeaField(item: ContentItem, patch: Partial<Pick<ContentItem, 'title' | 'notes' | 'format' | 'video_type' | 'unique_angle'>>) {
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
      const parsed = parseModelJson<ValidationResult>(raw)
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
                  { v:'priority', icon:<ArrowUpDown size={12}/>,label:'Priority' },
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
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setShowFindIdeas(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'0.625rem', color:C.cyan, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                  <Sparkles size={13}/>Find ideas
                </button>
                <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 1rem', background:'rgba(255,184,0,0.1)', border:'1px solid rgba(255,184,0,0.3)', borderRadius:'0.625rem', color:C.amber, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                  <Plus size={13}/>Add idea
                </button>
              </div>
            </div>

            <div style={{ padding:'0.75rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.75rem', marginBottom:'1.25rem' }}>
              <p style={{ fontSize:'0.72rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                <strong style={{ color:C.amber }}>Idea technique:</strong> combine two popular subjects together and ask what the overlap looks like &mdash; e.g. <em>gold standard</em> + <em>money</em> &rarr; &ldquo;What is the gold standard, and how to create money?&rdquo; Two proven topics collide into one angle nobody else has made.
              </p>
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
                      {['Focus','Title','Type','Format','Alpha (unique angle)','Notes / Angle','Added','Actions'].map(h => (
                        <th key={h} style={{ padding:'0.5rem 0.875rem', textAlign:'left' as const, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.muted, whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map(item => (
                      <tr key={item.id} style={{ borderBottom:'1px solid '+C.border+'60' }}>
                        <td style={{ padding:'0.75rem 0.875rem', whiteSpace:'nowrap' as const }}>
                          <FocusStar active={item.is_active_focus} atCap={focusCount >= 2} onToggle={() => toggleFocus(item)}/>
                        </td>
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

            {weeklyTargets.length > 0 && (
              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.25rem', padding:'0.75rem 1rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:C.cyan, margin:0, alignSelf:'center', flexShrink:0 }}>This week&apos;s pick:</p>
                {weeklyTargets.map(t => {
                  const wantsShort = t.tracking === 'auto_shorts'
                  const candidates = items.filter(i =>
                    (wantsShort ? (i.format === 'Short' || i.format === 'Both') : (i.format === 'Long-form' || i.format === 'Both')) &&
                    i.pipeline_stage !== '📣 Live' && i.pipeline_stage !== '📊 Post-Published'
                  )
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <span style={{ fontSize:'0.72rem', color:C.sec, flexShrink:0 }}>{t.label}:</span>
                      <select value={weeklyPicks[t.id] ?? ''} onChange={e => setWeeklyPick(t.id, e.target.value)}
                        style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.text, fontFamily:'inherit', fontSize:'0.75rem', padding:'0.3rem 0.5rem', maxWidth:'220px' }}>
                        <option value="">&mdash; none picked &mdash;</option>
                        {candidates.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
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
                    stage.items.map(item => <PipelineCard key={item.id} item={item} stats={ytStats[extractYouTubeId(item.youtube_url) ?? ''] } onMove={() => setMoveTarget(item)} onSaveRevenue={note => saveRevenueNote(item, note)} onToggleFocus={() => toggleFocus(item)} focusAtCap={focusCount >= 2}/>)
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : view === 'priority' ? (() => {

          /* ── PRIORITY (drag to rank) ── */
          const poolItems = items.filter(i => i.pipeline_stage !== '📣 Live' && i.pipeline_stage !== '📊 Post-Published')
          const cValid = cPriorityOrder.filter(id => poolItems.some(i => i.id === id))
          const cAssigned = new Set(cValid)
          const cUnassigned = poolItems.filter(i => !cAssigned.has(i.id))
          return (
            <div>
              <p style={{ fontSize:'0.78rem', color:C.muted, margin:'0 0 1.25rem' }}>
                Drag ideas/pipeline items into rank order &mdash; this is what the home page&apos;s YouTube priority card reads from. Live and Post-Published items aren&apos;t included; they don&apos;t need ranking anymore.
              </p>

              {/* Unassigned zone */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                  {cUnassigned.length > 0 && <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{cUnassigned.length}</span>}
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into priority list to rank</p>
                </div>
                {cUnassigned.length === 0 ? (
                  <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                    <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All items assigned</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                    onDragOver={e => { e.preventDefault(); setCDragOver('unassigned-zone') }}
                    onDrop={e => {
                      e.preventDefault()
                      if (cDragFrom === 'priority' && cDragId) saveContentPriority(cValid.filter(i => i !== cDragId))
                      setCDragId(null); setCDragOver(null); setCDragFrom(null)
                    }}>
                    {cUnassigned.map(item => (
                      <div key={item.id} draggable
                        onDragStart={() => { setCDragId(item.id); setCDragFrom('unassigned') }}
                        onDragEnd={() => { setCDragId(null); setCDragOver(null); setCDragFrom(null) }}
                        style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', cursor:'grab', opacity: cDragId===item.id ? 0.4 : 1 }}>
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.title}</span>
                        {item.format && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                        <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{item.pipeline_stage ?? '💡 Idea'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority list */}
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.orange, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                  <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{cValid.length} items ranked</p>
                </div>
                {cValid.length === 0 ? (
                  <div style={{ padding:'2.5rem 1.5rem', textAlign:'center', border:'2px dashed '+(cDragOver==='c-priority-empty' ? C.orange : C.border), borderRadius:'0.875rem', background: cDragOver==='c-priority-empty' ? 'rgba(249,115,22,0.05)' : 'transparent', transition:'all 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setCDragOver('c-priority-empty') }}
                    onDrop={e => { e.preventDefault(); if (cDragFrom==='unassigned'&&cDragId) saveContentPriority([cDragId]); setCDragId(null); setCDragOver(null); setCDragFrom(null) }}>
                    <p style={{ fontSize:'0.82rem', color:C.muted, margin:0 }}>Drag items here to start ranking</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                    {cValid.map((id, idx) => {
                      const item = poolItems.find(i => i.id === id)
                      if (!item) return null
                      return (
                        <div key={id} draggable
                          onDragStart={() => { setCDragId(id); setCDragFrom('priority') }}
                          onDragEnd={() => { setCDragId(null); setCDragOver(null); setCDragFrom(null) }}
                          onDragOver={e => { e.preventDefault(); setCDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && cDragOver===id) setCDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (cDragFrom==='unassigned'&&cDragId) { const o=[...cValid]; o.splice(idx,0,cDragId); saveContentPriority(o) }
                            else if (cDragFrom==='priority'&&cDragId&&cDragId!==id) { const w=cValid.filter(i=>i!==cDragId); w.splice(w.indexOf(id),0,cDragId); saveContentPriority(w) }
                            setCDragId(null); setCDragOver(null); setCDragFrom(null)
                          }}
                          style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.875rem', background: cDragOver===id ? 'rgba(249,115,22,0.07)' : C.surface, border:'1px solid '+(cDragOver===id ? C.orange : C.border), borderRadius:'0.75rem', cursor:'grab', opacity: cDragId===id ? 0.4 : 1, transition:'background 0.1s, border-color 0.1s' }}>
                          <span style={{ fontSize:'0.72rem', color:C.muted, fontWeight:700, minWidth:'1.25rem', userSelect:'none' as const }}>{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <span style={{ flex:1, fontSize:'0.82rem', fontWeight:600, color:C.text }}>{item.title}</span>
                          {item.format && <span style={{ fontSize:'0.62rem', color:C.muted, flexShrink:0 }}>{item.format}</span>}
                          <span style={{ fontSize:'0.6rem', color:C.muted, flexShrink:0 }}>{item.pipeline_stage ?? '💡 Idea'}</span>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveContentPriority([id, ...cValid.filter(i=>i!==id)]) }} style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:C.orange, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); saveContentPriority([...cValid.filter(i=>i!==id), id]) }} style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:C.orange, cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button type="button" draggable={false} onClick={e => { e.stopPropagation(); saveContentPriority(cValid.filter(i=>i!==id)) }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}>x</button>
                        </div>
                      )
                    })}
                    {/* Drop on bottom */}
                    <div style={{ height:'2rem', borderRadius:'0.75rem', border:'2px dashed '+(cDragOver==='__c_bottom__' ? C.orange : 'transparent'), background: cDragOver==='__c_bottom__' ? 'rgba(249,115,22,0.05)' : 'transparent', transition:'all 0.15s', marginTop:'0.25rem' }}
                      onDragOver={e => { e.preventDefault(); setCDragOver('__c_bottom__') }}
                      onDrop={e => {
                        e.preventDefault()
                        if (cDragFrom==='unassigned'&&cDragId) saveContentPriority([...cValid,cDragId])
                        else if (cDragFrom==='priority'&&cDragId) saveContentPriority([...cValid.filter(i=>i!==cDragId),cDragId])
                        setCDragId(null); setCDragOver(null); setCDragFrom(null)
                      }} />
                  </div>
                )}
              </div>
            </div>
          )
        })() : (

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
      {showFindIdeas && (
        <FindIdeasModal
          onGenerate={runFindIdeas}
          onAdd={addFoundIdea}
          onClose={() => setShowFindIdeas(false)}
        />
      )}
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
