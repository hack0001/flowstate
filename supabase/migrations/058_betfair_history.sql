-- =============================================================
-- FlowState — Betfair historical data (free Basic plan)
--
-- A private storage bucket for the recorder's historical import
-- (recorder/deploy/history.sh): one small gzipped file per day of GB/IE
-- racing at racing/YYYY-MM-DD.json.gz, plus racing/index.json listing the
-- days imported. Files, not database rows, to keep storage small (a year
-- is roughly 20 to 40 MB). You (the signed-in owner) can read them from
-- the Backtest and Insights tabs; only the recorder can write them.
--
-- Needs 050 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

insert into storage.buckets (id, name, public) values ('betfair-history', 'betfair-history', false)
on conflict (id) do nothing;

drop policy if exists betfair_history_owner_read on storage.objects;
create policy betfair_history_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'betfair-history' and public.is_app_owner());
