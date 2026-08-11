// ============================================================
// Schedule-aware habit streak + consistency math.
// Shared by app/tracking/page.tsx and app/page.tsx (Home) so both pages
// compute the exact same number for the exact same habit, instead of
// silently drifting apart.
//
// The old streak calc (duplicated separately on both pages) counted strict
// consecutive CALENDAR days. That unfairly broke a non-daily habit's streak
// on its own scheduled rest days -- e.g. a Mon/Wed/Fri habit done every
// single time it was actually due still showed a broken streak every
// weekend, because the gap between Friday and Monday isn't 1 day. This
// version walks backward day by day, skipping days the habit was never
// scheduled on, and only counts or breaks the streak on days it was
// actually due.
//
// It also fixes a second, separate bug: the old Tracking-page version only
// had access to a 7-day window of habit_completions (a query cap on that
// page), so its own streak badges could never show more than ~7 even when
// the real streak was much longer -- while Home's badge for the same habit
// (which queried a wider window) showed a different, larger number. Both
// pages now pull full history and run through this same function.
// ============================================================

export type StreakHabit = {
  id: string
  schedule_type: string
  schedule_days: number[] | null
  schedule_time: string | null
  created_at: string
}

export function toDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function isHabitScheduledOn(h: Pick<StreakHabit, 'schedule_type' | 'schedule_days'>, date: Date): boolean {
  const dow = date.getDay()
  if (h.schedule_type === 'daily') return true
  if (h.schedule_type === 'weekdays') return dow >= 1 && dow <= 5
  if (h.schedule_type === 'weekends') return dow === 0 || dow === 6
  if (h.schedule_type === 'custom') return (h.schedule_days ?? []).includes(dow)
  return false
}

function scheduleTimePassed(schedule_time: string | null): boolean {
  if (!schedule_time) return false
  const [hh, mm] = schedule_time.split(':').map(Number)
  const now = new Date()
  return now.getHours() > hh || (now.getHours() === hh && now.getMinutes() > mm)
}

// doneDates: the set of completed_date strings ('YYYY-MM-DD') for this one habit.
export function calcHabitStreak(h: StreakHabit, doneDates: Set<string>): number {
  const createdDate = new Date(h.created_at)
  createdDate.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cursor = new Date(today)

  // Today gets special treatment: if it's scheduled but not done yet, that
  // isn't a miss until its schedule_time actually passes -- don't zero the
  // streak just because the day isn't over. Skip evaluating today and start
  // the real walk from yesterday instead.
  if (isHabitScheduledOn(h, cursor) && !doneDates.has(toDateStr(cursor))) {
    if (scheduleTimePassed(h.schedule_time)) return 0 // genuine miss, already past due
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  const MAX_DAYS = 3650 // ~10 years safety cap against a malformed schedule
  for (let i = 0; i < MAX_DAYS; i++) {
    if (cursor < createdDate) break // don't walk back further than the habit's existed
    if (!isHabitScheduledOn(h, cursor)) { cursor.setDate(cursor.getDate() - 1); continue }
    if (doneDates.has(toDateStr(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); continue }
    break // scheduled, not done -- streak ends here
  }
  return streak
}

// Schedule-aware version of the "consistency" score: % of habit-days that
// were actually SCHEDULED and got done, over the last N days. Days a habit
// wasn't scheduled don't count against it -- the old version divided by
// habits.length * days regardless of each habit's own schedule, which
// unfairly punished non-daily habits every time their off-days rolled by.
export function calcConsistencyPct(habits: StreakHabit[], doneDatesByHabit: Map<string, Set<string>>, days = 7): number | null {
  let scheduled = 0
  let done = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000)
    for (const h of habits) {
      if (!isHabitScheduledOn(h, d)) continue
      scheduled++
      if (doneDatesByHabit.get(h.id)?.has(toDateStr(d))) done++
    }
  }
  if (scheduled === 0) return null
  return Math.round((done / scheduled) * 100)
}
