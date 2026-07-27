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
  perceivedEffort: number
  notes?: string
  route?: SessionRoute
}
