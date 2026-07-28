// F3.1: mirrors the advice written by functions/onStrengthAdviceRequest into
// teams/{teamId}/strengthAdviceRequests/{uid}.

export interface StrengthAdviceTip {
  exercise: string
  tip: string
}

export interface StrengthWorkoutItem {
  name: string
  sets: number
  reps: number
  weightKg: number
}

export interface StrengthAdvice {
  summary: string
  tips: StrengthAdviceTip[]
  nextWorkout: StrengthWorkoutItem[]
}

export type StrengthAdviceStatus = 'pending' | 'processing' | 'done' | 'error'

export interface StrengthAdviceRequest {
  status: StrengthAdviceStatus
  advice: StrengthAdvice | null
  errorMessage: string | null
  updatedAtMs: number | null
}
