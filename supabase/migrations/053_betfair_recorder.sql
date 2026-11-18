-- =============================================================
-- FlowState — Betfair recorder server (recorder/)
--
-- Adds what the always-on recorder needs on top of 052:
--   bf_markets      + race details for breakdowns (race type, country,
--                     total matched, time of the off, Starting Prices,
--                     when the day was archived)
--   bf_snaps        + one row per market per moment (makes retries safe)
--   bf_recorder     one row: the recorder's heartbeat and last error
--   bf_recorder_min one row per minute: checks made / failed, snapshots
--                     saved. Shows where data is missing.
--   storage bucket  betfair-archive (private): one compressed file per
--                     day once it is older than a week
--
-- Needs 050 and 052 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

alter table bf_markets add column if not exists market_name   text;
alter table bf_markets add column if not exists country       text;
alter table bf_markets add column if not exists race_type     text;
alter table bf_markets add column if not exists total_matched double precision;
alter table bf_markets add column if not exists off_at        timestamptz;
alter table bf_markets add column if not exists bsp           jsonb;
alter table bf_markets add column if not exists archived_at   timestamptz;
alter table bf_markets add column if not exists updated_at    timestamptz not null default now();
create index if not exists bf_markets_archive on bf_markets (start_at) where archived_at is null;

-- Remove any duplicate snapshots before adding the one-per-moment rule.
delete from bf_snaps a using bf_snaps b
where a.market_id = b.market_id and a.at = b.at and a.id > b.id;
create unique index if not exists bf_snaps_market_at_unique on bf_snaps (market_id, at);
drop index if exists bf_snaps_market_at;

create table if not exists bf_recorder (
  id                integer primary key default 1 check (id = 1),
  version           text,
  started_at        timestamptz,
  last_beat         timestamptz,
  last_ok           timestamptz,
  last_error        text,
  last_error_at     timestamptz,
  markets_tracked   integer not null default 0,
  pending_writes    integer not null default 0
);
insert into bf_recorder (id) values (1) on conflict (id) do nothing;

create table if not exists bf_recorder_min (
  minute        timestamptz primary key,
  checks_ok     integer not null default 0,
  checks_failed integer not null default 0,
  snaps         integer not null default 0
);

alter table bf_recorder     enable row level security;
alter table bf_recorder_min enable row level security;
drop policy if exists owner_only on bf_recorder;
drop policy if exists owner_only on bf_recorder_min;
create policy owner_only on bf_recorder     for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
create policy owner_only on bf_recorder_min for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner());

-- Private file storage for the daily archives. Only the recorder (service key)
-- and FlowState's server read or write it; there are no public policies.
insert into storage.buckets (id, name, public) values ('betfair-archive', 'betfair-archive', false)
on conflict (id) do nothing;

-- If you ran the once-a-minute schedule from the old Setup tab, this removes it
-- and its saved secrets. Does nothing if you never ran it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'betfair-bots';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    delete from vault.secrets where name in ('flowstate_url', 'flowstate_cron_secret');
  end if;
end $$;
