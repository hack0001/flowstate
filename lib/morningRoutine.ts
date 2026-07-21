// The morning routine checklist itself (items + completions) now lives in
// Supabase — see morning_routine_items / morning_routine_completions in
// supabase/migrations/022_morning_routine.sql, and the MorningRoutineItem
// type + helper functions in lib/supabase.ts. Edit the checklist from the
// "Edit" button on the morning page, not here.

export const SCHEDULE_BUCKETS = [
  { label: 'Morning focus',  startHour: 9,  urgency: 'Urgent',     importance: 'Important' },
  { label: 'Mid-morning',    startHour: 10, urgency: 'Urgent',     importance: null        },
  { label: 'Late morning',   startHour: 11, urgency: null,         importance: 'Important' },
  { label: 'Afternoon',      startHour: 14, urgency: 'Non Urgent', importance: null        },
  { label: 'Late afternoon', startHour: 16, urgency: null,         importance: null        },
]

export const DAY_START_HOUR = 6
export const DAY_END_HOUR   = 22
