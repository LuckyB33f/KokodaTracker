import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildExerciseHistory,
  buildStrengthAdvicePrompt,
  strengthAdviceSchema,
  type StrengthSessionRecord,
} from './strengthAdvice'

const day = 86400000
const now = Date.now()

const sessions: StrengthSessionRecord[] = [
  {
    startedAtMs: now - 2 * day,
    durationMin: 45,
    perceivedEffort: 7,
    exercises: [
      {
        name: 'Back squat',
        sets: [
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
          { reps: 6, weightKg: 65 },
        ],
      },
      { name: 'Weighted step-up', sets: [{ reps: 10, weightKg: 20 }] },
    ],
  },
  {
    startedAtMs: now - 9 * day,
    durationMin: 40,
    perceivedEffort: 6,
    exercises: [
      {
        // Case-insensitive merge with "Back squat" above.
        name: 'back squat',
        sets: [{ reps: 8, weightKg: 70 }],
      },
    ],
  },
]

test('buildExerciseHistory merges names case-insensitively', () => {
  const history = buildExerciseHistory(sessions)
  assert.equal(history.length, 2)
  const squat = history.find((h) => h.name.toLowerCase() === 'back squat')
  assert.ok(squat)
  assert.equal(squat.sessionCount, 2)
})

test('buildExerciseHistory tracks best set vs latest top set separately', () => {
  const squat = buildExerciseHistory(sessions).find(
    (h) => h.name.toLowerCase() === 'back squat',
  )
  assert.ok(squat)
  // Best ever was 8×70 a week ago; the most recent session topped out at 6×65.
  assert.deepEqual(squat.bestSet, { reps: 8, weightKg: 70 })
  assert.deepEqual(squat.latestTopSet, { reps: 6, weightKg: 65 })
  assert.equal(squat.latestVolumeKg, 8 * 60 + 8 * 60 + 6 * 65)
})

test('buildExerciseHistory sorts by most recently trained', () => {
  const history = buildExerciseHistory(sessions)
  assert.equal(history[0].lastTrainedMs, now - 2 * day)
})

test('buildExerciseHistory skips empty names and set-less exercises', () => {
  const history = buildExerciseHistory([
    {
      startedAtMs: now,
      durationMin: 30,
      perceivedEffort: 5,
      exercises: [
        { name: '  ', sets: [{ reps: 5, weightKg: 10 }] },
        { name: 'Bench press', sets: [] },
      ],
    },
  ])
  assert.equal(history.length, 0)
})

test('prompt includes exercise numbers and event context', () => {
  const prompt = buildStrengthAdvicePrompt({
    history: buildExerciseHistory(sessions),
    sessionCount: sessions.length,
    weeksToEvent: 12,
    eventDistanceKm: 48,
  })
  assert.match(prompt, /Back squat/)
  assert.match(prompt, /8×70kg/)
  assert.match(prompt, /12 weeks out/)
  assert.match(prompt, /48 km/)
  assert.match(prompt, /JSON ONLY/)
})

test('prompt handles empty history without event date', () => {
  const prompt = buildStrengthAdvicePrompt({
    history: [],
    sessionCount: 0,
    weeksToEvent: null,
    eventDistanceKm: null,
  })
  assert.match(prompt, /No exercise-level history/)
})

test('advice schema accepts a valid response', () => {
  const advice = strengthAdviceSchema.parse({
    summary: 'Solid squat progress; keep building the posterior chain.',
    tips: [{ exercise: 'Back squat', tip: 'Add 2.5kg to your top set.' }],
    nextWorkout: [{ name: 'Back squat', sets: 3, reps: 8, weightKg: 62.5 }],
  })
  assert.equal(advice.nextWorkout[0].weightKg, 62.5)
})

test('advice schema rejects an empty workout or absurd weight', () => {
  assert.throws(() =>
    strengthAdviceSchema.parse({ summary: 'x', tips: [], nextWorkout: [] }),
  )
  assert.throws(() =>
    strengthAdviceSchema.parse({
      summary: 'x',
      tips: [],
      nextWorkout: [{ name: 'Squat', sets: 3, reps: 8, weightKg: 1000 }],
    }),
  )
})
