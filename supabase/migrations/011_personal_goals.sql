-- personal_items: lifestyle goals, habits, ideas from Notion Personal database
create table if not exists personal_items (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  name text not null,
  priority text not null default 'Medium', -- High | Medium | Low
  notes text,
  notion_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table personal_items enable row level security;
create policy allow_all_personal_items on personal_items for all using (true) with check (true);

-- goals: hierarchical goals from Notion Goals database
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  name text not null,
  priority text, -- P0 | P1 | P2
  status text,   -- Green | Yellow | Red
  is_top_level boolean not null default false,
  notion_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy allow_all_goals on goals for all using (true) with check (true);
