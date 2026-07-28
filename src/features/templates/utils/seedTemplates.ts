import type { TrainingPhase } from '@/utils/trainingPhase'
import type { SessionTemplatePayload } from '../types/templateTypes'

interface SeedTemplate {
  name: string
  payload: SessionTemplatePayload
}

// R12.1: deterministic seed set derived from the plan phase — no AI call.
// Offered to the captain when the team has no session templates yet.
export function seedSessionTemplates(phase: TrainingPhase): SeedTemplate[] {
  const base: SeedTemplate[] = [
    {
      name: 'Brookfield long walk 90min',
      payload: { type: 'walk', durationMin: 90, distanceKm: 7, perceivedEffort: 4 },
    },
    {
      name: 'Easy recovery walk 30min',
      payload: { type: 'walk', durationMin: 30, perceivedEffort: 2 },
    },
  ]
  const hills: SeedTemplate = {
    name: 'Mt Coot-tha hill repeats 60min',
    payload: {
      type: 'hike',
      durationMin: 60,
      distanceKm: 5,
      elevationGainM: 300,
      perceivedEffort: 7,
    },
  }
  const longHike = (km: number, min: number): SeedTemplate => ({
    name: `Long trail hike ${km}km`,
    payload: {
      type: 'hike',
      durationMin: min,
      distanceKm: km,
      elevationGainM: km * 40,
      perceivedEffort: 6,
      notes: 'D’Aguilar trails — pack water, poles optional.',
    },
  })
  const strength: SeedTemplate = {
    name: 'Leg strength 45min',
    payload: { type: 'strength', durationMin: 45, perceivedEffort: 6 },
  }

  switch (phase) {
    case 'base':
      return [...base, longHike(10, 150), strength]
    case 'build1':
      return [...base, hills, longHike(15, 225), strength]
    case 'build2':
      return [...base, hills, longHike(20, 300), strength]
    case 'peak':
      return [hills, longHike(25, 375), longHike(30, 450), strength]
    case 'taper':
      return [
        {
          name: 'Taper walk 45min',
          payload: { type: 'walk', durationMin: 45, perceivedEffort: 3 },
        },
        longHike(10, 150),
      ]
  }
}
