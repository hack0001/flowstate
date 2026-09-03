-- =============================================================
-- FlowState — Channel watchlist (Content Pipeline > Ideas) + Adobe Skills
--
-- channel_watchlist — YouTube channels in Tom's niche or a similar/adjacent
-- niche worth keeping an eye on, added from the Ideas Bank tab of the
-- Content Pipeline (app/content/page.tsx).
--
-- adobe_skill_resources — a running library of Premiere Pro / After Effects
-- / Illustrator learning resources: a website or YouTube video Tom names and
-- describes, with a simple to-learn/learned tracker. New dedicated section,
-- app/adobe-skills/page.tsx.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists channel_watchlist (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text not null,
  niche       text,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table channel_watchlist enable row level security;
drop policy if exists allow_all_channel_watchlist on channel_watchlist;
create policy allow_all_channel_watchlist on channel_watchlist for all using (true) with check (true);

create table if not exists adobe_skill_resources (
  id          uuid primary key default gen_random_uuid(),
  tool        text not null default 'General',
  title       text not null,
  url         text not null,
  description text,
  status      text not null default 'To learn',
  created_at  timestamptz not null default now()
);

alter table adobe_skill_resources enable row level security;
drop policy if exists allow_all_adobe_skill_resources on adobe_skill_resources;
create policy allow_all_adobe_skill_resources on adobe_skill_resources for all using (true) with check (true);
