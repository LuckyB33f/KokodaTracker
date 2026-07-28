import type {
  SessionExercise,
  SessionType,
} from '@/features/sessions/types/sessionTypes'
import type { MealSlot, MealTag } from '@/features/meals/types/mealTypes'

export type TemplateKind = 'session' | 'mealDay' | 'exercise'
export type TemplateScope = 'personal' | 'team'
export type TemplateCreatedFrom = 'manual' | 'history' | 'seed'

// Prefills the F3 session form (R12.1).
export interface SessionTemplatePayload {
  type: SessionType
  durationMin: number
  distanceKm?: number
  elevationGainM?: number
  exercises?: SessionExercise[]
  perceivedEffort: number
  notes?: string
}

// F3.1: a single-exercise preset (name + default sets/weights) for one-tap
// adds in the strength editor.
export interface ExerciseTemplatePayload {
  exercise: SessionExercise
}

export interface MealDayTemplateItem {
  slot: MealSlot
  text: string
  libraryRefId?: string
  tag?: MealTag
}

// A named ordered set of meals; applying stages drafts (R12.2).
export interface MealDayTemplatePayload {
  items: MealDayTemplateItem[]
}

export type TemplatePayload =
  | SessionTemplatePayload
  | MealDayTemplatePayload
  | ExerciseTemplatePayload

// Mirrors users/{uid}/templates and teams/{teamId}/templates (MVP-SPEC v1.2
// F12). scope is a client-side annotation from which collection it streamed.
export interface Template {
  id: string
  kind: TemplateKind
  name: string
  payload: TemplatePayload
  useCount: number
  createdFrom: TemplateCreatedFrom
  scope: TemplateScope
}

export interface SessionTemplate extends Template {
  kind: 'session'
  payload: SessionTemplatePayload
}

export interface MealDayTemplate extends Template {
  kind: 'mealDay'
  payload: MealDayTemplatePayload
}

export function isSessionTemplate(t: Template): t is SessionTemplate {
  return t.kind === 'session'
}

export function isMealDayTemplate(t: Template): t is MealDayTemplate {
  return t.kind === 'mealDay'
}

export interface ExerciseTemplate extends Template {
  kind: 'exercise'
  payload: ExerciseTemplatePayload
}

export function isExerciseTemplate(t: Template): t is ExerciseTemplate {
  return t.kind === 'exercise'
}
