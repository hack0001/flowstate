-- =============================================================
-- FlowState — Configurable focus-star cap
--
-- content_focus_settings — single-row config (same singleton pattern as
-- daily_plan_settings in 020_daily_plan_and_stage_notes.sql) holding how
-- many content_items can be pinned (is_active_focus = true) at once in the
-- YouTube Content Pipeline. Was hardcoded to 2 everywhere; Tom wants to set
-- it himself instead.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists content_focus_settings (
  id              int primary key default 1,
  max_focus_items int not null default 2,
  updated_at      timestamptz not null default now(),
  constraint content_focus_settings_singleton check (id = 1)
);

insert into content_focus_settings (id) values (1) on conflict (id) do nothing;

alter table content_focus_settings enable row level security;
drop policy if exists allow_all_content_focus_settings on content_focus_settings;
create policy allow_all_content_focus_settings on content_focus_settings for all using (true) with check (true);
