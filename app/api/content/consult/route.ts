import { NextRequest, NextResponse } from 'next/server'

// Same pattern as app/api/x/generate/route.ts — server-side call so the
// Anthropic key never reaches the browser. Used by the Content Pipeline's
// "Consult Claude" button to draft a stage's output (title options, hook,
// script beats, etc.) from the video's known context + that stage's SOP.
export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userPrompt } = await req.json()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
