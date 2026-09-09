'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getScriptDocLinks, addScriptDocLink, updateScriptDocLink, deleteScriptDocLink, type ScriptDocLink } from '@/lib/supabase'
import { CHANNEL_BRIEF, SCRIPT_VOICE } from '@/lib/channelBrief'
import { ChevronLeft, RefreshCw, Wand2, Search, Plus, Check, AlertCircle, FileEdit, X, Pencil, Bookmark, SpellCheck, Target, Sparkles, Clapperboard } from 'lucide-react'

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

// A single AI-proposed edit, reviewed as its own card in the UI. Nothing
// reaches the Google Doc until its Accept button is clicked -- this is the
// app-level review layer that replaces relying on Google's native
// writeMode: SUGGEST, which is gated behind Google's Workspace Developer
// Preview Program and has proven unreliable here (silently landing as a
// direct edit -- see the commentUpdateState handling in lib/googleDocs.ts).
// Rejecting just removes the card; accepting calls the apply_edit action,
// which re-locates originalText fresh in the live doc and only touches
// that one small range.
type ProposedEdit = {
  id: string
  originalText: string
  replacementText: string
  reason?: string
  status: 'pending' | 'applying'
  error?: string
}

// Claude is asked to return a JSON array of {originalText, replacementText,
// reason}. Defensive parsing: strips a markdown fence if the model wraps
// the array in one despite instructions not to, and drops any entry
// missing a non-empty originalText (nothing to locate in the doc with an
// empty string).
// Scans for the first balanced top-level [...] array anywhere in the text,
// respecting string literals so brackets inside quoted strings don't throw
// off the depth count. More forgiving than requiring the whole response to
// be exactly the array: longer, denser system prompts (the ones with the
// full channel brief baked in) sometimes get Claude adding a line of
// commentary before or after the JSON despite being told not to -- a bare
// "does the whole string parse as JSON" check fails on that even though a
// perfectly good array is sitting right there in the middle.
function extractJsonArray(raw: string): string | null {
  const start = raw.indexOf('[')
  if (start === -1) return null
  let depth = 0, inString = false, escapeNext = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function parseProposedEdits(raw: string): { edits: ProposedEdit[]; error: string | null } {
  const preview = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
  const jsonSlice = extractJsonArray(raw) ?? raw.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonSlice)
  } catch {
    return { edits: [], error: "Couldn't parse Claude's response as a list of edits. What it actually said:\n" + preview }
  }
  if (!Array.isArray(parsed)) {
    return { edits: [], error: "Claude didn't return a list of edits. What it actually said:\n" + preview }
  }
  const edits: ProposedEdit[] = (parsed as Record<string, unknown>[])
    .filter(e => e && typeof e.originalText === 'string' && (e.originalText as string).trim())
    .map((e, i) => ({
      id: 'edit-' + Date.now() + '-' + i,
      originalText: String(e.originalText),
      replacementText: typeof e.replacementText === 'string' ? e.replacementText : '',
      reason: typeof e.reason === 'string' && e.reason.trim() ? e.reason.trim() : undefined,
      status: 'pending' as const,
    }))
  return { edits, error: null }
}

// How many times originalText appears in the doc's current text -- shown
// as a heads-up on each card before the user clicks Accept. The server
// does the real, authoritative check when Accept is actually clicked (and
// refuses ambiguous or missing matches rather than guessing); this is just
// an earlier warning so it doesn't come as a surprise.
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0, from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count++
    from = idx + needle.length
  }
  return count
}

// "Skill" presets — editing rules lifted from the installed CGE skills
// (cge-scriptwriter's VOICE RULES, cge-holy-trifecta's intro rules), minus
// their intake questions and promo/CTA blocks, which don't belong in an
// automated doc edit. Selecting one prepends its rules to the system prompt
// sent to Claude, on top of whatever instruction you type. Add more presets
// here as you find edits you keep asking for the same way.
const STYLE_PRESETS = [
  { id:'none', label:'No preset — just my instruction', rules:'' },
  {
    id:'scriptwriter-voice', label:'Scriptwriter voice (CGE method)',
    rules:"Match this voice: conversational mid-length sentences with the occasional short punchy line, natural connectors ('Now,' 'So,' 'All right,' 'By the way,' 'Honestly'). Complete sentences only -- no fragments, no one-word lines like 'Boom.' or 'Done.' Numbers always numeric ($77,000 not 'seventy-seven thousand'; '5 ways' not 'five ways'). No year stamps -- use 'right now' or 'currently' instead. No robotic triple-beat cadence ('it's fast, it's free, it's easy'). Avoid AI-sounding phrases: 'level up', 'unlock your potential', 'game-changer', 'delve', 'in today's fast-paced world', 'in conclusion', 'here's the thing', 'at the end of the day'. Plain vocabulary, roughly a 10-year-old reading level.",
  },
  {
    id:'punchier-hook', label:'Punch up the hook/intro (CGE Holy Trifecta method)',
    rules:"Rewrite the opening so it restates the title's promise in the first 1-2 sentences using the title's own keywords -- don't bury it. Keep the cold open to roughly 10-30 seconds of spoken content (about 30-90 words). Vary the rhythm -- no robotic triple-beat cadence. Numbers always numeric, no year stamps, complete sentences only. Never invent a stat, quote, or name -- write [FILL IN: description] instead.",
  },
  {
    id:'tighten', label:'Tighten & trim',
    rules:'Cut ruthlessly for pace -- remove filler, redundant setup, and throat-clearing, while keeping every fact, number, and beat that is actually load-bearing. Prefer shorter sentences. Do not add new content.',
  },
] as const

// Common instruction glued onto every review preset's system prompt --
// keeps the output contract (JSON array of small, located edits) identical
// to the free-form "Ask Claude" flow so they all render as the same
// reviewable cards.
const REVIEW_OUTPUT_CONTRACT = "Your ENTIRE reply must be a single JSON array and nothing else -- the very first character you write must be [ and the very last must be ]. No markdown code fences, no preamble like \"Here are the issues I found\", no summary or sign-off after the array, no commentary anywhere. Just the raw array. It must be an array of edit objects, each shaped exactly like {\"originalText\": string, \"replacementText\": string, \"reason\": string}. originalText must be copied EXACTLY, character-for-character, from the document text below -- same spelling, punctuation, capitalization and spacing -- since it's used to locate the exact spot in the doc; never paraphrase or approximate it, and never invent text that isn't actually there. If there's nothing to flag, your entire reply must be exactly []."

// One-click review buttons -- each runs a specialized system prompt built
// from the channel's real strategy brief and script voice (lib/channelBrief.ts,
// the same single source of truth used everywhere else in the content
// pipeline), so "channel tone and vibe" isn't reinvented per-button. Each
// produces the same {originalText, replacementText, reason} edit shape as
// the free-form Rewrite flow, so they render as the same review cards --
// including the visual-breakdown preset, whose "edit" is just the original
// line with a bracketed screen-direction tag appended, not a reword.
const REVIEW_PRESETS = [
  {
    id: 'grammar',
    label: 'Grammar',
    icon: <SpellCheck size={13}/>,
    systemPrompt: "You are proofreading a YouTube script for grammar, spelling, punctuation, and clarity -- nothing else, not style or content. This script is written in a specific deliberate voice for reading aloud, so don't 'fix' intentional choices: sentence fragments used for comedic timing, informal contractions, dry deadpan phrasing, or a banned-word list are all correct as written if they match this voice:\n\n" + SCRIPT_VOICE + "\n\nOnly propose an edit for a genuine grammar, spelling, punctuation, or clarity error -- never a style preference. reason should name the specific error (e.g. 'subject-verb agreement', 'missing comma', 'typo', 'ambiguous pronoun'). " + REVIEW_OUTPUT_CONTRACT,
  },
  {
    id: 'coherency',
    label: 'Content & channel fit',
    icon: <Target size={13}/>,
    systemPrompt: "You are reviewing a YouTube script for whether it actually fits the channel's established strategy, audience, and voice -- not grammar. Here is the channel's strategy brief and script voice this script must fit:\n\n" + CHANNEL_BRIEF + "\n\n" + SCRIPT_VOICE + "\n\nLook specifically for: claims or framing drifting off the channel's niche or audience, missing or weak prescriptive ending (what this means for the viewer's savings/money), the Austrian-economics lens turning into policy-advocacy sermonising instead of staying inside the analysis, factual claims that seem shaky or unsupported, structure that doesn't match the channel's proven patterns, or tone that doesn't match the script voice. reason should name the specific coherency issue and why the fix helps. " + REVIEW_OUTPUT_CONTRACT,
  },
  {
    id: 'humor',
    label: 'Make it funnier',
    icon: <Sparkles size={13}/>,
    systemPrompt: "You are punching up a YouTube script with more humour, in exactly this style:\n\n" + SCRIPT_VOICE + "\n\nFocus specifically on the HUMOUR guidance above -- deadpan, dry, sarcastic understatement, never sold or over-explained. Find lines that are flat or could land an irreverent analogy, a dry aside, or a sardonic button, and propose a funnier version without changing the facts or the point being made. Don't force a joke into every line -- only propose an edit where it genuinely improves the line. reason should be a one-clause note on the comedic beat (e.g. 'deadpan understatement', 'irreverent analogy'). " + REVIEW_OUTPUT_CONTRACT,
  },
  {
    id: 'visual_breakdown',
    label: 'Visual breakdown',
    icon: <Clapperboard size={13}/>,
    systemPrompt: "You are storyboarding a script for a FACELESS YouTube channel -- voiceover only, no on-camera host, so every line needs something on screen. Go through the script line by line (or beat by beat for a longer passage) and decide what should be showing at that moment. Append a short bracketed tag to the END of each line, choosing whichever fits: [SCREENSHOT: ...], [ANIMATION: ...], [TEXT ON SCREEN: ...], [IMAGE: ...], [B-ROLL: ...], [STOCK FOOTAGE: ...], [AI VISUAL: ...], [MEME: ...], [AUDIO: ...] (sfx or music cue) -- be specific about WHAT it shows, not just the category (e.g. '[B-ROLL: empty grocery store shelves]', not '[B-ROLL: footage]'). Cover the whole script, one edit per line or short beat, in order -- don't skip sections. Each edit's replacementText must be the original line UNCHANGED plus the bracketed tag appended after it -- do not reword the line itself. reason should be a short note on why that visual fits the moment. " + REVIEW_OUTPUT_CONTRACT,
  },
] as const

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
  const [docUrl, setDocUrl] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [model, setModel] = useState<string>(MODELS[1].value)
  const [tool, setTool] = useState<Tool>('rewrite')

  // Suggestion mode -- when on, edits land in the doc as real Google Docs
  // suggestions (colored, Accept/Reject) instead of landing directly.
  // Requires the doc's Google Cloud project to be enrolled in Google's
  // Workspace Developer Preview Program -- see the note under the toggle.
  // Persisted to localStorage -- it used to silently reset to checked on
  // every page refresh, which was genuinely confusing to test against
  // (unchecking it, refreshing, and clicking Apply would quietly apply a
  // direct edit again without it looking like anything had changed).
  const [suggestMode, setSuggestModeState] = useState(true)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('scriptEditorSuggestMode') : null
    if (stored !== null) setSuggestModeState(stored === 'true')
  }, [])
  function setSuggestMode(v: boolean) {
    setSuggestModeState(v)
    try { window.localStorage.setItem('scriptEditorSuggestMode', String(v)) } catch {}
  }

  // Rewrite tool -- proposedEdits holds the current review batch; nothing
  // in it has touched the doc yet (see ProposedEdit's doc comment above).
  const [instruction, setInstruction] = useState('')
  const [stylePreset, setStylePreset] = useState<string>(STYLE_PRESETS[0].id)
  const [proposedEdits, setProposedEdits] = useState<ProposedEdit[]>([])
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState<string | null>(null)

  // Find & replace tool
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)

  // Append tool
  const [appendInstruction, setAppendInstruction] = useState('')
  const [appendStylePreset, setAppendStylePreset] = useState<string>(STYLE_PRESETS[0].id)
  const [appendProposed, setAppendProposed] = useState('')

  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  // Saved doc links -- a small, user-managed list for quick access, editable
  // and deletable, any number of them.
  const [links, setLinks] = useState<ScriptDocLink[]>([])
  const [linksErr, setLinksErr] = useState<string | null>(null)
  const [addingLink, setAddingLink] = useState(false)
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editUrl, setEditUrl] = useState('')

  const refreshLinks = useCallback(() => {
    getScriptDocLinks().then(({ links, error }) => { setLinks(links); setLinksErr(error) })
  }, [])

  useEffect(() => { refreshLinks() }, [refreshLinks])

  async function saveCurrentAsLink() {
    if (!docUrl.trim()) return
    setAddingLink(true)
    const label = newLinkLabel.trim() || snapshot?.title || 'Untitled link'
    const { error } = await addScriptDocLink(label, docUrl.trim())
    if (error) setLinksErr(error)
    else { setNewLinkLabel(''); refreshLinks() }
    setAddingLink(false)
  }

  function startEditLink(link: ScriptDocLink) {
    setEditingLinkId(link.id)
    setEditLabel(link.label)
    setEditUrl(link.url)
  }

  async function saveEditLink() {
    if (!editingLinkId) return
    const { error } = await updateScriptDocLink(editingLinkId, { label: editLabel.trim() || 'Untitled link', url: editUrl.trim() })
    if (error) setLinksErr(error)
    setEditingLinkId(null)
    refreshLinks()
  }

  async function removeLink(id: string) {
    const { error } = await deleteScriptDocLink(id)
    if (error) setLinksErr(error)
    else refreshLinks()
  }

  // resetForms controls whether switching to (or reloading) a doc should
  // wipe the review batch. The "Load" button and clicking a saved link
  // pass true (default) -- you're deliberately switching documents, so
  // stale proposed edits from a different doc shouldn't linger. Refreshing
  // the preview after successfully applying ONE edit -- from acceptEdit,
  // applyFindReplace, applyAppend -- passes false, so accepting one card
  // doesn't wipe out every other still-pending card in the same batch.
  // (That was a real bug: accepting a change was silently clearing the
  // whole proposedEdits list because this always ran with the old
  // unconditional reset.)
  const loadDoc = useCallback(async (url: string, resetForms = true) => {
    if (!url.trim()) return
    setLoadingDoc(true)
    setLoadErr(null)
    // Only clear the status message on a deliberate doc switch. A
    // post-action refresh (resetForms=false) runs right after
    // acceptEdit/applyFindReplace/applyAppend just set that same message
    // (e.g. a suggestionWarning) -- clearing it here too would wipe it out
    // before it was ever visible, in the same render batch.
    if (resetForms) setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs?url=' + encodeURIComponent(url.trim()))
      const data = await res.json()
      if (data?.error) { setLoadErr(String(data.error)); setSnapshot(null) }
      else {
        setSnapshot(data)
        if (resetForms) { setProposedEdits([]); setAppendProposed('') }
      }
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
    const preset = STYLE_PRESETS.find(p => p.id === stylePreset)
    let systemPrompt = "You are proposing precise, individually reviewable edits to a YouTube script in a Google Doc, alongside the writer. You'll get the CURRENT FULL TEXT of the doc and an instruction for what to change. Return ONLY a JSON array (no markdown fences, no commentary before or after) of edit objects, each shaped exactly like {\"originalText\": string, \"replacementText\": string, \"reason\": string}. originalText must be copied EXACTLY, character-for-character, from the current document text below -- same spelling, punctuation, capitalization and spacing -- since it's used to locate the exact spot to change; never paraphrase or approximate it, and never invent text that isn't actually there. Keep each edit as small and targeted as the change actually requires -- usually a phrase or a sentence -- rather than rewriting whole paragraphs, unless the instruction clearly calls for a bigger rewrite (in that case it's fine for one edit's originalText/replacementText to span a larger passage, or to propose several separate edits). reason should be one short clause explaining why. If nothing in the document needs to change, return []."
    if (preset?.rules) systemPrompt += '\n\n' + preset.rules
    const userPrompt = 'CURRENT DOCUMENT TEXT:\n"""\n' + snapshot.text + '\n"""\n\nINSTRUCTION: ' + instruction.trim()
    const { text, error } = await consult(systemPrompt, userPrompt, model)
    if (error) {
      setGenMsg(error)
    } else {
      const { edits, error: parseError } = parseProposedEdits(text)
      if (parseError) setGenMsg(parseError)
      else if (edits.length === 0) setGenMsg('Claude found nothing to change.')
      setProposedEdits(edits)
    }
    setGenerating(false)
  }

  // One-click alternative to typing an instruction -- runs a REVIEW_PRESETS
  // system prompt straight away and fills the same review-card list.
  async function generateReview(preset: (typeof REVIEW_PRESETS)[number]) {
    if (!snapshot) return
    setGenerating(true)
    setGenMsg(null)
    const userPrompt = 'CURRENT DOCUMENT TEXT:\n"""\n' + snapshot.text + '\n"""'
    const { text, error } = await consult(preset.systemPrompt, userPrompt, model)
    if (error) {
      setGenMsg(error)
    } else {
      const { edits, error: parseError } = parseProposedEdits(text)
      if (parseError) setGenMsg(parseError)
      else if (edits.length === 0) setGenMsg('Claude found nothing to flag.')
      setProposedEdits(edits)
    }
    setGenerating(false)
  }

  function rejectEdit(id: string) {
    setProposedEdits(prev => prev.filter(e => e.id !== id))
    setApplyMsg('Rejected — no change made to the doc.')
  }

  function updateEditText(id: string, replacementText: string) {
    setProposedEdits(prev => prev.map(e => e.id === id ? { ...e, replacementText } : e))
  }

  // Accept-one-edit -- the only thing in this whole tool that actually
  // writes to the Google Doc. Independent per call: re-fetches and
  // re-locates originalText fresh each time, so accepting several edits in
  // a row (or out of order) is safe even though earlier accepts change the
  // doc the later ones will be located against.
  async function acceptEdit(id: string) {
    const edit = proposedEdits.find(e => e.id === id)
    if (!edit) return
    setProposedEdits(prev => prev.map(e => e.id === id ? { ...e, status: 'applying', error: undefined } : e))
    try {
      const res = await fetch('/api/gdocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_edit', url: docUrl, originalText: edit.originalText, replacementText: edit.replacementText, suggest: suggestMode }),
      })
      const data = await res.json()
      if (data?.error) {
        setProposedEdits(prev => prev.map(e => e.id === id ? { ...e, status: 'pending', error: String(data.error) } : e))
        return
      }
      if (data.suggestionWarning) setApplyMsg('Warning: ' + String(data.suggestionWarning))
      setProposedEdits(prev => prev.filter(e => e.id !== id))
      loadDoc(docUrl, false)
    } catch (e) {
      setProposedEdits(prev => prev.map(e => e.id === id ? { ...e, status: 'pending', error: String(e) } : e))
    }
  }

  async function acceptAllPending() {
    for (const id of proposedEdits.filter(e => e.status === 'pending').map(e => e.id)) {
      await acceptEdit(id)
    }
  }

  async function generateAppend() {
    if (!snapshot || !appendInstruction.trim()) return
    setGenerating(true)
    setGenMsg(null)
    const preset = STYLE_PRESETS.find(p => p.id === appendStylePreset)
    let systemPrompt = "You are helping write a YouTube script live, alongside the writer, in a Google Doc. You'll get the CURRENT FULL TEXT of the doc (for context/voice/continuity) and an instruction for a new section to add at the END of the doc. Return ONLY the new section's text to append -- no commentary, no markdown fences, no repeating the existing text. Plain text, matching the doc's existing style and voice."
    if (preset?.rules) systemPrompt += '\n\n' + preset.rules
    const userPrompt = 'CURRENT DOCUMENT TEXT (for context only -- do not repeat it):\n"""\n' + snapshot.text + '\n"""\n\nWhat to add at the end: ' + appendInstruction.trim()
    const { text, error } = await consult(systemPrompt, userPrompt, model)
    if (error) setGenMsg(error)
    else setAppendProposed(text)
    setGenerating(false)
  }

  async function applyFindReplace() {
    if (!findText.trim()) return
    setApplying(true)
    setApplyMsg(null)
    try {
      const res = await fetch('/api/gdocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find_replace', url: docUrl, find: findText, replace: replaceText, matchCase, suggest: suggestMode }),
      })
      const data = await res.json()
      if (data?.error) setApplyMsg('Failed: ' + String(data.error))
      else if (data.suggestionWarning) setApplyMsg('Warning: ' + String(data.suggestionWarning))
      else setApplyMsg(data.occurrencesChanged + (suggestMode ? ' occurrence(s) suggested — open the doc to Accept/Reject.' : ' occurrence(s) changed.'))
      if (!data?.error) loadDoc(docUrl, false)
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
        body: JSON.stringify({ action: 'append', url: docUrl, text: '\n' + appendProposed, suggest: suggestMode }),
      })
      const data = await res.json()
      if (data?.error) setApplyMsg('Failed: ' + String(data.error))
      else {
        if (data.suggestionWarning) setApplyMsg('Warning: ' + String(data.suggestionWarning))
        else setApplyMsg(suggestMode ? 'Suggested in the doc — open it to Accept/Reject.' : 'Appended to the doc.')
        setAppendProposed(''); setAppendInstruction(''); loadDoc(docUrl, false)
      }
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
            Claude proposes small edits to a Google Doc, you Accept or Reject each one right here, and only accepted edits reach the doc. Nothing lands without your say-so.
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
          {/* Saved links -- editable, deletable, add as many as you want */}
          <div style={{ marginTop:'0.7rem' }}>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const, alignItems:'center' }}>
              {links.map(link => editingLinkId === link.id ? (
                <div key={link.id} style={{ display:'flex', gap:'0.3rem', alignItems:'center', background:C.surface, border:'1px solid '+C.cyan, borderRadius:'0.5rem', padding:'0.3rem' }}>
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label" style={{ ...inputStyle, padding:'0.3rem 0.5rem', fontSize:'0.7rem', width:110 }}/>
                  <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="URL" style={{ ...inputStyle, padding:'0.3rem 0.5rem', fontSize:'0.7rem', width:200 }}/>
                  <button onClick={saveEditLink} style={{ background:'none', border:'none', color:C.green, cursor:'pointer', padding:'0.2rem' }}><Check size={14}/></button>
                  <button onClick={() => setEditingLinkId(null)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem' }}><X size={14}/></button>
                </div>
              ) : (
                <div key={link.id} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.15rem 0.3rem 0.15rem 0.7rem' }}>
                  <button onClick={() => { setDocUrl(link.url); loadDoc(link.url) }} title={link.url} style={{ fontSize:'0.68rem', background:'none', border:'none', color:C.sec, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                    {link.label}
                  </button>
                  <button onClick={() => startEditLink(link)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem', display:'flex' }}><Pencil size={11}/></button>
                  <button onClick={() => removeLink(link.id)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem', display:'flex' }}><X size={12}/></button>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                <input value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="Label for this link" style={{ ...inputStyle, padding:'0.3rem 0.6rem', fontSize:'0.68rem', width:130 }}/>
                <button onClick={saveCurrentAsLink} disabled={addingLink || !docUrl.trim()} title="Save the URL above as a quick-access link" style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.68rem', padding:'0.3rem 0.6rem', background:'rgba(0,212,255,0.08)', border:'1px dashed rgba(0,212,255,0.35)', borderRadius:'9999px', color:C.cyan, cursor: (addingLink || !docUrl.trim()) ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  <Bookmark size={11}/> Save link
                </button>
              </div>
            </div>
            {linksErr && <p style={{ fontSize:'0.7rem', color:C.red, margin:'0.4rem 0 0' }}>{linksErr}</p>}
          </div>
          {loadErr && (
            <p style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.75rem', color:C.red, margin:'0.6rem 0 0' }}><AlertCircle size={13}/> {loadErr}</p>
          )}
          {loadErr === null && !snapshot && (
            <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.6rem 0 0', lineHeight:1.5 }}>
              Works on any doc you own or have access to — no per-doc sharing needed (this uses Workspace domain-wide delegation, not a shared service account).
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

            {/* Suggestion mode toggle */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'0.875rem 1rem', marginBottom:'1.25rem' }}>
              <label style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', cursor:'pointer' }}>
                <input type="checkbox" checked={suggestMode} onChange={e => setSuggestMode(e.target.checked)} style={{ marginTop:'0.2rem' }}/>
                <span>
                  <span style={{ display:'block', fontSize:'0.82rem', fontWeight:700, color:C.text }}>Also try landing accepted edits as a Google Docs suggestion</span>
                  <span style={{ display:'block', fontSize:'0.72rem', color:C.muted, lineHeight:1.5, marginTop:'0.15rem' }}>
                    Review happens here first either way — nothing reaches the doc until you click Accept on a "Rewrite with Claude" card, or hit the buttons on Find & Replace / Append. This toggle only affects what happens at that moment: On additionally tries to land it as a real, colored Google Docs suggestion (still Accept/Reject-able there too) — this needs the Google Cloud project enrolled in Google's <a href="https://developers.google.com/workspace/preview" target="_blank" rel="noopener noreferrer" style={{ color:C.cyan }}>Workspace Developer Preview Program</a>, and has been unreliable here (it can silently write directly instead — you'll see a warning if that happens). Off writes it straight in once you've already approved it.
                  </span>
                </span>
              </label>
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
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.5rem' }}>Quick review — one click, no instruction needed</label>
                <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const, marginBottom:'1rem' }}>
                  {REVIEW_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => generateReview(preset)} disabled={generating} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.5rem 0.85rem', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.625rem', color:C.cyan, cursor: generating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:700 }}>
                      {preset.icon} {preset.label}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'0 0 0.75rem' }}>
                  <div style={{ flex:1, height:1, background:C.border }}/>
                  <span style={{ fontSize:'0.68rem', color:C.muted, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>or write your own</span>
                  <div style={{ flex:1, height:1, background:C.border }}/>
                </div>
                <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="What do you want changed? e.g. 'Tighten the intro to 3 sentences' or 'Make the hook punchier'" style={{ ...textareaStyle, minHeight:60, flex:1 }}/>
                </div>
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Style / skill</label>
                <select value={stylePreset} onChange={e => setStylePreset(e.target.value)} style={{ ...inputStyle, cursor:'pointer', marginBottom:'0.75rem' }}>
                  {STYLE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                  <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <button onClick={generateRewrite} disabled={generating || !instruction.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:C.purple, cursor: generating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                    <Wand2 size={13}/> {generating ? 'Thinking...' : 'Ask Claude'}
                  </button>
                </div>
                {genMsg && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem', whiteSpace:'pre-wrap' as const }}>{genMsg}</p>}

                {proposedEdits.length > 0 && (
                  <div style={{ marginTop:'0.5rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem' }}>
                      <label style={{ fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>
                        {proposedEdits.length} proposed edit{proposedEdits.length === 1 ? '' : 's'} — review each
                      </label>
                      {proposedEdits.length > 1 && (
                        <button onClick={acceptAllPending} disabled={proposedEdits.some(e => e.status === 'applying')} style={{ fontSize:'0.7rem', padding:'0.35rem 0.7rem', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'0.5rem', color:C.green, cursor: proposedEdits.some(e => e.status === 'applying') ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontWeight:700 }}>
                          Accept all
                        </button>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.65rem' }}>
                      {proposedEdits.map(edit => {
                        const occurrences = snapshot ? countOccurrences(snapshot.text, edit.originalText) : 1
                        return (
                          <div key={edit.id} style={{ background:C.surface, border:'1px solid '+(edit.error ? C.red : C.border), borderRadius:'0.75rem', padding:'0.85rem' }}>
                            {occurrences !== 1 && (
                              <p style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.7rem', color:C.amber, margin:'0 0 0.6rem' }}>
                                <AlertCircle size={12}/> {occurrences === 0 ? "Can't find this text in the doc anymore — it may already be out of date." : 'Appears ' + occurrences + ' times — accepting may be ambiguous.'}
                              </p>
                            )}
                            <label style={{ display:'block', fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'0.25rem' }}>Current</label>
                            <p style={{ fontSize:'0.8rem', color:C.sec, margin:'0 0 0.6rem', textDecoration:'line-through', textDecorationColor:C.red, whiteSpace:'pre-wrap' as const, lineHeight:1.5 }}>{edit.originalText}</p>
                            <label style={{ display:'block', fontSize:'0.68rem', fontWeight:700, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'0.25rem' }}>Suggested — edit freely before accepting</label>
                            <textarea value={edit.replacementText} onChange={e => updateEditText(edit.id, e.target.value)} placeholder="(delete this text)" style={{ ...textareaStyle, minHeight:48, fontSize:'0.8rem', color:C.green, marginBottom:'0.6rem' }}/>
                            {edit.reason && <p style={{ fontSize:'0.72rem', color:C.sec, margin:'0 0 0.6rem', fontStyle:'italic' as const }}>{edit.reason}</p>}
                            {edit.error && <p style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.72rem', color:C.red, margin:'0 0 0.6rem' }}><AlertCircle size={12}/> {edit.error}</p>}
                            <div style={{ display:'flex', gap:'0.5rem' }}>
                              <button onClick={() => acceptEdit(edit.id)} disabled={edit.status === 'applying'} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.9rem', background:'linear-gradient(135deg,'+C.green+',#00cc6a)', border:'none', borderRadius:'0.5rem', color:'#000', cursor: edit.status === 'applying' ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:800 }}>
                                <Check size={12}/> {edit.status === 'applying' ? 'Applying...' : 'Accept'}
                              </button>
                              <button onClick={() => rejectEdit(edit.id)} disabled={edit.status === 'applying'} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.sec, cursor: edit.status === 'applying' ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.75rem', fontWeight:700 }}>
                                <X size={12}/> Reject
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.sec, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:'0.4rem' }}>Style / skill</label>
                <select value={appendStylePreset} onChange={e => setAppendStylePreset(e.target.value)} style={{ ...inputStyle, cursor:'pointer', marginBottom:'0.75rem' }}>
                  {STYLE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                  <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <button onClick={generateAppend} disabled={generating || !appendInstruction.trim()} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'0.625rem', color:C.purple, cursor: generating ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700 }}>
                    <Wand2 size={13}/> {generating ? 'Thinking...' : 'Ask Claude'}
                  </button>
                </div>
                {genMsg && <p style={{ fontSize:'0.75rem', color:C.amber, margin:'0 0 0.75rem', whiteSpace:'pre-wrap' as const }}>{genMsg}</p>}
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

            {applyMsg && <p style={{ fontSize:'0.78rem', color: applyMsg.startsWith('Failed') ? C.red : applyMsg.startsWith('Warning') ? C.amber : C.green, marginTop:'0.9rem', whiteSpace:'pre-wrap' as const }}>{applyMsg}</p>}
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
