-- 026_mobility_program.sql
-- Squat & Snatch Mobility Program: a rotating knee/ankle/lower-back/hip
-- bodyweight program, aimed at eventually hitting a full deep squat and a
-- snatch lift. The exercise pool and weekly rotation logic live in
-- lib/mobility.ts (client-side, deterministic) — this migration only adds:
--   1. mobility_program — single row storing when the 4-week cycle started
--   2. A morning_routine_items row (mr-mobility) so today's mobility work
--      shows up as one step in the morning routine
--   3. A daily reminders row so it also shows on every Calendar day
-- Per-exercise tick-off reuses the existing generic
-- daily_checklist_completions table (checklist_key = 'mobility'), no new
-- table needed for that.

create table if not exists mobility_program (
  id         text primary key default 'default',
  start_date date not null default current_date
);

alter table mobility_program enable row level security;
drop policy if exists allow_all_mobility_program on mobility_program;
create policy allow_all_mobility_program on mobility_program for all using (true) with check (true);

insert into mobility_program (id, start_date)
values ('default', current_date)
on conflict (id) do nothing;

-- Insert the morning routine step, shifting anything from the ankle-mobility
-- item onward down by one slot so it lands right after it (only runs once —
-- guarded so re-running this migration doesn't keep shifting sort order).
do $$
begin
  if not exists (select 1 from morning_routine_items where id = 'mr-mobility') then
    update morning_routine_items set sort_order = sort_order + 1 where sort_order >= 6;
    insert into morning_routine_items (id, title, minutes, note, category, sort_order)
    values ('mr-mobility', 'Mobility Program — today''s focus', 6, null, 'Movement', 6);
  end if;
end $$;

insert into reminders (id, title, emoji, color, start_date, recurrence, time_label)
values (
  'mobility-program',
  'Mobility Program',
  '🦵',
  '#8b5cf6',
  current_date::text,
  '{"type":"daily"}',
  'Anytime'
)
on conflict (id) do nothing;
