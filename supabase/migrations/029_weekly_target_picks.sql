-- ============================================================
-- 029_weekly_target_picks.sql — "This week's" long-form / short pick
-- ============================================================
-- Companion to weekly_targets (028). The Shorts/Long-form targets already
-- auto-count how many videos of each format hit Live this week — this table
-- adds the ability to SELECT which specific pipeline item you're actually
-- committing to ship as this week's long-form / short-form piece, chosen
-- from the Content page. The home page then shows that title alongside the
-- auto-counted progress instead of just a bare number.
--
-- One pick per (target, week) — re-picking overwrites the prior choice via
-- the unique constraint + upsert. content_item_id is nullable and ON DELETE
-- SET NULL so removing the underlying video doesn't break the row.

create table if not exists weekly_target_picks (
  id              uuid        primary key default gen_random_uuid(),
  target_id       uuid        not null references weekly_targets(id) on delete cascade,
  week_start      date        not null,
  content_item_id uuid        references content_items(id) on delete set null,
  updated_at      timestamptz not null default now(),
  unique(target_id, week_start)
);

create index if not exists weekly_target_picks_week_idx on weekly_target_picks(week_start);

alter table weekly_target_picks enable row level security;
drop policy if exists allow_all_weekly_target_picks on weekly_target_picks;
create policy allow_all_weekly_target_picks on weekly_target_picks for all using (true) with check (true);
