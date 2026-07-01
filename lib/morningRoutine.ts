// Edit this file to customise your morning routine.
// Each item gets a checkbox on the morning page. All checked = routine complete.

export type RoutineItem = {
  id: string
  title: string
  minutes: number
  note?: string
  category?: string
}

export const MORNING_ROUTINE: RoutineItem[] = [
  { id: 'mr-pushpull',   title: '5 push-ups / 5 pull-ups',                      minutes: 5,  category: 'Movement', note: 'Before breakfast' },
  { id: 'mr-weight',     title: 'Weigh yourself + log in spreadsheet',            minutes: 2,  category: 'Health' },
  { id: 'mr-waist',      title: 'Measure waist (if down 2kg since last measure)', minutes: 2,  category: 'Health', note: '1 inch lost = fat loss confirmed' },
  { id: 'mr-floor',      title: '1 min floor sit, 90/90 switches, child pose',    minutes: 5,  category: 'Movement' },
  { id: 'mr-bounce',     title: '20 bounces + hold squat 1 minute',               minutes: 3,  category: 'Movement' },
  { id: 'mr-breakfast',  title: 'Breakfast: yoghurt + maple syrup',               minutes: 10, category: 'Fuel' },
  { id: 'mr-coffee',     title: 'Coffee + cane sugar + collagen + molasses',      minutes: 5,  category: 'Fuel' },
  { id: 'mr-eggs',       title: 'Eggs on sourdough + mushrooms (weights day)',     minutes: 15, category: 'Fuel', note: 'Only on hard weights days' },
  { id: 'mr-read',       title: 'Read 2 pages',                                   minutes: 5,  category: 'Mind' },
]

export const SCHEDULE_BUCKETS = [
  { label: 'Morning focus',  startHour: 9,  urgency: 'Urgent',     importance: 'Important' },
  { label: 'Mid-morning',    startHour: 10, urgency: 'Urgent',     importance: null        },
  { label: 'Late morning',   startHour: 11, urgency: null,         importance: 'Important' },
  { label: 'Afternoon',      startHour: 14, urgency: 'Non Urgent', importance: null        },
  { label: 'Late afternoon', startHour: 16, urgency: null,         importance: null        },
]

export const DAY_START_HOUR = 6
export const DAY_END_HOUR   = 22
