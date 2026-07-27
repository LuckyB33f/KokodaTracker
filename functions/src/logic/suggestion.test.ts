import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickWeekendWindow, type LocationForecast } from './suggestion'

// 2026-08-01 is a Saturday, 2026-08-02 a Sunday.
function forecast(
  saturday: Partial<LocationForecast['days'][number]>,
  sunday: Partial<LocationForecast['days'][number]>,
): LocationForecast[] {
  const blank = {
    tMin: 10,
    tMax: 22,
    precipProb: 10,
    stormProb: 0,
    sunrise: null,
    sunset: null,
    summary: null,
  }
  return [
    {
      name: 'Brookfield Reserve',
      days: [
        { ...blank, date: '2026-08-01', ...saturday },
        { ...blank, date: '2026-08-02', ...sunday },
      ],
    },
  ]
}

test('stormy Saturday, clear Sunday → picks Sunday', () => {
  const pick = pickWeekendWindow(forecast({ stormProb: 60 }, { stormProb: 5 }))
  assert.ok(pick)
  assert.equal(pick.dayLabel, 'Sunday')
  assert.ok(pick.reasons.some((r) => r.includes('Saturday rejected')))
})

test('hot day → early 5:30am start', () => {
  const pick = pickWeekendWindow(forecast({ tMax: 33 }, { tMax: 35 }))
  assert.ok(pick)
  assert.equal(pick.startTime, '5:30am')
  assert.equal(pick.dayLabel, 'Saturday') // cooler of the two
})

test('mild weekend → normal start, lower-rain day wins', () => {
  const pick = pickWeekendWindow(
    forecast({ precipProb: 40 }, { precipProb: 5 }),
  )
  assert.ok(pick)
  assert.equal(pick.startTime, '6:30am')
  assert.equal(pick.dayLabel, 'Sunday')
})

test('both days stormy → no pick (stay home)', () => {
  const pick = pickWeekendWindow(forecast({ stormProb: 70 }, { stormProb: 45 }))
  assert.equal(pick, null)
})
