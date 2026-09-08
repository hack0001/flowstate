-- =============================================================
-- FlowState — Music library (Sound folder)
--
-- music_library — a running store of links to music/sound tracks worth
-- using in videos or Shorts (e.g. a slowed/trending TikTok or YouTube
-- audio), each with an optional artist, genre/mood tag and notes, plus a
-- simple saved/used tracker. New dedicated section, app/music/page.tsx.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists music_library (
  id          uuid primary key default gen_random_uuid(),
  genre       text not null default 'Other',
  title       text not null,
  url         text not null,
  artist      text,
  notes       text,
  status      text not null default 'Saved',
  created_at  timestamptz not null default now()
);

alter table music_library enable row level security;
drop policy if exists allow_all_music_library on music_library;
create policy allow_all_music_library on music_library for all using (true) with check (true);

-- Seed with the example Tom asked for -- guarded so re-running this
-- migration doesn't duplicate rows (music_library has no natural unique key).
insert into music_library (genre, title, url, artist, notes, status)
select * from (values
  ('Trending / Viral', 'Vem Pere Reka (Slowed)', 'https://www.youtube.com/watch?v=XFdnTeTJp3E', 'DJ Kinn',
   'Popular slowed/phonk TikTok + YouTube Shorts audio. Also on TikTok as a sound: https://www.tiktok.com/music/Vem-Pere-Reka-Super-Slowed-7525087205191960577',
   'Saved')
) as seed(genre, title, url, artist, notes, status)
where not exists (select 1 from music_library);
