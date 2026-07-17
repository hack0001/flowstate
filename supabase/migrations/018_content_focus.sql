-- ============================================================
-- 018_content_focus.sql — YouTube-Pipeline-driven Focus Session
-- Additive only, flowstate-local (not sourced from Notion sync — the
-- Notion upsert in app/api/sync/notion/route.ts only ever writes the
-- columns it explicitly lists, so these are safe to add without
-- touching the sync).
--
-- is_active_focus        — up to 2 content_items pinned as the Home page's
--                           "active focus" videos/shorts (any pipeline stage).
--                           Enforced to max 2 in the app layer, not the DB.
-- content_step_completions — per-video checklist state for the SOP steps
--                           tied to the item's current pipeline_stage (see
--                           lib/sops.ts STAGE_TO_SOP). Ticking every step for
--                           the current stage is what the new focus session
--                           uses to trigger the pipeline_stage advance.
-- ============================================================

alter table content_items add column if not exists is_active_focus boolean not null default false;

create index if not exists content_items_active_focus_idx on content_items(is_active_focus) where is_active_focus = true;

create table if not exists content_step_completions (
  id                uuid        primary key default gen_random_uuid(),
  content_item_id   uuid        not null references content_items(id) on delete cascade,
  sop_id            text        not null,   -- matches SOP.id in lib/sops.ts, e.g. '02'
  step_index        int         not null,   -- index into that SOP's steps[] array
  completed_at      timestamptz not null default now(),
  unique (content_item_id, sop_id, step_index)
);

create index if not exists content_step_completions_item_idx on content_step_completions(content_item_id);

alter table content_step_completions enable row level security;
drop policy if exists allow_all_content_step_completions on content_step_completions;
create policy allow_all_content_step_completions on content_step_completions for all using (true) with check (true);
