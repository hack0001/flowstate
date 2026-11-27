import { supabase, getStageNote, saveStageNote, getMaxFocusItems, setMaxFocusItems, DEFAULT_MAX_FOCUS_ITEMS, getChannelWatchlist, addChannelWatch, deleteChannelWatch, type ChannelWatch } from '@/lib/supabase'
import { sopForStage, isShortsOnly, isStageSkippedForShorts, productionSopIdsFor, IDEA_VALIDATION_CHECKS, SOPS } from '@/lib/sops'
import { CHANNEL_BRIEF, SCRIPT_VOICE, OUTLIER_SEED_QUERIES } from '@/lib/channelBrief'
import { buildStageDraftPrompt } from '@/lib/stageDraftPrompt'
import { C } from '@/lib/theme'
import { FORMATS, VIDEO_TYPES, ContentItem } from '@/lib/contentTypes'

export const IDEA_VALIDATION_SOP_ID = 'idea_validation'
// Manual log of a Claude-chat consult (copy prompt -> paste into Claude ->
// paste the reply back here) — separate from IDEA_VALIDATION_SOP_ID, which
// stores the structured result of the in-app automated call.
export const IDEA_LOG_SOP_ID = 'idea_validation_log'
export type IdeaLog = { reply: string; nextSteps: string; loggedAt: string }

export type ValidationCheckResult = { key: string; status: 'pass' | 'fail' | 'needs_research'; note: string }
export type ValidationAlternative = { title: string; why: string; evidence: string }
export type ValidationResult = {
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
export const CONSULT_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', hint: 'Fastest, cheapest — good default' },
  { value: 'claude-sonnet-5',           label: 'Claude Sonnet 5',  hint: 'Stronger reasoning, still quick' },
  { value: 'claude-opus-4-8',           label: 'Claude Opus 4.8',  hint: 'Most thorough, slowest' },
  { value: 'claude-fable-5',            label: 'Claude Fable 5',   hint: 'Alternate model' },
] as const
export const DEFAULT_CONSULT_MODEL = CONSULT_MODELS[0].value
export function consultModelLabel(value: string): string {
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
export const VALIDATION_METHOD = `Validate this YouTube video idea using the following method, step by step:
1. PITCH — Can the idea be stated as one clear sentence a viewer could repeat back? If it takes a paragraph to explain, it's not ready.
2. ANGLE — Does the framing use a proven high-CTR pattern (a specific number, a contrarian claim, a curiosity gap, a direct named benefit, a before/after)? Vague or generic framing fails this.
3. ALPHA CHECK — Does this idea contain something a generic AI answer or a quick search wouldn't already give a viewer? If not, it's a "recipe" video with no edge.
4. OUTLIER EVIDENCE — Search YouTube for existing videos on this exact topic and closely adjacent topics in this niche. Identify videos that clearly overperformed relative to their channel's typical view count (outliers), note their approximate view counts, channel names, and how recent they are. This tells you whether there is proven audience demand, not just supply.
5. COMMENT-MINED GAP — Read the comments on the outlier videos found in step 4 (or the closest available videos in the niche). Look for repeated questions, complaints, or requests that existing videos do NOT answer well. That unmet demand is the gap this new video should fill.
6. VIDEO TYPE / FUNNEL FIT — Does the format (how-to, listicle, case study, explainer, testimonial/interview) match a sensible role in the content funnel — how-tos and explainers pull search traffic, listicles are passive top-of-funnel reach, case studies build authority, testimonials/interviews convert?
7. REVENUE-TIER AWARENESS — Is this idea aligned with a monetizable tier appropriate to the channel's current stage (ads, affiliate, product, service, community), or is it pure vanity content with no path to revenue?

Tool use: if you have live web/YouTube search available in this environment, you MUST actually use it for steps 4 and 5 — search, open real results, and cite what you found (approximate titles, view counts, channel names, and specific comment themes) in your notes for those checks. Only mark a check "needs_research" if you genuinely have no search capability here — never fabricate statistics, video titles, or comments.`

export function buildValidationPrompt(item: ContentItem): { systemPrompt: string; userPrompt: string; combined: string } {
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
export function buildSkillInvokePrompt(item: ContentItem): string {
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
export type OutlierBreakdown = {
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
export type FoundIdea = {
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
export type ScannedOutlier = {
  videoId: string; title: string; channel: string
  views: number; subscribers: number; ratio: number
  publishedAt: string; url: string; query: string
  ageDays: number; viewsPerDay: number
  channelCountry: string | null // channel's own declared country (About), not confirmed viewer geography
}

// Real top-level YouTube comment, filtered for substance and ranked by likes
// — from /api/content/comments. The audience's own words on a video, used to
// ground "comment_gap" in something real instead of a guess.
export type TopComment = {
  id: string; author: string; text: string
  likeCount: number; publishedAt: string; replyCount: number
}

// Parse a model reply that should be JSON, surviving markdown fences,
// commentary around the object, and — the common failure — truncation at the
// output-token limit. On truncation, walks back to the last complete object/
// array boundary and closes whatever is still open, so a cut-off "ideas"
// array yields its complete entries instead of a SyntaxError.
export function parseModelJson<T>(raw: string): T {
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
export type HookPattern = { pattern: string; why_it_works: string; example: string }
export type HookOption = { hook: string; pattern: string; emotion: string }
export type HookAnalysis = { patterns: HookPattern[]; hooks: HookOption[] }

export function buildHookAnalysisPrompt(outliers: ScannedOutlier[], topic: string): { systemPrompt: string; userPrompt: string } {
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

export function formatScannedOutliers(rows: ScannedOutlier[]): string {
  return rows.map(o =>
    `- "${o.title}" — ${o.channel}${o.channelCountry ? ' [' + o.channelCountry + ']' : ''} · ${o.views.toLocaleString()} views on a ${o.subscribers.toLocaleString()}-subscriber channel (${o.ratio}:1 view:sub) · published ${o.publishedAt.slice(0, 10)} · found via "${o.query}" · ${o.url}`
  ).join('\n')
}

export function formatScannedVelocity(rows: ScannedOutlier[]): string {
  return rows.map(o =>
    `- "${o.title}" — ${o.channel}${o.channelCountry ? ' [' + o.channelCountry + ']' : ''} (${o.subscribers.toLocaleString()} subs) · ${o.views.toLocaleString()} views in ${o.ageDays} days (~${o.viewsPerDay.toLocaleString()}/day) · published ${o.publishedAt.slice(0, 10)} · found via "${o.query}" · ${o.url}`
  ).join('\n')
}

// Real audience comments pulled for one or more scanned videos, formatted as
// grounding evidence for the idea generator — the actual words viewers used
// to ask for something, praise something, or complain something was
// missing, not Claude's guess at what a "comment gap" might be.
export function formatCommentInsights(commentsByVideo: Record<string, TopComment[]>, allVideos: ScannedOutlier[]): string {
  const titleByVideo = new Map(allVideos.map(v => [v.videoId, v.title]))
  const entries = Object.entries(commentsByVideo).filter(([, cs]) => cs.length > 0)
  if (entries.length === 0) return ''
  return entries.map(([videoId, cs]) => {
    const title = titleByVideo.get(videoId) ?? videoId
    const quotes = cs.slice(0, 6).map(c => `  - "${c.text.slice(0, 220)}" (${c.likeCount} likes)`).join('\n')
    return `On "${title}":\n${quotes}`
  }).join('\n\n')
}

export function buildFindIdeasPrompt(existingTitles: string[], count: number, scannedOutliers?: ScannedOutlier[], scannedVelocity?: ScannedOutlier[], commentInsights?: Record<string, TopComment[]>): { systemPrompt: string; userPrompt: string } {
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
    (commentInsights && Object.keys(commentInsights).length > 0
      ? `REAL AUDIENCE COMMENTS — pulled directly from YouTube via the comment analyser (filtered for substance, ranked by likes), so these are actual viewer words, not inferred. Use these as your first source for "comment_gap" — quote or closely paraphrase what a comment actually asked for, praised, or complained was missing, rather than inventing a plausible-sounding gap:\n${formatCommentInsights(commentInsights, [...(scannedOutliers ?? []), ...(scannedVelocity ?? [])])}\n\n`
      : '') +
    `For each idea, ground it in a real outlier or velocity video first (see the method above)${(scannedOutliers && scannedOutliers.length > 0) || (scannedVelocity && scannedVelocity.length > 0) ? ', preferably one from the verified lists' : ''}, then build the idea around beating it. Run through all 7 checks and only include ideas that would score Viable or at worst Needs More Research — do not include ideas that would fail, and do not include an idea if you cannot find genuine outlier or velocity evidence backing it.\n\n` +
    `Return JSON exactly in this shape:\n` +
    `{"ideas":[{"title":"...","description":"one or two sentences on what the video covers","video_type":"${VIDEO_TYPES.join('"|"')}"|"","format":"${FORMATS.join('"|"')}","unique_angle":"the alpha/edge — what your version does differently or better than the outlier","pattern":"Anxiety Question"|"History Story"|"Contrarian Take"|"Credible How-To","comment_gap":"the specific unanswered question or frustration from comments (or the audience insight in the brief) this idea fills — empty string if genuinely unknown","why_now":"one sentence on timing: the outlier's recency, the news cycle, or seasonality that makes this topic hot right now","rationale":"one or two sentences on why this passes the checklist and fits the channel","researched":true|false,"outlier":{"video_title":"the specific outlier/velocity video's title","channel":"its channel name","views":"approx view count, e.g. '180,000 views'","subscribers":"approx subscriber count of that channel, e.g. '8,200 subscribers'","view_to_sub_ratio":"e.g. '22:1', or 'n/a — velocity signal' if this is a velocity-based candidate","recency":"how old the video is, e.g. '4 months ago' or '3 weeks ago'","packaging_gap":"specifically what's weak about its title, thumbnail, or the video itself that your version can beat","signal_type":"ratio"|"velocity","velocity_note":"only when signal_type is velocity — one sentence naming the channel size and flagging how much of the pull might be channel authority vs topic demand, empty string otherwise"} or null if you genuinely could not find qualifying evidence}, ... ${count} entries]}\n\n` +
    `"researched" should be true only if you actually used live web/YouTube search or the verified lists above to ground this idea, false if you had neither and relied on established niche patterns instead. If "researched" is false, "outlier" should be null — do not fabricate view counts or channel names.`
  return { systemPrompt, userPrompt }
}

// The stages the auto-draft chain fills, in dependency order. Voiceover,
// Editing and Upload stay human — that's where the creator's voice and
// judgment go; the chain's job is to have everything ready for them.
export const AUTO_DRAFT_STAGES: { sopId: string; label: string }[] = [
  { sopId: '02', label: 'Research' },
  { sopId: '03', label: 'Holy Trifecta' },
  { sopId: '04', label: 'Script' },
  { sopId: '05', label: 'Assets' },
  { sopId: '08', label: 'Thumbnail & SEO' },
]
