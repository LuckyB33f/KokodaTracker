import test from 'node:test'
import assert from 'node:assert/strict'
import { planIssues } from './generatePlan'
import { brisbaneWeekDates } from '../lib/weekKey'

const WEEK = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
]

function validDays(uid: string) {
  return [
    { date: WEEK[0], memberUid: uid, title: 'Walk', detail: 'easy', targetType: 'duration' as const, targetValue: 45 },
    { date: WEEK[1], memberUid: uid, title: 'Rest', detail: 'off', targetType: 'rest' as const, targetValue: 0 },
    { date: WEEK[2], memberUid: uid, title: 'Rest', detail: 'off', targetType: 'rest' as const, targetValue: 0 },
    { date: WEEK[5], memberUid: null, title: 'Team hike', detail: 'trail', targetType: 'distance' as const, targetValue: 15 },
  ]
}

test('planIssues: clean plan has no issues', () => {
  assert.deepEqual(planIssues(validDays('u1'), ['u1'], WEEK), [])
})

test('planIssues: flags wrong dates, unknown uids, missing team hike and rest days', () => {
  const days = [
    { date: '2026-01-01', memberUid: 'ghost', title: 'X', detail: 'y', targetType: 'duration' as const, targetValue: 60 },
  ]
  const issues = planIssues(days, ['u1'], WEEK)
  assert.ok(issues.some((i) => i.includes('2026-01-01')))
  assert.ok(issues.some((i) => i.includes('ghost')))
  assert.ok(issues.some((i) => i.includes('Saturday')))
  assert.ok(issues.some((i) => i.includes('rest day')))
})

test('planIssues: rest day with nonzero target is flagged', () => {
  const days = validDays('u1')
  days[1] = { ...days[1], targetValue: 30 }
  const issues = planIssues(days, ['u1'], WEEK)
  assert.ok(issues.some((i) => i.includes('targetValue 0')))
})

test('brisbaneWeekDates: Monday-first consecutive week containing the date', () => {
  // 2026-07-28 is a Tuesday in Brisbane.
  const dates = brisbaneWeekDates(new Date('2026-07-28T12:00:00+10:00'))
  assert.deepEqual(dates, WEEK)
})
