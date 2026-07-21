-- =============================================================
-- FlowState — Move the morning routine checklist into the database
--
-- Previously the item list lived in lib/morningRoutine.ts (hardcoded) and
-- daily completion state lived in localStorage — only an all-or-nothing
-- "did you finish the whole routine" row made it to Supabase
-- (routine_completions, for the streak counter). That meant no way to see
-- which individual items get done vs skipped over time, and no way to add
-- an item without a code change.
--
-- This migration:
--   1. Creates morning_routine_items — the checklist itself, editable at
--      runtime from the app (add/reorder/retire items).
--   2. Creates morning_routine_completions — one row per item per day it
--      was completed, so per-item completion rates can actually be tracked.
--   3. Seeds it with the routine as it existed in code (including the new
--      Welsh/Duolingo item), preserving the same ids so nothing resets.
--
-- routine_completions (the all-done streak table) is untouched — it still
-- works exactly as before, just alongside the new per-item data.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists morning_routine_items (
  id text primary key,
  title text not null,
  minutes integer not null default 5,
  note text,
  category text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists morning_routine_completions (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references morning_routine_items(id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  unique (item_id, completed_date)
);

create index if not exists morning_routine_completions_date_idx on morning_routine_completions (completed_date);
create index if not exists morning_routine_completions_item_idx on morning_routine_completions (item_id);

insert into morning_routine_items (id, title, minutes, note, category, sort_order) values
  ('mr-pushpull',  '5 push-ups / 5 pull-ups',                       5,  'Before breakfast', 'Movement', 0),
  ('mr-weight',    'Weigh yourself + log in spreadsheet',            2,  null, 'Health', 1),
  ('mr-waist',     'Measure waist (if down 2kg since last measure)', 2,  '1 inch lost = fat loss confirmed', 'Health', 2),
  ('mr-floor',     '1 min floor sit, 90/90 switches, child pose',    5,  null, 'Movement', 3),
  ('mr-bounce',    '20 bounces + hold squat 2 minutes',              4,  'Deep squat, heels flat if possible — builds ankle & hip mobility', 'Movement', 4),
  ('mr-ankle',     'Ankle mobility — circles, leans, alphabet',      3,  '10 circles each way, 10 wall leans each foot, trace A-Z with each foot', 'Movement', 5),
  ('mr-breakfast', 'Breakfast: yoghurt + maple syrup',               10, null, 'Fuel', 6),
  ('mr-coffee',    'Coffee + cane sugar + collagen + molasses',      5,  null, 'Fuel', 7),
  ('mr-eggs',      'Eggs on sourdough + mushrooms (weights day)',    15, 'Only on hard weights days', 'Fuel', 8),
  ('mr-read',      'Read 2 pages',                                   5,  null, 'Mind', 9),
  ('mr-welsh',     'Duolingo lesson in Welsh',                       5,  'Minimum 1 lesson', 'Mind', 10),
  ('mr-visualise', 'Process visualisation',                          5,  'Close your eyes. Walk through your day step by step — not the outcome, the PROCESS. See yourself sitting down to work, what your hands are doing, how focused you feel, how you handle the first obstacle. Finish by writing 1 specific action you will take before lunch.', 'Mind', 11)
on conflict (id) do nothing;
