-- =============================================================
-- FlowState — Script Editor storyboard categories
--
-- storyboard_categories — the user-editable list of visual-direction
-- categories used by the Script Editor's "Visual breakdown" (storyboard)
-- tab (app/script-editor/page.tsx). Each category has a label (what
-- Claude tags a line with, e.g. "B-ROLL") and a color (used for the
-- badge in the UI and the actual text color written into the Google Doc
-- when a note is accepted). Editable, deletable, and any number can be
-- added -- not a fixed enum -- so new shot types can be added as the
-- channel's needs change, same pattern as script_doc_links.
--
-- Seeded with the original 9 categories. TEXT ON SCREEN's color was
-- toned down from a pure, eye-searing #00ff88 to a softer green after
-- Tom flagged it as too bright.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists storyboard_categories (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  color       text not null default '#8888aa',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table storyboard_categories enable row level security;
drop policy if exists allow_all_storyboard_categories on storyboard_categories;
create policy allow_all_storyboard_categories on storyboard_categories for all using (true) with check (true);

insert into storyboard_categories (label, color, sort_order)
select v.label, v.color, v.sort_order
from (values
  ('SCREENSHOT',      '#00d4ff', 0),
  ('ANIMATION',       '#8b5cf6', 1),
  ('TEXT ON SCREEN',  '#3ecf7e', 2),
  ('IMAGE',           '#ffb800', 3),
  ('B-ROLL',          '#ff4fa3', 4),
  ('STOCK FOOTAGE',   '#4a9eff', 5),
  ('AI VISUAL',       '#c084fc', 6),
  ('MEME',            '#ff8a3d', 7),
  ('AUDIO',           '#2fb8ac', 8)
) as v(label, color, sort_order)
where not exists (select 1 from storyboard_categories);
