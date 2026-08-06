-- 031_ensure_rls_all_tables.sql
-- =============================================================
-- FlowState is single-user, accessed only via the anon key, so every
-- table needs RLS enabled + a permissive "allow_all" policy or reads/
-- writes silently fail (or, per 025_fix_missing_rls.sql's finding,
-- reads can appear to work via default grants while writes are
-- rejected). Migrations have added tables one at a time and a few have
-- been missed over time (025 already caught three of them).
--
-- This migration is a one-shot sweep across every table this project
-- has ever created, idempotent and safe to re-run: it (re)creates the
-- same "allow_all" policy already used everywhere else in this repo
-- for any table that's missing it, and leaves already-correct tables
-- untouched.
--
-- RUN IN SUPABASE SQL EDITOR -- safe to re-run
-- =============================================================

do $$
declare
  t text;
  all_tables text[] := array[
    'habits', 'habit_completions',
    'vault_items',
    'daily_tasks', 'daily_intentions', 'routine_completions',
    'content_items',
    'tasks',
    'projects',
    'master_tasks',
    'personal_items', 'goals',
    'workspace_links',
    'reminders', 'habit_blocks', 'checklist_state', 'welsh_progress', 'welsh_custom_words',
    'priority_lists',
    'site_ideas',
    'content_step_completions',
    'morning_routine_items', 'morning_routine_completions',
    'daily_plans', 'daily_plan_settings', 'content_stage_notes', 'x_ideas',
    'evening_reviews', 'daily_checklist_completions', 'tweet_models', 'etsy_kb_overrides', 'error_log',
    'mobility_program',
    'weekly_targets', 'weekly_target_progress',
    'weekly_target_picks',
    'weekly_exercise_plan',
    'page_visits'
  ];
begin
  foreach t in array all_tables
  loop
    if to_regclass(t) is not null then
      execute format('alter table %I enable row level security;', t);
      execute format('drop policy if exists allow_all_%s on %I;', t, t);
      execute format('create policy allow_all_%s on %I for all using (true) with check (true);', t, t);
    end if;
  end loop;
end $$;
