// Edit this file to customise your morning routine.
// Items appear pinned at the top of the Day Planner before your Notion tasks.
// order: the display order (0 = first)

export type RoutineItem = {
  id: string
  title: string
  minutes: number
  note?: string
}

export const MORNING_ROUTINE: RoutineItem[] = [
  { id: 'mr-water',    title: 'Glass of water',           minutes: 2  },
  { id: 'mr-coffee',   title: 'Coffee + Duolingo',        minutes: 20 },
  { id: 'mr-exercise', title: 'Exercise / 10k steps goal',minutes: 45, note: 'Target: 10,000 steps by end of day' },
  { id: 'mr-journal',  title: 'Journal / set intentions', minutes: 10 },
  { id: 'mr-plan',     title: 'Review today\'s plan',     minutes: 5  },
]

// Day structure — which hours tasks auto-schedule into by priority.
// Each bucket fills from startHour downwards until capacity is used.
export const SCHEDULE_BUCKETS = [
  { label: 'Morning focus',  startHour: 9,  urgency: 'Urgent',    importance: 'Important'     },
  { label: 'Mid-morning',    startHour: 10, urgency: 'Urgent',    importance: null            },
  { label: 'Late morning',   startHour: 11, urgency: null,        importance: 'Important'     },
  { label: 'Afternoon',      startHour: 14, urgency: 'Non Urgent',importance: null            },
  { label: 'Late afternoon', startHour: 16, urgency: null,        importance: null            },
]

export const DAY_START_HOUR = 6   // 6am
export const DAY_END_HOUR   = 22  // 10pm
