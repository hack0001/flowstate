-- FlowState Seed Data
-- Run AFTER schema.sql
-- Inserts all workflow types, stages, and tasks

-- ─── Workflow Types ────────────────────────────────────────────────────────────
INSERT INTO workflow_types (slug, name, description, icon, color) VALUES
  ('youtube-short',   'YouTube Short',     'Vertical video under 60 seconds',    '⚡',  '#ff0000'),
  ('youtube-longform','YouTube Longform',   'Full-length educational video',       '🎬', '#ff4444'),
  ('tweet',           'Tweet / X Post',    'High-impact text post',               '𝕏',  '#1da1f2'),
  ('instagram-post',  'Instagram Post',    'Feed image or carousel',              '📸', '#e1306c'),
  ('instagram-reel',  'Instagram Reel',    'Short vertical video for Instagram',  '🎞️', '#833ab4'),
  ('linkedin-post',   'LinkedIn Post',     'Professional thought-leadership',     '💼', '#0077b5'),
  ('tiktok',          'TikTok',            'Trend-driven short video',            '🎵', '#69c9d0')
ON CONFLICT (slug) DO NOTHING;

-- ─── Helper: seed stages and tasks for YouTube Short ─────────────────────────
DO $$
DECLARE
  wt_id UUID;
  stage_id UUID;
BEGIN
  SELECT id INTO wt_id FROM workflow_types WHERE slug = 'youtube-short';

  -- Stage 1: Idea
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Idea', 'Find and validate your hook angle', '💡', 0)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Research trending topics in your niche',
   'Identify what is already working before creating',
   E'Go to YouTube → search [your niche keyword] → filter by "This Week" → sort by View Count.\n\nFind 3 videos with 100k+ views. For each one, note:\n• What is the hook in the first 3 seconds?\n• What made someone stop scrolling?\n• What format did they use (talking head / text overlay / B-roll)?\n\nScreenshot or bookmark all 3.',
   0, 10),
  (stage_id, 'Write your 1-line concept',
   'Distil the video into a single clear sentence',
   E'Complete this sentence (under 15 words):\n\n"This Short teaches [specific viewer] how to [specific outcome] in [timeframe/method]."\n\nExample: "This Short teaches freelancers how to raise their rates in 48 hours."\n\nIf you cannot complete it cleanly → your idea is not focused enough yet. Try again.',
   1, 5),
  (stage_id, 'Validate the hook out loud',
   'Gut-check before investing time in production',
   E'Say your hook out loud as if talking to a friend.\n\nAsk yourself:\n• Would I stop scrolling for this?\n• Is the payoff clear within 3 seconds?\n• Does it create curiosity or promise a specific outcome?\n\nIf YES to all three → move on.\nIf NO to any → rewrite the hook angle and repeat.',
   2, 5);

  -- Stage 2: Hook & Script
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Hook & Script', 'Write the hook and tight script', '✍️', 1)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes, has_prompt, prompt_text) VALUES
  (stage_id, 'Write 5 hook variations',
   'Generate options before committing',
   E'Write 5 different opening lines for your Short. Each hook must:\n✓ Start with action, a bold claim, or a question\n✓ Include the word "you" or speak directly to viewer\n✓ Be speakable in under 6 seconds\n✓ Create curiosity or promise a clear payoff\n\nWrite all 5 now → circle the strongest one.',
   0, 10, false, null),
  (stage_id, 'Script the body (150–200 words)',
   'Keep it punchy and under 58 seconds',
   E'Structure:\n1. HOOK (your chosen line from previous task)\n2. TENSION/PROBLEM (1-2 sentences — why this matters)\n3. PAYOFF (3 rapid tips OR 1 reveal — the actual value)\n4. CTA (1 sentence: "Follow for more [X]" or "Comment [Y] below")\n\nRead it out loud and time yourself. Must land under 58 seconds.\nIf over → cut the weakest tip or tighten each sentence.\nNever pad. Every word earns its place.',
   1, 15, false, null),
  (stage_id, 'Refine with Claude',
   'Use AI to punch up your script',
   E'Copy your script and paste it into Claude with this exact prompt:\n\n"Rewrite this YouTube Short script to sound more conversational and punchy. Keep it under 200 words. Start with the hook line exactly as written. No fluff, no filler. Make every sentence land harder."\n\nReview the output → take the best elements from both versions → write your final script.',
   2, 10, true,
   E'Rewrite this YouTube Short script to sound more conversational and punchy. Keep it under 200 words. Start with the hook line exactly as written. No fluff, no filler. Make every sentence land harder.\n\n[PASTE YOUR SCRIPT HERE]'),
  (stage_id, 'Lock in final script',
   'Get it in front of you before recording',
   E'• Copy final script to your phone notes OR print it\n• Read it aloud one more time — at full energy, not quietly\n• Highlight any words you want to emphasise\n• Put the script somewhere you can glance at during recording\n\nYou are ready to record.',
   3, 5, false, null);

  -- Stage 3: Recording
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Recording', 'Get the footage you need', '🎥', 2)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Set up your shot',
   'Check all technical settings before recording',
   E'Run through this checklist before pressing record:\n\n✓ FRAMING: Camera shooting vertically (9:16) and at eye level\n✓ LIGHT: No harsh shadows on face — ring light or face a window\n✓ AUDIO: Mic plugged in / Lavalier clipped on / room is quiet\n✓ BACKGROUND: Clean, intentional, or blurred — no clutter\n✓ CAMERA: Recording in at least 1080p\n✓ PHONE OFF: Do Not Disturb mode on\n\nDo not start recording until every item is checked.',
   0, 10),
  (stage_id, 'Record minimum 3 full takes',
   'Quantity gives you options in editing',
   E'Rules:\n• NEVER stop mid-take — power through any mistake, keep going\n• Vary your energy:\n  Take 1 → Normal pace, conversational\n  Take 2 → 20% faster, more urgent energy\n  Take 3 → Most confident, highest energy you have got\n\n• Clap hands at the start of each take (helps sync in editing)\n• You need at least 3 before you are allowed to stop recording.',
   1, 20),
  (stage_id, 'Select your best take',
   'Choose with your gut, not your inner critic',
   E'Step 1: Watch all 3 takes on MUTE → pick most energetic body language.\nStep 2: Watch your top pick WITH sound → confirm audio is clean.\nStep 3: Check: does the hook land in the first 3 seconds?\n\nIf YES → mark that take and move to Assets.\nIf the audio is bad on all takes → re-record.\n\nTip: You will always hate how you look/sound. Pick the best one anyway.',
   2, 5);

  -- Stage 4: Assets
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Assets', 'Gather all media before editing', '🗂️', 3)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes, resource_url) VALUES
  (stage_id, 'Pull 3 memes or reaction clips',
   'Cutaway visuals that reinforce your points',
   E'Go to your memes folder (create one if you do not have it).\n\nAlternatives:\n• giphy.com → search [your topic or emotion]\n• knowyourmeme.com\n• Google Images → [topic] + "meme"\n\nFind 3 images or GIFs that match moments in your script.\nSave them to a dedicated folder: [ProjectName]/Assets/Memes/',
   0, 10, 'https://giphy.com'),
  (stage_id, 'Download 2 stock videos from Pexels',
   'Free B-roll to make cuts visually dynamic',
   E'Go to pexels.com/videos\n\nSearch [your topic keyword] — be specific.\n\nDownload 2 clips:\n✓ Under 10 seconds each\n✓ HD quality (1080p minimum)\n✓ Relevant to your script topic\n\nSave to: [ProjectName]/Assets/Stock/\n\nTip: Download 4–5 options so you have backups.',
   1, 10, 'https://pexels.com/videos'),
  (stage_id, 'Find background music',
   'A music bed makes your Short feel polished',
   E'Go to one of these sources (all copyright-free):\n• YouTube Audio Library: studio.youtube.com → Audio Library\n• Pixabay Music: pixabay.com/music\n• Uppbeat: uppbeat.io (free tier)\n\nSearch mood: upbeat / energetic / motivational\n\nDownload 1 track and save to: [ProjectName]/Assets/Music/\nNote the track name for description credits.',
   2, 10, 'https://studio.youtube.com');

  -- Stage 5: Editing
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Editing', 'Cut, caption, and polish', '✂️', 4)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Create project and import all media',
   'Set up your timeline correctly first time',
   E'Open your editor (CapCut / Premiere / DaVinci).\n\nNew project settings:\n• Resolution: 1080 x 1920 (vertical)\n• Frame rate: 30fps\n\nImport everything:\n✓ Your best take (main recording)\n✓ All B-roll clips\n✓ Memes / reaction images\n✓ Background music track\n\nDrop main recording onto timeline first.',
   0, 5),
  (stage_id, 'Rough cut — remove all dead air',
   'The most important edit you will make',
   E'Go through your main recording and cut:\n✗ Every pause longer than 0.5 seconds\n✗ Every "um", "uh", "like", "you know"\n✗ Any stumbled words before you recovered\n✗ Silence at start and end of clip\n\nAfter rough cut, your timeline should feel rapid.\nTotal runtime should be 45–58 seconds.\n\nIf over 60 seconds → cut the weakest tip.',
   1, 20),
  (stage_id, 'Add B-roll cutaways',
   'Every 3–4 seconds, change the visual',
   E'Rule: Never more than 4 seconds on talking head without a visual cut.\n\nPlace your B-roll clips and memes at natural cut points.\nBest moments to cut away:\n• When you mention a concept → cut to example clip\n• During a list item → cut to relevant meme or footage\n• Between tips → reset with B-roll\n\nAdd smooth cuts (J-cut or L-cut). No wipes.',
   2, 15),
  (stage_id, 'Add captions',
   'Captions double watch time — do not skip this',
   E'Option A (fastest) — CapCut auto-captions:\nText → Auto Captions → Generate → review and fix errors.\n\nOption B — Manual:\nType captions yourself, synced to speech.\n\nCaption style rules:\n✓ 2–3 words per line maximum\n✓ Bold white text\n✓ Black drop shadow or dark outline\n✓ Positioned centre or lower-centre\n✓ Large enough to read on a phone screen\n\nHighlight key words in yellow or cyan.',
   3, 15),
  (stage_id, 'Add music and export',
   'Final polish before exporting',
   E'1. Drop your music track below all other tracks.\n2. Set music volume to 10–15% (voice must be louder).\n3. Add fade in: first 2 seconds / Fade out: last 2 seconds.\n4. Watch the whole thing one final time.\n\nExport settings:\n• Format: MP4 / H.264\n• Resolution: 1080 x 1920\n• Frame rate: 30fps\n• Bitrate: 10–15 Mbps\n• Audio: Stereo, 44.1kHz',
   4, 10);

  -- Stage 6: Upload
  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Upload', 'Publish and optimise for discovery', '🚀', 5)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes, resource_url) VALUES
  (stage_id, 'Write your title',
   'Keyword-first title that earns the click',
   E'Formula: [Strong Action Verb] + [Specific Outcome] + [Optional: "#Shorts" or niche tag]\n\nRules:\n✓ Under 60 characters total\n✓ Front-load your main keyword (first 2–3 words)\n✓ No clickbait without delivering on the promise\n✓ Read it out loud — does it sound like something someone would say?\n\nExamples:\n✓ "Double Your Freelance Rate in 48 Hours #Shorts"\n✓ "3 Morning Habits That Changed My Life"\n✗ "This video will change everything..." (vague)',
   0, 5, null),
  (stage_id, 'Write description and hashtags',
   'Helps search and algorithm discovery',
   E'Description structure:\n• Line 1: Your hook sentence (same as your opening line)\n• Line 2: 1–2 sentence value proposition\n• Line 3: Subscribe CTA\n• Line 4-5: 3–5 hashtags\n\nHashtags: #Shorts + 2 niche-specific tags\n\nDo NOT spam hashtags. 3–5 relevant ones beat 30 random ones.',
   1, 5, null),
  (stage_id, 'Upload and publish',
   'Get it live at the right time',
   E'Go to studio.youtube.com → Upload video.\n\nDuring upload:\n✓ Add title and description\n✓ Set audience: "No, it''s not made for kids"\n✓ YouTube will auto-detect it is a Short (vertical + under 60s)\n✓ Thumbnail: YouTube will auto-generate for Shorts\n\nBest upload times:\n• Weekdays: 3pm–7pm your audience timezone\n• Weekends: 9am–11am\n\nAfter publishing → pin a comment with your CTA immediately.',
   2, 10, 'https://studio.youtube.com');

END $$;

-- ─── Tweet Workflow ────────────────────────────────────────────────────────────
DO $$
DECLARE
  wt_id UUID;
  stage_id UUID;
BEGIN
  SELECT id INTO wt_id FROM workflow_types WHERE slug = 'tweet';

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Idea', 'Find the angle that will resonate', '💡', 0)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Choose your tweet type',
   'Different formats serve different goals',
   E'Pick one type for this tweet:\n\n1. INSIGHT — a counterintuitive truth in your niche\n2. STORY — a personal experience with a lesson\n3. HOT TAKE — a strong opinion others are afraid to say\n4. TIP — one specific actionable tip\n5. LIST — 5–10 items on a theme\n6. QUESTION — engage your audience directly\n7. THREAD — multi-tweet deep dive on one topic\n\nThe best performing tweets are:\n✓ Specific not vague\n✓ Have a clear point of view\n✓ Make the reader feel seen, taught, or challenged',
   0, 5),
  (stage_id, 'Write your 1-sentence core idea',
   'If you cannot say it in one sentence, you do not know it yet',
   E'Write the core idea of your tweet in exactly one sentence.\n\nThis is not the tweet itself — it is what the tweet MEANS.\n\nExample:\n• Core idea: "Most people fail at habits because they set goals instead of systems"\n• Tweet: (will be crafted from this)\n\nIf you cannot write it clearly in one sentence → pick a different topic.',
   1, 5);

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Write', 'Draft and sharpen your tweet', '✍️', 1)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Write 3 draft versions',
   'Your first draft is almost never your best',
   E'Write 3 completely different versions:\n\nVersion 1: Direct statement\nVersion 2: Start with a story or scenario\nVersion 3: Start with a surprising/counterintuitive opener\n\nFor each version:\n✓ First line must hook BEFORE the "Read more" cutoff\n✓ Clear point — no vagueness\n✓ Ends with punchline, takeaway, or question\n✓ No hashtags in the body\n\nWrite all 3 before judging any of them.',
   0, 15),
  (stage_id, 'Sharpen your best version',
   'Cut ruthlessly until every word earns its place',
   E'Pick your best draft.\n\nEdit ruthlessly:\n✗ Cut every filler word (very, really, just, actually, basically)\n✗ Cut every sentence that does not add new information\n✗ Replace passive voice with active voice\n✗ Make vague words specific (not "a lot" → "3x more")\n✗ Cut "I think" and "in my opinion" — just say the thing\n\nRead it out loud. Does every line pull you to the next?',
   1, 10);

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Post & Engage', 'Post at the right time and drive early engagement', '🚀', 2)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Post at optimal time',
   'Timing impacts the first hour of reach dramatically',
   E'Best times to post (general):\n• Mon–Thu: 8–10am, 12–1pm, 5–7pm\n• Fri: 8–10am, 12–1pm\n• Weekends: 9–11am\n\nYour personal best times:\n→ Check X Analytics → Tweets tab → sort by engagement → look at what times your top tweets went live\n\nPost now OR schedule using Buffer or Typefully.',
   0, 5),
  (stage_id, 'Engage for 30 minutes after posting',
   'Reply to every comment in the first 30 minutes',
   E'The first 30 minutes are critical for algorithmic reach.\n\nRules:\n✓ Reply to every comment (even just a follow-up question)\n✓ Like your own top comments\n✓ Quote-tweet with additional context if it picks up traction\n✓ Share to other platforms\n\nDo NOT:\n✗ Post and disappear immediately\n✗ Delete and repost (hurts reach)\n\nSet a 30-minute timer and stay engaged.',
   1, 30);
END $$;

-- ─── Instagram Post Workflow ───────────────────────────────────────────────────
DO $$
DECLARE
  wt_id UUID;
  stage_id UUID;
BEGIN
  SELECT id INTO wt_id FROM workflow_types WHERE slug = 'instagram-post';

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Concept', 'Define what this post is and who it''s for', '💡', 0)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Choose post format',
   'Format determines the creation workflow',
   E'Choose one:\n\n1. SINGLE IMAGE — one strong visual + caption\n2. CAROUSEL (2–10 slides) — swipeable multi-page content (highest reach)\n3. INFOGRAPHIC — visual data or framework\n\nCarousels currently get 3x more reach than single images.\nIf you have 3+ points to make → use a carousel.',
   0, 3),
  (stage_id, 'Write your hook for slide 1',
   'The first slide determines whether they swipe or scroll past',
   E'Slide 1 is your thumbnail. It must stop the scroll.\n\nFormulas:\n• "X things I wish I knew about [topic]"\n• "[Bold claim] (and most people get this wrong)"\n• "Stop [doing thing]. Do [this] instead."\n• "How I [result] without [common method]"\n\nSlide 1 text rules:\n✓ Under 7 words\n✓ Creates curiosity or promises a specific outcome\n✓ Readable at thumbnail size\n\nWrite 3 options → pick the best.',
   1, 10);

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Design', 'Create the visual content', '🎨', 1)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes, resource_url) VALUES
  (stage_id, 'Set up Canva template',
   'Start from the right canvas size',
   E'Open Canva → New Design → Instagram Post (1080x1080) for square OR Instagram Story (1080x1920) for vertical carousel.\n\nBrand consistency checklist:\n✓ Maximum 2 fonts (one heading, one body)\n✓ Your brand colours only\n✓ Same border/padding on every slide\n✓ Your handle or logo on every slide (small, bottom corner)\n\nIf no brand assets → pick ONE font and ONE accent colour and stick to it.',
   0, 10, 'https://canva.com'),
  (stage_id, 'Design all slides',
   'Create each slide in order',
   E'For each slide:\n• Slide 1: Hook (bold text, strong visual, curiosity)\n• Slides 2–N: One point per slide — simple, visual hierarchy\n• Last slide: CTA ("Follow for more [X]" + your handle)\n\nDesign rules:\n✓ One main idea per slide\n✓ Large text — readable on phone without zooming\n✓ Lots of white space\n✗ No walls of text\n✗ No more than 3 visual elements per slide',
   1, 30, 'https://canva.com'),
  (stage_id, 'Export and review on your phone',
   'What looks good on desktop often looks different on mobile',
   E'Export from Canva:\n• Format: PNG (best quality)\n• Download all pages\n\nSend to your phone and view:\n• Does the text look large enough?\n• Is the visual hierarchy clear?\n• Does Slide 1 stop the scroll?\n• Does the last slide have a clear CTA?\n\nIf anything looks off → fix it in Canva before writing the caption.',
   2, 10, null);

  INSERT INTO stages (workflow_type_id, name, description, icon, order_index)
    VALUES (wt_id, 'Caption & Post', 'Write a caption that drives action', '🚀', 2)
    RETURNING id INTO stage_id;

  INSERT INTO tasks (stage_id, title, description, instructions, order_index, estimated_minutes) VALUES
  (stage_id, 'Write your caption',
   'A great caption extends the value of the visual',
   E'Caption structure:\n\nLine 1 (hook): Restate or complement the slide 1 hook\n[line break]\nLines 2–5: Expand on the value. 2–4 sentences.\n[line break]\nCTA: "Save this for later" OR "Comment [X] if you want [Y]"\n[line break]\nHashtags: 5–10 relevant hashtags\n\nCaption length: 125–250 words typically performs best.\n\n✗ Do not repeat exactly what is in the slides\n✓ Add context, a personal anecdote, or extra tips the slides could not fit',
   0, 15),
  (stage_id, 'Post at optimal time',
   'Timing affects early engagement and algorithmic push',
   E'Best general posting times:\n• Tuesday–Friday: 9–11am and 5–7pm\n• Monday: 11am–1pm\n• Weekends: 9–11am\n\nYour personal best time:\n→ Instagram Insights → Total Followers → Most active times\n\nPost and then:\n✓ Add to your Story (share button → Add to Story)\n✓ Respond to every comment in the first hour\n✓ Share to relevant group chats',
   1, 5);
END $$;
