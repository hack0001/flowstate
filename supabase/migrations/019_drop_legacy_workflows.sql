-- =============================================================
-- FlowState — Drop legacy generic workflow system
-- The /workflows, /workflow/[id], /workflow/[id]/focus routes and all
-- app code referencing these tables have been removed. Content that was
-- worth keeping (YouTube Longform + Shorts SOPs) has been folded into
-- lib/sops.ts, which drives the Content Pipeline instead.
--
-- RUN IN SUPABASE SQL EDITOR — safe to re-run
-- =============================================================

drop table if exists task_completions cascade;
drop table if exists workflow_sessions cascade;
drop table if exists tasks cascade;
drop table if exists stages cascade;
drop table if exists workflow_types cascade;
