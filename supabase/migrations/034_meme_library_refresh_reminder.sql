-- 034_meme_library_refresh_reminder.sql
-- Meme library (lib/memes.ts, YouTube page "Memes" tab) is a Claude-synced
-- snapshot of the "Sound Money Memes" Drive folder, not a live connection --
-- it only updates when Tom asks Claude to "refresh the meme library". This
-- reminder is the nudge to actually do that periodically. Monthly by
-- default; edit the recurrence on the Calendar > Reminders tab like any
-- other reminder if a different cadence fits better.

insert into reminders (id, title, emoji, color, start_date, recurrence, time_label)
values (
  'meme-library-refresh',
  'Refresh the meme library (tell Claude to re-sync Sound Money Memes)',
  '🖼️',
  '#00d4ff',
  current_date::text,
  '{"type":"monthly","every":1}',
  'Anytime'
)
on conflict (id) do nothing;
