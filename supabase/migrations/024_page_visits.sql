-- =============================================================
-- FlowState — track page visits in the database
--
-- The Home page shows a warning badge on each section pill once it's been
-- a few days since you last opened it. That was driven entirely by
-- flowstate_last_visit_<route> in localStorage, so it only ever reflected
-- activity on one browser — a fresh browser or a cleared cache made every
-- pill look stale even if you visit constantly elsewhere.
--
-- This migration adds a single table so "last visited" is a real,
-- cross-device fact instead of a per-browser guess.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists page_visits (
  route text primary key,
  last_visited_at timestamptz not null default now()
);

alter table page_visits enable row level security;
drop policy if exists allow_all_page_visits on page_visits;
create policy allow_all_page_visits on page_visits for all using (true) with check (true);
