-- ============================================================
-- 017_content_growth_fields.sql  —  Growth-lever fields for content_items
-- Additive only, flowstate-local (not sourced from Notion sync — the
-- Notion upsert in app/api/sync/notion/route.ts only ever writes the
-- columns it explicitly lists, so these are safe to add without
-- touching the sync).
--
-- video_type    — which of the four funnel roles this video plays
-- unique_angle  — the "alpha" check: what this video has that a
--                 generic AI answer or the top existing videos don't
-- revenue_note  — manual revenue attribution logged at Post-Published,
--                 since views alone don't tell you what actually paid
-- ============================================================

alter table content_items add column if not exists video_type text;
-- How-To | Listicle | Case Study | Explainer

alter table content_items add column if not exists unique_angle text;
alter table content_items add column if not exists revenue_note text;

create index if not exists content_video_type_idx on content_items(video_type);
