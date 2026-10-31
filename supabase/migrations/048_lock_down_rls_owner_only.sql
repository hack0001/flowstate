-- =============================================================
-- FlowState — lock the database down to the signed-in owner
--
-- WHY: every table so far used an allow-all policy (using (true)). The
-- Supabase URL and anon key ship in the browser bundle by design, so with
-- allow-all RLS anyone who opens the site's JS could read or write the whole
-- database directly -- bypassing the app entirely. App-level login alone does
-- NOT fix that; the database itself has to refuse anonymous callers.
--
-- WHAT THIS DOES: on every table in the public schema it
--   1. makes sure RLS is enabled,
--   2. drops every existing policy (the allow-all ones),
--   3. creates one policy: only a signed-in user whose email is on the owner
--      list may do anything.
--
-- !! DO NOT RUN THIS UNTIL YOU HAVE DEPLOYED THE LOGIN AND SIGNED IN !!
-- Order of operations:
--   a) Supabase dashboard -> Authentication -> Users -> Add user (your email
--      + a password, tick "Auto Confirm User").
--   b) Supabase dashboard -> Authentication -> Sign In / Providers -> turn OFF
--      "Allow new users to sign up" (so nobody else can register).
--   c) Set ALLOWED_EMAILS in your hosting env vars, redeploy, and confirm you
--      can log in at /login and the app works.
--   d) THEN run this file in the Supabase SQL editor.
-- Running it earlier locks the (not-yet-logged-in) app out of its own data.
--
-- To allow more than one owner later, edit the email list in
-- is_app_owner() below and re-run just that function.
--
-- GOTCHA: the older migrations (and RUN_ALL.sql) create allow-all policies.
-- Re-running any of them AFTER this file re-opens those tables. Whenever you
-- run RUN_ALL.sql or a new table migration, re-run this file straight after
-- (it's idempotent), and write new tables' policies as:
--   create policy owner_only on <table> for all to authenticated
--     using (public.is_app_owner()) with check (public.is_app_owner());
--
-- Safe to re-run. The service_role key (used only by the scheduled Search
-- Console sync) bypasses RLS by design and is unaffected.
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

do $$
declare
  t record;
  p record;
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')          -- ordinary + partitioned tables
  loop
    execute format('alter table public.%I enable row level security', t.table_name);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t.table_name
    loop
      execute format('drop policy %I on public.%I', p.policyname, t.table_name);
    end loop;

    execute format(
      'create policy owner_only on public.%I for all to authenticated using (public.is_app_owner()) with check (public.is_app_owner())',
      t.table_name
    );
  end loop;
end $$;
