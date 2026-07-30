-- 027_task_time_blocks.sql
-- Adds optional time-of-day scheduling to master_tasks so the Calendar's
-- Timeline view can place tasks on an hourly grid and let the user
-- drag-move / drag-resize them, instead of only sorting by section.
-- Both columns are nullable: a task with no start_time falls back to the
-- Timeline view's default placement (Flow -> morning window, Personal/Admin
-- -> evening window) computed client-side, so nothing has to backfill.

alter table master_tasks add column if not exists start_time text;   -- 'HH:MM' 24h, e.g. '09:30'
alter table master_tasks add column if not exists duration_min integer; -- minutes, e.g. 30

comment on column master_tasks.start_time is 'Optional HH:MM (24h) time-of-day for the Calendar Timeline view. Null = auto-placed by task_type.';
comment on column master_tasks.duration_min is 'Optional block length in minutes for the Calendar Timeline view. Null = default (30).';
