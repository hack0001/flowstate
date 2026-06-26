-- FlowState Schema
-- Run this in the Supabase SQL editor

-- Workflow types (YouTube Short, Longform, Tweet, etc.)
create table if not exists workflow_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text not null,
  description text,
  color text not null default '#00d4ff',
  estimated_minutes int not null default 30,
  order_index int not null default 0,
  created_at timestamptz default now()
);

-- Stages within a workflow (Ideation, Production, Publishing, etc.)
create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  workflow_type_id uuid not null references workflow_types(id) on delete cascade,
  name text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz default now()
);

-- Tasks within a stage
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stages(id) on delete cascade,
  title text not null,
  description text,
  instructions text,
  has_prompt boolean not null default false,
  prompt_text text,
  resource_url text,
  estimated_minutes int not null default 5,
  order_index int not null default 0,
  created_at timestamptz default now()
);

-- User workflow sessions
create table if not exists workflow_sessions (
  id uuid primary key default gen_random_uuid(),
  workflow_type_id uuid not null references workflow_types(id),
  title text not null,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  current_stage_id uuid references stages(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

-- Which tasks have been completed in a session
create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workflow_sessions(id) on delete cascade,
  task_id uuid not null references tasks(id),
  pomodoros_used int not null default 0,
  completed_at timestamptz default now(),
  unique(session_id, task_id)
);

-- RLS: allow all (no auth required)
alter table workflow_types enable row level security;
alter table stages enable row level security;
alter table tasks enable row level security;
alter table workflow_sessions enable row level security;
alter table task_completions enable row level security;

create policy "allow all" on workflow_types for all using (true) with check (true);
create policy "allow all" on stages for all using (true) with check (true);
create policy "allow all" on tasks for all using (true) with check (true);
create policy "allow all" on workflow_sessions for all using (true) with check (true);
create policy "allow all" on task_completions for all using (true) with check (true);
