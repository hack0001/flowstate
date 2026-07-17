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
    const { systemPrompt, userPrompt, model } = await req.json()
    const resolvedModel = ALLOWED_MODELS[model] ?? ALLOWED_MODELS['claude-haiku-4-5-20251001']
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
