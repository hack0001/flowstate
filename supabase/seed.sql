-- FlowState Seed Data
-- Run AFTER schema.sql

-- 1. Workflow Types
insert into workflow_types (id, name, slug, icon, description, color, estimated_minutes, order_index) values
  ('11111111-0000-0000-0000-000000000001', 'YouTube Short', 'yt-short', 'Short', 'Viral vertical video under 60 seconds', '#ff0000', 45, 1),
  ('11111111-0000-0000-0000-000000000002', 'YouTube Longform', 'yt-long', 'Long', 'In-depth video 8-20+ minutes', '#ff4444', 180, 2),
  ('11111111-0000-0000-0000-000000000003', 'Tweet / X Post', 'tweet', 'Tweet', 'High-impact post under 280 characters', '#1da1f2', 20, 3),
  ('11111111-0000-0000-0000-000000000004', 'Instagram Post', 'ig-post', 'Gram', 'Feed photo or carousel post', '#e1306c', 40, 4),
  ('11111111-0000-0000-0000-000000000005', 'Instagram Reel', 'ig-reel', 'Reel', 'Short-form vertical video for Reels', '#f77737', 60, 5),
  ('11111111-0000-0000-0000-000000000006', 'LinkedIn Post', 'linkedin', 'LinkedIn', 'Professional thought leadership post', '#0077b5', 35, 6),
  ('11111111-0000-0000-0000-000000000007', 'TikTok Video', 'tiktok', 'TikTok', 'Short entertaining vertical video', '#69c9d0', 50, 7)
on conflict do nothing;

-- 2. YouTube Short Stages & Tasks
insert into stages (id, workflow_type_id, name, description, order_index) values
  ('22222222-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Ideation', 'Find your hook and angle', 1),
  ('22222222-0001-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Script', 'Write a punchy script', 2),
  ('22222222-0001-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Record', 'Film your Short', 3),
  ('22222222-0001-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Edit', 'Cut and polish', 4),
  ('22222222-0001-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Publish', 'Upload and optimise', 5)
on conflict do nothing;

insert into tasks (stage_id, title, description, instructions, has_prompt, prompt_text, estimated_minutes, order_index) values
  ('22222222-0001-0000-0000-000000000001', 'Define your hook', 'What makes someone stop scrolling?', 'Write 3 hook options. The hook is the first 1-2 seconds. It should create curiosity, shock, or instant value. Think: "What if I told you..." or start mid-action.', true, 'Generate 5 pattern-interrupt hook ideas for a YouTube Short about [TOPIC]. Each hook must be under 8 words and create immediate curiosity. Format: numbered list.', 10, 1),
  ('22222222-0001-0000-0000-000000000001', 'Choose your angle', 'Pick the most contrarian or surprising take', 'Review your hooks. Pick the one that would make YOU stop scrolling. Consider: is it different from what already exists? Does it promise a transformation?', false, null, 5, 2),
  ('22222222-0002-0000-0000-000000000001', 'Write the script', 'Hook + value + CTA in under 60 seconds', 'Structure: Hook (0-3s) > Problem/Story (3-40s) > Payoff (40-55s) > CTA (55-60s). Read aloud. Cut anything that bores you. Aim for 150 words max.', true, 'Write a 60-second YouTube Shorts script about [TOPIC]. Hook: [YOUR HOOK]. Use punchy sentences. End with a CTA to follow. No filler words.', 20, 1),
  ('22222222-0002-0000-0000-000000000002', 'Read aloud and time it', 'Must be under 60 seconds', 'Use a stopwatch. If over 60 seconds, cut the weakest sentence. Repeat until it fits. The script should feel urgent, not rushed.', false, null, 5, 2),
  ('22222222-0003-0000-0000-000000000001', 'Set up your shot', 'Good light, clean background, vertical frame', 'Vertical 9:16. Face fills top 2/3 of frame. Window light on your face (not behind you). Clean or intentional background. Phone on tripod or propped up.', false, null, 10, 1),
  ('22222222-0003-0000-0000-000000000002', 'Record 3 takes minimum', 'Best take wins', 'Do not stop for mistakes. Just keep going. Record 3 full takes. Watch them back. Pick the one with the best energy, not the most perfect delivery.', false, null, 15, 2),
  ('22222222-0004-0000-0000-000000000001', 'Cut dead air', 'Remove pauses over 0.3 seconds', 'Import into your editor. Cut every gap over 0.3 seconds. Add jump cuts if needed. The video should feel relentlessly paced.', false, null, 20, 1),
  ('22222222-0004-0000-0000-000000000002', 'Add captions', 'Auto-captions or manual - always have them', 'Use CapCut auto-captions or Premiere transcript. Style: bold white text, black outline. Position: middle of screen. 80% of Shorts watched without sound.', false, null, 15, 2),
  ('22222222-0004-0000-0000-000000000003', 'Add b-roll or overlays', 'Keep eyes engaged', 'Add screen recordings, stock clips (Pexels), or text overlays every 3-5 seconds. Cut to something new before the viewer gets bored.', false, null, 20, 3),
  ('22222222-0005-0000-0000-000000000001', 'Write your title', 'The title shows in suggested - make it click', 'Title formula: [Curiosity gap] or [Bold claim] or [How I did X]. Under 60 characters. Do NOT use clickbait that does not match content.', true, 'Write 5 YouTube Shorts title options for a video about [TOPIC]. Each under 60 chars. Optimise for curiosity and search. No clickbait.', 10, 1),
  ('22222222-0005-0000-0000-000000000002', 'Upload and add tags', 'Publish for maximum reach', 'Upload as Shorts (vertical, under 60s auto-qualifies). Add #Shorts in description. Pick 3-5 relevant hashtags. Schedule for your audience peak time or publish now.', false, null, 10, 2)
on conflict do nothing;

-- 3. YouTube Longform Stages & Tasks
insert into stages (id, workflow_type_id, name, description, order_index) values
  ('22222222-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Research', 'Build your knowledge base', 1),
  ('22222222-0002-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Outline', 'Structure your video', 2),
  ('22222222-0002-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Script', 'Write your full script', 3),
  ('22222222-0002-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'Record', 'Film your video', 4),
  ('22222222-0002-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'Edit', 'Post-production', 5),
  ('22222222-0002-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002', 'Packaging', 'Thumbnail and title', 6),
  ('22222222-0002-0000-0000-000000000007', '11111111-0000-0000-0000-000000000002', 'Publish', 'Upload and launch', 7)
on conflict do nothing;

insert into tasks (stage_id, title, description, instructions, has_prompt, prompt_text, estimated_minutes, order_index) values
  ('22222222-0002-0000-0000-000000000001', 'Keyword research', 'Find what people are actually searching', 'Use TubeBuddy, VidIQ, or just YouTube search autocomplete. Find keywords with decent volume and beatable competition. Your video needs a reason to exist.', true, 'I want to make a YouTube video about [TOPIC]. Give me 10 specific keyword phrases people search for, ranked by likely search volume. Include long-tail variations.', 20, 1),
  ('22222222-0002-0000-0000-000000000001', 'Watch top 5 competing videos', 'Know what you are up against', 'Watch the top 5 videos for your keyword. Note: what do they cover? What do they miss? What questions are left unanswered in the comments? That gap is your angle.', false, null, 30, 2),
  ('22222222-0002-0000-0000-000000000002', 'Build your outline', 'Structure determines retention', 'Use this structure: Hook (problem/curiosity) > Intro (why you) > Main content (3-5 sections) > Recap > CTA. Each section needs a clear promise and payoff.', true, 'Create a detailed YouTube video outline for a video titled "[TITLE]". Target length: [LENGTH] mins. Include hook, intro, 4 main sections with subpoints, and CTA. Make it logical and retain-y.', 25, 1),
  ('22222222-0002-0000-0000-000000000003', 'Write full script', 'Word for word beats winging it', 'Write conversationally. Read aloud as you write. Aim for 130-150 words per minute of video. Include [B-ROLL] markers. Add pattern interrupts every 60-90 seconds.', true, 'Write a full YouTube script for a video titled "[TITLE]" based on this outline: [OUTLINE]. Conversational tone. Include [B-ROLL] markers. Hook in first 30 seconds. Word count: approx [WORDS].', 90, 1),
  ('22222222-0002-0000-0000-000000000004', 'Set up and record', 'Camera, audio, lighting check', 'Check: audio levels, exposure, white balance. Record a 30-second test clip. Watch it back. Fix anything before you record the whole video. Energy is everything on camera.', false, null, 60, 1),
  ('22222222-0002-0000-0000-000000000005', 'Rough cut', 'Cut out the bad takes and dead air', 'Import all footage. Keep only the best takes. Remove all pauses over 0.5 seconds. First watch should feel fast. Do not colour grade yet.', false, null, 60, 1),
  ('22222222-0002-0000-0000-000000000005', 'Add b-roll and graphics', 'Visually support your points', 'Drop b-roll every 30-60 seconds. Add text overlays for key stats or terms. Use chapter markers. A graph or screen recording beats 1000 words.', false, null, 45, 2),
  ('22222222-0002-0000-0000-000000000006', 'Design thumbnail', 'Thumbnail gets the click - make it count', 'Use Canva or Photoshop. Rule: thumbnail + title must tell a story together. Large face (if applicable). Bold 3-4 word text max. High contrast. Test at small size.', true, 'Describe 3 high-CTR YouTube thumbnail concepts for a video titled "[TITLE]". For each: describe the background, text overlay (max 4 words), facial expression if applicable, and colour scheme. Think MrBeast + Veritasium style.', 30, 1),
  ('22222222-0002-0000-0000-000000000006', 'Write title and description', 'SEO and click-through together', 'Title: primary keyword + curiosity or emotion. Under 60 characters. Description: first 2 sentences count most (show in search). Include keyword, timestamps, and links.', true, 'Write an optimised YouTube title (under 60 chars) and description (300 words) for a video about [TOPIC] with keyword [KEYWORD]. Include timestamps placeholder, social links placeholder, and CTA.', 20, 2),
  ('22222222-0002-0000-0000-000000000007', 'Schedule or publish', 'Timing matters', 'Upload as unlisted first. Check captions are correct. Set thumbnail. Add to a playlist. Schedule for your best performing time (check Analytics > When your viewers are on YouTube).', false, null, 20, 1)
on conflict do nothing;

-- 4. Tweet Stages & Tasks
insert into stages (id, workflow_type_id, name, description, order_index) values
  ('22222222-0003-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'Concept', 'Find your angle', 1),
  ('22222222-0003-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'Write', 'Draft and refine', 2),
  ('22222222-0003-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Publish', 'Post and engage', 3)
on conflict do nothing;

insert into tasks (stage_id, title, description, instructions, has_prompt, prompt_text, estimated_minutes, order_index) values
  ('22222222-0003-0000-0000-000000000001', 'Pick your format', 'Thread, single tweet, or opinion?', 'Formats: (1) Hot take - 1 tweet, bold opinion; (2) Thread - 5-10 tweet story or list; (3) Observation - interesting thing you noticed; (4) Resource list. Pick based on your idea.', false, null, 5, 1),
  ('22222222-0003-0000-0000-000000000002', 'Write the first line', 'The first line is your entire tweet', 'If it is a thread, the first line determines if anyone reads the rest. It must: start a loop, make a bold claim, or hit a pain point. No "A thread:" as first words.', true, 'Write 5 opening lines for a tweet/thread about [TOPIC]. Each must be under 280 chars, stop-the-scroll quality, and set up curiosity for what follows. No emojis.', 10, 1),
  ('22222222-0003-0000-0000-000000000002', 'Write the full post', 'Draft quickly, edit slowly', 'Write the whole thing without editing. Then: cut every word that is not earning its place. Replace vague words with specific ones. Short sentences win.', true, 'Write a punchy Twitter/X [thread/single tweet] about [TOPIC]. First line: [YOUR HOOK]. Voice: direct, confident, no corporate speak. End with a follow CTA.', 15, 2),
  ('22222222-0003-0000-0000-000000000003', 'Post and engage for 30 mins', 'The algorithm rewards fast engagement', 'Post when your audience is active. Then stay in the app for 30 minutes. Reply to everyone who engages. This early engagement window is crucial for reach.', false, null, 30, 1)
on conflict do nothing;

-- 5. LinkedIn Stages & Tasks
insert into stages (id, workflow_type_id, name, description, order_index) values
  ('22222222-0006-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006', 'Concept', 'Story or insight?', 1),
  ('22222222-0006-0000-0000-000000000002', '11111111-0000-0000-0000-000000000006', 'Write', 'Draft your post', 2),
  ('22222222-0006-0000-0000-000000000003', '11111111-0000-0000-0000-000000000006', 'Publish', 'Post and monitor', 3)
on conflict do nothing;

insert into tasks (stage_id, title, description, instructions, has_prompt, prompt_text, estimated_minutes, order_index) values
  ('22222222-0006-0000-0000-000000000001', 'Choose post type', 'Story, lesson, or list?', 'LinkedIn formats: (1) Personal story with lesson; (2) Contrarian industry opinion; (3) "X things I learned" list; (4) Behind-the-scenes. Personal stories get 3x more engagement than pure advice.', false, null, 5, 1),
  ('22222222-0006-0000-0000-000000000002', 'Write the hook line', 'First line shows in feed preview', 'LinkedIn shows first 2 lines before "see more". Your hook must be a statement that makes people click "see more". Question hooks or bold statements work best. No preamble.', true, 'Write 5 LinkedIn hook lines for a post about [TOPIC]. Each must be 1-2 sentences that create enough curiosity to click "see more". Professional but human voice.', 10, 1),
  ('22222222-0006-0000-0000-000000000002', 'Write the full post', 'Story arc + lesson + CTA', 'Structure: Hook > Story/context (3-5 short paragraphs) > Key lesson > Ask a question for comments. Use line breaks every 1-2 sentences. No walls of text. Max 1300 chars for best reach.', true, 'Write a full LinkedIn post about [TOPIC]. Hook: [YOUR HOOK]. Include a personal angle or story. End with a question to drive comments. Under 1300 characters. No hashtag spam.', 20, 2),
  ('22222222-0006-0000-0000-000000000003', 'Post and respond fast', 'Early comments boost reach significantly', 'Post Tuesday-Thursday 8-10am or 12-1pm. Reply to every comment in the first 2 hours. A comment reply counts as engagement and extends reach.', false, null, 20, 1)
on conflict do nothing;
