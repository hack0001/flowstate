-- =============================================================
-- FlowState — Google Search Console dashboard (app/seo)
--
-- gsc_sites    one row per Search Console property you can see
-- gsc_daily    site-level clicks / impressions / CTR / position per day
-- gsc_queries  top queries per site per day (capped, see lib/searchConsole.ts)
-- gsc_pages    top pages per site per day
--
-- Kept in your own database so history survives Google's 16-month limit and
-- the dashboard loads from a fast local query instead of calling Google.
--
-- Access is OWNER-ONLY from day one (this is client search data). The helper
-- is_app_owner() is also defined in 048_lock_down_rls_owner_only.sql; it's
-- created here too (create or replace, identical) so this file works whether
-- or not 048 has been run yet. If you add more owner emails, change them in
-- BOTH places.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

create or replace function public.is_app_owner()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = any (array['admin@derivativemedia.co.uk']),
    false
  )
$$;

create table if not exists gsc_sites (
  site_url         text primary key,
  label            text,
  permission_level text,
  tracked          boolean not null default true,
  last_synced_at   timestamptz,
  last_sync_error  text,
  created_at       timestamptz not null default now()
);

create table if not exists gsc_daily (
  site_url     text not null references gsc_sites(site_url) on delete cascade,
  date         date not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  ctr          double precision not null default 0,
  position     double precision not null default 0,
  primary key (site_url, date)
);

create table if not exists gsc_queries (
  site_url     text not null references gsc_sites(site_url) on delete cascade,
  date         date not null,
  query        text not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  position     double precision not null default 0,
  primary key (site_url, date, query)
);

create table if not exists gsc_pages (
  site_url     text not null references gsc_sites(site_url) on delete cascade,
  date         date not null,
  page         text not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  position     double precision not null default 0,
  primary key (site_url, date, page)
);

do $$
declare t text;
begin
  foreach t in array array['gsc_sites', 'gsc_daily', 'gsc_queries', 'gsc_pages']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format(
      'create policy owner_only on %I for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner())',
      t
    );
  end loop;
end $$;

-- ---- Aggregation helpers -------------------------------------------------
-- The dashboard compares "the latest N days we have" against "the N days
-- before that" per query / page. Done in SQL (not the browser) because the raw
-- tables can hold far more rows than PostgREST returns per request.
-- Position is impression-weighted so a query shown 1,000 times counts for
-- more than one shown twice. SECURITY INVOKER (the default) -> RLS applies.

create or replace function public.gsc_query_movers(p_site text, p_days integer default 7)
returns table (
  query text,
  clicks_now bigint, clicks_prev bigint,
  impressions_now bigint, impressions_prev bigint,
  position_now double precision, position_prev double precision
)
language sql
stable
as $$
  with bounds as (
    select max(date) as last_day from public.gsc_queries where site_url = p_site
  ),
  agg as (
    select
      q.query,
      sum(q.clicks)      filter (where q.date >  b.last_day - p_days)                                          as clicks_now,
      sum(q.clicks)      filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)     as clicks_prev,
      sum(q.impressions) filter (where q.date >  b.last_day - p_days)                                          as impressions_now,
      sum(q.impressions) filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)     as impressions_prev,
      sum(q.position * q.impressions) filter (where q.date >  b.last_day - p_days)
        / nullif(sum(q.impressions)   filter (where q.date >  b.last_day - p_days), 0)                         as position_now,
      sum(q.position * q.impressions) filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)
        / nullif(sum(q.impressions)   filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days), 0) as position_prev
    from public.gsc_queries q
    cross join bounds b
    where q.site_url = p_site and b.last_day is not null and q.date > b.last_day - 2 * p_days
    group by q.query
  )
  select
    query,
    coalesce(clicks_now, 0), coalesce(clicks_prev, 0),
    coalesce(impressions_now, 0), coalesce(impressions_prev, 0),
    position_now, position_prev
  from agg
  order by coalesce(clicks_now, 0) + coalesce(clicks_prev, 0) desc, coalesce(impressions_now, 0) desc
  limit 400
$$;

create or replace function public.gsc_page_movers(p_site text, p_days integer default 7)
returns table (
  page text,
  clicks_now bigint, clicks_prev bigint,
  impressions_now bigint, impressions_prev bigint,
  position_now double precision, position_prev double precision
)
language sql
stable
as $$
  with bounds as (
    select max(date) as last_day from public.gsc_pages where site_url = p_site
  ),
  agg as (
    select
      q.page,
      sum(q.clicks)      filter (where q.date >  b.last_day - p_days)                                          as clicks_now,
      sum(q.clicks)      filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)     as clicks_prev,
      sum(q.impressions) filter (where q.date >  b.last_day - p_days)                                          as impressions_now,
      sum(q.impressions) filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)     as impressions_prev,
      sum(q.position * q.impressions) filter (where q.date >  b.last_day - p_days)
        / nullif(sum(q.impressions)   filter (where q.date >  b.last_day - p_days), 0)                         as position_now,
      sum(q.position * q.impressions) filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days)
        / nullif(sum(q.impressions)   filter (where q.date <= b.last_day - p_days and q.date > b.last_day - 2 * p_days), 0) as position_prev
    from public.gsc_pages q
    cross join bounds b
    where q.site_url = p_site and b.last_day is not null and q.date > b.last_day - 2 * p_days
    group by q.page
  )
  select
    page,
    coalesce(clicks_now, 0), coalesce(clicks_prev, 0),
    coalesce(impressions_now, 0), coalesce(impressions_prev, 0),
    position_now, position_prev
  from agg
  order by coalesce(clicks_now, 0) + coalesce(clicks_prev, 0) desc, coalesce(impressions_now, 0) desc
  limit 400
$$;
