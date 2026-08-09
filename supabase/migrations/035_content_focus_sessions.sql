-- ============================================================
-- 035_content_focus_sessions.sql — Chunked focus session logging
-- Content Pipeline items get worked in small 3-4 task chunks sized to a
-- ~60 minute budget (see lib/sops.ts nextSessionChunk / SESSION_TIME_BUDGET_MINS).
-- Nothing previously persisted that a session ever happened at all --
-- content_step_completions (018_content_focus.sql) tracks which checklist
-- steps are ticked, but not when a focus sitting started/ended or how many
-- there were. This table is purely additive, for the "how many focus
-- sessions did I do today, how much progress" view on the Home page.
-- ============================================================

create table if not exists content_focus_sessions (
  id                uuid        primary key default gen_random_uuid(),
  content_item_id   uuid        not null references content_items(id) on delete cascade,
  sop_id            text        not null,        -- matches SOP.id in lib/sops.ts
  step_indices      jsonb       not null default '[]'::jsonb,  -- which steps this chunk covered
  estimated_mins    int         not null default 0,
  actual_mins       int,                          -- set on completion/exit
  tasks_completed   int         not null default 0,
  status            text        not null default 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);

create index if not exists content_focus_sessions_item_idx on content_focus_sessions(content_item_id);
create index if not exists content_focus_sessions_started_idx on content_focus_sessions(started_at);

alter table content_focus_sessions enable row level security;
drop policy if exists allow_all_content_focus_sessions on content_focus_sessions;
create policy allow_all_content_focus_sessions on content_focus_sessions for all using (true) with check (true);
