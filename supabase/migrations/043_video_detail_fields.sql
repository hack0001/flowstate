-- =============================================================
-- FlowState — Structured video-detail fields for the production build
--
-- Before this, the only place to capture what a video is actually about
-- while building it was the single freeform "Consult Claude" note per
-- stage (content_stage_notes) — the Holy Trifecta decisions (title,
-- thumbnail concept, hook) and the Thumbnail & SEO stage's metadata had
-- nowhere structured to live, so they either got buried in a paragraph of
-- notes or never written down at all.
--
-- hook              — the opening line/angle locked in Holy Trifecta
-- thumbnail_concept — the thumbnail type-combo + description locked in
--                      Holy Trifecta (the real image gets built later)
-- thumbnail_url      — link to the finished thumbnail image file, once
--                      built in the Thumbnail & SEO stage
-- seo_description    — the finalised YouTube description
-- seo_tags           — the finalised YouTube tags (comma-separated)
--
-- title, unique_angle and video_type already exist (008/017) but weren't
-- surfaced/editable inside the actual production build (content-focus) —
-- no new columns needed for those, just app-side wiring.
--
-- Additive only, flowstate-local (the Notion sync only writes columns it
-- explicitly lists, so these are safe to add without touching it).
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

alter table content_items add column if not exists hook text;
alter table content_items add column if not exists thumbnail_concept text;
alter table content_items add column if not exists thumbnail_url text;
alter table content_items add column if not exists seo_description text;
alter table content_items add column if not exists seo_tags text;
