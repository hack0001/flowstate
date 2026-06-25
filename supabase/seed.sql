insert into workflow_types (id, name, slug, description, icon, color) values
  ('yt-short',  'YouTube Short',   'youtube-short',    'Vertical video under 60 seconds',  'Short',    '#ff0000'),
  ('yt-long',   'YouTube Longform','youtube-longform',  'Full-length educational video',     'Long',     '#ff4444'),
  ('tweet',     'Tweet / X Post',  'tweet',             'High-impact text post',             'Tweet',    '#1da1f2'),
  ('ig-post',   'Instagram Post',  'instagram-post',    'Feed image or carousel',            'Photo',    '#e1306c'),
  ('ig-reel',   'Instagram Reel',  'instagram-reel',    'Short vertical video',              'Reel',     '#833ab4'),
  ('linkedin',  'LinkedIn Post',   'linkedin-post',     'Professional thought-leadership',   'LinkedIn', '#0077b5'),
  ('tiktok',    'TikTok',          'tiktok',            'Trend-driven short video',          'TikTok',   '#69c9d0')
on conflict (id) do nothing;

do $$ declare wid uuid;
begin
  insert into stages (workflow_type_id, name, description, icon, order_index) values
    ('yt-short','Idea & Hook','Define your concept and scroll-stopping hook','1',0),
    ('yt-short','Script','Write a tight 60-second script','2',1),
    ('yt-short','Record','Film your short','3',2),
    ('yt-short','Edit','Cut and polish','4',3),
    ('yt-short','Publish','Upload and optimise','5',4);

  insert into stages (workflow_type_id, name, description, icon, order_index) values
    ('yt-long','Research','Deep-dive research and source gathering','1',0),
    ('yt-long','Outline','Structure your video for maximum retention','2',1),
    ('yt-long','Script','Write a compelling full script','3',2),
    ('yt-long','Record','Film with energy and clarity','4',3),
    ('yt-long','Edit','Cut, add B-roll, colour grade','5',4),
    ('yt-long','Thumbnail','Design a click-worthy thumbnail','6',5),
    ('yt-long','Publish','Upload, optimise, and promote','7',6);

  insert into stages (workflow_type_id, name, description, icon, order_index) values
    ('tweet','Concept','Find an idea worth sharing','1',0),
    ('tweet','Draft','Write and refine the tweet','2',1),
    ('tweet','Publish','Post and engage','3',2);
end $$;

do $$ declare s uuid;
begin
  select id into s from stages where workflow_type_id='yt-short' and order_index=0;
  insert into tasks (stage_id, title, description, instructions, order_index, estimated_minutes, has_prompt) values
    (s,'Define your core concept','One sentence: what is this short about?','Write one sentence that completes: "After watching this, viewers will know ___".\n\nKeep it to a single, specific idea. Broad topics fail. Narrow insights win.',0,5,false),
    (s,'Write 3 hook options','The first 2 seconds determine everything','Write 3 different hook styles:\n1. Bold claim: "Most people get X completely wrong..."\n2. Question: "Did you know X can do Y?"\n3. Visual action: Start mid-action, no intro needed.\n\nPick the strongest one.',1,10,false);

  select id into s from stages where workflow_type_id='yt-short' and order_index=1;
  insert into tasks (stage_id, title, description, instructions, order_index, estimated_minutes, has_prompt) values
    (s,'Write the full script','60 seconds max - every word earns its place','Structure:\n- Hook (0-3s): Your chosen hook from the previous step\n- Body (3-50s): One idea, explained clearly with one example\n- CTA (50-60s): "Follow for more" or direct next action\n\nRead it aloud. If it takes over 60 seconds, cut.',0,20,false),
    (s,'Record a scratch audio','Test your script before filming','Record yourself reading the script on your phone. Listen back:\n- Does it flow naturally?\n- Are there any awkward phrases?\n- Is the timing under 60 seconds?\n\nRevise if needed before filming.',1,10,false);

  select id into s from stages where workflow_type_id='yt-short' and order_index=2;
  insert into tasks (stage_id, title, description, instructions, order_index, estimated_minutes, has_prompt) values
    (s,'Set up your shot','Frame, light, and sound check','Checklist:\n- Camera at eye level or slightly above\n- Key light on your face (window or ring light)\n- Clean background or intentional backdrop\n- Audio test: record 10 seconds and listen for echo/noise\n- Vertical 9:16 framing confirmed',0,10,false),
    (s,'Record 3 takes','Performance over perfection','Film at least 3 takes. On each take:\n- High energy from the first word\n- Look directly into the lens\n- Do not restart if you stumble - keep going\n\nYou need options in the edit.',1,15,false);
end $$;
