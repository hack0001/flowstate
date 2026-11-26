-- =============================================================
-- FlowState — Motion Reference Bank
--
-- motion_references       — one row per reference video (an upload in the
--                           private bucket motion-references, or a YouTube link)
-- motion_reference_clips  — the parts you marked in a reference: in/out time,
--                           tags (transition, text, data…), notes and a still
-- motion_projects.refs    — which clips are attached to which Motion Studio
--                           scene, e.g. {"s4": ["<clip id>", …]}
--
-- Needs 048 (is_app_owner) and 052 (motion_projects). Safe to re-run.
-- File size: uploads are limited by Supabase's global limit
-- (Free plan 50 MB per file; Pro up to 500 GB — Storage → Settings).
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

create table if not exists motion_references (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  format        text not null default 'short' check (format in ('short', 'long')),
  source        text not null check (source in ('upload', 'youtube')),
  storage_path  text,           -- uploads: path inside the motion-references bucket
  youtube_id    text,           -- youtube: the 11-character video id
  creator       text,
  duration_s    numeric,
  width         int,
  height        int,
  tags          text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists motion_reference_clips (
  id            uuid primary key default gen_random_uuid(),
  reference_id  uuid not null references motion_references(id) on delete cascade,
  label         text not null,
  start_s       numeric not null,
  end_s         numeric not null check (end_s > start_s),
  tags          text[] not null default '{}',
  notes         text,
  still_path    text,           -- PNG in the bucket, captured at the in point
  created_at    timestamptz not null default now()
);
create index if not exists motion_reference_clips_ref_idx on motion_reference_clips(reference_id);

alter table motion_projects add column if not exists refs jsonb not null default '{}'::jsonb;

alter table motion_references enable row level security;
drop policy if exists owner_only on motion_references;
create policy owner_only on motion_references for all to authenticated
  using (public.is_app_owner()) with check (public.is_app_owner());

alter table motion_reference_clips enable row level security;
drop policy if exists owner_only on motion_reference_clips;
create policy owner_only on motion_reference_clips for all to authenticated
  using (public.is_app_owner()) with check (public.is_app_owner());

-- Private bucket: only you (signed in) can read, upload, replace or delete.
insert into storage.buckets (id, name, public) values ('motion-references', 'motion-references', false)
on conflict (id) do nothing;

drop policy if exists motion_references_owner_all on storage.objects;
create policy motion_references_owner_all on storage.objects for all to authenticated
  using (bucket_id = 'motion-references' and public.is_app_owner())
  with check (bucket_id = 'motion-references' and public.is_app_owner());
