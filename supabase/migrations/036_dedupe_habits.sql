-- ============================================================
-- 036_dedupe_habits.sql — Fix duplicate habits, make it structurally
-- impossible to happen again.
--
-- Root cause: 006_habits.sql's seed insert used "on conflict do nothing"
-- but the habits table had no unique constraint for anything to actually
-- conflict on (id is a fresh random uuid every time) -- so every time the
-- seed insert ran again (e.g. re-running RUN_ALL.sql against an already-
-- provisioned database), it silently added another full set of duplicate
-- habit rows instead of being skipped. That's why the Tracking page and
-- Home's streaks row started showing repeated habits, and why finishing
-- the Morning Routine stopped extending its Habit Tracker streak --
-- completeMorningRoutineHabit() (lib/supabase.ts) and Home's own
-- cross-check both looked the habit up by title with .maybeSingle(),
-- which errors out the moment more than one row shares that title, and
-- that error was never surfaced anywhere, so it just silently no-op'd.
--
-- This migration is idempotent and safe to re-run: for each set of
-- same-titled habit rows it keeps the oldest one, moves any completions
-- recorded against the newer duplicates onto it, deletes the duplicates,
-- then adds a real unique constraint on title so this can't recur. Once
-- re-run with no duplicates left, both statements below simply affect 0
-- rows and the CREATE UNIQUE INDEX is a no-op.
-- ============================================================

-- Move every duplicate's completions onto the oldest row for that title,
-- skipping any day the keeper already has a completion for (that pairing
-- has its own unique(habit_id, completed_date) constraint).
with ranked as (
  select id, title,
         first_value(id) over (partition by title order by created_at asc, id asc) as keeper_id
  from habits
),
dups as (
  select id, keeper_id from ranked where id <> keeper_id
)
insert into habit_completions (habit_id, completed_date)
select d.keeper_id, hc.completed_date
from habit_completions hc
join dups d on d.id = hc.habit_id
on conflict (habit_id, completed_date) do nothing;

-- Now remove the duplicate habit rows themselves (cascades to clean up
-- their now-redundant habit_completions rows too).
with ranked as (
  select id, title,
         first_value(id) over (partition by title order by created_at asc, id asc) as keeper_id
  from habits
)
delete from habits where id in (select id from ranked where id <> keeper_id);

-- Enforce uniqueness going forward so the original bug can't happen again.
-- 006_habits.sql's seed insert deliberately stays a bare "on conflict do
-- nothing" (see the comment there) since it runs before this file in
-- RUN_ALL.sql -- but once this index exists, that bare form starts
-- actually catching the conflict instead of letting it through.
create unique index if not exists habits_title_unique_idx on habits(title);
