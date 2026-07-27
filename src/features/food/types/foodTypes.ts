export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

// Mirrors teams/{teamId}/foodLogs/{logId} (MVP-SPEC §2.3, feature F3.5).
export interface FoodLog {
  id: string
  uid: string
  date: string // yyyy-mm-dd, Australia/Brisbane
  mealType: MealType
  description: string
  calories: number | null
  notes: string
  createdAtMs: number | null
}

export interface FoodLogFormValues {
  mealType: MealType
  description: string
  calories: string
  notes: string
}

export interface FoodLogInput {
  date: string
  mealType: MealType
  description: string
  calories?: number
  notes?: string
}
