// ============================================================
// lib/reminders.ts — shared Reminder type + recurrence matching
// ============================================================
// Originally lived only in app/calendar/page.tsx. Pulled out so the home
// page's Today/Tomorrow list can show "does this reminder occur today /
// tomorrow" without duplicating (and risking drift in) the recurrence math.

export type ReminderRecurrence =
  | { type: 'daily' }
  | { type: 'weekday' }
  | { type: 'weekly'; every: number }
  | { type: 'monthly'; every: number }
  | { type: 'yearly'; every: number }
  | { type: 'custom'; every: number; unit: 'days' | 'weeks' | 'months' | 'years' }

export type Reminder = {
  id: string; title: string; emoji: string; color: string
  startDate: string; recurrence: ReminderRecurrence; timeLabel: string
}

export function reminderOccursOn(r: Reminder, dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00')
  const start = new Date(r.startDate + 'T12:00:00')
  if (date < start) return false
  const diffDays = Math.round((date.getTime() - start.getTime()) / 86400000)
  const rec = r.recurrence
  switch (rec.type) {
    case 'daily': return true
    case 'weekday': { const d = date.getDay(); return d >= 1 && d <= 5 }
    case 'weekly': return diffDays % (7 * rec.every) === 0
    case 'monthly': {
      if (date.getDate() !== start.getDate()) return false
      const md = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
      return md % rec.every === 0
    }
    case 'yearly': {
      if (date.getDate() !== start.getDate() || date.getMonth() !== start.getMonth()) return false
      return (date.getFullYear() - start.getFullYear()) % rec.every === 0
    }
    case 'custom': {
      const { every, unit } = rec
      if (unit === 'days') return diffDays % every === 0
      if (unit === 'weeks') return diffDays % (every * 7) === 0
      if (unit === 'months') {
        if (date.getDate() !== start.getDate()) return false
        const md = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
        return md % every === 0
      }
      if (unit === 'years') {
        if (date.getDate() !== start.getDate() || date.getMonth() !== start.getMonth()) return false
        return (date.getFullYear() - start.getFullYear()) % every === 0
      }
      return false
    }
  }
}

export function describeRecurrence(rec: ReminderRecurrence): string {
  switch (rec.type) {
    case 'daily': return 'Every day'
    case 'weekday': return 'Every weekday'
    case 'weekly': return rec.every === 1 ? 'Every week' : 'Every ' + rec.every + ' weeks'
    case 'monthly': return rec.every === 1 ? 'Every month' : 'Every ' + rec.every + ' months'
    case 'yearly': return rec.every === 1 ? 'Every year' : 'Every ' + rec.every + ' years'
    case 'custom': return 'Every ' + rec.every + ' ' + rec.unit
  }
}

export function fetchRemindersRow(row: { id: string; title: string; emoji: string; color: string; start_date: string; recurrence: unknown; time_label: string }): Reminder {
  return { id: row.id, title: row.title, emoji: row.emoji, color: row.color, startDate: row.start_date, recurrence: row.recurrence as ReminderRecurrence, timeLabel: row.time_label }
}
