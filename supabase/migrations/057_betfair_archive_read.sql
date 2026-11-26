-- =============================================================
-- FlowState — let the app owner read the Betfair archive files
--
-- The recorder moves price snapshots older than three days into
-- compressed daily files in the private storage bucket betfair-archive.
-- This lets you (the signed-in owner, is_app_owner() from 050) read
-- those files from FlowState's Backtest, Insights and Data tabs, so the
-- website doesn't need the Supabase secret key to do it. Read only:
-- only the recorder (with its secret key) can write or delete them.
--
-- Needs 050 and 053 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

insert into storage.buckets (id, name, public) values ('betfair-archive', 'betfair-archive', false)
on conflict (id) do nothing;

drop policy if exists betfair_archive_owner_read on storage.objects;
create policy betfair_archive_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'betfair-archive' and public.is_app_owner());
