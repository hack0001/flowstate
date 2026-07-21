-- =============================================================
-- FlowState — migrate the remaining localStorage-only features to Supabase
--
-- These features had zero database backing at all (unlike most of the app,
-- which already uses localStorage purely as an instant-load cache in front
-- of Supabase). That meant real data — a saved tweet swipe file, edited
-- knowledge-base pages, daily routine journal entries — could be lost by
-- clearing the browser, and none of it synced across devices or had any
-- history.
--
-- This migration adds:
--   1. evening_reviews      — tomorrow's MIT + whether the evening routine
--                              was completed, one row per day.
--   2. daily_checklist_completions — generic per-day checklist completions,
--                              shared by the Physical, Instagram, and X
--                              "Daily Workflow" checklists (checklist_key
--                              distinguishes them).
--   3. tweet_models         — the X page's saved tweet swipe file (was
--                              flowstate_tweet_models, localStorage only).
--   4. etsy_kb_overrides    — Tom's edited versions of the Etsy Knowledge
--                              Base pages (was flowstate_etsy_kb_*).
--   5. error_log            — the morning page's "what went wrong" journal
--                              (was flowstate_error_log), so it can actually
--                              be reviewed for patterns over time.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists evening_reviews (
  review_date date primary key,
  mit text,
  completed_at timestamptz
);

create table if not exists daily_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null,
  item_id text not null,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  unique (checklist_key, item_id, completed_date)
);

create index if not exists daily_checklist_completions_lookup_idx
  on daily_checklist_completions (checklist_key, completed_date);

create table if not exists tweet_models (
  id text primary key,
  source text not null default 'manual',
  tweet_url text,
  added_at date not null default current_date,
  author_handle text,
  author_name text,
  tweet_text text not null,
  likes integer,
  retweets integer,
  follower_estimate integer,
  engagement_ratio numeric,
  category text,
  hook_pattern text,
  format_type text,
  why_it_worked text,
  sound_money_alternative text,
  created_at timestamptz not null default now()
);

create table if not exists etsy_kb_overrides (
  page_id text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  entry_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists error_log_date_idx on error_log (log_date);
