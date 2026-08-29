import { CHANNEL_BRIEF, SCRIPT_VOICE } from './channelBrief'
import type { SOP } from './sops'

// ============================================================
// Shared "draft this stage's output" prompt builder — used by the Content
// Pipeline's Produce (auto-draft chain) AND the Focus Session's Consult
// Claude button, so a stage consulted from either place produces identical,
// consistent output. Previously lived only in app/content/page.tsx; moved
// here once the Focus Session also needed it (SOP & AI panel moved off the
// Pipeline card and into the focus session, see app/content-focus/page.tsx).
// ============================================================

// Deliberately narrower than the full ContentItem type in app/content —
// only what the prompt actually needs, so both the Pipeline's ContentItem
// and the Focus Session's lighter ActiveFocusVideo type can be passed
// straight in without extra mapping.
export type StageDraftItem = {
  title: string
  video_type?: string | null
  format?: string | null
  unique_angle?: string | null
  notes?: string | null
}

export function buildStageDraftPrompt(
  item: StageDraftItem,
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
