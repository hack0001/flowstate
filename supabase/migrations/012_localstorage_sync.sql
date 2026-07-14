-- 012_localstorage_sync.sql
-- Migrate localStorage-only data to Supabase for cross-device sync

-- ── Reminders ────────────────────────────────────────────────────────────────
create table if not exists reminders (
  id          text        primary key,
  title       text        not null,
  emoji       text        not null default '',
  color       text        not null default '#00ff88',
  start_date  text        not null,
  recurrence  jsonb       not null default '{"type":"daily"}',
  time_label  text        not null default ''
);

-- ── Habit blocks (calendar recurring habit display) ───────────────────────────
create table if not exists habit_blocks (
  id          text        primary key,
  title       text        not null,
  emoji       text        not null default '',
  color       text        not null default '#00d4ff',
  days        integer[]   not null default '{}',
  time_label  text        not null default ''
);

-- ── Generic checklist state (YouTube, Etsy, etc.) ────────────────────────────
-- key = 'yt_creation' | 'yt_shorts' | 'etsy_checklists'
-- state = JSON array of checked item IDs (YouTube) or {id: bool} object (Etsy)
create table if not exists checklist_state (
  key         text        primary key,
  state       jsonb       not null default '[]',
  updated_at  timestamptz not null default now()
);

-- ── Welsh quiz progress (single row) ─────────────────────────────────────────
create table if not exists welsh_progress (
  id          integer     primary key default 1,
  streak      integer     not null default 0,
  best        integer     not null default 0,
  last_date   text        not null default ''
);
-- Ensure row exists
insert into welsh_progress (id, streak, best, last_date)
values (1, 0, 0, '')
on conflict (id) do nothing;

-- ── Welsh custom vocabulary ───────────────────────────────────────────────────
create table if not exists welsh_custom_words (
  id          text        primary key,
  en          text        not null,
  cy          text        not null,
  created_at  timestamptz not null default now()
);
