create table if not exists workflow_types (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  color text,
  created_at timestamptz default now()
);

create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  workflow_type_id text references workflow_types(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  order_index int not null,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid references stages(id) on delete cascade,
  title text not null,
  description text,
  instructions text,
  order_index int not null,
  estimated_minutes int,
  has_prompt boolean default false,
  prompt_text text,
  resource_url text,
  created_at timestamptz default now()
);

create table if not exists workflow_sessions (
  id uuid primary key default gen_random_uuid(),
  workflow_type_id text references workflow_types(id),
  title text not null,
  is_priority boolean default false,
  current_stage_id uuid,
  current_task_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists one_priority
  on workflow_sessions(is_priority)
  where is_priority = true;

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workflow_sessions(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  completed_at timestamptz default now(),
  pomodoros_used int default 0,
  unique(session_id, task_id)
);

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
