// F3.1: bundled exercise catalog for the strength editor's searchable
// dropdown. Shipped with the app bundle and held in module scope, so lookups
// are instant, work offline (PWA), and never touch the network — the whole
// list is "cached" by construction. Free-text entries are still allowed
// (Autocomplete freeSolo) for anything not listed.

export interface CatalogExercise {
  name: string
  group: string
}

export const EXERCISE_GROUPS = [
  'Legs — quads',
  'Legs — glutes & hamstrings',
  'Legs — calves',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Core',
  'Full body & carries',
  'Hike-specific',
] as const
export type ExerciseGroup = (typeof EXERCISE_GROUPS)[number]

const catalog: Record<ExerciseGroup, string[]> = {
  'Legs — quads': [
    'Back squat',
    'Front squat',
    'Goblet squat',
    'Box squat',
    'Hack squat',
    'Leg press',
    'Leg extension',
    'Bulgarian split squat',
    'Split squat',
    'Walking lunge',
    'Reverse lunge',
    'Lateral lunge',
    'Step-up',
    'Weighted step-up',
    'Pistol squat',
    'Wall sit',
    'Sissy squat',
  ],
  'Legs — glutes & hamstrings': [
    'Deadlift',
    'Romanian deadlift',
    'Stiff-leg deadlift',
    'Sumo deadlift',
    'Trap bar deadlift',
    'Single-leg Romanian deadlift',
    'Hip thrust',
    'Glute bridge',
    'Good morning',
    'Leg curl',
    'Nordic hamstring curl',
    'Kettlebell swing',
    'Cable pull-through',
    'Back extension',
    'Glute kickback',
  ],
  'Legs — calves': [
    'Standing calf raise',
    'Seated calf raise',
    'Single-leg calf raise',
    'Donkey calf raise',
    'Tibialis raise',
  ],
  Chest: [
    'Bench press',
    'Incline bench press',
    'Decline bench press',
    'Dumbbell bench press',
    'Incline dumbbell press',
    'Dumbbell fly',
    'Cable fly',
    'Pec deck',
    'Chest press machine',
    'Push-up',
    'Weighted push-up',
    'Dip (chest)',
  ],
  Back: [
    'Pull-up',
    'Chin-up',
    'Weighted pull-up',
    'Lat pulldown',
    'Barbell row',
    'Pendlay row',
    'Dumbbell row',
    'Chest-supported row',
    'Seated cable row',
    'T-bar row',
    'Inverted row',
    'Straight-arm pulldown',
    'Face pull',
    'Shrug',
    'Rack pull',
  ],
  Shoulders: [
    'Overhead press',
    'Push press',
    'Dumbbell shoulder press',
    'Arnold press',
    'Seated shoulder press',
    'Lateral raise',
    'Cable lateral raise',
    'Front raise',
    'Rear delt fly',
    'Upright row',
    'Landmine press',
  ],
  Arms: [
    'Barbell curl',
    'Dumbbell curl',
    'Hammer curl',
    'Incline dumbbell curl',
    'Preacher curl',
    'Cable curl',
    'Concentration curl',
    'Tricep pushdown',
    'Overhead tricep extension',
    'Skull crusher',
    'Close-grip bench press',
    'Dip (triceps)',
    'Wrist curl',
    'Reverse curl',
  ],
  Core: [
    'Plank',
    'Weighted plank',
    'Side plank',
    'Dead bug',
    'Bird dog',
    'Hanging leg raise',
    'Hanging knee raise',
    'Ab wheel rollout',
    'Cable crunch',
    'Crunch',
    'Sit-up',
    'Weighted sit-up',
    'Russian twist',
    'Pallof press',
    'Woodchopper',
    'Mountain climber',
    'Hollow hold',
  ],
  'Full body & carries': [
    'Clean',
    'Power clean',
    'Clean and press',
    'Snatch',
    'Thruster',
    'Kettlebell clean',
    'Kettlebell snatch',
    'Turkish get-up',
    'Farmer’s carry',
    'Suitcase carry',
    'Overhead carry',
    'Sandbag carry',
    'Sled push',
    'Sled pull',
    'Burpee',
    'Man maker',
    'Medicine ball slam',
    'Battle ropes',
  ],
  'Hike-specific': [
    'Weighted pack step-up',
    'Weighted pack squat',
    'Weighted pack lunge',
    'Weighted pack calf raise',
    'Box step-over',
    'Stair climb with pack',
    'Downhill eccentric step-down',
    'Single-leg balance reach',
    'Copenhagen plank',
    'Monster walk (band)',
    'Lateral band walk',
  ],
}

export const EXERCISE_CATALOG: CatalogExercise[] = EXERCISE_GROUPS.flatMap(
  (group) => catalog[group].map((name) => ({ name, group })),
)

const groupByName = new Map(
  EXERCISE_CATALOG.map((exercise) => [
    exercise.name.toLowerCase(),
    exercise.group,
  ]),
)

// The lifter's own past/custom names first (under "Your exercises"), then the
// full catalog — deduped case-insensitively. Options must stay sorted by
// group for MUI Autocomplete's groupBy.
export function catalogWithCustom(customNames: string[]): CatalogExercise[] {
  const seen = new Set(groupByName.keys())
  const custom: CatalogExercise[] = []
  for (const raw of customNames) {
    const name = raw.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    custom.push({ name, group: 'Your exercises' })
  }
  return [...custom, ...EXERCISE_CATALOG]
}
