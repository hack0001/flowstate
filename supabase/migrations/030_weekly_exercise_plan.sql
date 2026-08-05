-- ============================================================
-- 030_weekly_exercise_plan.sql — Physical page weekly organiser
-- ============================================================
-- Lets the user assign exercises to specific days of the week from the
-- Physical page (a recurring template, not tied to a specific calendar
-- week — day_of_week repeats every week until changed). The home page
-- reads this table filtered to today's day_of_week and shows "Today's
-- physical" as a real checklist, so planning and daily execution share
-- one source of truth.
--
-- day_of_week matches JS Date.getDay(): 0 = Sunday .. 6 = Saturday.
-- Completion state is tracked separately via the existing
-- daily_checklist_completions table (checklist_key = 'physical_plan',
-- item_id = this row's id, completed_date = today) — no new tracking
-- table needed, and it resets automatically each day.

create table if not exists weekly_exercise_plan (
  id          uuid        primary key default gen_random_uuid(),
  day_of_week int         not null check (day_of_week between 0 and 6),
  label       text        not null,
  category    text,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists weekly_exercise_plan_day_idx on weekly_exercise_plan(day_of_week);

alter table weekly_exercise_plan enable row level security;
drop policy if exists allow_all_weekly_exercise_plan on weekly_exercise_plan;
create policy allow_all_weekly_exercise_plan on weekly_exercise_plan for all using (true) with check (true);
