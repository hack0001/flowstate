-- Day planning tables: daily_tasks, daily_intentions, routine_completions
-- These replace Notion as the primary store for the day planner

create table if not exists daily_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  due_date        date,
  status          text not null default 'Not started',
  urgency         text,
  importance      text,
  time_commitment text,
  task_type       text,
  is_frog         boolean not null default false,
  why_note        text,
  notion_id       text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists daily_intentions (
  id              uuid primary key default gen_random_uuid(),
  intention_date  date not null unique,
  intention_text  text not null default '',
  locked          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists routine_completions (
  id             uuid primary key default gen_random_uuid(),
  routine_date   date not null unique,
  completed_at   timestamptz not null default now()
);

create index if not exists daily_tasks_due_date_idx on daily_tasks(due_date);
create index if not exists daily_tasks_status_idx on daily_tasks(status);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists daily_tasks_updated_at on daily_tasks;
create trigger daily_tasks_updated_at
  before update on daily_tasks for each row execute function set_updated_at();

drop trigger if exists daily_intentions_updated_at on daily_intentions;
create trigger daily_intentions_updated_at
  before update on daily_intentions for each row execute function set_updated_at();
