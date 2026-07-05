create table if not exists workspace_links (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  name text not null,
  url text,
  select_type text,   -- 'Watch' | 'Read' | null
  priority text,      -- 'Important' | 'Medium' | 'Long Term' | null
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table workspace_links enable row level security;
create policy allow_all_workspace_links on workspace_links for all using (true) with check (true);
