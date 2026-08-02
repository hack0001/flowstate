-- ============================================================
-- 028_weekly_targets.sql  —  Weekly output targets (home page)
-- ============================================================
-- weekly_targets: the definitions ("3 Shorts", "1 Long-form", ...).
-- tracking = 'auto_shorts' | 'auto_longform' | 'manual'
--   auto_* targets are counted live from content_items (pipeline_stage =
--   Live, updated this week) rather than stored — nothing to keep in sync.
--   manual targets are ticked up/down by hand and stored per week below.

create table if not exists weekly_targets (
  id            uuid        primary key default gen_random_uuid(),
  label         text        not null,
  emoji         text        not null default '#',
  color         text        not null default '#00d4ff',
  target_count  integer     not null default 1,
  tracking      text        not null default 'manual', -- auto_shorts | auto_longform | manual
  sort_order    integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- weekly_target_progress: manual tally per target per week (Monday date).
create table if not exists weekly_target_progress (
  id            uuid        primary key default gen_random_uuid(),
  target_id     uuid        not null references weekly_targets(id) on delete cascade,
  week_start    date        not null,
  manual_count  integer     not null default 0,
  updated_at    timestamptz not null default now(),
  unique(target_id, week_start)
);

create index if not exists weekly_target_progress_week_idx on weekly_target_progress(week_start);

alter table weekly_targets          enable row level security;
alter table weekly_target_progress  enable row level security;

drop policy if exists allow_all_weekly_targets          on weekly_targets;
drop policy if exists allow_all_weekly_target_progress  on weekly_target_progress;

create policy allow_all_weekly_targets         on weekly_targets         for all using (true) with check (true);
create policy allow_all_weekly_target_progress on weekly_target_progress for all using (true) with check (true);

-- ---- Seed: default weekly targets ----
insert into weekly_targets (label, emoji, color, target_count, tracking, sort_order) values
  ('Shorts',         '🎬', '#ff4466', 3, 'auto_shorts',    0),
  ('Long-form',      '🎥', '#00d4ff', 1, 'auto_longform',  1),
  ('Etsy listings',  '🛍',  '#f97316', 4, 'manual',         2),
  ('Website work',   '💻', '#8b5cf6', 1, 'manual',         3)
on conflict do nothing;
