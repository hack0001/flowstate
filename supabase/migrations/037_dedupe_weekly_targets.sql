-- ============================================================
-- 037_dedupe_weekly_targets.sql — Same bug as 036_dedupe_habits.sql, same
-- fix, different table.
--
-- 028_weekly_targets.sql's seed insert already used a bare "on conflict do
-- nothing" (no target column), but weekly_targets never had a unique
-- constraint on label (or anything but id, which is always a fresh random
-- uuid) -- so there was nothing for it to conflict against, and every
-- re-run of RUN_ALL.sql against an already-provisioned database silently
-- added another full set of the 4 default targets (Shorts, Long-form,
-- Etsy listings, Website work). That's the "lots of empty boxes" on the
-- Home page's This week's targets section -- duplicate cards, each
-- starting this week at 0 progress.
--
-- Idempotent and safe to re-run: for each set of same-labelled target
-- rows, keeps the oldest, moves any weekly_target_progress and
-- weekly_target_picks rows recorded against the newer duplicates onto it,
-- deletes the duplicates, then adds a real unique constraint on label.
-- ============================================================

with ranked as (
  select id, label,
         first_value(id) over (partition by label order by created_at asc, id asc) as keeper_id
  from weekly_targets
),
dups as (
  select id, keeper_id from ranked where id <> keeper_id
)
insert into weekly_target_progress (target_id, week_start, manual_count, updated_at)
select d.keeper_id, wtp.week_start, wtp.manual_count, wtp.updated_at
from weekly_target_progress wtp
join dups d on d.id = wtp.target_id
on conflict (target_id, week_start) do nothing;

with ranked as (
  select id, label,
         first_value(id) over (partition by label order by created_at asc, id asc) as keeper_id
  from weekly_targets
),
dups as (
  select id, keeper_id from ranked where id <> keeper_id
)
insert into weekly_target_picks (target_id, week_start, content_item_id, updated_at)
select d.keeper_id, wtp.week_start, wtp.content_item_id, wtp.updated_at
from weekly_target_picks wtp
join dups d on d.id = wtp.target_id
on conflict (target_id, week_start) do nothing;

with ranked as (
  select id, label,
         first_value(id) over (partition by label order by created_at asc, id asc) as keeper_id
  from weekly_targets
)
delete from weekly_targets where id in (select id from ranked where id <> keeper_id);

create unique index if not exists weekly_targets_label_unique_idx on weekly_targets(label);
