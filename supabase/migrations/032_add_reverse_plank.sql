-- =============================================================
-- FlowState — add "Reverse plank hold" to the morning routine
--
-- morning_routine_items is a runtime-editable table (see
-- 022_morning_routine.sql) -- this migration just seeds one more row so
-- it shows up without hand-adding it in the app. Idempotent: appended
-- with a fresh id and guarded by ON CONFLICT DO NOTHING, same as the
-- original seed, so re-running this (or RUN_ALL.sql) is always safe.
--
-- RUN IN SUPABASE SQL EDITOR -- safe to re-run
-- =============================================================

insert into morning_routine_items (id, title, minutes, note, category, sort_order) values
  ('mr-revplank', 'Reverse plank hold', 2, '2 minute hold -- hips up, glutes squeezed, shoulders back', 'Movement', 12)
on conflict (id) do nothing;
