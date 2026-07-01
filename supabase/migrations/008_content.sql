-- ============================================================
-- 008_content.sql  —  YouTube content pipeline
-- Items from master DB that have a YT Pipeline Stage set
-- ============================================================

create table if not exists content_items (
  id              uuid        primary key default gen_random_uuid(),
  notion_id       text        unique,
  title           text        not null,
  pipeline_stage  text,        -- 💡 Idea | 📚 Research | 📝 Scripting | 🎙️ Voiceover | 🎨 Assets | ✂️ Editing | 🖼️ Thumbnail & SEO | ☁️ Ready to Upload | 📣 Live
  format          text,        -- Both | Short | Long form
  yt_length       text,        -- Long form | Short form (multi-select stored as comma-sep)
  tag             text,        -- SEO | Design | Film | Edit | Script
  due_date        date,
  status          text        not null default 'Not started',
  link            text,
  notes           text,
  notion_url      text,
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists content_pipeline_stage_idx on content_items(pipeline_stage);
create index if not exists content_due_date_idx       on content_items(due_date);
create index if not exists content_archived_idx       on content_items(archived);

alter table content_items enable row level security;
drop policy if exists allow_all_content on content_items;
create policy allow_all_content on content_items for all using (true) with check (true);

create or replace function update_content_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_content_updated_at on content_items;
create trigger trg_content_updated_at
  before update on content_items
  for each row execute function update_content_updated_at();
