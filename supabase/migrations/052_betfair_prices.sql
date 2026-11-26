-- =============================================================
-- FlowState — Betfair price recorder (app/betfair, Data tab)
--
-- bf_markets  one row per market the live bots looked at: sport, type, event,
--             start time, runner names, and the result once Betfair settles it
-- bf_snaps    price snapshots: best back/lay, sizes and last traded price for
--             every runner. runners = [[selectionId, back, backSize, lay,
--             laySize, lastTraded], ...]
--
-- Filled in live mode only. Used to export CSVs and replay the strategies.
-- Needs 050_betfair_paper.sql first (uses is_app_owner()).
--
-- Owner-only RLS from day one, same as 048-051.
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists bf_markets (
  market_id    text primary key,
  sport        text not null check (sport in ('racing', 'football')),
  market_type  text not null,
  event_id     text,
  event        text not null,
  venue        text,
  start_at     timestamptz not null,
  runners      jsonb not null default '[]'::jsonb,
  status       text,
  winners      jsonb,
  removed      jsonb,
  result_at    timestamptz,
  first_seen   timestamptz not null default now()
);
create index if not exists bf_markets_sport_start on bf_markets (sport, start_at);
create index if not exists bf_markets_unresolved on bf_markets (sport, start_at) where status is null;

create table if not exists bf_snaps (
  id         bigserial primary key,
  market_id  text not null,
  at         timestamptz not null,
  inplay     boolean not null default false,
  matched    double precision,
  runners    jsonb not null
);
create index if not exists bf_snaps_market_at on bf_snaps (market_id, at);

alter table bf_markets enable row level security;
alter table bf_snaps   enable row level security;

drop policy if exists owner_only on bf_markets;
drop policy if exists owner_only on bf_snaps;
create policy owner_only on bf_markets for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
create policy owner_only on bf_snaps   for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
