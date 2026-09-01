-- =============================================================
-- FlowState — Google Drive integration (SOUND MONEY HQ)
--
-- drive_folder_map — single-row config (same singleton pattern as
-- daily_plan_settings / content_focus_settings) pointing at the key
-- subfolders inside Tom's "SOUND MONEY HQ" Drive folder
-- (admin@derivativemedia.co.uk). Pre-filled with the real folder IDs
-- discovered when this was set up (30 Aug 2026) so no manual entry is
-- needed — editable later from Settings if the structure ever changes.
--
-- content_items gains drive_folder_id (the raw Drive id, for future API
-- calls) alongside the existing drive_url column (022_video_links_and_stats.sql
-- — "the video's asset folder in Google Drive", already wired into the
-- Pipeline card's Assets chip and Full History) which the auto-create action
-- below writes the link into, rather than adding a second, duplicate link
-- field.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists drive_folder_map (
  id                              int primary key default 1,
  root_folder_id                  text,   -- SOUND MONEY HQ
  brand_folder_id                 text,   -- 01_BRAND (Logos, Fonts, Colors, Brand Guidelines)
  asset_library_folder_id         text,   -- 02_ASSET_LIBRARY (topic-organised b-roll/graphics)
  premiere_templates_folder_id    text,   -- 04_PREMIERE (Master_Longform_Template, Master_Short_Template)
  projects_longform_folder_id     text,   -- 07_PROJECTS/LONGFORM
  projects_shorts_folder_id       text,   -- 07_PROJECTS/SHORTS
  project_template_folder_id      text,   -- 07_PROJECTS/TEMPLATE_TO_COPY_001_XXX (subfolder skeleton to replicate per video)
  updated_at                      timestamptz not null default now(),
  constraint drive_folder_map_singleton check (id = 1)
);

insert into drive_folder_map (
  id, root_folder_id, brand_folder_id, asset_library_folder_id,
  premiere_templates_folder_id, projects_longform_folder_id,
  projects_shorts_folder_id, project_template_folder_id
) values (
  1,
  '1yIJQWkH92M9lxVFNmdCkwnOPuA8pHqcV',
  '1fh_RT7dSDCDRKfD5MYj73RXTH0k1_CFA',
  '1Ztro3pSoFuiDm_gFPSYBwraPxKVtjnSe',
  '1Yi8nK78BGZR4FJZI4KUaWbaUr9OvsEk2',
  '1-moPSyof2ieq_L6vA-wJo2wR_6nR30Cg',
  '1U7xwkwBAztbToHCkpWOuljhKBS-iTI0W',
  '1RE3tnR8dxkzSJRxEzdkeBpnzMQxlAngD'
)
on conflict (id) do nothing;

alter table drive_folder_map enable row level security;
drop policy if exists allow_all_drive_folder_map on drive_folder_map;
create policy allow_all_drive_folder_map on drive_folder_map for all using (true) with check (true);

alter table content_items add column if not exists drive_folder_id text;
