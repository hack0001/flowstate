-- =============================================================
-- FlowState — Yap Session transcripts + Storyboard blocks
--
-- Two new per-content-item tables supporting the Scripting stage:
--
-- 1. content_yap_transcripts — one row per content item, holding the whole
--    back-and-forth "yap session" conversation (you talk out loud about the
--    video, Claude interviews you with follow-ups) as a JSON array of
--    {role, content} messages. Single row per item (primary key on
--    content_item_id) since there's only ever one running conversation per
--    video, updated in place rather than accumulating history rows.
--
-- 2. content_storyboard_blocks — many rows per content item, one per shot/
--    beat: the spoken line plus what's on screen at that moment (b-roll,
--    screenshot, animation, image, meme, text overlay, SFX, or just VO).
--    Ordered by sort_order. This is the color-coded script — reading down
--    the list is the storyboard, and counting rows by asset_type is the
--    asset checklist ("collect 4 b-roll clips, 3 screenshots...") before
--    you ever open Premiere.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists content_yap_transcripts (
  content_item_id uuid primary key references content_items(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table content_yap_transcripts enable row level security;
drop policy if exists allow_all_content_yap_transcripts on content_yap_transcripts;
create policy allow_all_content_yap_transcripts on content_yap_transcripts for all using (true) with check (true);

create table if not exists content_storyboard_blocks (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  sort_order integer not null default 0,
  text text not null default '',
  -- 'vo' | 'text' | 'broll' | 'screenshot' | 'animation' | 'image' | 'meme' | 'sfx'
  asset_type text not null default 'vo',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists content_storyboard_blocks_item_idx on content_storyboard_blocks(content_item_id, sort_order);

alter table content_storyboard_blocks enable row level security;
drop policy if exists allow_all_content_storyboard_blocks on content_storyboard_blocks;
create policy allow_all_content_storyboard_blocks on content_storyboard_blocks for all using (true) with check (true);
