-- =============================================================
-- FlowState — Betfair paper desk (app/betfair)
--
-- bf_bot     one row: the bot's running state (paper bank, watched markets,
--            open paper positions, agent counters) as jsonb, plus the cached
--            Betfair session token. The token is server-side only: the API
--            route never selects it for the browser.
-- bf_trades  every closed paper trade
-- bf_events  the session log (kills, scores, entries, exits)
--
-- PAPER ONLY: nothing in this feature can place a real bet. The Betfair
-- client (lib/betfair/live.ts) only calls listMarketCatalogue and
-- listMarketBook.
--
-- Owner-only RLS from day one, same as 048/049.
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create or replace function public.is_app_owner()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = any (array['admin@derivativemedia.co.uk']),
    false
  )
$$;

create table if not exists bf_bot (
  id             integer primary key default 1 check (id = 1),
  mode           text not null default 'demo' check (mode in ('demo', 'live')),
  running        boolean not null default false,
  state          jsonb not null default '{}'::jsonb,
  version        integer not null default 0,
  session_token  text,
  session_at     timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);
insert into bf_bot (id) values (1) on conflict (id) do nothing;

create table if not exists bf_trades (
  id          bigserial primary key,
  mode        text not null,
  closed_at   timestamptz not null default now(),
  market_id   text not null,
  market      text not null,
  side        text not null check (side in ('BACK', 'LAY')),
  entry       double precision not null,
  exit        double precision not null,
  stake       double precision not null,
  gross_pl    double precision not null,
  commission  double precision not null,
  net_pl      double precision not null,
  score       integer,
  reason      text not null
);
create index if not exists bf_trades_mode_closed on bf_trades (mode, closed_at);

create table if not exists bf_events (
  id      bigserial primary key,
  mode    text not null,
  at      timestamptz not null default now(),
  type    text not null,
  market  text,
  detail  text
);
create index if not exists bf_events_mode_id on bf_events (mode, id desc);

alter table bf_bot    enable row level security;
alter table bf_trades enable row level security;
alter table bf_events enable row level security;

drop policy if exists owner_only on bf_bot;
drop policy if exists owner_only on bf_trades;
drop policy if exists owner_only on bf_events;
create policy owner_only on bf_bot    for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
create policy owner_only on bf_trades for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
create policy owner_only on bf_events for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
