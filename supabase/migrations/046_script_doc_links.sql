-- =============================================================
-- FlowState — Script Editor saved doc links
--
-- script_doc_links — a small, user-managed list of Google Doc links for
-- quick access in the Script Editor (app/script-editor/page.tsx), separate
-- from the auto-populated "active focus videos with a script_url" list.
-- Editable/deletable, and supports more than one at a time -- replaces the
-- old auto-pulled-from-video quick-select, which had gone stale and once
-- pointed at the wrong doc entirely.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create table if not exists script_doc_links (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

alter table script_doc_links enable row level security;
drop policy if exists allow_all_script_doc_links on script_doc_links;
create policy allow_all_script_doc_links on script_doc_links for all using (true) with check (true);
