-- =============================================================
-- FlowState — fade-drift paper bot
--
-- One row per paper trade from the recorder's fade-drift bot
-- (recorder/src/fadeBot.ts): when a horse drifts 15+ ticks in 5 minutes
-- and stays out, paper-back it, then hedge 10 minutes later. Paper only.
-- Only you can read it; the recorder writes it with its server key.
--
-- Needs 050 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

create table if not exists bf_paper_fade (
  market_id text not null,
  selection_id bigint not null,
  race text,
  start_at timestamptz,
  signal_at timestamptz,
  ref_price double precision,
  drift_ticks double precision,
  entry_at timestamptz,
  entry_price double precision,
  exit_at timestamptz,
  exit_price double precision,
  stake double precision,
  pnl double precision,
  status text,
  updated_at timestamptz default now(),
  primary key (market_id, selection_id)
);
create index if not exists bf_paper_fade_entry on bf_paper_fade (entry_at desc);

alter table bf_paper_fade enable row level security;
drop policy if exists bf_paper_fade_owner on bf_paper_fade;
create policy bf_paper_fade_owner on bf_paper_fade for select to authenticated using (public.is_app_owner());
