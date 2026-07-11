import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const ANALYZE_SYSTEM = `You are an expert social media analyst for a Sound Money / Austrian Economics X (Twitter) account called SoundMoney. Analyze viral tweets and create tailored Sound Money alternatives.

Topics you cover: inflation, purchasing power, the Cantillon Effect, Federal Reserve criticism, gold, Bitcoin as sound money, Austrian Business Cycle, Mises, Hayek, Rothbard, savings vs consumption, monetary wealth gap, fiat money failures.

Return ONLY valid JSON with this exact structure (no markdown, no backticks):
{
  "hookPattern": "Stat Hook|Hot Take|Shocking Comparison|Anti-Institution|Hard Truth|Story|Contrarian|Relatable Loss|Explainer",
  "formatType": "standalone|thread|quote-tweet|list",
  "whyItWorked": "2-3 sentences explaining the psychological trigger and why this tweet outperformed typical engagement for the account",
  "soundMoneyAlternative": "Complete alternative tweet (max 280 chars for standalone) applying the same hook pattern to Austrian economics / sound money topics"
}`

const GENERATE_SYSTEM = `You are an expert viral content analyst for the finance niche on X (Twitter). Generate examples of viral finance tweets -- the kind that achieve 5x-20x higher engagement than typical for the account (high likes+retweets relative to follower count).

Create realistic, specific examples with real-feeling engagement numbers. Cover: inflation, bitcoin, central banking, savings, purchasing power, monetary policy, wealth inequality via money printing, sound money principles.

For each example, include a Sound Money Alternative: how the SoundMoney channel (Austrian economics / sound money / inflation education) would adapt the same hook pattern.

Return ONLY valid JSON array (no markdown, no backticks, no preamble):
[{
  "tweetText": "...",
  "authorHandle": "@examplehandle",
  "authorName": "Example Name",
  "likes": 8500,
  "retweets": 1200,
  "followerEstimate": 9500,
  "engagementRatio": 10.2,
  "category": "inflation",
  "hookPattern": "Stat Hook",
  "formatType": "standalone",
  "whyItWorked": "2-3 sentences on the psychological trigger",
  "soundMoneyAlternative": "Complete alternative tweet using the same hook for Austrian economics / sound money topics"
}]`

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 3000): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  const data = await res.json()
  if (data?.error) throw new Error(JSON.stringify(data.error))
  return data?.content?.[0]?.text ?? ''
}

function parseTweetText(html: string): string {
  // Extract text content from blockquote <p> in oEmbed HTML
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (!match) return ''
  let text = match[1]
  // Strip anchor tags but keep link text
  text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode basic HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // ── oEmbed proxy ──────────────────────────────────────────────────────────
    if (action === 'oembed') {
      const { tweetUrl } = body
      if (!tweetUrl) return NextResponse.json({ error: 'tweetUrl required' }, { status: 400 })

      const url = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) return NextResponse.json({ error: 'oEmbed fetch failed: ' + res.status }, { status: 502 })

      const data = await res.json()
      const text = parseTweetText(data.html ?? '')
      // Extract handle from author_url: https://twitter.com/handle
      const handleMatch = (data.author_url ?? '').match(/twitter\.com\/([^/]+)$/) ?? (data.author_url ?? '').match(/x\.com\/([^/]+)$/)
      const authorHandle = handleMatch ? '@' + handleMatch[1] : ''

      return NextResponse.json({ text, authorName: data.author_name ?? '', authorHandle })
    }

    // ── Analyze tweet ─────────────────────────────────────────────────────────
    if (action === 'analyze') {
      const { tweetText, authorHandle, likes = 0, retweets = 0, followerEstimate = 0, category = 'finance' } = body
      if (!tweetText) return NextResponse.json({ error: 'tweetText required' }, { status: 400 })

      const ratio = followerEstimate > 0 ? ((likes + retweets) / followerEstimate).toFixed(1) : '?'
      const userPrompt = `Analyze this viral tweet:

Tweet: "${tweetText}"
Author: ${authorHandle || 'Unknown'}
Category: ${category}
Engagement: ${likes} likes, ${retweets} retweets, ~${followerEstimate} followers (${ratio}x engagement ratio)

Return the JSON analysis with hookPattern, formatType, whyItWorked, and soundMoneyAlternative.`

      const raw = await callClaude(ANALYZE_SYSTEM, userPrompt, 800)
      const clean = raw.replace(/```json|```/g, '').trim()
      return NextResponse.json({ content: [{ text: clean }] })
    }

    // ── Generate examples ─────────────────────────────────────────────────────
    if (action === 'generate') {
      const { category = 'inflation,bitcoin,fed,sound-money,cantillon' } = body
      const userPrompt = `Generate 8 viral finance tweet examples with Sound Money alternatives. Focus categories: ${category}. Make engagement numbers realistic and specific. Vary the hook patterns across examples.`

      const raw = await callClaude(GENERATE_SYSTEM, userPrompt, 4000)
      const clean = raw.replace(/```json|```/g, '').trim()
      return NextResponse.json({ content: [{ text: clean }] })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
