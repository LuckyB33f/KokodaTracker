export const SESSION_TYPES = [
  'hike',
  'run',
  'walk',
  'stairs',
  'strength',
  'other',
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  hike: 'Hike',
  run: 'Run',
  walk: 'Walk',
  stairs: 'Stairs',
  strength: 'Strength',
  other: 'Other',
}

// F3.1: strength detail — one logged set of an exercise.
export interface ExerciseSet {
  reps: number
  weightKg: number
}

export interface SessionExercise {
  name: string
  sets: ExerciseSet[]
}

// Form-side mirror (text inputs hold strings until submit).
export interface ExerciseSetFormValues {
  reps: string
  weightKg: string
}

export interface SessionExerciseFormValues {
  name: string
  sets: ExerciseSetFormValues[]
}

export const MAX_EXERCISES = 20
export const MAX_SETS_PER_EXERCISE = 10

export function toExerciseFormValues(
  exercises: SessionExercise[],
): SessionExerciseFormValues[] {
  return exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets.map((set) => ({
      reps: String(set.reps),
      weightKg: String(set.weightKg),
    })),
  }))
}

// Assumes the rows already passed validation; blank rows are dropped so an
// untouched empty exercise never blocks submission.
export function fromExerciseFormValues(
  rows: SessionExerciseFormValues[],
): SessionExercise[] {
  return rows
    .filter((row) => row.name.trim() !== '')
    .map((row) => ({
      name: row.name.trim(),
      sets: row.sets.map((set) => ({
        reps: Number(set.reps),
        weightKg: Number(set.weightKg),
      })),
    }))
}

// Σ reps × kg across every set.
export function totalVolumeKg(exercises: SessionExercise[]): number {
  return Math.round(
    exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0),
      0,
    ),
  )
}

export interface SessionRoute {
  encodedPolyline: string
  bounds: { north: number; south: number; east: number; west: number }
  pointCount: number
}

// Mirrors teams/{teamId}/sessions/{sessionId} (MVP-SPEC §2.3).
export interface Session {
  id: string
  uid: string
  type: SessionType
  source: 'gps' | 'manual'
  startedAtMs: number
  durationMin: number
  distanceKm: number | null
  elevationGainM: number | null
  avgPaceMinPerKm: number | null
  route: SessionRoute | null
  exercises: SessionExercise[] | null
  perceivedEffort: number
  notes: string
  weekKey: string
}

export interface SessionFormValues {
  type: SessionType
  startedAt: string // datetime-local value
  durationMin: string
  distanceKm: string
  elevationGainM: string
  exercises: SessionExerciseFormValues[]
  perceivedEffort: number
  notes: string
}

export interface SessionInput {
  type: SessionType
  source: 'gps' | 'manual'
  startedAt: Date
  durationMin: number
  distanceKm?: number
  elevationGainM?: number
  exercises?: SessionExercise[]
  perceivedEffort: number
  notes?: string
  route?: SessionRoute
}
