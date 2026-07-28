import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MEAL_PREFS,
  buildMealPlanPrompt,
  libraryCoveragePct,
  mealPlanIssues,
  mealPlanSchema,
  type MealPlanDays,
} from './mealPlan'

const WEEK = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
]

function validWeek(libId: string | null = null): MealPlanDays {
  return WEEK.map((date) => ({
    date,
    meals: [
      { slot: 'breakfast' as const, libraryRefId: libId, text: 'Porridge', tag: 'carb' as const },
      { slot: 'lunch' as const, libraryRefId: null, text: 'Wrap', tag: null },
      { slot: 'dinner' as const, libraryRefId: null, text: 'Chicken and rice', tag: null },
      { slot: 'snack' as const, libraryRefId: null, text: 'Banana', tag: null },
    ],
  }))
}

const BASE_ARGS = {
  weekDates: WEEK,
  prefs: DEFAULT_MEAL_PREFS,
  libraryIds: new Set<string>(),
  trainingDates: new Set<string>([WEEK[5]]),
}

test('mealPlanIssues: clean plan passes', () => {
  assert.deepEqual(mealPlanIssues(validWeek(), BASE_ARGS), [])
})

test('mealPlanIssues: wrong main count and too many snacks flagged', () => {
  const days = validWeek()
  days[0].meals = days[0].meals.filter((m) => m.slot !== 'dinner')
  days[1].meals.push(
    { slot: 'snack', libraryRefId: null, text: 'Chips', tag: null },
    { slot: 'snack', libraryRefId: null, text: 'Lollies', tag: null },
  )
  const issues = mealPlanIssues(days, BASE_ARGS)
  assert.ok(issues.some((i) => i.includes('main meals')))
  assert.ok(issues.some((i) => i.includes('snacks')))
})

test('mealPlanIssues: during slot rejected off training days and when pref off', () => {
  const days = validWeek()
  days[0].meals.push({
    slot: 'during',
    libraryRefId: null,
    text: 'Gel',
    tag: 'carb',
  })
  const onRestDay = mealPlanIssues(days, BASE_ARGS)
  assert.ok(onRestDay.some((i) => i.includes('no training')))

  const days2 = validWeek()
  days2[5].meals.push({
    slot: 'during',
    libraryRefId: null,
    text: 'Gel',
    tag: 'carb',
  })
  assert.deepEqual(mealPlanIssues(days2, BASE_ARGS), [])
  const prefOff = mealPlanIssues(days2, {
    ...BASE_ARGS,
    prefs: { ...DEFAULT_MEAL_PREFS, duringTraining: false },
  })
  assert.ok(prefOff.some((i) => i.includes('member has it off')))
})

test('mealPlanIssues: unknown libraryRefId flagged', () => {
  const days = validWeek('ghost-id')
  const issues = mealPlanIssues(days, BASE_ARGS)
  assert.ok(issues.some((i) => i.includes('ghost-id')))
})

test('mealPlanIssues: library coverage enforced at >=10 items', () => {
  const libraryIds = new Set(
    Array.from({ length: 10 }, (_, i) => `item-${i}`),
  )
  const days = validWeek() // zero library usage
  const issues = mealPlanIssues(days, { ...BASE_ARGS, libraryIds })
  assert.ok(issues.some((i) => i.includes('at least half')))
  // Under 10 items the rule doesn't apply.
  const smallLib = new Set(['item-0'])
  assert.deepEqual(
    mealPlanIssues(validWeek(), { ...BASE_ARGS, libraryIds: smallLib }),
    [],
  )
})

test('mealPlanIssues: missing dates flagged', () => {
  const days = validWeek()
  days[6].date = '2026-08-09'
  const issues = mealPlanIssues(days, BASE_ARGS)
  assert.ok(issues.some((i) => i.includes('missing date 2026-08-02')))
  assert.ok(issues.some((i) => i.includes('not in this week')))
})

test('prompt: includes prefs structure, dates, library ids and tone rules', () => {
  const prompt = buildMealPlanPrompt({
    displayName: 'Jason',
    eventDate: '2027-06-19',
    distanceKm: 96,
    phase: 'base',
    weekKey: '2026-W31',
    weekDates: WEEK,
    prefs: { mainMeals: 3, snacks: 2, duringTraining: true, macroFocus: 'carb' },
    library: [{ id: 'abc123', text: 'Chicken and rice', tag: 'protein', favourite: true }],
    trainingDays: [
      { date: WEEK[5], title: 'Team hike', targetType: 'distance', targetValue: 15 },
    ],
  })
  assert.ok(prompt.includes('exactly 3 main meals'))
  assert.ok(prompt.includes('at most 2 snacks'))
  assert.ok(prompt.includes('id "abc123"'))
  assert.ok(prompt.includes(WEEK[0]) && prompt.includes(WEEK[6]))
  assert.ok(prompt.includes('NO calorie counts'))
  assert.ok(prompt.includes('96 km'))
  assert.ok(!prompt.includes('weight-loss framing is fine'))
})

test('schema: rejects wrong slot and >10 meals per day', () => {
  const bad = {
    days: validWeek().map((d, i) =>
      i === 0
        ? { ...d, meals: [{ slot: 'supper', libraryRefId: null, text: 'x', tag: null }] }
        : d,
    ),
  }
  assert.equal(mealPlanSchema.safeParse(bad).success, false)
})

test('libraryCoveragePct', () => {
  assert.equal(libraryCoveragePct(validWeek('lib-1')), 25)
  assert.equal(libraryCoveragePct(validWeek()), 0)
})
