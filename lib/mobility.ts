// ---- Squat & Snatch Mobility Program ----
// A rotating bodyweight/mobility program aimed at fixing knee, ankle and
// lower-back flexibility to eventually hit a full, pain-free deep squat and
// a snatch lift. Shared by the Physical page (full program + checklist),
// the Morning routine (today's exercises as one routine step), and the
// Calendar (a daily reminder pointing back at Physical).
//
// The exact exercise picked for each category rotates week to week (4-week
// cycle, then repeats) so the plan stays varied over a month without needing
// to hand-author 28 individual days. The weekday -> focus mapping is fixed
// so "what does Wednesday work" is always answerable at a glance.

export type MobilityExercise = {
  id: string
  name: string
  cue: string
  categories: string[]
}

// categories: ankle | knee | hip | lowerback | squat | snatch
export const MOBILITY_POOL: MobilityExercise[] = [
  { id:'step-downs',            name:'Step Downs',                          cue:'10 each leg',                                                categories:['knee','ankle'] },
  { id:'front-rack-rev-lunge',  name:'Front Rack Reverse Lunge',            cue:'10 each leg',                                                categories:['knee','squat'] },
  { id:'single-leg-rdl',        name:'Single Leg RDLs',                     cue:'10 each leg',                                                categories:['hip','ankle'] },
  { id:'single-leg-hip-thrust', name:'Single Leg Hip Thrusts',              cue:'10 each side',                                               categories:['hip'] },
  { id:'curtsy-step-up',        name:'Curtsy Step Ups',                     cue:'10 each side',                                               categories:['knee','hip'] },
  { id:'runners-lunge',         name:"Runner's Lunge Reach",                cue:'Lunge, hand to sky, add weight -- 10 each side',             categories:['knee','snatch'] },
  { id:'deep-squat-hold',       name:'Deep Squat Hold',                     cue:'Hold with counterweight, work the hips at the bottom, knees toward the ground', categories:['ankle','squat'] },
  { id:'90-90',                 name:'90/90 Hip Switch',                    cue:'Add weight -- 2 minutes total',                              categories:['hip','lowerback'] },
  { id:'cobra',                 name:'Cobra Hold',                          cue:'Hold 1 minute',                                              categories:['lowerback'] },
  { id:'cossacks',              name:'Cossack Squat Flow',                  cue:'Deep squat, shift weight side to side extending the opposite leg straight -- flow continuously for 20-30 sec (Vladislav Tretiak\'s warm-up flow)', categories:['ankle','knee','hip'] },
  { id:'overhead-squat-lunge',  name:'Weighted Overhead Squats & Lunges',   cue:'Weight in one or both arms',                                 categories:['snatch','squat'] },
  { id:'heel-dips',             name:'Heel Dips / Step Downs',              cue:'10 reps',                                                    categories:['ankle'] },
  { id:'kneeling-thoracic-ext', name:'Kneeling Thoracic Extension vs Wall', cue:'Add weight',                                                 categories:['lowerback','snatch'] },
  { id:'bounces',               name:'Bounces',                             cue:'Light bouncing mobility flow',                               categories:['ankle'] },
  { id:'arm-circles',           name:'Arm Circles',                        cue:'1 sec each direction, both ways',                            categories:['snatch'] },
  { id:'kb-swing-thrust',       name:'Kettlebell Swings & Thrusts',        cue:'',                                                            categories:['hip','snatch'] },
  { id:'aura-farmers',          name:"Aura Farmer's Wave",                  cue:'Wave arms',                                                  categories:['snatch'] },
  { id:'magregors',             name:"MAgregor's Arm Wave",                 cue:'Wave arms about',                                            categories:['snatch'] },
  { id:'bridge',                name:'Bridge',                              cue:'Hold',                                                       categories:['lowerback','hip'] },
  { id:'dead-hang',             name:'Dead Hang',                          cue:'30 seconds',                                                 categories:['snatch'] },
  { id:'atg-split-squat',       name:'ATG Split Squats',                    cue:'',                                                            categories:['knee','ankle'] },
  { id:'rdl',                   name:'Romanian Deadlifts',                  cue:'',                                                            categories:['hip'] },
  { id:'back-extension',        name:'Back Extensions',                     cue:'',                                                            categories:['lowerback','hip'] },
  { id:'handstand-progression', name:'Handstand Progression',               cue:'',                                                            categories:['snatch'] },
  { id:'squat-hands-behind-head', name:'Squat with Hands Behind Head',      cue:'',                                                            categories:['squat'] },
  { id:'kb-around-head',        name:'Kettlebell Swing Around Head',        cue:'',                                                            categories:['snatch'] },
  { id:'grip-swap',             name:'Weight Swaps for Grip',               cue:'Swap weights hand to hand',                                  categories:['snatch'] },
  { id:'squat-ankle-raise',     name:'Squat Ankle Raises',                  cue:'',                                                            categories:['ankle','squat'] },
  { id:'pancakes',              name:'Pancakes',                            cue:'Pancake stretch',                                            categories:['hip','squat'] },
  { id:'squat-rotate-in',       name:'Squat Then Rotate In',                cue:'',                                                            categories:['squat','lowerback'] },
  { id:'butterfly-hold',        name:'Butterfly Holds',                     cue:'',                                                            categories:['hip','ankle'] },
  { id:'sissy-squat',           name:'Sissy Squats',                        cue:'10-12 reps, control the descent',                            categories:['knee','squat'] },
  { id:'farmer-walk',           name:"Farmer's Walk",                       cue:'40m each way, heavy as you can hold with good posture',      categories:['hip','snatch'] },
  { id:'lowerback-hold',        name:'Lower Back Holds',                    cue:'Hold, 3 minutes total -- gym',                               categories:['lowerback'] },
  { id:'lizard-reach',          name:'Lizard Reaches',                      cue:'Deep lunge, reach overhead and rotate -- 10 each side',       categories:['hip','lowerback'] },
  { id:'squat-twist',           name:'Squat Twists',                        cue:'Hold bottom of squat, rotate through the torso -- 10 each side', categories:['squat','lowerback'] },
  { id:'pump-stretch',          name:'Pump Stretches',                      cue:'Straight-leg hamstring pump -- 15 each side',                categories:['hip','knee'] },
  { id:'pigeon-pulse',          name:'Pigeon Pulses',                       cue:'Hold pigeon pose, small pulses -- 20 each side',             categories:['hip'] },
  { id:'windshield-wipers',     name:'Windshield Wipers',                   cue:'Lying, knees side to side -- 12 each way',                   categories:['hip','lowerback'] },
  { id:'plow-pose',             name:'Plow Pose',                           cue:'Hold 30-60 seconds',                                         categories:['lowerback','hip'] },
  { id:'couch-stretch',         name:'Couch Stretch',                       cue:'Rear foot up on a couch/bench, hips driven forward, back knee down -- 60-90 sec each side', categories:['hip'] },
]

// Not part of the daily category rotation -- shown every OTHER day
// (alternating on the days-since-program-start counter) regardless of the
// day's focus, so it doesn't crowd out the regular rotation but still lands
// roughly 3-4x a week. Consumed identically by Physical and Morning routine.
export const MOBILITY_ALT_DAY_ANCHORS: MobilityExercise[] = [
  { id:'kb-snatch', name:'Kettlebell Snatches', cue:'Explosive hip-driven snatch, both arms -- every other day', categories:['snatch','hip'] },
]

// Run every day regardless of the day's rotation -- always shown first, in
// this order. Supermans added per Tom's request to run daily for months,
// same treatment as the existing Reverse Plank anchor.
export const MOBILITY_DAILY_ANCHORS: MobilityExercise[] = [
  { id:'reverse-plank', name:'Reverse Planks', cue:'Hold 1 minute x5 -- every day', categories:['lowerback'] },
  { id:'supermans',     name:'Supermans',      cue:'Face down, arms and legs raised in a V, hold -- every day for months', categories:['lowerback'] },
  { id:'crab-walk',     name:'Crab Position Holds & Walks', cue:'Hold crab position 30-60 seconds, then crab walk forward and back x10 -- every day', categories:['lowerback','hip'] },
]

export const MOBILITY_PROGRAM_WEEKS = 4

type MobilityDayTemplate = { day: string; focus: string; categories: string[] }

// Monday-first, matches Date#getDay() via ((getDay()+6)%7)
export const MOBILITY_WEEK_TEMPLATE: MobilityDayTemplate[] = [
  { day:'Monday',    focus:'Ankle & Knee -- Squat Foundation',      categories:['ankle','knee'] },
  { day:'Tuesday',   focus:'Hip & Lower Back',                      categories:['hip','lowerback'] },
  { day:'Wednesday', focus:'Squat Integration',                     categories:['squat'] },
  { day:'Thursday',  focus:'Snatch & Overhead Prep',                categories:['snatch'] },
  { day:'Friday',    focus:'Knee & Hip -- Posterior Chain',         categories:['knee','hip'] },
  { day:'Saturday',  focus:'Ankle & Lower Back',                    categories:['ankle','lowerback'] },
  { day:'Sunday',    focus:'Full Body Flow -- Active Recovery',     categories:['ankle','hip','lowerback'] },
]

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export type MobilityDayPlan = {
  weekNumber: number   // 1..MOBILITY_PROGRAM_WEEKS
  dayLabel: string
  focus: string
  exercises: MobilityExercise[] // anchor first, then today's rotation
}

/**
 * Deterministic day plan: the weekday (Mon..Sun) always maps to the same
 * focus area so the structure is easy to remember, while `weekNumber`
 * (derived from days-since-start, cycling every 4 weeks) rotates which
 * specific exercise gets pulled from each category so the plan varies
 * week to week instead of repeating identically.
 */
export function getMobilityDay(date: Date, startDate: Date, size = 5): MobilityDayPlan {
  const d0 = startOfDay(date).getTime()
  const s0 = startOfDay(startDate).getTime()
  const totalDays = Math.max(0, Math.round((d0 - s0) / 86400000))
  const weekNumber = (Math.floor(totalDays / 7) % MOBILITY_PROGRAM_WEEKS) + 1
  const dayIndex = (date.getDay() + 6) % 7 // Monday = 0
  const template = MOBILITY_WEEK_TEMPLATE[dayIndex]

  const candidates = MOBILITY_POOL.filter(e => e.categories.some(c => template.categories.includes(c)))
  const offset = candidates.length > 0 ? (weekNumber - 1) % candidates.length : 0
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)]
  const picked = rotated.slice(0, size)

  const isAltDay = totalDays % 2 === 0
  const anchors = isAltDay ? [...MOBILITY_DAILY_ANCHORS, ...MOBILITY_ALT_DAY_ANCHORS] : MOBILITY_DAILY_ANCHORS

  return {
    weekNumber,
    dayLabel: template.day,
    focus: template.focus,
    exercises: [...anchors, ...picked],
  }
}
