-- 033_yt_channel_audit.sql
-- YouTube Channel Audit: recurring reminder so the new "Channel Audit" tab
-- on app/youtube/page.tsx (checklist_state key 'yt_audit') gets re-run
-- monthly. Checklist items/state live entirely in the app (checklist_state,
-- migration 012) — this migration only adds the Calendar-side nudge.

insert into reminders (id, title, emoji, color, start_date, recurrence, time_label)
values (
  'yt-channel-audit',
  'YouTube Channel Audit',
  '📺',
  '#8b5cf6',
  current_date::text,
  '{"type":"monthly","every":1}',
  'Anytime'
)
on conflict (id) do nothing;
