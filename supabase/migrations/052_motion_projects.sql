-- =============================================================
-- FlowState — Motion Studio projects
--
-- motion_projects — one row per animated video built in Motion Studio
-- (app/motion/page.tsx): which template it uses and the template's content
-- JSON (text, numbers, icons, media slot paths). The template code itself
-- lives in motion/templates/*; this table only stores the data.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run.
-- Uses the owner-only policy from migration 048 (re-run 048 afterwards is
-- not needed for this table; it is created locked down).
-- =============================================================

create table if not exists motion_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  template    text not null default 'kinetic-short',
  content     jsonb not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table motion_projects enable row level security;
drop policy if exists owner_only on motion_projects;
create policy owner_only on motion_projects for all to authenticated
  using (public.is_app_owner()) with check (public.is_app_owner());
