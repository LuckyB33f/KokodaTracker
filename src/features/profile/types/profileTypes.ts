import type { ThemePreference } from '@/features/settings/settingsSlice'

export type Units = 'metric' | 'imperial'

export const MACRO_FOCUS = ['carb', 'protein', 'balanced'] as const
export type MacroFocus = (typeof MACRO_FOCUS)[number]

// Spec v1.2: per-user meal structure prefs — drive the day-view completeness
// indicator (F11) and both Gemini meal prompts (F13).
export interface MealPrefs {
  mainMeals: number // 2-4
  snacks: number // 0-4
  duringTraining: boolean
  macroFocus: MacroFocus
}

export const DEFAULT_MEAL_PREFS: MealPrefs = {
  mainMeals: 3,
  snacks: 2,
  duringTraining: true,
  macroFocus: 'balanced',
}

// Mirrors users/{uid} in MVP-SPEC §2.3. createdAt is converted to millis at
// the api layer so the RTK Query cache stays serializable.
export interface UserProfile {
  activeTeamId: string | null
  units: Units
  theme: ThemePreference
  // Master switch for ALL AI meal features (plan generation + nightly
  // review). Off ⇒ zero Gemini calls for this member, enforced server-side.
  aiMealsEnabled: boolean
  mealPrefs: MealPrefs
  createdAtMs: number | null
}

export interface ProfileFormValues {
  displayName: string
  units: Units
  theme: ThemePreference
  aiMealsEnabled: boolean
  mainMeals: number
  snacks: number
  duringTraining: boolean
  macroFocus: MacroFocus
}
