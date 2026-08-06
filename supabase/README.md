# Supabase migrations — how this actually works

This app has hit the same bug more than once: a migration file gets written
in `migrations/`, but never actually gets run against the live database. The
app then fails in a confusing way — a page that silently shows nothing, or
an error like `column master_tasks.start_time does not exist` — because the
code assumes a column, table, or RLS policy exists that the live database
doesn't actually have yet. Writing the SQL file is not the same as running
it.

## The fix: one file, always safe to run

**`RUN_ALL.sql`** in this folder is every migration in `migrations/`,
concatenated in order, into one file. Every migration in this project is
written to be idempotent:

- `create table` / `add column` / `create index` all use `IF NOT EXISTS`
- every RLS policy is `DROP POLICY IF EXISTS` immediately before
  `CREATE POLICY`
- every seed `INSERT` is guarded with `ON CONFLICT ... DO NOTHING` or an
  `IF NOT EXISTS` / `WHERE NOT EXISTS` check

That means **`RUN_ALL.sql` is always safe to paste into the Supabase SQL
editor and run in full**, no matter which individual migrations have or
haven't already been applied. It brings the database fully in sync with the
repo with zero guesswork.

**Rule of thumb: whenever something looks broken and you're not sure if a
migration got run, just run `RUN_ALL.sql`.** It costs nothing to re-run —
tables that already match are left untouched.

## When a new migration is added

1. The new file goes in `migrations/`, numbered one higher than the current
   highest (check for accidental duplicate numbers — a few already exist
   from earlier in the project, e.g. `012_*`, `017_*`, `022_*`; duplicates
   are fine since none of them depend on each other, but try not to add more).
2. It must follow the idempotent conventions above.
3. **`RUN_ALL.sql` must be regenerated** — either ask Claude to do it, or
   run:
   ```
   cd supabase
   { head -n 27 RUN_ALL.sql; for f in $(ls migrations/*.sql | sort -V); do echo; echo "-- ============================================================="; echo "-- ---- migrations/$f ----"; echo "-- ============================================================="; cat "migrations/$f"; done; } > RUN_ALL.sql.new
   mv RUN_ALL.sql.new RUN_ALL.sql
   ```
4. Run the updated `RUN_ALL.sql` in the Supabase SQL editor before relying
   on the new schema in the app.

## `schema.sql`

`schema.sql` (in this same folder, not in `migrations/`) is **not** part of
this system and is **not** included in `RUN_ALL.sql`. It's the original,
pre-migrations bootstrap for a generic workflow system (`workflow_types`,
`stages`, `tasks` with `stage_id`, `workflow_sessions`, `task_completions`)
that the app no longer uses — `019_drop_legacy_workflows.sql` deliberately
tears those tables back down. It's kept for historical reference only. Do
not run it.

## Why this happened

Before this fix, a handful of migrations were missing either their
`DROP POLICY IF EXISTS` guard or an RLS policy entirely (`025_fix_missing_rls.sql`
and `031_ensure_rls_all_tables.sql` are both past sweeps to fix exactly this).
There was also no single source of truth for "what's actually been run" —
each migration was a separate manual copy-paste into the SQL editor, easy to
lose track of. `RUN_ALL.sql` removes the need to track that at all: it's
just always safe to run, so "did I run that one?" stops being a question
worth asking.
