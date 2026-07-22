-- ============================================================
-- 022_video_links_and_stats.sql — Per-video links for the pipeline
--
-- script_url   — where the actual script lives (Google Doc / Drive file)
-- drive_url    — the video's asset folder in Google Drive
-- youtube_url  — the published video, once live; the app extracts the
--                video id from this to pull public stats (views/likes/
--                comments) from the YouTube Data API in one place.
--
-- Additive only, flowstate-local (the Notion sync only writes columns it
-- explicitly lists, so these are safe to add without touching it).
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- ============================================================

alter table content_items add column if not exists script_url text;
alter table content_items add column if not exists drive_url text;
alter table content_items add column if not exists youtube_url text;
