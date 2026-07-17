-- =============================================================
-- FlowState — Fold the weighted daily plan into master_tasks
--
-- Tom wants the Calendar (not a separate Evening-page-only view) to be
-- the single place everything lives, so it inherits the existing
-- drag-to-reschedule, "Organise" (overdue), and "Organise Week" (type
-- rebalancing) behaviour for free. The weighted-plan generator now
-- writes ordinary master_tasks rows instead of a separate daily_plans
-- table — so this migration:
--   1. Adds source_section/source_id to master_tasks so generated rows
--      can be traced back to the pipeline item they came from (and so
--      regenerating doesn't create duplicates).
--   2. Drops the now-unused daily_plans table from 020.
--   3. Leaves daily_plan_settings (the weighting %), content_stage_notes,
--      and x_ideas in place — those are still used.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

alter table master_tasks add column if not exists source_section text;
alter table master_tasks add column if not exists source_id text;

create index if not exists master_tasks_source_id_idx on master_tasks (source_id) where source_id is not null;

drop table if exists daily_plans cascade;
