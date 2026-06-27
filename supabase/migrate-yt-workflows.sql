-- =============================================================
-- FlowState — Complete YouTube Workflow Migration
-- Sources:
--   Shane Hummus: 3 Moves, Outlier Filter, Holy Trifecta,
--                 Video Types, Upload Strategy, Shorts Algo
--   Shane Hummus Skills: cge-holy-trifecta, cge-scriptwriter,
--                 cge-settings, cge-niche-validator,
--                 cge-launch-optimization, cge-monetization
--   Dave Jeltman: Content System, Hook Generation System (6
--                 templates, pre-gen analysis, 3-option output),
--                 Script Planning Guide (Step 1 creativity Qs),
--                 Script Writing Rules (retention mechanics)
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

-- Clear completions first (no cascade on task_completions → tasks FK)
DELETE FROM task_completions WHERE task_id IN (
  SELECT t.id FROM tasks t
  JOIN stages s ON t.stage_id = s.id
  WHERE s.workflow_type_id IN (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002'
  )
);

DELETE FROM stages WHERE workflow_type_id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002'
);

-- =============================================================
-- YOUTUBE LONGFORM  (workflow_type_id: ...0002)
-- 8 Stages | ~8–10 hours total
-- =============================================================

INSERT INTO stages (id, workflow_type_id, name, description, order_index) VALUES
  ('33330002-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'System Setup', 'One-time: build your voice and strategy files so Claude always sounds like you', 1),
  ('33330002-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Idea', 'Find the proven opportunity, pick your video type, validate the angle', 2),
  ('33330002-0003-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Packaging', 'Holy Trifecta: title, thumbnail, hook — built before the script', 3),
  ('33330002-0004-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Script Plan', 'Architecture first — foundation, brain dump, creativity, locked structure', 4),
  ('33330002-0005-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Script', 'Write with full retention mechanics — Setup, Tension, Payoff every block', 5),
  ('33330002-0006-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Record', 'Energy beats perfection — best take wins', 6),
  ('33330002-0007-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Edit', 'Cut, b-roll, captions, repurpose to Shorts', 7),
  ('33330002-0008-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Launch', 'Full 10-step upload strategy — first 2 hours decide distribution', 8);


-- =============================================================
-- STAGE 1: SYSTEM SETUP (one-time — skip after first run)
-- Based on Dave Jeltman content system
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0001-0000-0000-000000000001',
 'Build your Writing Rules file',
 'The single most impactful file. Catches AI tells before you ever see them.',
 E'Create a document called "Writing Rules" in your content folder (Cowork, Notion, or Google Docs).\n\nStart with these rules, then add to it every time Claude sounds wrong:\n\nSENTENCE RULES:\n  Contractions everywhere — you''re, it''s, doesn''t, won''t\n  Numbers always numeric — $12,000 not "twelve thousand", 5 ways not "five ways"\n  No year stamps — use "right now" or "currently" instead\n  Complete sentences only — no fragments\n  Short punchy lines mixed with medium ones — vary the rhythm\n  5th grade reading level — plain vocabulary\n\nBANNED PHRASES (AI tells):\n  "Here''s the thing" / "Here''s the deal"\n  "At the end of the day"\n  "Game-changer" / "Level up" / "Unlock"\n  "Let me break this down"\n  "Something magical happens"\n  "What if I told you"\n  "In today''s fast-paced world"\n  "Moving forward"\n  "The bottom line is"\n  "Delve" / "Navigate" / "Robust"\n  Rhetorical questions ("Want to know why?")\n  Question fragments ("The key?" / "The result?")\n\nBANNED STRUCTURES:\n  Robotic triple-beat cadence ("it''s fast, it''s easy, it''s free")\n  "In conclusion" / "To summarise"\n  Starting sentences with "Additionally" or "Furthermore"\n\nREMINDER: Paste this file at the start of every script-writing session. Add to it every time you catch Claude sounding like a robot.',
 false, null, null,
 30, 1),

('33330002-0001-0000-0000-000000000001',
 'Build your Voice Profile file',
 'Who you are, what you believe, your contrarian takes. Separate from how you write.',
 E'Create a document called "Voice Profile" in your content folder.\n\nAnswer these questions — your answers become the file:\n\nWHO YOU ARE:\n  Your background in 2–3 sentences (the credibility that matters for your niche)\n  What you have done / been through that your audience has not\n  The version of yourself 5 years ago that you are making content for\n\nYOUR BELIEFS (the ones your niche would argue with):\n  List 3–5 things you believe about your topic that most people get wrong\n  These are your contrarian angles — the engine of your best videos\n\nYOUR TONE:\n  Energy level on camera: high / medium / calm\n  How direct are you: say it straight / build to it / lead with empathy first\n  What you are NOT: what do you hate seeing in other creators in your niche?\n\nYOUR EXAMPLES:\n  The 3 stories from your own life that best illustrate what you teach\n  The analogies you naturally reach for\n\nREMINDER: The Voice Profile captures the WHO and WHY. The Writing Rules captures the HOW. Keep them in separate files — mixing them muddies both.',
 true,
 E'I want to build a Voice Profile file for my YouTube channel.\n\nHere is my background: [YOUR BACKGROUND]\nMy niche: [NICHE]\nI help: [X] do [Y]\nWhat I believe that others in my niche get wrong: [YOUR CONTRARIAN TAKES]\nMy energy/tone on camera: [HIGH / MEDIUM / CALM]\n\nBased on this, write my Voice Profile document with these sections:\n1. Background (2–3 sentences of relevant credibility)\n2. Core beliefs (3–5 contrarian takes, stated directly)\n3. Tone descriptor (how I sound, what I am NOT)\n4. Signature phrases or expressions that sound like me\n5. The one sentence that is my north star for deciding what content to make\n\nWrite it in my voice, not yours. It should read like I wrote it about myself.',
 null,
 25, 2),

('33330002-0001-0000-0000-000000000001',
 'Build your Strategy file',
 'One specific person, one specific problem, one monetisation path. The filter for every video decision.',
 E'Create a document called "Strategy" in your content folder.\n\nThree sections:\n\n1. NICHE HYPOTHESIS:\n   "I help [SPECIFIC PERSON] do/overcome [SPECIFIC OUTCOME] by [METHOD/APPROACH]"\n   X must be specific — not "everyone" or "people interested in X"\n   Y must be a felt outcome they want\n   Run the niche validator prompt if you are not sure yet\n\n2. MONETISATION PATH (from Shane Hummus):\n   Beyond AdSense — pick 1–2 that fit your niche:\n     High ticket offer (coaching, done-for-you service) — $3k+\n     Mid tier (course, community) — $297–$997\n     Low ticket (ebook, templates) — $27–$97\n     Affiliate (products you genuinely use)\n     AdSense alone (only viable in high-RPM niches: finance, software, career)\n   Your niche RPM estimate: [low / medium / high]\n\n3. CONTENT FUNNEL (Shane Hummus video type order):\n   Listicle videos → How to videos → Case study videos → Testimonial/interview videos → Hard CTA\n   Start with Listicles (top of funnel, high view count)\n   Build to Case Studies (proof + expert positioning)\n   Move to Testimonials (social proof, trust)\n   Then you can sell\n\nREMINDER: If this file disagrees with your Voice Profile, the Strategy file wins. Current direction beats history.',
 true,
 E'I want to understand the revenue potential of my YouTube niche before I commit fully.\n\nMy niche: [NICHE]\nI help: [X] do [Y]\nMy background/credibility: [BACKGROUND]\n\nPlease:\n1. Estimate the typical AdSense RPM range for this niche (realistic range, not best case)\n2. Tell me if this niche can support high ticket offers ($3k+) and why or why not\n3. List 3 specific monetisation paths creators in this niche use successfully\n4. Give a rough monthly revenue estimate at 1k / 10k / 50k monthly longform views (AdSense + best-fit offer)\n5. Rate this niche''s monetisation potential 1–10 with a one-paragraph explanation\n6. Suggest which video type funnel fits this niche: Listicle → How to → Case study → Testimonial → Offer',
 null,
 20, 3),

('33330002-0001-0000-0000-000000000001',
 'Note your System Map rule',
 'One instruction that makes Claude read your files before writing anything',
 E'In every Claude session where you write scripts or content, paste this at the start:\n\n---\nBefore writing anything, read these files:\n1. Writing Rules — apply every rule to everything you produce\n2. Voice Profile — ground all arguments and takes in my beliefs, not yours\n3. Strategy — ensure this video serves my niche hypothesis and funnel position\n---\n\nThen attach or paste the three files.\n\nThis is Dave Jeltman''s core principle: Claude never writes from a blank slate. It always reads your direction first. Without this step, every output defaults to generic.\n\nOptional: if you use Claude Cowork, add this instruction to your Project Instructions box so it fires automatically every session.',
 false, null, null,
 10, 4);


-- =============================================================
-- STAGE 2: IDEA
-- Shane Hummus: outlier filter, comment mining, video types
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0002-0000-0000-000000000001',
 'Find outlier videos — apply the filter',
 'Copy proven demand. Own the angle. Never copy the video.',
 E'Go to YouTube. Search your niche keyword. Filter: Videos only.\n\nOUTLIER FILTER — all 4 must be true:\n  100,000+ views\n  Under 100,000 subscribers on that channel\n  5:1+ view-to-sub ratio\n  Weak thumbnail, bad audio, or low production\n\nThese are supply-demand imbalances — proven demand, beatable execution.\n\nFind 3–5 qualifying videos. Note:\n  Title\n  View count and sub count\n  Why the packaging is weak\n  What the video does and does not cover\n\nAlso check: 1of10.com — paste your 5 niche search terms, get the top 20 outliers per term, then analyse them with the Claude prompt.',
 true,
 E'Here are proven outlier videos in my niche:\n[Video 1: Title | Views | Subs | Packaging weakness | What it covers / misses]\n[Video 2: ...]\n[Video 3: ...]\n\nFor each:\n1. Confirm the outlier filter score (view/sub ratio, packaging weakness)\n2. Identify the core demand being satisfied\n3. Write a sharper title — same proven demand, stronger packaging\n4. Identify the biggest gap: what did the top comments ask for that this video did not deliver?\n\nThen: rank the 3 best opportunities and tell me which to make first and why.',
 'https://1of10.com',
 20, 1),

('33330002-0002-0000-0000-000000000001',
 'Mine the comments for the real demand',
 'Comments reveal what the audience wanted but did not get. That gap is your angle.',
 E'Open the outlier video you are modelling. Read the top 30–50 comments.\n\nLook for:\n  Questions that went unanswered\n  Frustrations with what was covered\n  Requests for follow-up videos\n  Exact language — the words people use to describe their pain\n\nThis comment data also feeds directly into your hook. Note the key phrases — you will use them in Stage 3.\n\nPaste 20–30 comments into the Claude prompt.',
 true,
 E'Here are top comments from: [VIDEO TITLE]\n\n[Paste 20–30 comments]\n\nAnalyse them:\n1. What question appears most that the video did NOT answer?\n2. What frustration surfaces repeatedly?\n3. What specific follow-up is being requested?\n4. What exact phrases does the audience use for their problem? (These are hook-ready words)\n5. Primary audience desire: what did they ACTUALLY want from this video?\n6. Gap in original: what did it fail to deliver?\n7. Write the ONE opening sentence for my version — addressing what the original missed, using their language\n\nSave the key phrases. They will be used in hook generation.',
 null,
 15, 2),

('33330002-0002-0000-0000-000000000001',
 'Choose your video type',
 'Different types serve different funnel positions. Pick the right one for where you are.',
 E'Shane Hummus video type framework — pick based on your current funnel position:\n\n  LISTICLE (Top of funnel — start here)\n    "Top X things / reasons / ways..."\n    High view count, broad appeal, builds channel awareness\n    Best for: new channel or new topic area\n\n  HOW TO (Mid funnel — once you have some audience)\n    "How to [specific outcome]"\n    Shows expertise, pulls search traffic\n    Best for: after listicles have proven the demand\n\n  CASE STUDY (Mid-to-bottom funnel)\n    "How I / How [person] did [specific result]"\n    Proof + teaching, positions you as the expert\n    Best for: when you have a result to showcase\n\n  TESTIMONIAL / INTERVIEW (Bottom funnel)\n    "I interviewed [person] / [Person] got [result]"\n    Social proof, builds trust before the ask\n    Best for: when you are ready to sell something\n\nFunnel order: Listicle → How to → Case study → Testimonial → Offer\n\nPick your type and write 5 title ideas for that type using the Claude prompt.',
 true,
 E'My niche: [NICHE]\nI help: [X] do [Y]\nVideo type I am making: [LISTICLE / HOW TO / CASE STUDY / TESTIMONIAL]\nOutlier video I am modelling: [TITLE]\n\nGenerate 5 video ideas for this video type:\n\nFor each idea:\n1. A click-worthy YouTube title\n2. The primary emotion or desire it targets (curiosity / relief / aspiration / validation)\n3. A 1-sentence hook for the first 15 seconds\n4. Funnel position: does this video attract new viewers, build trust, or convert?\n\nAlso include: here is an example competitor video that performed well — [PASTE OUTLIER TITLE AND ANGLE]. Sharpen each of my ideas so they are a stronger version of that proven format.',
 null,
 15, 3),

('33330002-0002-0000-0000-000000000001',
 'Lock your angle',
 'Specific beats broad. The new algo sorts into sub-niches, not broad topics.',
 E'Write your video idea as a locked hypothesis:\n\n"I help [AUDIENCE] understand/do [SPECIFIC THING] by showing them [YOUR UNIQUE ANGLE]"\n\nYour angle must genuinely differ from the outlier you found — not higher quality, a different perspective, structure, or take.\n\nAlso confirm:\n  Which video type: Listicle / How to / Case study / Testimonial\n  Where it sits in your funnel\n  The one emotion this video is designed to create\n\nOnce written, move to Packaging. Do not start scripting without a locked angle.',
 false, null, null,
 10, 4);


-- =============================================================
-- STAGE 3: PACKAGING — HOLY TRIFECTA
-- Shane Hummus + Dave Jeltman Hook Generation System
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0003-0000-0000-000000000001',
 'Build your title — 3 options',
 'Thumbnail → title → intro. They live or die together.',
 E'Title rules (Shane Hummus):\n  Keyword as close to the START as possible\n  Under 60 characters\n  ONE clear angle: Best / Worst / Avoid / How / Why / Warning — commit to one\n  Dollar amounts go in the thumbnail, not the title\n  Capitalise The First Letter Of Every Word (unless sad/mysterious vibe)\n  No year stamps\n  Read your title out loud — should sound natural in one breath\n\nWrite 3 title options. For each: one sentence on why it works. Pick the one that makes you stop scrolling.',
 true,
 E'Video topic: [TOPIC]\nTarget audience: [SPECIFIC PERSON]\nMy angle vs competitors: [YOUR ANGLE]\nVideo type: [LISTICLE / HOW TO / CASE STUDY / TESTIMONIAL]\nOutlier title I am modelling: [PASTE IT]\n\nWrite 3 title options:\n  Keyword first, under 60 characters\n  One clear angle each (Best / Worst / Avoid / How / Why / Warning)\n  For each: one sentence on why it works\n\nThen recommend the strongest and explain why.\n\nRules: no dollar amounts, no year stamps, capitalise first letter of every word, read-aloud natural.',
 null,
 15, 1),

('33330002-0003-0000-0000-000000000001',
 'Design your thumbnail concept',
 'Standalone-clear: cover the title, can a stranger still understand the video?',
 E'Thumbnail rules (Shane Hummus):\n  Standalone-clear — shrink to phone size, cover the title text, is the video topic still clear?\n  Text: 3–4 words MAX, ALL CAPS\n  Text must include the main keyword from the title\n  No years, no listicle numbers\n  3 colours max, big readable text with outline\n  Specific numbers beat round ones ($12,578 beats $12,000)\n  Text angle MUST match title angle — if title says WARNING, thumbnail cannot say BEST\n\nOutput format:\n  FACE: expression + position in frame (vary expressions — not always shocked)\n  TEXT: 3–4 word ALL CAPS phrase + 2 alternates\n  FOCAL: one prop, screenshot, graph, or background element that anchors the visual',
 true,
 E'Video title: [CHOSEN TITLE]\nTopic: [TOPIC]\nEmotional tone: [warning / exciting / informative / contrarian]\n\nDesign 3 thumbnail concepts:\n\nFor each:\n  FACE: expression and position (rotate — not everything is shocked face)\n  TEXT: 3–4 word ALL CAPS phrase + 2 alternates\n  FOCAL: one specific prop, screenshot, graph, or background element\n  VIBE CHECK: does thumbnail tone match title tone?\n\nTest: must be understood at phone size without reading the title.',
 null,
 20, 2),

('33330002-0003-0000-0000-000000000001',
 'Pre-generation analysis — plan your hook before writing it',
 'Dave Jeltman system: think strategically before generating. Prevents repetitive hooks across videos.',
 E'Before writing the hook, complete this analysis (takes 5 minutes, saves rework):\n\n1. VIDEO CONTEXT:\n   Is this more tactical or mindset-focused than my recent videos?\n   Does this have stronger proof/data than usual?\n   What is the primary emotion: frustration / hope / confusion / validation?\n\n2. PATTERN AVOIDANCE:\n   What opening structure did I use on my last 2–3 videos?\n   What template did I use most recently?\n   What transition phrases have I overused?\n   Write: "In this hook I will NOT use [X opening], [Y template], [Z transition]. Instead I will..."\n\n3. COMMENT SENTIMENT (from Stage 2):\n   Primary audience desire: what did they actually want?\n   Gap in the outlier video: what did it fail to deliver?\n   Key phrases from comments to echo in the hook\n\n4. TEMPLATE SELECTION:\n   F (Observation → Promise → Proof) — tactical, efficiency-first, 15–25s\n   A (Shared Struggle → Contrarian Insight) — mindset, vulnerability, 25–40s\n   B (Myth-Bust with Stakes) — clear wrong belief to bust, 20–30s\n   C (Pain Point Diagnosis) — diagnostic/multi-point content, 25–35s\n   D (Proof-First Evidence) — compelling visual proof exists, 20–30s\n   E (Quick Credibility → Promise) — USE SPARINGLY, weakest template\n\nWrite your analysis in notes, then generate 3 hook options.',
 false, null, null,
 10, 3),

('33330002-0003-0000-0000-000000000001',
 'Write your hook — 3 options (Safe / Experimental / Hybrid)',
 'Dave Jeltman Hook Generation System. Each option uses a different template. Efficiency checked.',
 E'Generate 3 distinct hook options. Each must use a different template. Each must be ready to record.\n\nOPTION 1 — SAFE:\n  Proven template, conventional structure\n  15–25 seconds, lower risk\n  Best for: time-sensitive uploads, tactical content\n\nOPTION 2 — EXPERIMENTAL:\n  Unexpected angle, riskier approach\n  25–40 seconds for mindset content\n  Best for: standout topics, differentiation\n\nOPTION 3 — HYBRID:\n  Combines 2 templates\n  20–35 seconds, balanced risk\n  Best for: complex topics where multiple angles work\n\nFor each hook verify:\n  Restates title promise in first 2 sentences using title keywords\n  Does NOT repeat phrases from the script body (check after scripting)\n  Estimated read time in seconds\n  Template used and why it fits this content\n\nFORBIDDEN in all hooks: "Here''s the thing", "At the end of the day", "Game-changer", rhetorical questions, question fragments, year stamps, AI tells from your Writing Rules file.',
 true,
 E'Attach: Writing Rules file, Voice Profile file\n\nVideo title: [TITLE]\nThumbnail: [describe]\nAudience pain: [PAIN POINT]\nContrarian insight: [THE "BUT ACTUALLY..." MOMENT]\nPre-gen analysis (pattern to avoid): [FROM PREVIOUS TASK]\nComment sentiment key phrases: [FROM STAGE 2]\nTemplate for Option 1: [F / A / B / C / D]\nTemplate for Option 2: [different from Option 1]\nTemplate for Option 3: [HYBRID — name both]\n\nWrite 3 hook options, each ready to record:\n\nOPTION 1 — SAFE (Template [X], target [Y] seconds)\n[Full hook text]\nWhy it works: [2 reasons]\nPattern avoidance: different from recent hooks because [specific structural difference]\nEfficiency: target was [X]s, landed at [Y]s\n\nOPTION 2 — EXPERIMENTAL (Template [X], target [Y] seconds)\n[Full hook text]\nRisk/reward: [explain the gamble]\nEfficiency: [same format]\n\nOPTION 3 — HYBRID (Templates [X]+[Y], target [Y] seconds)\n[Full hook text]\nWhy combining these: [explain]\nEfficiency: [same format]\n\nRules: contractions everywhere, numbers numeric, complete sentences, no AI tells.',
 null,
 25, 4),

('33330002-0003-0000-0000-000000000001',
 'Congruency check — title, thumbnail, and hook all match?',
 'Mismatched vibes kill CTR even when each piece is individually strong.',
 E'Read your title, thumbnail text, and chosen hook out loud.\n\nCheck:\n  All three promise the SAME thing?\n  All three have the SAME emotional tone (warning / exciting / educational / contrarian)?\n  If thumbnail is negative/warning, is the hook corrective — not cheerful?\n  Would a first-time viewer feel misled after 30 seconds?\n\nAlso: read your title out loud in one breath. Does it sound natural? If you stumble, rewrite it.\n\nFix any mismatch before touching the script. This check takes 5 minutes and prevents hours of rework.',
 false, null, null,
 5, 5);


-- =============================================================
-- STAGE 4: SCRIPT PLAN
-- Dave Jeltman Script Planning Guide Step 1
-- Foundation, brain dump, creativity questions, locked architecture
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0004-0000-0000-000000000001',
 'Define your foundation',
 'One specific person, one real problem, one transformation. The filter for every content decision.',
 E'Write out clearly before writing anything else:\n\nAUDIENCE (one line):\n  Not "people interested in X" — the one specific person\n  Their situation, what they have tried, where they are stuck\n\nCORE PROBLEM:\n  The pain in their words, not yours\n  What does it feel like to have this problem daily?\n\nROOT CAUSE:\n  Why do they have it? The real underlying reason\n  What common advice have they already tried that failed?\n\nTRANSFORMATION:\n  What can they specifically do/think/feel after watching?\n  This is your promise — every block must serve it\n\nThis foundation is read before every script block is written. Without it, your script drifts and retention drops.',
 false, null, null,
 10, 1),

('33330002-0004-0000-0000-000000000001',
 'Brain dump — no filtering, no organising',
 'Get everything out first. Volume beats curation at this stage.',
 E'Set a 10-minute timer. Dump everything you might include:\n\n  Personal stories and examples\n  Stats and data (use [FILL IN: description] for missing facts)\n  Analogies and metaphors you naturally reach for\n  Common objections you hear from your audience\n  Questions they ask constantly\n  Visual demonstrations or screen recordings\n  Frameworks, systems, or processes you teach\n  Case studies or results\n  The thing nobody else is saying about this topic\n\nNo filtering. No organising. Just volume.\n\nThen paste into Claude to get a proposed block structure.',
 true,
 E'Video title: [TITLE]\nAudience: [SPECIFIC PERSON]\nCore problem: [PROBLEM]\nTransformation: [WHAT THEY CAN DO AFTER]\nVideo type: [LISTICLE / HOW TO / CASE STUDY / TESTIMONIAL]\n\nHere is my full brain dump: [PASTE EVERYTHING]\n\nPropose:\n1. 3–5 strongest content blocks — what order creates the best story arc for this video type?\n2. What to cut (weakens the through-line or repeats)\n3. 1–2 stories or examples that would make this more specific and real\n4. Block structure: Hook → Block 1 → Block 2 → Block 3 → [Block 4?] → Final CTA block\n5. For each block: one-line purpose + Setup/Tension/Payoff summary\n6. CTA placement — where they land naturally, 140+ words apart',
 null,
 20, 2),

('33330002-0004-0000-0000-000000000001',
 'Creativity questions — deepen every block before writing',
 'Dave Jeltman Script Planning Guide: tension loops, visual storytelling, specificity audit, vulnerability.',
 E'For each content block, answer these before writing. They prevent generic, lecture-style content.\n\n1. TENSION LOOP MAP:\n   Where does tension raise and release every 30–60 seconds?\n   Pattern per block: Problem → Solution teased → Problem deepened → Solution revealed → NEW problem\n   Map 5–7 tension points across the whole video\n\n2. VISUAL STORYTELLING ("Show, don''t tell"):\n   For each abstract concept — what is the visual metaphor?\n   Instead of "the algorithm promotes based on performance" say "Look at this video — 50 views for 90 days, then 295k in one week. See this spike?"\n   For every major teaching point: what will be on screen? What will you say about it?\n\n3. SPECIFICITY AUDIT:\n   Replace every vague statement with a specific one:\n     "It works well" → "237% increase in click-through in 14 days"\n     "Recently" → "In the first 7 days"\n     "Some people" → "14 students in my first cohort"\n   Go through your brain dump and make this swap for every vague phrase\n\n4. CREDIBILITY THROUGH VULNERABILITY:\n   What is your "I used to be terrible at this" moment for this topic?\n     The struggle: specific failure with numbers\n     The turning point: what changed\n     The contrast: where you are now vs then\n   This story earns you the right to teach — it goes in Block 1\n\n5. THE "SO WHAT" TEST:\n   For each major point: "So what does this mean for the viewer?"\n     Point: [your point]\n     So what: immediate consequence for them\n     Which means: deeper implication\n     Therefore: action they should take\n   Run this for your 3–5 main points',
 true,
 E'Video title: [TITLE]\nProposed block structure: [PASTE FROM PREVIOUS TASK]\nBrain dump content: [PASTE RELEVANT POINTS]\n\nFor each block, provide:\n1. TENSION LOOP: raise → tease → deepen → release → re-tension\n2. VISUAL MOMENT: what specific thing is on screen at the key teaching point? (real data, before/after, demo — not "show analytics")\n3. STORY/EXAMPLE: specific narrative that compresses explanation — include the contrast (before/after), specific numbers, and the visual moment\n4. SPECIFICITY SWAP: list all vague statements in this block and replace with specific ones\n5. SO WHAT: for the main point of each block — immediate consequence, deeper implication, action\n\nAlso flag:\n  Which blocks feel "boring" and need the most creative help\n  Where you are over-explaining vs under-demonstrating\n  Whether there is a central metaphor that could run through the whole video',
 null,
 20, 3),

('33330002-0004-0000-0000-000000000001',
 'Lock the architecture',
 'Structure first. Writing second. Never the other way.',
 E'Confirm your final architecture before writing a single word of script:\n\n  Hook (20–30 seconds)\n  Block 1: [name + purpose + Setup/Tension/Payoff summary]\n  Block 2: [name + purpose + Setup/Tension/Payoff summary]\n  Block 3: [name + purpose + Setup/Tension/Payoff summary]\n  Block 4 (if needed): [name + purpose]\n  Final block: Insight → Gap → Bridge to next video\n\nCTA placements (must be 140+ words apart):\n  Lead magnet first mention: after Block __\n  Lead magnet second mention: after Block __\n  Like request: during Block __\n  End screen video: [which video and why it extends this one]\n\nOnce locked — do not change structure mid-script. Write everything inside the architecture you have committed to.',
 false, null, null,
 10, 4);


-- =============================================================
-- STAGE 5: SCRIPT WRITING
-- Dave Jeltman Script Writing Rules — full retention mechanics
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0005-0000-0000-000000000001',
 'Write the cold open',
 'Delivers the title promise in sentences 1–2. Like-button line before sign-off.',
 E'Cold open structure:\n  1. Your chosen hook (verbatim from Stage 3)\n  2. Big promise: "By the end of this video, you will know [specific outcome]"\n  3. Roadmap: group into 2–3 categories — NOT a full list of every block\n     Pattern: "I''m going to show you [X]. We''ll cover [CATEGORY 1], [CATEGORY 2], and [THE SURPRISING THING]. By the end, [OUTCOME]."\n  4. Like-button line: "If you appreciate this type of content, gently tap that like button."\n  5. Sign-off — rotate: "Let''s dive in." / "Here we go." / "Let''s get to work."\n\nVoice rules (from your Writing Rules file):\n  Contractions everywhere\n  Numbers always numeric\n  No year stamps\n  Complete sentences. No fragments.',
 true,
 E'Attach: Writing Rules file, Voice Profile file\n\nChosen hook (word for word): [PASTE FROM STAGE 3]\nBig promise (specific outcome): [WHAT THEY WILL KNOW/DO]\nBlock names: [Block 1], [Block 2], [Block 3]\n\nWrite my complete cold open (30–60 seconds when read aloud):\n  Hook verbatim\n  Big promise\n  Roadmap — 2–3 categories (not a list of every point)\n  Like-button line: "If you appreciate this type of content, gently tap that like button."\n  Sign-off line\n\nApply Writing Rules and Voice Profile throughout.',
 null,
 20, 1),

('33330002-0005-0000-0000-000000000001',
 'Write all content blocks with full retention mechanics',
 'Setup → Tension → Payoff every block. Forward Pulls Level 3+ every 45–60 seconds. WHY moments with immediate re-tension.',
 E'RETENTION MECHANICS — apply exactly:\n\nSETUP (30–40% of each block):\n  Present the problem — do NOT hint at the solution\n  Make them realise WHY they need the payoff\n  ❌ Do not: "Today I''m going to show you how to fix this..."\n  ✅ Do: describe the problem so specifically they think you are watching them\n\nTENSION (40–50%):\n  Story of discovering the answer: Struggle → Complication → Discovery → Resolution → Lesson\n  Withhold the payoff until the end of this section\n  Include the vulnerability/credibility moment from your creativity questions\n\nPAYOFF (10–20%):\n  Deliver the answer and action steps\n  Land it. Move on. Do not belabour it.\n  Efficiency test: remove one sentence — does it still work? If yes, cut it.\n\nFORWARD PULLS every 45–60 seconds (Level 3 minimum):\n  Level 3: "Let me show you why this title is killing your reach"\n  Level 4: "...and it''s not what you think" (curiosity gap)\n  Level 5: "Before I show you how to fix this, you need to see why it fails — because if you skip this, the tactics won''t work"\n\nWHY MOMENTS:\n  "That means [implication for viewer]"\n  "That''s because [cause]"\n  ⚠️ ALWAYS follow every WHY moment with new tension within 1–2 sentences\n  If the WHY moment just ends — tension released with nothing pulling forward — you lose the viewer\n\nFORBIDDEN: "Here''s the thing", "At the end of the day", "Game-changer", "Let me break this down", "Something magical happens", question fragments, rhetorical questions\n\nFIX-IT TEST (for each structural beat):\n  What retention function does this beat serve? (Forward Pull / WHY moment / Setup / Tension / Payoff)\n  Does your version preserve that function?\n  Are you only changing HOW it says it — not WHAT it does?\n  If changing WHAT → flag it with [CREATOR: Review this beat]',
 true,
 E'Attach: Writing Rules file, Voice Profile file\n\nLocked architecture: [PASTE FULL BLOCK STRUCTURE]\nFoundation: Audience=[X], Problem=[Y], Transformation=[Z]\nCreativity notes per block (tension loops, visual moments, stories, specificity swaps): [PASTE FROM STAGE 4]\n\nWrite all content blocks as continuous teleprompter-ready script.\n\nFor each block:\n  SETUP: introduce the problem without solving it (30–40%)\n  TENSION: story to the answer — Struggle → Complication → Discovery → Resolution → Lesson (40–50%)\n  PAYOFF: answer + action steps, land it and move on (10–20%)\n  Level 4+ Forward Pull every 45–60 seconds\n  WHY moment + immediate re-tension after each one\n  Visual moment on screen at the key teaching point\n\nUse [FILL IN: description] for any missing facts. Never invent stats, quotes, or names.\n\nApply Writing Rules throughout. Where architecture violates voice rules, fix the words but preserve the retention function.',
 null,
 60, 2),

('33330002-0005-0000-0000-000000000001',
 'Write the final block and read aloud',
 'Insight → Gap → Bridge. Then read the whole script out loud and time it.',
 E'FINAL BLOCK structure (Dave Jeltman):\n  INSIGHT: what they now understand or can do (do not signal the video is ending)\n  GAP: what is still missing, what happens next\n  BRIDGE: how the end screen video addresses that gap\n  Then: your lead magnet mention + final CTA\n\nWRITE THE FINAL BLOCK. Then:\n\nREAD ALOUD TEST:\n  Read the entire script at natural speaking pace. Time it.\n  Word count targets (130–150 words/minute):\n    8-min video: ~1,050–1,200 words\n    10-min video: ~1,300–1,500 words\n    15-min video: ~1,950–2,250 words\n\nCheck:\n  Any stumble → rewrite it\n  Any section you''d skip as a viewer → cut or rewrite\n  All [FILL IN] markers → resolve every one before recording\n  CTAs 140+ words apart\n  Hook lands within 30 seconds\n  Final block: completion, not a summary list\n\nEfficiency test per section: remove one sentence. Does it still work? If yes — keep it cut.',
 false, null, null,
 25, 3);


-- =============================================================
-- STAGE 6: RECORD
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0006-0000-0000-000000000001',
 'Setup check — 30-second test first',
 'Fix everything before the full take. 5 minutes here saves 30 later.',
 E'Before recording:\n  Audio: separate mic if possible. Clap once, listen back — no echo, hum, or hiss.\n  Lighting: natural light on your face (not behind you), or key light at 45 degrees.\n  Frame: face fills top 2/3 in landscape. Background: clean or one intentional element.\n  Script: teleprompter app, printed notes, or memorised — viewers cannot tell which.\n\nRecord a 30-second test. Watch it back. Fix anything before the full session.\n\nWatch the first 30 seconds WITHOUT sound. Does your video make sense if people hover over it? (Shane Hummus upload checklist rule.)',
 false, null, null,
 10, 1),

('33330002-0006-0000-0000-000000000001',
 'Record — minimum 3 full takes',
 'Energy beats perfection. Best take wins, not cleanest.',
 E'Do NOT stop for mistakes. Keep rolling through each take.\n\nRecord 3 full takes:\n  Take 1: warm-up, get the words right\n  Take 2: find your energy\n  Take 3: trust yourself and perform\n\nPick the take with:\n  Best energy and pace\n  Most natural delivery\n  NOT necessarily the fewest mistakes — editing fixes mistakes, not energy\n\nSpeaking tip: talk to one specific person — the person from your Strategy file. Picture them across the table. That is the energy.',
 false, null, null,
 60, 2);


-- =============================================================
-- STAGE 7: EDIT
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0007-0000-0000-000000000001',
 'Rough cut — pace before polish',
 'If it drags at 1.5x speed, there is more to cut.',
 E'Import all footage.\n\n1. Cut every pause over 0.5 seconds\n2. Keep only the best take per section\n3. Watch at 1.5x speed — if it feels slow, keep cutting\n4. Do NOT colour grade or add music yet\n\nUse Descript for AI-assisted rough cutting — put in your voiceover and let it handle the first pass. You review and control all final cuts. Do not let AI edit the full video unsupervised.',
 false, null, null,
 60, 1),

('33330002-0007-0000-0000-000000000001',
 'B-roll, graphics, and captions',
 'New visual every 30–60 seconds. Captions are not optional.',
 E'B-ROLL:\n  New visual every 30–60 seconds minimum\n  Screen recordings, stock (Pexels — free), your own footage\n  Graph or demo beats 1000 words\n\nGRAPHICS:\n  Text overlays for key stats, terms, and takeaways\n  Chapter markers so viewers can navigate\n  Any graphs, before/after comparisons, screenshots\n\nCAPTIONS:\n  Auto-captions in Premiere, DaVinci, or CapCut — check accuracy\n  Style: bold white text, black outline, readable at phone size\n  Position: mid-screen or lower third\n  80% of viewers watch without sound — captions are mandatory\n\nExport: H.264, 1920x1080, 30fps.',
 false, null, null,
 60, 2),

('33330002-0007-0000-0000-000000000001',
 'Repurpose to Shorts',
 'Two distribution channels from one recording session.',
 E'Find 2–3 moments from your longform that work as standalone Shorts (under 60 seconds, no prior context needed):\n  A shocking stat or revelation\n  A quick how-to with clear before/after\n  A contrarian take or myth-bust\n  A story with a strong punchline\n\nFor each clip:\n  Crop to vertical 9:16\n  Add captions\n  Add hook text overlay for first 3 seconds\n  Description: link back to full video + #Shorts\n  No CTA in the body — the Shorts algo penalises engagement bait\n\nShane Hummus: channels that post both formats get more algorithmic reach. This is not optional if you want to grow faster.',
 true,
 E'Here is my full video script: [PASTE]\n\nIdentify 3 moments that work as standalone YouTube Shorts (under 60 seconds, no prior context needed).\n\nFor each:\n1. The clip script section (paste it)\n2. Short-specific hook for seconds 0–3 (pattern interrupt — under 8 words)\n3. Short title (under 60 characters, curiosity or bold claim)\n4. 2-line Short description: what it is (keyword included) + "Full video in description" + #Shorts\n\nRule: each Short must be understood without watching the full video.',
 null,
 30, 3);


-- =============================================================
-- STAGE 8: LAUNCH — Full 10-step CGE Settings + tracking
-- Shane Hummus: cge-settings + "7 Boring Things" + tracking
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0008-0000-0000-000000000001',
 '① Update end screens on your best videos — do this BEFORE you go public',
 'Redirect existing traffic to your new upload. This is your head start.',
 E'Before the new video goes live:\n\n1. Open YouTube Analytics\n2. Find your 3 best-performing videos (highest views in last 90 days)\n3. Open each → YouTube Studio → Editor → End Screens\n4. Update the "most recent upload" end screen to this new video\n\nThis gives your new video immediate traffic from viewers already on your channel. The algorithm cannot give you this — only you can.\n\nDo it before you publish.',
 false, null, null,
 10, 1),

('33330002-0008-0000-0000-000000000001',
 '② Check your title appears in YouTube search',
 'Search your video title in the YouTube search bar. Verify it surfaces.',
 E'After publishing (as Unlisted):\n\nSearch your exact video title in the YouTube search bar.\n\nDoes your video appear in results? If not:\n  Your title may be too obscure or too competitive\n  Check rapidtags.io — enter your video title and niche keyword to get the keywords top-performing videos use\n  Add the top relevant keywords to your title, description, and tags\n  Rapid metadata alignment helps YouTube categorise your video faster\n\nAlso check: does your video appear under "Videos" filter? That is where most discovery happens.',
 false, null,
 'https://rapidtags.io',
 10, 2),

('33330002-0008-0000-0000-000000000001',
 '③ Write and publish SEO description',
 'First 2 lines appear in search. Make them searchable AND compelling.',
 E'DESCRIPTION structure:\n  Lines 1–2: restate the video topic with the primary keyword, naturally (appears in search results)\n  Line 3: your most important link (newsletter, free resource, course)\n  Timestamps (00:00 format)\n  200–300 word SEO paragraph with related keywords\n  Social links\n  DO NOT put links above lines 1–2 — it pushes your searchable text below the fold',
 true,
 E'Video title: [TITLE]\nPrimary keyword: [KEYWORD]\nMain link: [URL]\nTimestamps: [PASTE LIST]\n\nWrite:\n1. A 300-word SEO description — first 2 lines include keyword naturally, then link, then timestamps, then SEO paragraph with related terms\n2. 5 relevant tags for the video\n\nRule: lines 1–2 must be naturally searchable with the keyword. No links above the fold.',
 null,
 10, 3),

('33330002-0008-0000-0000-000000000001',
 '④ Write pinned comment and community post',
 'Pinned comment drives engagement. Community post drives immediate views.',
 E'PINNED COMMENT:\n  Engagement question to drive replies\n  Your main link\n  Soft CTA\n  Under 200 characters, conversational voice\n  Post immediately after upload → three-dot menu → Pin\n\nCOMMUNITY POST:\n  New upload announcement with urgency\n  Under 40 words\n  What the video is about + what they will get\n  A question to drive comments\n  Post as soon as the video goes public\n\nNever auto-post AI-written comment replies. Customise every reply — add the viewer''s name and a specific reference to what they said.',
 true,
 E'Video title: [TITLE]\nAudience: [AUDIENCE]\nKey insight: [WHAT THEY LEARN]\nMain link: [URL]\n\nWrite:\n1. Pinned comment — engagement question + link + soft CTA, under 200 characters, sounds like a real person\n2. Community post — new upload announcement, under 40 words, ends with a question, urgent tone',
 null,
 10, 4),

('33330002-0008-0000-0000-000000000001',
 '⑤ Watch the intro without sound and read title out loud',
 'Shane Hummus checks: silent watch + out-loud title read. Both catch problems before they cost you.',
 E'TWO QUICK CHECKS before going fully public:\n\n1. SILENT WATCH:\n   Watch your first 60 seconds with the volume off\n   Does your video make sense if someone hovers over it without sound?\n   Captions, text overlays, and your facial expression should carry the story\n   If it is confusing without audio — add a text overlay at the opening\n\n2. READ TITLE OUT LOUD:\n   Say your title out loud in one breath\n   Does it sound natural and easy to understand?\n   Would you say this to a friend?\n   If you stumble or it sounds awkward — rewrite it before publishing\n\nBoth checks take under 2 minutes combined.',
 false, null, null,
 5, 5),

('33330002-0008-0000-0000-000000000001',
 '⑥ Add to playlist and set end screens to playlist URL',
 'Playlists drive binge-watching. End screens should point to playlist, not single video.',
 E'PLAYLISTS:\n  Add this video to the most relevant playlist\n  If no relevant playlist exists — create one now (this helps YouTube and drives session time)\n  Open the video INSIDE the playlist → copy that URL\n  This URL contains both the video ID and playlist ID — it extends binge-watching\n\nEND SCREENS:\n  Set end screens to point to the playlist URL (not a single video)\n  Position end screen for "next best video" at the top right\n  Position end screen for "subscribe" at the bottom left\n  Both should appear in the last 20 seconds\n\nSHANE HUMMUS NOTE: Playlists are really important. Viewers who watch via a playlist watch more videos per session. This is a free retention multiplier.',
 false, null, null,
 10, 6),

('33330002-0008-0000-0000-000000000001',
 '⑦ Drop 3 comments and go public',
 'Kickstart conversation before others arrive. Then stay active for 30–60 minutes.',
 E'Before going fully public:\n\n1. Drop 3 comments on your own video immediately after it goes live:\n   Comment 1: Ask a question related to the video topic\n   Comment 2: Share an extra tip that did not make it into the video\n   Comment 3: A genuine insight or opinion\n   Pin the best one\n\n2. These start the conversation before other viewers arrive — the algo watches early engagement signals\n\n3. Go public\n\n4. Stay in comments for 30–60 minutes after publishing\n   Reply to every comment\n   A comment reply counts as engagement and extends reach\n   NEVER use auto-posted AI replies — customise each one\n\nThis 30-60 minute window is the single most leveraged action after publishing.',
 false, null, null,
 15, 7),

('33330002-0008-0000-0000-000000000001',
 '⑧ Set up link tracking',
 'Shane Hummus Section 6: track clicks and sales. Identify which videos convert — make more of those.',
 E'Set up tracking for every link you promote in this video:\n\n1. Go to short.io (or bit.ly as a free alternative)\n2. Create a short link for your main CTA (newsletter, lead magnet, course)\n3. Name it clearly: e.g. short.io/[yourchannel]-[videotopic]\n4. Replace the raw URL in your description and pinned comment with the short link\n\nTRACKING HABIT:\n  After 7 days: check the short.io dashboard — how many clicks did this video drive?\n  After 30 days: compare click-through rate across your videos\n  Identify which topics, video types, and CTAs convert best\n  Make more of the converting videos — that is the feedback loop\n\nSHANE HUMMUS NOTE: Subscriber and view count means nothing when it comes to making money. The only metric that matters is: did the right viewers find you, and did they take action?',
 false, null,
 'https://short.io',
 15, 8),

('33330002-0008-0000-0000-000000000001',
 '⑨ Repurpose longform into Shorts — publish within 24 hours',
 'Channels posting both formats get more algorithmic reach.',
 E'Take the Short clips you prepared in the Edit stage and publish them now.\n\nFor each Short:\n  Upload vertical video\n  Set title (under 60 characters, curiosity or bold claim)\n  Paste description: what it is (keyword included) + "Full video in description" + #Shorts\n  Do NOT set a custom thumbnail for Shorts\n  Publish immediately (do not schedule)\n  In the Short description: link to the full video\n\nWhy do this within 24 hours of the main upload?\n  The main video is at peak visibility — Shorts extend that reach\n  Viewers who find you via Shorts discover the full video in the description\n  This compounds your distribution without extra filming time',
 false, null, null,
 10, 9),

('33330002-0008-0000-0000-000000000001',
 '⑩ 48-hour launch check — diagnose and carry the lesson',
 'CGE Launch Optimization: one diagnosis, one fix. The feedback loop is how channels improve.',
 E'After 48 hours, check YouTube Analytics.\n\nDIAGNOSTIC ORDER (stop at the first failure you find):\n\n  1. PACKAGING (CTR):\n     Is your CTR below your channel average?\n     → Thumbnail/title problem — people saw it and did not click\n     → Fix NOW: swap thumbnail and/or title today (this is the only live fix)\n\n  2. INTRO (first 30–60s retention cliff):\n     CTR is fine but steep early drop in retention?\n     → Intro did not pay off the click\n     → Fix on next video: rewrite hook and cold open\n\n  3. BODY (mid-video bleed):\n     Hook holds but retention drops through the middle?\n     → Pacing issue — sections too long, payoffs too late\n     → Fix on next video: tighter Setup/Tension/Payoff, more Forward Pulls\n\n  4. IDEA (healthy CTR and retention but low impressions):\n     The packaging worked — not enough people wanted this topic\n     → Fix on next video: stronger outlier filter on idea selection\n\nONE diagnosis. ONE fix. Write the lesson in your playbook.\n\nAlso: go into your best-performing old videos and update end screens to point to this video if it is performing well.',
 true,
 E'My video has been live for 48 hours.\n\nAnalytics:\n  CTR: [X%] — my channel average is [Y%]\n  Average view duration: [X minutes / X%]\n  Impressions: [number]\n  Retention graph: [cliff in first 30s / gradual slope / holds then drops at Xmin / healthy throughout]\n  Title: [TITLE]\n  Thumbnail: [describe briefly]\n\nDiagnose:\n1. Which failure point — packaging, intro, body, or idea?\n2. What evidence from my numbers supports this?\n3. The ONE fix for this video right now (only packaging is fixable on a live video — swap thumbnail/title)\n4. The ONE change for my next video\n5. One-sentence lesson to add to my playbook',
 null,
 15, 10);


-- =============================================================
-- LONGFORM SYSTEM SETUP — ADDITIONS
-- Dave Jeltman: Guidelines file, Money file
-- Shane Hummus: cge-niche-validator (one-time channel setup)
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0001-0000-0000-000000000001',
 'Build your Guidelines file',
 'Dave Jeltman: the filter for what you will and will not make. Prevents scope creep.',
 E'Create a document called "Guidelines" in your content folder.\n\nThis is the shortest file but one of the hardest to write. Answer:\n\nCHANNEL SCOPE:\n  What topics are IN? (3–5 specific areas)\n  What topics are OUT? (list 5 things that feel adjacent but do not serve your niche hypothesis)\n  The test: "Would my ideal viewer expect this from my channel?" If no — it is out.\n\nCONTENT STANDARDS:\n  Minimum quality bar: what must every video have before it is published?\n  What does a "B-minus" video look like? Below this line, do not publish.\n  Length range: your minimum and maximum video lengths (e.g. 8–18 min longform, 30–55s Shorts)\n\nPACE AND VOLUME:\n  Your sustainable upload rhythm — the cadence you can keep for 6 months, not your best week\n  How many hours per video does your current setup allow?\n\nBRAND VOICE:\n  One sentence: what is your channel NOT (however tempting)?\n  What would make a subscriber unsubscribe? (Important: avoid it consistently)\n\nREMINDER: The Guidelines file is where you say no to yourself. Without it, scope creep fragments your audience. When a video idea feels exciting but different — check it against this file first.',
 false, null, null,
 20, 5),

('33330002-0001-0000-0000-000000000001',
 'Build your Money file',
 'Dave Jeltman: one source of truth for every offer, link, and affiliate. Never hunt for a URL again.',
 E'Create a document called "Money" in your content folder.\n\nThis is your single source of truth for everything revenue-related. Every time you create or update an offer, update this file.\n\nSECTIONS:\n\n1. PRIMARY OFFER:\n   Name, price, and short description (1 sentence)\n   Link (the actual URL you promote on YouTube)\n   short.io tracking URL: [your tracked link here]\n   Current conversion rate: [% if known, else TBD]\n\n2. SECONDARY OFFERS (if any):\n   Same format for each — name, price, link, tracked link\n\n3. LEAD MAGNET:\n   What it is + the URL\n   Where it sits in the funnel (top/mid)\n\n4. AFFILIATE LINKS:\n   Product | Commission % | Link | Disclosure requirement\n   Only list products you genuinely use\n\n5. ADSENSE:\n   Your channel RPM estimate (update from Analytics quarterly)\n   Notes on mid-roll placement (your standard rule)\n\n6. NEXT OFFER (in development):\n   What you are building, target launch, price point\n\nREMINDER: Paste the relevant section of this file when asking Claude to write descriptions, pinned comments, or CTAs. Claude will always use the right link. Never manually copy links into scripts — always pull from this file.',
 false, null, null,
 20, 6),

('33330002-0001-0000-0000-000000000001',
 'Run the niche validator — one-time before committing',
 'Shane Hummus Niche 2.0: hybrid personal brand, money tiers, 5-year commitment test. Skip if niche is already locked.',
 E'This task is a one-time decision gate — complete it BEFORE making your first video, or run it again if you are pivoting.\n\nThe niche validator checks three things:\n  1. Is there a monetisable audience?\n  2. Can you create in this space for 5 years?\n  3. Is there a realistic path to $10k/month?\n\nPaste the prompt into Claude. Answer honestly. If Claude pushes back on your niche — listen.\n\nShane Hummus Niche 2.0 principle:\n  Do NOT pick a niche based solely on passion. Pick the intersection of:\n    Something you know well (experience/credibility)\n    Something people will pay to learn or solve\n    Something with clear monetisation at the top of funnel (AdSense RPM + offer potential)\n\nAfter running the validator, document the conclusion in your Strategy file.',
 true,
 E'I want to validate my YouTube niche before I commit to it.\n\nHere is my hypothesis:\n  I help [SPECIFIC PERSON] do/overcome [SPECIFIC OUTCOME] by [METHOD]\n  My background/credibility: [YOUR BACKGROUND]\n  Why I can create in this space for 5 years: [YOUR REASON]\n\nPlease:\n1. Rate this niche 1–10 on monetisation potential — explain the rating\n2. Tell me the realistic AdSense RPM range for this niche\n3. Name the strongest offer type for this niche (coaching / course / affiliate / SaaS / physical) and why\n4. Is the "I help X do Y" specific enough? If not, give 3 sharper alternatives\n5. What is the one biggest risk that kills channels in this niche?\n6. Name 2 existing channels in this niche that are making money — what is their model?\n7. Verdict: start, pivot, or hard no? Give one specific reason.',
 null,
 30, 7);


-- =============================================================
-- LONGFORM IDEA STAGE — ADDITIONS
-- cge-monetization: dedicated monetisation check per video
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0002-0000-0000-000000000001',
 'Monetisation check — does this video serve the money path?',
 'Before committing to a video, confirm it moves someone toward your offer. Views that do not convert are vanity.',
 E'Before locking your video idea, run the monetisation check:\n\n1. Which audience segment does this video attract?\n   Top of funnel (new viewers, awareness) → should pull into your lead magnet\n   Mid funnel (warm audience, consideration) → should move toward your offer\n   Bottom funnel (buyers, trust) → should contain a direct CTA\n\n2. Does this video type fit where you are in the funnel?\n   If you have made 10 Listicles and no How-tos yet — this video should probably be a How-to\n   If you are ready to sell — does this video create the buying context?\n\n3. Where does the viewer go AFTER this video?\n   Lead magnet (if top of funnel)\n   Course/offer page (if mid-to-bottom funnel)\n   Another video in your funnel (via end screen)\n\n4. What is the CTA for this video? Write it now. You need it for the script.\n\nIf this video does not fit the funnel, either reframe it or save the idea for later.',
 true,
 E'I am planning a YouTube video and want to check it fits my monetisation path.\n\nMy niche: [NICHE]\nI help: [X] do [Y]\nMy primary offer: [OFFER NAME + PRICE]\nMy lead magnet: [LEAD MAGNET]\nVideo idea: [VIDEO TITLE/TOPIC]\nVideo type: [LISTICLE / HOW TO / CASE STUDY / TESTIMONIAL]\nMy funnel stage for this video: [TOP / MID / BOTTOM]\n\nPlease:\n1. Confirm whether this video type fits my current funnel position\n2. Tell me what percentage of viewers from this topic are likely to be buyers vs browsers\n3. Write the strongest CTA for this video (one sentence, fits naturally at the 70% mark)\n4. If I should add a mid-roll mention of my offer — write a 2-sentence mid-roll CTA\n5. Suggest which end screen video would best extend this viewer''s journey toward my offer',
 null,
 10, 5);


-- =============================================================
-- LONGFORM LAUNCH STAGE — MISSING CGE SETTINGS STEPS
-- From cge-settings skill: transcript audit, thumbnail poll,
-- two-screen pacing audit, mid-roll placement
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330002-0008-0000-0000-000000000001',
 '⑪ Transcript audit — clean the auto-generated captions',
 'The transcript is used by YouTube for search. Errors hurt SEO and credibility.',
 E'After upload, go to YouTube Studio → Subtitles → Auto-generated.\n\nCheck for:\n  Misheard proper nouns, brand names, or niche-specific terms\n  Numbers that were mis-transcribed (critical for any finance/stats content)\n  Missing punctuation that breaks readability\n  Any section where the auto-transcript is embarrassing or confusing\n\nEdit corrections directly in the subtitles editor.\n\nAlso: the clean transcript is useful raw material. Paste it into Claude to:\n  Pull shareable quotes for social posts\n  Generate a blog-post version of the video\n  Create the chapter titles and timestamps if you have not already\n  Build the Shorts scripts from the strongest 60-second moments',
 true,
 E'Here is the auto-generated transcript from my YouTube video: [PASTE TRANSCRIPT]\n\n1. Identify any obvious transcription errors, misheard words, or broken sentences\n2. Extract 3–5 shareable quotes suitable for a community post or tweet\n3. Generate a list of chapter titles with approximate timestamps (based on topic shifts in the transcript)\n4. Identify the 2–3 best 60-second moments for repurposing as YouTube Shorts',
 null,
 15, 11),

('33330002-0008-0000-0000-000000000001',
 '⑫ Thumbnail A/B poll — let the audience pick before YouTube does',
 'Post two thumbnail options in your community tab. Highest engagement wins. Real data beats your own preference.',
 E'This works if you have 2+ thumbnail options from Stage 3, OR if you are testing a new thumbnail against your published one.\n\nPOST STRUCTURE:\n  Show both thumbnails as images\n  "Which thumbnail would make YOU click? Comment A or B"\n  Keep the poll open 24 hours\n  The one with more A or B comments wins — swap the live thumbnail if B wins\n\nWHY THIS MATTERS:\n  Your audience''s click is the only data that counts\n  Changing a thumbnail on a live video is the only performance lever you can pull post-publish\n  Shane Hummus: a thumbnail swap on a video stuck at 2k views is the first fix to try\n\nAfter 24 hours:\n  Implement the winning thumbnail immediately\n  Note which visual style won — add to your thumbnail playbook',
 true,
 E'Write a YouTube community post for a thumbnail A/B test.\n\nVideo title: [TITLE]\nThumbnail A concept: [describe — face/text/focal]\nThumbnail B concept: [describe — face/text/focal]\n\nWrite:\n1. Community post (under 80 words) — shows both options, asks viewers to vote A or B, warm/curious tone\n2. A follow-up post for 24h later announcing the winner (template — fill in after results)',
 null,
 10, 12),

('33330002-0008-0000-0000-000000000001',
 '⑬ Two-screen pacing audit',
 'Watch on desktop AND phone. Different screen sizes expose different pacing problems.',
 E'CGE Settings two-screen audit:\n\nDESKTOP (full focus):\n  Watch your video at 1x speed — the real viewer experience\n  Mark timestamps where you personally lost focus\n  Mark any section that feels slower than the rest\n\nPHONE (distracted):\n  Watch on your phone with one screen of distraction nearby\n  This simulates how most viewers actually watch\n  Where did you reach for the other screen? That section needs cutting or energy injection\n\nACTION:\n  If you find a dead zone: note the timestamp and reason in your editing playbook\n  You cannot re-edit a published video, but you can fix the same pattern in the next one\n  If the dead zone is EARLY (before 2 minutes): consider updating the hook or adding a pattern interrupt via a text overlay card (YouTube cards can be added to published videos)\n\nNote the timestamps and findings — they feed directly into the 48-hour launch check diagnosis.',
 false, null, null,
 15, 13),

('33330002-0008-0000-0000-000000000001',
 '⑭ Mid-roll ad placement — 3 max, never at a cliff-hanger',
 'Mid-roll timing directly affects watch time. Wrong placement loses viewers. Right placement loses no one.',
 E'Open YouTube Studio → Content → your video → Monetisation → Ad breaks.\n\nMID-ROLL RULES:\n  Maximum 3 mid-roll placements\n  Place at natural pauses — end of a section, before a new point begins\n  NEVER place at a cliff-hanger or Forward Pull moment (viewers who came for the payoff will leave)\n  Minimum 2 minutes between placements\n  First mid-roll: no earlier than the 25% mark\n\nFIND YOUR NATURAL PAUSES:\n  End of each content block\n  Just before you start a new numbered point (in listicles)\n  After a story resolves and before the lesson begins\n\nSHANE HUMMUS NOTE: CPM from mid-rolls beats AdSense RPM on short videos. On a 10+ minute video, 3 well-placed mid-rolls can double your AdSense revenue per 1k views vs a video with no mid-rolls. Do not skip this step.\n\nAfter placing: note the timestamps in your Money file under "AdSense notes".',
 false, null, null,
 10, 14);


-- =============================================================
-- YOUTUBE SHORTS  (workflow_type_id: ...0001)
-- 5 Stages | ~1.5–2 hours total
-- =============================================================

INSERT INTO stages (id, workflow_type_id, name, description, order_index) VALUES
  ('33330001-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Idea', 'Repurpose from longform or find a standalone outlier', 1),
  ('33330001-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Hook & Script', '60 seconds max — every second earns the next', 2),
  ('33330001-0003-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Record', 'Vertical, tight, high energy', 3),
  ('33330001-0004-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Edit', 'Pace, captions, pattern interrupts', 4),
  ('33330001-0005-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Publish', 'Trust score, timing, and the two metrics that matter', 5);


-- =============================================================
-- SHORTS STAGE 1: IDEA
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330001-0001-0000-0000-000000000001',
 'Find your Short idea',
 'Two routes: repurpose from longform, or standalone outlier',
 E'ROUTE 1 — REPURPOSE (fastest, recommended):\n  Find the single strongest insight, stat, or story from your latest longform\n  Must make sense WITHOUT context from the full video\n  Description: link back to the longform\n  This is a cheat code — two channels from one recording session\n\nROUTE 2 — STANDALONE:\n  Search your niche keyword on YouTube Shorts\n  Apply the outlier filter: high views, low subs, weak packaging\n  One proven idea, your style, one insight only\n\nTRUST SCORE reminder (Shane Hummus Shorts algo):\n  Aged channels with consistent upload history get more initial distribution\n  Trust score = your channel''s reliability signal to YouTube\n  Low trust = low views regardless of content quality\n  Build trust by uploading consistently — even average Shorts build trust',
 true,
 E'My niche: [NICHE]\nI help: [X] do [Y]\n\nGenerate 5 YouTube Short ideas.\n\nFor each:\n1. One-line concept\n2. Hook — first 3 seconds, under 8 words, instant curiosity or shock\n3. The single takeaway (what does the viewer walk away knowing?)\n4. Type: Repurpose / Standalone / Trending\n\nPrioritise ideas that:\n  Work without context from a full video\n  Have one clear insight or reveal\n  Can be covered in 30–55 seconds',
 null,
 15, 1),

('33330001-0001-0000-0000-000000000001',
 'Lock your hook — the entire Short in 8 words',
 'VVSA and AVD start here. A weak hook cannot be recovered.',
 E'The hook IS the Short. If it does not stop the scroll, nothing else matters.\n\nSHORTS HOOK RULES:\n  Seconds 0–3: pattern interrupt — curiosity, shock, or bold statement\n  Under 8 words\n  NO CTA: "follow me for more" = immediate swipe\n  Never start with "Hey guys" or any greeting\n  Never start with your channel name\n\nMETRICS YOUR HOOK CONTROLS:\n  VVSA (Viewed vs Swiped Away): target above 80%\n  AVD (Average View Duration): target 100% on 30-second Shorts, 85%+ on 40–60s Shorts\n\nVIEW COUNT JAIL EXPLAINED (Shane Hummus):\n  100–10k views: low quality signal or low trust score\n  10k–30k views: VVSA or AVD slightly off, or niche is oversaturated\n  30k+ "jail": your Shorts have passed every seed test — YouTube just needs more data. Keep uploading.\n\nTest: would YOU stop scrolling if this played on your feed? Be honest.',
 false, null, null,
 10, 2);


-- =============================================================
-- SHORTS STAGE 2: HOOK & SCRIPT
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330001-0002-0000-0000-000000000001',
 'Write the Short script',
 'Hook → Value → Payoff. One idea. Zero fat. Under 150 words.',
 E'Script structure (60 seconds = ~150 words maximum):\n\n  0–3s:  HOOK — pattern interrupt. Bold statement, shocking fact, instant curiosity.\n  3–50s: VALUE — deliver the ONE thing. No tangents. No background. No intro.\n  50–57s: PAYOFF or LOOP — satisfying reveal, OR loop back to opening hook phrase\n  57–60s: Optional soft CTA — "More on this on my channel" (passive only)\n\nDO NOT:\n  Mid-video CTAs like "smash that like button" — the algo penalises engagement bait\n  Start with "Hey guys" or channel name\n  Cover more than one idea\n\nDO:\n  Keep it to one insight\n  Let the content be the reason to follow\n  Make the payoff satisfying enough that they replay it',
 true,
 E'Short concept: [YOUR IDEA]\nHook (first 3 seconds, word for word): [YOUR HOOK]\nCore insight or reveal: [THE ONE THING]\n\nWrite a complete 60-second Short script:\n  0–3s: Hook (verbatim as provided)\n  3–50s: Deliver the insight with one supporting detail, example, or mini-story\n  50–57s: Payoff or loop back to hook phrase\n  57–60s: Optional passive CTA\n\nRules:\n  Under 150 words total\n  No mid-video engagement CTAs\n  Complete sentences, contractions everywhere, numbers numeric\n  One idea — no tangents\n  Must run under 60 seconds at natural speaking pace',
 null,
 20, 1),

('33330001-0002-0000-0000-000000000001',
 'Read aloud and time it',
 '60 seconds is the hard ceiling. Cut until it fits.',
 E'Use a stopwatch. Read at natural speaking pace — not rushed.\n\nIf over 60 seconds:\n  Find the weakest sentence and cut it\n  Read again. Repeat until under 60 seconds.\n\nTest: at any moment, if you would swipe on yourself, that section goes.',
 false, null, null,
 5, 2);


-- =============================================================
-- SHORTS STAGE 3: RECORD
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330001-0003-0000-0000-000000000001',
 'Record — vertical, high energy, 3 takes',
 'The take with the best energy wins. Not the most polished.',
 E'Setup:\n  Vertical 9:16 — face fills the top half of frame\n  Light on your face, not behind you\n  Clean or intentional background\n\nRecording:\n  Do NOT stop for mistakes — keep rolling\n  Record 3 takes minimum, vary energy\n  Pick the most natural and energetic take\n\nCONSISTENCY NOTE:\n  One Short per day in a high-trust state beats three Shorts then silence\n  The trust score is built by consistency, not by individual viral hits\n  Post even when it is not perfect',
 false, null, null,
 20, 1);


-- =============================================================
-- SHORTS STAGE 4: EDIT
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330001-0004-0000-0000-000000000001',
 'Cut and pace',
 'Remove every pause over 0.3 seconds. Shorts pace is relentless.',
 E'Import into CapCut, Premiere, or DaVinci:\n\n1. Cut every pause over 0.3 seconds\n2. Add jump cuts between takes where needed\n3. Watch at 1.25x — if it drags, cut more\n4. Add trending audio from Shorts music library if it fits the vibe\n\nDO NOT add a traditional intro, channel bumper, or pause at the start. Viewers make the swipe decision in under 0.5 seconds.',
 false, null, null,
 15, 1),

('33330001-0004-0000-0000-000000000001',
 'Captions and visual hooks',
 '80% of Shorts watched without sound. Captions are mandatory.',
 E'CAPTIONS:\n  Auto-captions in CapCut or Premiere — check accuracy\n  Bold white text, black outline, mid-screen position\n  Readable on a small phone screen\n  Every word must be correct\n\nVISUAL HOOKS:\n  Hook text overlay at seconds 0–3 — reinforce the audio with text on screen\n  B-roll, images, or graphics where relevant\n  New visual element every 5–10 seconds minimum\n\nExport: H.264, 1080x1920 (vertical), 30fps minimum.',
 false, null, null,
 15, 2);


-- =============================================================
-- SHORTS STAGE 5: PUBLISH
-- =============================================================

INSERT INTO tasks (stage_id, title, description, instructions, has_prompt, prompt_text, resource_url, estimated_minutes, order_index) VALUES

('33330001-0005-0000-0000-000000000001',
 'Title and description',
 'Same rules as longform — keyword first, curiosity gap, under 60 characters.',
 E'TITLE:\n  Under 60 characters\n  Curiosity gap, bold claim, or "How I did X"\n  Keyword as close to the start as possible\n  Do NOT include "#Shorts" or "YouTube Short" in the title\n\nDESCRIPTION:\n  Line 1: what the Short is about, keyword included naturally\n  If repurposing: "Watch the full video: [link]"\n  Add #Shorts\n  1–3 relevant hashtags max\n\nTHUMBNAIL:\n  Do NOT set a custom thumbnail for Shorts\n  YouTube auto-selects from the video\n  Custom thumbnails on Shorts are ignored',
 true,
 E'Write 5 title options for a YouTube Short about: [TOPIC/HOOK]\n\nEach title:\n  Under 60 characters\n  Curiosity gap or bold claim\n  Mobile-first — works in a Shorts feed\n  No "#Shorts" in the title itself\n\nAlso write the 2-line Short description:\n  Line 1: what it is (keyword included naturally)\n  Line 2: "Full video linked in description" if repurposing + #Shorts + 1-2 hashtags',
 null,
 10, 1),

('33330001-0005-0000-0000-000000000001',
 'Publish — consistency builds trust score',
 'Post now. Reply fast. Trust score compounds over time.',
 E'Upload:\n  Upload vertical video (YouTube auto-detects as Short: vertical + under 60s)\n  Set title and description with #Shorts\n  Do NOT set custom thumbnail\n  Publish immediately — do not schedule Shorts\n\nTiming: 12pm–3pm your audience''s timezone is reliably safe.\n\nPost-publish (first 60 minutes):\n  Drop 2–3 comments on your own Short to kickstart conversation\n  Reply to every comment\n  Share to community tab with a question\n\nSHANE HUMMUS SHORTS ALGO:\n  30,000 views to start is YouTube''s seed audience test\n  At 30k: if your VVSA and AVD are good, YouTube pushes further\n  If stuck: it needs more data — volume is the answer, not a new strategy',
 false, null, null,
 10, 2),

('33330001-0005-0000-0000-000000000001',
 '24-hour check — VVSA and AVD are the only metrics',
 'Two numbers. Everything else is noise for Shorts.',
 E'After 24 hours, open YouTube Studio Analytics.\n\nTHE ONLY TWO METRICS THAT MATTER:\n\n  VVSA (Viewed vs Swiped Away):\n    Target: above 80%\n    Below 80% → hook is not stopping the scroll\n    Fix for next Short: rewrite the first 3 seconds\n\n  AVD (Average View Duration):\n    Target: 100% on 30-second Shorts\n    Target: 85%+ on 40–60 second Shorts\n    Low in first 10 seconds → hook stopped them but opening did not deliver\n    Low mid-video → content dragged, cut harder next time\n\nDIAGNOSTIC:\n  VVSA low → rewrite hook\n  AVD low early → opening did not earn the hook\n  AVD low mid → content was too long or too slow\n  Both healthy but low views → trust score or niche saturation — keep uploading\n\nOne fix. Write it in your playbook. Run again.',
 false, null, null,
 10, 3);
