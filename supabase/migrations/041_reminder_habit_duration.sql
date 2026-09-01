-- =============================================================
-- FlowState — Reminder/Habit duration on the Calendar Timeline
--
-- reminders and habit_blocks only ever had a single free-text time_label
-- ("9am", "18:00") and a hardcoded 30-minute block on the Timeline — there
-- was no way to drag-resize their end time or set one in the edit modal,
-- unlike tasks (which have start_time + duration_min). Adds duration_min to
-- both tables, defaulting to 30 so existing rows render exactly as before
-- until Tom actually resizes one.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

alter table reminders add column if not exists duration_min integer not null default 30;
alter table habit_blocks add column if not exists duration_min integer not null default 30;
