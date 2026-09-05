-- =============================================================
-- FlowState — Title/thumbnail variants for YouTube's A/B test tool
--
-- YouTube's native Test & Compare feature (Studio) lets you test up to 3
-- titles, 3 thumbnails, or 3 title+thumbnail combos on one video, picking a
-- winner by watch time. Previously this app only ever stored ONE title
-- (content_items.title) and one thumbnail concept/link (043), so there was
-- nowhere to draft the other 1-2 candidates ahead of upload.
--
-- title (existing) and thumbnail_concept/thumbnail_url (043) now double as
-- "variant 1" -- these two add slots 2 and 3 alongside them, decided early
-- (title options + thumbnail concepts in Holy Trifecta) and finished later
-- (thumbnail image links in Thumbnail & SEO), ready to drop straight into
-- YouTube Studio's A/B test tool at upload time.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

alter table content_items add column if not exists title_option_2 text;
alter table content_items add column if not exists title_option_3 text;
alter table content_items add column if not exists thumbnail_concept_2 text;
alter table content_items add column if not exists thumbnail_concept_3 text;
alter table content_items add column if not exists thumbnail_url_2 text;
alter table content_items add column if not exists thumbnail_url_3 text;
