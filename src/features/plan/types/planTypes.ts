export type PlanTargetType = 'duration' | 'distance' | 'rest'
export type ReadinessVerdict = 'scale_up' | 'hold' | 'scale_back'

export interface PlanDay {
  date: string // yyyy-mm-dd
  memberUid: string | null // null = whole team
  title: string
  detail: string
  targetType: PlanTargetType
  targetValue: number
}

export interface ReadinessInput {
  verdict: ReadinessVerdict
  reason: string
  ceiling: number
}

// Mirrors teams/{teamId}/plans/{planId} (MVP-SPEC §2.3). Function-written for
// AI plans; captain-written (model 'manual') for manual plans.
export interface Plan {
  id: string
  weekKey: string
  phase: string
  model: string
  status: 'active' | 'superseded'
  generatedAtMs: number | null
  promptVersion: number
  readinessInputs: Record<string, ReadinessInput>
  days: PlanDay[]
}

// Mirrors teams/{teamId}/planRequests/{requestId} — the fire-and-forget
// generation queue processed by the onPlanRequest trigger.
export interface PlanRequest {
  id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  planId: string | null
  errorMessage: string | null
  createdAtMs: number | null
}

export interface Checkoff {
  id: string // `${uid}_${dayIndex}`
  uid: string
  dayIndex: number
  done: boolean
}

// Mirrors teams/{teamId}/suggestions/{weekKey} (MVP-SPEC F10).
export interface WeekendSuggestion {
  weekKey: string
  status: 'go' | 'no_window'
  pick: {
    day: string
    dayLabel: string
    startTime: string
    locationName: string
    distanceKm: number
  } | null
  reasoning: string
  weatherSnapshot: {
    stormProb?: number | null
    precipProb?: number | null
    tMax?: number | null
    gates?: string[]
  }
  updatedAtMs: number | null
}
