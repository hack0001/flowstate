-- ============================================================
-- 009_projects.sql  —  Projects (separate Notion DB)
-- DB ID: 352ed686-b47d-8035-8c12-000bc64736c4
-- ============================================================

create table if not exists projects (
  id              uuid        primary key default gen_random_uuid(),
  notion_id       text        unique,
  title           text        not null,
  status          text        not null default 'Not started', -- Not started | In progress | Paused | Done
  priority        text,        -- Low | Medium | High
  deadline        date,
  goal            text,        -- "Why does this project exist"
  next_action     text,        -- "Single Next Action"
  notes           text,
  notion_url      text,
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_status_idx   on projects(status);
create index if not exists projects_deadline_idx on projects(deadline);
create index if not exists projects_archived_idx on projects(archived);

alter table projects enable row level security;
drop policy if exists allow_all_projects on projects;
create policy allow_all_projects on projects for all using (true) with check (true);

create or replace function update_projects_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_projects_updated_at();
