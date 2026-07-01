-- ============================================================
-- 006_habits.sql  —  Habit tracker
-- ============================================================

-- habits: one row per habit definition
create table if not exists habits (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  description     text,
  -- schedule_type: 'daily' | 'weekdays' | 'weekends' | 'custom'
  schedule_type   text        not null default 'daily',
  -- schedule_days: array of weekday ints (0=Sun … 6=Sat) used when type='custom'
  schedule_days   integer[]   not null default '{}',
  -- optional target time 'HH:MM' — used for accountability warnings
  schedule_time   text,
  color           text        not null default '#00d4ff',
  emoji           text        not null default '✓',
  sort_order      integer     not null default 0,
  active          boolean     not null default true,
  created_at      timestamptz not null default now()
);

-- habit_completions: one row per habit per calendar day it was checked off
create table if not exists habit_completions (
  id              uuid        primary key default gen_random_uuid(),
  habit_id        uuid        not null references habits(id) on delete cascade,
  completed_date  date        not null,
  completed_at    timestamptz not null default now(),
  -- prevent duplicate completions for the same day
  unique(habit_id, completed_date)
);

-- Indexes
create index if not exists habit_completions_habit_id_idx     on habit_completions(habit_id);
create index if not exists habit_completions_date_idx         on habit_completions(completed_date);

-- Auto-updated_at is not needed for these simple tables

-- ---- RLS (open policy for personal single-user app) ----
alter table habits            enable row level security;
alter table habit_completions enable row level security;

drop policy if exists allow_all_habits            on habits;
drop policy if exists allow_all_habit_completions on habit_completions;

create policy allow_all_habits            on habits            for all using (true) with check (true);
create policy allow_all_habit_completions on habit_completions for all using (true) with check (true);

-- ---- Seed: default habits ----
insert into habits (title, description, schedule_type, schedule_days, schedule_time, color, emoji, sort_order) values
  ('Morning routine',        'Complete the full morning routine',                'daily',    '{}',        '08:00', '#00d4ff', '🌅', 0),
  ('Deep work session',      'At least one 90-min focus block',                  'weekdays', '{}',        '10:00', '#00ff88', '🎯', 1),
  ('Exercise',               'Move your body — gym, run, or walk',               'daily',    '{}',        '07:00', '#ffb800', '💪', 2),
  ('Read / listen 10 pages', 'Minimum 10 pages of a book or Welsh learning',     'daily',    '{}',        '21:30', '#8b5cf6', '📚', 3),
  ('Talk / Read Welsh',      'Welsh practice — Duolingo, reading or speaking',   'daily',    '{}',        '21:00', '#ff4466', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 4),
  ('No phone after 9pm',     'Phone in another room, no scrolling',              'daily',    '{}',        '21:00', '#4a4a6a', '📵', 5),
  ('Magnesium',              'Take magnesium supplement before bed',             'daily',    '{}',        '21:30', '#00d4ff', '💊', 6),
  ('Collagen 10g',           '10g collagen in water before bed',                 'daily',    '{}',        '21:30', '#ffb800', '🥛', 7)
on conflict do nothing;
