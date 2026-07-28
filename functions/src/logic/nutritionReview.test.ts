import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REVIEW_VERDICTS,
  buildReviewPrompt,
  neutralReview,
  reviewSchema,
  shouldReview,
  summariseTraining,
} from './nutritionReview'

test('shouldReview: toggle-off wins over everything (checked first)', () => {
  assert.equal(shouldReview({ aiMealsEnabled: false }, 5), 'skip-disabled')
  assert.equal(shouldReview({ aiMealsEnabled: false }, 0), 'skip-disabled')
})

test('shouldReview: zero meals skips; missing profile defaults to enabled', () => {
  assert.equal(shouldReview(undefined, 0), 'skip-empty')
  assert.equal(shouldReview({}, 0), 'skip-empty')
  assert.equal(shouldReview({ aiMealsEnabled: true }, 0), 'skip-empty')
})

test('shouldReview: enabled with meals reviews', () => {
  assert.equal(shouldReview(undefined, 1), 'review')
  assert.equal(shouldReview({ aiMealsEnabled: true }, 3), 'review')
})

test('reviewSchema: accepts exactly the three verdicts, rejects others', () => {
  for (const verdict of REVIEW_VERDICTS) {
    assert.ok(
      reviewSchema.safeParse({ verdict, reason: 'r', suggestion: 's' }).success,
    )
  }
  assert.equal(
    reviewSchema.safeParse({
      verdict: 'eat less', // diet-culture drift → must be rejected
      reason: 'r',
      suggestion: 's',
    }).success,
    false,
  )
  assert.equal(
    reviewSchema.safeParse({ verdict: 'about right', reason: '', suggestion: 's' })
      .success,
    false,
  )
})

test('neutralReview: not-assessed doc shape', () => {
  const doc = neutralReview(2, 'rest day — no sessions logged')
  assert.equal(doc.verdict, 'not-assessed')
  assert.equal(doc.mealCount, 2)
  assert.ok(typeof doc.reason === 'string')
})

test('summariseTraining: rest day and multi-session days', () => {
  assert.equal(summariseTraining([]), 'rest day — no sessions logged')
  const summary = summariseTraining([
    { type: 'hike', durationMin: 190, distanceKm: 14, perceivedEffort: 7 },
    { type: 'strength', durationMin: 45, distanceKm: null, perceivedEffort: 6 },
  ])
  assert.ok(summary.includes('hike 3h10m 14km effort 7/10'))
  assert.ok(summary.includes('strength 45m effort 6/10'))
})

test('review prompt: framing constraints and enum present, no diet language', () => {
  const prompt = buildReviewPrompt({
    date: '2026-07-28',
    phase: 'base',
    macroFocus: 'balanced',
    meals: [
      { slot: 'breakfast', text: 'Porridge', tag: 'carb', portionNote: 'big bowl' },
    ],
    trainingSummary: 'hike 2h 10km effort 6/10',
  })
  assert.ok(prompt.includes('NEVER mention body weight, calories, restriction, or dieting'))
  assert.ok(prompt.includes('"likely under-fuelled","about right","heavier than the day needed"'))
  assert.ok(prompt.includes('If unsure, choose "about right"'))
  assert.ok(prompt.includes('breakfast: Porridge (carb) — big bowl'))
  assert.ok(prompt.includes('hike 2h 10km'))
})
