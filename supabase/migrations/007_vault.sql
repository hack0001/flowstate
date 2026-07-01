-- ============================================================
-- 007_vault.sql  —  Knowledge base (Notion vault items)
-- task/vault = 'vault' rows from the master DB
-- ============================================================

create table if not exists vault_items (
  id              uuid        primary key default gen_random_uuid(),
  notion_id       text        unique,
  title           text        not null,
  category        text,        -- Book | Article | Tool / Software | Business Idea | Reference | Movie | Academic | Audiobook / Podcast | Video | Spreadsheet | Buy
  author_source   text,
  link            text,
  key_takeaway    text,
  notes           text,
  platform        text,        -- Wealthmack | Website | Shopify | Etsy | YouTube | Twitter
  tag             text,        -- SEO | Design | Film | Edit | Script
  status          text        not null default 'Not started',
  notion_url      text,
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists vault_items_category_idx  on vault_items(category);
create index if not exists vault_items_tag_idx       on vault_items(tag);
create index if not exists vault_items_archived_idx  on vault_items(archived);

alter table vault_items enable row level security;
drop policy if exists allow_all_vault on vault_items;
create policy allow_all_vault on vault_items for all using (true) with check (true);

create or replace function update_vault_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_vault_updated_at on vault_items;
create trigger trg_vault_updated_at
  before update on vault_items
  for each row execute function update_vault_updated_at();
