import type { ThemePreference } from '@/features/settings/settingsSlice'

export type Units = 'metric' | 'imperial'

export const MACRO_FOCUS = ['carb', 'protein', 'balanced'] as const
export type MacroFocus = (typeof MACRO_FOCUS)[number]

export const DIET_STYLES = [
  'none',
  'vegetarian',
  'vegan',
  'pescatarian',
] as const
export type DietStyle = (typeof DIET_STYLES)[number]

export const DIET_STYLE_LABELS: Record<DietStyle, string> = {
  none: 'No restrictions',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
}

// Spec v1.2: per-user meal structure prefs — drive the day-view completeness
// indicator (F11) and both Gemini meal prompts (F13). The questionnaire
// fields (F13C) feed straight into the meal-plan prompt.
export interface MealPrefs {
  mainMeals: number // 2-4
  snacks: number // 0-4
  duringTraining: boolean
  macroFocus: MacroFocus
  dietStyle: DietStyle
  favouriteFoods: string[] // foods they love — plan should lean on these
  foodsToTry: string[] // new foods to work into the week
  avoidFoods: string[] // allergies + hard dislikes — never planned
  extraNotes: string
  // Set once the food questionnaire has been filled in; gates the
  // ask-before-first-generate flow on the meal plan page.
  questionnaireDone: boolean
}

export const DEFAULT_MEAL_PREFS: MealPrefs = {
  mainMeals: 3,
  snacks: 2,
  duringTraining: true,
  macroFocus: 'balanced',
  dietStyle: 'none',
  favouriteFoods: [],
  foodsToTry: [],
  avoidFoods: [],
  extraNotes: '',
  questionnaireDone: false,
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
