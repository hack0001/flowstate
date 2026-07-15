-- 015_priority_lists.sql
-- Stores user-defined drag-sorted priority order for any item list.
-- key identifies the list (e.g. 'tasks_priority', 'vault_priority', 'etsy_todos_priority', 'youtube_priority')
-- ordered_ids is a JSON array of item IDs in priority rank order (1st = highest)

create table if not exists priority_lists (
  key         text        primary key,
  ordered_ids jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
