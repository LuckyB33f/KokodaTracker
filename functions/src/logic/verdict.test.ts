import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeAcwr,
  computeVerdict,
  loadCeiling,
} from './verdict'

const base = {
  phase: 'build1' as const,
  weeksOfHistory: 6,
  sustainedHighEffort: false,
}

test('scenario 1: cruising member scales up', () => {
  const result = computeVerdict({
    ...base,
    completionPct: 95,
    avgEffort: 3.5,
    acwr: 1.1,
  })
  assert.equal(result.verdict, 'scale_up')
})

test('scenario 2: struggling member scales back (low completion)', () => {
  const result = computeVerdict({
    ...base,
    completionPct: 45,
    avgEffort: 6,
    acwr: 1.0,
  })
  assert.equal(result.verdict, 'scale_back')
})

test('scenario 2b: ACWR spike forces recovery even with high completion', () => {
  const result = computeVerdict({
    ...base,
    completionPct: 100,
    avgEffort: 3,
    acwr: 1.6,
  })
  assert.equal(result.verdict, 'scale_back')
})

test('scenario 3: middling week holds', () => {
  const result = computeVerdict({
    ...base,
    completionPct: 75,
    avgEffort: 6,
    acwr: 1.1,
  })
  assert.equal(result.verdict, 'hold')
})

test('taper is never scaled up', () => {
  const result = computeVerdict({
    ...base,
    phase: 'taper',
    completionPct: 100,
    avgEffort: 2,
    acwr: 1.0,
  })
  assert.equal(result.verdict, 'hold')
})

test('taper can still scale back', () => {
  const result = computeVerdict({
    ...base,
    phase: 'taper',
    completionPct: 40,
    avgEffort: 9,
    acwr: 1.0,
  })
  assert.equal(result.verdict, 'scale_back')
})

test('no verdicts before 4 weeks of history', () => {
  const result = computeVerdict({
    ...base,
    weeksOfHistory: 3,
    completionPct: 100,
    avgEffort: 2,
    acwr: 1.0,
  })
  assert.equal(result.verdict, 'hold')
})

test('sustained high effort scales back', () => {
  const result = computeVerdict({
    ...base,
    sustainedHighEffort: true,
    completionPct: 92,
    avgEffort: 8.5,
    acwr: 1.1,
  })
  assert.equal(result.verdict, 'scale_back')
})

test('ceiling caps scale_up at +10%', () => {
  assert.equal(loadCeiling(1000, 'scale_up'), 1100)
  assert.equal(loadCeiling(1000, 'hold'), 1000)
  assert.equal(loadCeiling(1000, 'scale_back'), 700)
})

test('ACWR needs 5 weeks and divides by 4-week chronic mean', () => {
  assert.equal(computeAcwr([100, 100, 100, 100]), null)
  assert.equal(computeAcwr([100, 100, 100, 100, 150]), 1.5)
  assert.equal(computeAcwr([0, 0, 0, 0, 100]), null)
})
