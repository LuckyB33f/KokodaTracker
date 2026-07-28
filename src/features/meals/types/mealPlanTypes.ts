import type { MealSlot, MealTag } from './mealTypes'

export interface MealPlanMeal {
  slot: MealSlot
  libraryRefId: string | null
  text: string
  tag: MealTag | null
}

export interface MealPlanDay {
  date: string
  meals: MealPlanMeal[]
}

// Mirrors users/{uid}/mealPlans/{weekKey} (MVP-SPEC v1.2 F13A,
// function-written; regeneration overwrites, version increments).
export interface MealPlan {
  weekKey: string
  phase: string
  version: number
  generatedAtMs: number | null
  libraryCoveragePct: number
  days: MealPlanDay[]
}

// Mirrors teams/{teamId}/mealPlanRequests/{requestId}.
export interface MealPlanRequest {
  id: string
  scope: 'self' | 'team'
  requestedBy: string
  status: 'pending' | 'processing' | 'done' | 'error'
  results: Record<string, 'done' | 'skipped-disabled' | 'error'> | null
  errorMessage: string | null
  createdAtMs: number | null
}
