-- 016_from_vault.sql
-- Tracks tasks that were converted from vault items, so the task page
-- can highlight them as needing urgency / type / priority assignment.

alter table master_tasks add column if not exists from_vault boolean not null default false;
