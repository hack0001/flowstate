-- =============================================================
-- FlowState — fix missing RLS policies on the tables added in
-- 022_morning_routine.sql, 023_localstorage_to_db.sql, and 024_page_visits.sql
--
-- Every other table-creating migration in this project explicitly runs:
--   alter table X enable row level security;
--   create policy allow_all_X on X for all using (true) with check (true);
-- Those three migrations missed that step. The likely effect: SELECT still
-- worked (default grants), which is why pages loaded and showed data with
-- no error banner — but INSERT/UPDATE/DELETE through the anon key were
-- silently rejected, so nothing written from the app (routine completions,
-- evening reviews, checklist ticks, tweet models, KB edits, error log
-- entries, page visits) ever actually reached the database. This is almost
-- certainly why page_visits stayed empty after clicking pills, and may also
-- explain why morning routine completions and the other new features looked
-- like they saved but didn't persist across reloads.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

alter table morning_routine_items enable row level security;
drop policy if exists allow_all_morning_routine_items on morning_routine_items;
create policy allow_all_morning_routine_items on morning_routine_items for all using (true) with check (true);

alter table morning_routine_completions enable row level security;
drop policy if exists allow_all_morning_routine_completions on morning_routine_completions;
create policy allow_all_morning_routine_completions on morning_routine_completions for all using (true) with check (true);

alter table evening_reviews enable row level security;
drop policy if exists allow_all_evening_reviews on evening_reviews;
create policy allow_all_evening_reviews on evening_reviews for all using (true) with check (true);

alter table daily_checklist_completions enable row level security;
drop policy if exists allow_all_daily_checklist_completions on daily_checklist_completions;
create policy allow_all_daily_checklist_completions on daily_checklist_completions for all using (true) with check (true);

alter table tweet_models enable row level security;
drop policy if exists allow_all_tweet_models on tweet_models;
create policy allow_all_tweet_models on tweet_models for all using (true) with check (true);

alter table etsy_kb_overrides enable row level security;
drop policy if exists allow_all_etsy_kb_overrides on etsy_kb_overrides;
create policy allow_all_etsy_kb_overrides on etsy_kb_overrides for all using (true) with check (true);

alter table error_log enable row level security;
drop policy if exists allow_all_error_log on error_log;
create policy allow_all_error_log on error_log for all using (true) with check (true);

alter table page_visits enable row level security;
drop policy if exists allow_all_page_visits on page_visits;
create policy allow_all_page_visits on page_visits for all using (true) with check (true);
