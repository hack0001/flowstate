-- Google Calendar sync: remember which Google event a timed task was pushed to,
-- so moving/resizing the task updates the same event instead of duplicating it.
alter table master_tasks add column if not exists google_event_id text;
