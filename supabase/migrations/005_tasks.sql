-- 005_tasks.sql
-- Central tasks table: authoritative store for all tasks (synced from Notion, created in-app)
-- Replaces the split daily_tasks + Notion API approach.
--
-- Guard: an older, incompatible "tasks" table can already exist on the live
-- database from the original schema.sql (the legacy generic-workflow system,
-- with stage_id/instructions columns and no "archived" column). If it's still
-- there, "create table if not exists" below is a no-op against it and the
-- indexes further down fail with "column archived does not exist". That
-- legacy table is unconditionally dropped later anyway (019_drop_legacy_workflows.sql,
-- superseded by master_tasks from 010_master_tasks.sql), so it's always safe
-- to drop it here too rather than let this migration fail on old data.
do $$
begin
  if to_regclass('public.tasks') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_name = 'tasks' and column_name = 'archived'
     )
  then
    drop table tasks cascade;
  end if;
end $$;

create table if not exists tasks (
  id               uuid        primary key default gen_random_uuid(),
  notion_id        text        unique,                          -- deduplication key for Notion sync
  title            text        not null,
  status           text        not null default 'Not started', -- 'Not started' | 'In progress' | 'Done'
  due_date         date,
  task_type        text,                                        -- 'Flow' | 'Recurring' | 'Quick Task' | 'Admin' | 'Personal'
  urgency          text,                                        -- 'Urgent' | 'Habit' | 'Non Urgent'
  importance       text,                                        -- 'Moved the Needle' | 'Non Important' | 'Important'
  time_commitment  text,                                        -- '60 + mins' | '30 - 60 mins' | '15 - 30 mins' | '< 15mins'
  is_frog          boolean     not null default false,          -- top priority task of the day
  priority         text,                                        -- 'Low' | 'Medium' | 'High'
  why_note         text,                                        -- personal reason / motivation note
  notion_url       text,                                        -- link back to Notion page
  archived         boolean     not null default false,          -- soft delete
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Performance indexes
create index if not exists tasks_due_date_idx
  on tasks(due_date)
  where archived = false;

create index if not exists tasks_status_idx
  on tasks(status)
  where archived = false and status != 'Done';

create index if not exists tasks_frog_idx
  on tasks(due_date, is_frog)
  where archived = false and is_frog = true;

create index if not exists tasks_type_idx
  on tasks(task_type, due_date)
  where archived = false;

-- Auto-update updated_at on every row change
create or replace function tasks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure tasks_set_updated_at();

-- Enable RLS (personal app -- allow all for anon key)
alter table tasks enable row level security;

drop policy if exists "allow_all_tasks" on tasks;
create policy "allow_all_tasks" on tasks
  for all using (true) with check (true);
