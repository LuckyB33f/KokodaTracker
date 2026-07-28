import { z } from 'zod'

// F3.1: AI strength coach. Pure logic (history aggregation, prompt, schema)
// lives here so it is unit-testable; Firestore/Gemini I/O stays in the
// trigger, mirroring the plan-generation split.

export interface StrengthSet {
  reps: number
  weightKg: number
}

export interface StrengthSessionRecord {
  startedAtMs: number
  durationMin: number
  perceivedEffort: number
  exercises: { name: string; sets: StrengthSet[] }[]
}

export interface ExerciseHistory {
  name: string
  sessionCount: number
  lastTrainedMs: number
  // Heaviest set overall and the most recent session's top set — the two
  // numbers a coach needs to judge progression.
  bestSet: StrengthSet
  latestTopSet: StrengthSet
  latestVolumeKg: number
}

export const strengthAdviceSchema = z.object({
  summary: z.string().min(1).max(600),
  tips: z
    .array(
      z.object({
        exercise: z.string().min(1).max(60),
        tip: z.string().min(1).max(300),
      }),
    )
    .max(8),
  nextWorkout: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        sets: z.number().int().min(1).max(10),
        reps: z.number().int().min(1).max(50),
        weightKg: z.number().min(0).max(500),
      }),
    )
    .min(1)
    .max(10),
})

export type StrengthAdvice = z.infer<typeof strengthAdviceSchema>

function topSet(sets: StrengthSet[]): StrengthSet {
  return sets.reduce(
    (best, set) => (set.weightKg > best.weightKg ? set : best),
    sets[0] ?? { reps: 0, weightKg: 0 },
  )
}

function volumeKg(sets: StrengthSet[]): number {
  return Math.round(sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0))
}

// Newest-first history per exercise name (case-insensitive merge).
export function buildExerciseHistory(
  sessions: StrengthSessionRecord[],
): ExerciseHistory[] {
  const byName = new Map<string, ExerciseHistory>()
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const name = exercise.name.trim()
      if (!name || exercise.sets.length === 0) continue
      const key = name.toLowerCase()
      const sessionTop = topSet(exercise.sets)
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, {
          name,
          sessionCount: 1,
          lastTrainedMs: session.startedAtMs,
          bestSet: sessionTop,
          latestTopSet: sessionTop,
          latestVolumeKg: volumeKg(exercise.sets),
        })
        continue
      }
      existing.sessionCount += 1
      if (sessionTop.weightKg > existing.bestSet.weightKg) {
        existing.bestSet = sessionTop
      }
      if (session.startedAtMs > existing.lastTrainedMs) {
        existing.lastTrainedMs = session.startedAtMs
        existing.latestTopSet = sessionTop
        existing.latestVolumeKg = volumeKg(exercise.sets)
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.lastTrainedMs - a.lastTrainedMs)
}

export function buildStrengthAdvicePrompt(args: {
  history: ExerciseHistory[]
  sessionCount: number
  weeksToEvent: number | null
  eventDistanceKm: number | null
}): string {
  const daysAgo = (ms: number) =>
    Math.max(0, Math.round((Date.now() - ms) / 86400000))
  const historyLines =
    args.history.length > 0
      ? args.history
          .map(
            (h) =>
              `- ${h.name}: trained ${h.sessionCount}×, last ${daysAgo(h.lastTrainedMs)} days ago. Best set ${h.bestSet.reps}×${h.bestSet.weightKg}kg. Latest top set ${h.latestTopSet.reps}×${h.latestTopSet.weightKg}kg, latest session volume ${h.latestVolumeKg}kg.`,
          )
          .join('\n')
      : '- No exercise-level history logged yet.'
  const eventLine =
    args.weeksToEvent !== null && args.eventDistanceKm !== null
      ? `They are ${args.weeksToEvent} weeks out from the Kokoda Challenge, a ${args.eventDistanceKm} km trail hiking event. Strength work supports long hiking under load: prioritise legs, posterior chain, core and carries; keep upper-body work secondary.`
      : 'They train strength to support long trail hiking under load.'

  return `You are a strength coach for a recreational trainee. ${eventLine}

Their recent strength history (${args.sessionCount} logged strength sessions):
${historyLines}

Rules (non-negotiable):
- Return JSON ONLY matching: {"summary":"...","tips":[{"exercise":"...","tip":"..."}],"nextWorkout":[{"name":"...","sets":<int>,"reps":<int>,"weightKg":<number>}]}
- "summary": 2-3 sentences on their overall progression and what to focus on.
- "tips": up to 8 entries, one per exercise they actually train — concrete progressive-overload guidance (e.g. add 2.5kg, add a rep, fix stalling) based on the numbers above.
- "nextWorkout": 4-8 exercises for their next session with specific sets/reps/weightKg. Progress conservatively from their latest top sets (2.5-5% or +1 rep). For new exercises pick a light starter weight.
- weightKg 0 means bodyweight. Round weights to 0.5kg.
- General fitness guidance only — no medical advice. If history is empty, suggest a sensible hiking-support starter workout.`
}
