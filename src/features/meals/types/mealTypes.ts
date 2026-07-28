export const MEAL_SLOTS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'during',
] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  during: 'During training',
}

export const MAIN_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner']

export const MEAL_TAGS = ['carb', 'protein', 'light'] as const
export type MealTag = (typeof MEAL_TAGS)[number]

export const MEAL_TAG_LABELS: Record<MealTag, string> = {
  carb: 'Carb-heavy',
  protein: 'Protein-heavy',
  light: 'Light',
}

export type MealStatus = 'logged' | 'draft'

// Mirrors users/{uid}/meals/{mealId} (MVP-SPEC v1.2 F11). textSnapshot is
// denormalised so library renames never rewrite history.
export interface Meal {
  id: string
  date: string // yyyy-mm-dd (Brisbane)
  slot: MealSlot
  libraryRefId: string
  textSnapshot: string
  portionNote: string
  tag: MealTag | null
  status: MealStatus
  loggedAtMs: number | null
  createdAtMs: number | null
}

// Mirrors users/{uid}/mealLibrary/{itemId}; itemId = fnv1a64(normalisedText).
export interface MealLibraryItem {
  id: string
  text: string
  normalisedText: string
  tag: MealTag | null
  useCount: number
  lastUsedAtMs: number | null
  favourite: boolean
  hidden: boolean
}

export interface MealWriteInput {
  date: string
  slot: MealSlot
  text: string
  portionNote?: string
  tag?: MealTag
  loggedAtMs: number
  status?: MealStatus // defaults to 'logged'
  // Provided when re-logging from a chip / plan item — reuses the item as-is
  // (keeps pointing at renamed items). Absent = derive from text.
  libraryRefId?: string
  // True when the text isn't in the library yet — the upsert then also writes
  // the one-time fields (favourite/hidden/createdAt) without clobbering them
  // on existing items.
  createLibraryItem?: boolean
}

// Mirrors users/{uid}/nutritionReviews/{date} (F13B, function-written).
export interface NutritionReview {
  date: string
  verdict: string
  reason: string
  suggestion: string
  mealCount: number
  trainingSummary: string
}

// Mirrors teams/{teamId}/fuelling/{uid} — the function-written aggregate the
// dashboard reads so raw meals stay private (spec §3).
export interface FuellingEntry {
  uid: string
  date: string
  mealCount: number
  review: { date: string; verdict: string } | null
}

export interface MealFormValues {
  slot: MealSlot
  text: string
  portionNote: string
  tag: MealTag | ''
  time: string // HH:mm
}
