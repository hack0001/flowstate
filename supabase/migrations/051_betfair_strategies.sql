-- =============================================================
-- FlowState — Betfair paper desk: football strategy tests (app/betfair)
--
-- bf_strat       one row: running state of the three paper-test strategies
--                (teams' recent form, matches awaiting a result, demo simulator)
-- bf_strat_bets  every paper bet a strategy places, and how it settled
--
-- PAPER ONLY: nothing in this feature can place a real bet.
-- Needs 050_betfair_paper.sql first (uses bf_bot for the Betfair session).
--
-- Owner-only RLS from day one, same as 048/049/050.
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists bf_strat (
  id          integer primary key default 1 check (id = 1),
  mode        text not null default 'demo' check (mode in ('demo', 'live')),
  running     boolean not null default false,
  state       jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  last_error  text,
  updated_at  timestamptz not null default now()
);
insert into bf_strat (id) values (1) on conflict (id) do nothing;

create table if not exists bf_strat_bets (
  id            bigserial primary key,
  mode          text not null,
  strategy      text not null check (strategy in ('dc', 'bands', 'form')),
  placed_at     timestamptz not null default now(),
  event_id      text not null,
  event         text not null,
  market_id     text not null,
  market_type   text not null,
  selection_id  bigint not null,
  selection     text not null,
  side          text not null check (side in ('BACK', 'LAY')),
  price         double precision not null,
  stake         double precision not null,
  risk          double precision not null,
  model_prob    double precision,
  edge          double precision,
  band          text,
  status        text not null default 'open' check (status in ('open', 'won', 'lost', 'void')),
  pl            double precision,
  settled_at    timestamptz
);
create index if not exists bf_strat_bets_mode_strategy on bf_strat_bets (mode, strategy, id desc);
create index if not exists bf_strat_bets_open on bf_strat_bets (mode, status) where status = 'open';

alter table bf_strat      enable row level security;
alter table bf_strat_bets enable row level security;

drop policy if exists owner_only on bf_strat;
drop policy if exists owner_only on bf_strat_bets;
create policy owner_only on bf_strat      for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
create policy owner_only on bf_strat_bets for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
