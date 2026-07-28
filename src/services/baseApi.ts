import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'

export interface ApiError {
  code: string
  message: string
}

// Single RTK Query api. All Firestore/backend access goes through endpoints
// injected into this api (spec §2.1: "Firestore accessed via api layer").
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: [
    'UserProfile',
    'Team',
    'TeamMembers',
    'Sessions',
    'Meals',
    'MealLibrary',
    'Templates',
    'TeamTemplates',
    'MealPlan',
    'MealPlanRequest',
    'NutritionReview',
    'Fuelling',
    'Plan',
    'PlanRequest',
    'Checkoffs',
    'Suggestion',
    'StrengthAdvice',
  ],
  endpoints: () => ({}),
})
