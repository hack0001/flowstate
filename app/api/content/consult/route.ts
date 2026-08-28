import { NextRequest, NextResponse } from 'next/server'

// Same pattern as app/api/x/generate/route.ts — server-side call so the
// Anthropic key never reaches the browser. Used by the Content Pipeline's
// "Consult Claude" button to draft a stage's output (title options, hook,
// script beats, etc.) from the video's known context + that stage's SOP,
// and by the idea-validation flow.
//
// `model` is optional and whitelisted — callers pass one of the keys below
// (see CONSULT_MODELS in app/content/page.tsx for the matching UI labels).
// Unknown/missing values fall back to Haiku.
const ALLOWED_MODELS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5-20251001',
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-fable-5': 'claude-fable-5',
}

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userPrompt, model, webSearch, messages } = await req.json()
    const resolvedModel = ALLOWED_MODELS[model] ?? ALLOWED_MODELS['claude-haiku-4-5-20251001']

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    }
    const body: Record<string, unknown> = {
      model: resolvedModel,
      // Generous caps — the Find Ideas / validation JSON with the full
      // opportunity breakdown regularly passed 2,500 tokens and got truncated
      // mid-array, which surfaced as JSON parse errors in the UI.
      max_tokens: webSearch ? 8000 : 4000,
      system: systemPrompt,
      // Multi-turn callers (Yap Session) pass a full messages array; every
      // other caller still just passes a single userPrompt string.
      messages: Array.isArray(messages) && messages.length > 0 ? messages : [{ role: 'user', content: userPrompt }],
    }
    // Idea validation opts into Claude's native web search tool so it can
    // actually look up comparable YouTube videos and comment themes instead
    // of guessing. Only requested when the caller explicitly asks for it
    // (the validation flow) — everything else is unaffected.
    if (webSearch) {
      headers['anthropic-beta'] = 'web-search-2025-03-05'
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }]
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
