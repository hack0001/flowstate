-- 010_master_tasks.sql
-- Personal tasks table — renamed from 'tasks' to avoid collision with YouTube workflow tasks table.
-- The YouTube workflow 'tasks' table (schema.sql) has stage_id/instructions/etc.
-- This table holds personal/Notion-imported tasks.

create table if not exists master_tasks (
  id               uuid        primary key default gen_random_uuid(),
  notion_id        text        unique,
  title            text        not null,
  status           text        not null default 'Not started',
  due_date         date,
  task_type        text,
  urgency          text,
  importance       text,
  time_commitment  text,
  is_frog          boolean     not null default false,
  priority         text,
  why_note         text,
  notion_url       text,
  archived         boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists master_tasks_due_date_idx
  on master_tasks(due_date)
  where archived = false;

create index if not exists master_tasks_status_idx
  on master_tasks(status)
  where archived = false;

-- RLS: allow all operations with anon key
alter table master_tasks enable row level security;

drop policy if exists allow_all_master_tasks on master_tasks;
create policy allow_all_master_tasks on master_tasks for all using (true) with check (true);
