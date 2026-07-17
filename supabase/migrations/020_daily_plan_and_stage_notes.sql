-- =============================================================
-- FlowState — Daily weighted workflow plan + Pipeline AI-assist
--
-- 1. daily_plans        — the generated/edited plan for a given date,
--                          one row per scheduled block (one section's
--                          top-priority item + a time allocation).
-- 2. daily_plan_settings — single-row config: total working minutes/day
--                          and the % split across the 5 sections.
-- 3. content_stage_notes — AI-assisted (or hand-written) notes per
--                          content_item per SOP stage, so each stage
--                          keeps its own output as a video advances.
-- 4. x_ideas             — lightweight content-idea backlog for X, so
--                          X has something to prioritise like the other
--                          sections (it previously had no persisted list).
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists daily_plans (
  id          uuid primary key default gen_random_uuid(),
  plan_date   date not null,
  section     text not null,              -- 'youtube' | 'etsy' | 'tasks' | 'x' | 'vault'
  source_id   text,                       -- id of the underlying item, nullable for freeform blocks
  title       text not null,
  minutes     int  not null default 30,
  order_index int  not null default 0,
  status      text not null default 'planned',  -- planned | done | skipped | rescheduled
  created_at  timestamptz not null default now()
);

create index if not exists daily_plans_date_idx on daily_plans (plan_date);

alter table daily_plans enable row level security;
drop policy if exists allow_all_daily_plans on daily_plans;
create policy allow_all_daily_plans on daily_plans for all using (true) with check (true);


create table if not exists daily_plan_settings (
  id           int primary key default 1,
  total_minutes int not null default 360,
  pct_youtube  int not null default 50,
  pct_etsy     int not null default 20,
  pct_tasks    int not null default 15,
  pct_x        int not null default 10,
  pct_vault    int not null default 5,
  updated_at   timestamptz not null default now(),
  constraint daily_plan_settings_singleton check (id = 1)
);

insert into daily_plan_settings (id) values (1) on conflict (id) do nothing;

alter table daily_plan_settings enable row level security;
drop policy if exists allow_all_daily_plan_settings on daily_plan_settings;
create policy allow_all_daily_plan_settings on daily_plan_settings for all using (true) with check (true);


create table if not exists content_stage_notes (
  id              uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  sop_id          text not null,
  output          text,
  updated_at      timestamptz not null default now(),
  unique (content_item_id, sop_id)
);

alter table content_stage_notes enable row level security;
drop policy if exists allow_all_content_stage_notes on content_stage_notes;
create policy allow_all_content_stage_notes on content_stage_notes for all using (true) with check (true);


create table if not exists x_ideas (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  status     text not null default 'todo',   -- todo | done
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table x_ideas enable row level security;
drop policy if exists allow_all_x_ideas on x_ideas;
create policy allow_all_x_ideas on x_ideas for all using (true) with check (true);
