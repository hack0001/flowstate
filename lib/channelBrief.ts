// ============================================================
// lib/channelBrief.ts — SoundMoney channel strategy brief
//
// Single source of truth for the channel's validated strategy, injected
// into EVERY AI prompt in the content pipeline (Find Ideas, Validate,
// per-stage Consult Claude, and the copy-to-Claude skill prompt). Edit
// this file when the strategy evolves — every AI touchpoint picks the
// change up automatically. Keep it under ~450 words so it doesn't
// crowd out the task-specific part of each prompt.
//
// The evidence cited below came from live outlier + comment research
// (Money & Macro, How Money Works, Casual Finance, and the comments on
// Casual Finance's "WTF Is Happening To Gold?!"), not guesswork —
// re-verify roughly quarterly, numbers drift.
// ============================================================

export const CHANNEL_BRIEF = `CHANNEL BRIEF — SoundMoney (every idea, title, verdict and draft must fit this)

WHO WE SERVE: everyday savers, roughly 30-55, who feel poorer every year, sense something is broken with money, and want to understand it and act. Niche hypothesis: "I help everyday savers protect their wealth from inflation and a broken money system." Austrian economics is the LENS, never the topic — no policy-advocacy packaging ("why the gold standard should return" is banned as a title/thumbnail concept; the lens lives inside the analysis).

LAUNCH FOCUS (current phase): inflation eating savings, framed through everyday prices and the viewer's own money — not macro abstractions. Secondary lanes: gold/hard assets (central banks are buying record amounts right now), monetary-history stories, and how the money system actually works.

PROVEN PACKAGING PATTERNS (from real outlier research in this exact niche — every idea must name which one it uses):
1. ANXIETY QUESTION — a question the viewer is already nervously asking ("Why Hasn't The Economy Collapsed... Yet?" 1.5M views; "How Is Everything Outpacing Inflation At The Same Time?" 1.3M — How Money Works, faceless).
2. HISTORY STORY — story-driven monetary history with a wealth lesson ("How the Nazis created an economic miracle" 1.5M at 5.8x channel median — Money & Macro; "The 1973 Stock Market Crash that Nobody Remembers" 1.2M on a then-tiny channel — Casual Finance).
3. CONTRARIAN TAKE — a confident claim against consensus ("Crypto Is a Brilliant Scam and I Can Prove It" 552k — Casual Finance).
4. CREDIBLE HOW-TO — actionable money-engine videos leaning on the ex-investment-manager credential ("How to Buy Gold Without Getting Ripped Off").
Straight textbook explainer titles die in this niche; an explainer must wear a question or story title.

AUDIENCE INSIGHT (comment-mined, verified): comments on this niche's big videos are dominated by doom anxiety (top comment "worst financial calamity in human history", 6.3k likes), everyday-price evidence (a McChicken going $1 to $3.50, 3.2k likes), and — the gap — requests for WHAT TO DO (a viewer's advice comment out-liked nearly everything at 2k likes). The big channels diagnose and never prescribe. Our signature: every video ends with a concrete "what this means for your savings" segment. That ending is also the monetization bridge.

FORMAT & CADENCE: faceless — voiceover + dense, high-quality visuals. 8-15 minute long-form. Target 2-3 uploads/week (1 excellent long-form + Shorts cut from it counts). Creator is a former investment manager — use that credibility explicitly wherever it strengthens trust.

MONETIZATION: Tier 1 niche. Now: AdSense + endemic affiliates (bullion dealers, brokers) on prescriptive videos. Later: lead magnet, then own product. Prefer ideas that can naturally carry an affiliate or feed the prescriptive ending.`

// Seed queries for the YouTube Data API outlier scanner — the searches most
// likely to surface overperforming videos in SoundMoney's lanes. Edit freely.
export const OUTLIER_SEED_QUERIES = [
  'inflation eating savings',
  'why is everything so expensive',
  'gold price record high',
  'central banks buying gold',
  'hyperinflation history',
  '1971 gold standard',
  'how money is created',
  'cash losing value',
  'how to buy gold beginner',
  'money printing explained',
]
