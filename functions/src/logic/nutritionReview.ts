import { z } from 'zod'

export const REVIEW_PROMPT_VERSION = 1

// Coarse 3-value enum (risk R7); anything else degrades to a neutral doc.
export const REVIEW_VERDICTS = [
  'likely under-fuelled',
  'about right',
  'heavier than the day needed',
] as const

export const reviewSchema = z.object({
  verdict: z.enum(REVIEW_VERDICTS),
  reason: z.string().min(1).max(160),
  suggestion: z.string().min(1).max(200),
})

export type ReviewResult = z.infer<typeof reviewSchema>

// R13.7 + AI toggle: both gates are deterministic code, evaluated before any
// model involvement, in this order.
export function shouldReview(
  profile: { aiMealsEnabled?: boolean } | undefined,
  mealCount: number,
): 'skip-disabled' | 'skip-empty' | 'review' {
  if (profile?.aiMealsEnabled === false) return 'skip-disabled'
  if (mealCount === 0) return 'skip-empty'
  return 'review'
}

export interface ReviewSession {
  type: string
  durationMin: number
  distanceKm: number | null
  perceivedEffort: number
}

export function summariseTraining(sessions: ReviewSession[]): string {
  if (sessions.length === 0) return 'rest day — no sessions logged'
  return sessions
    .map((s) => {
      const hours = Math.floor(s.durationMin / 60)
      const mins = s.durationMin % 60
      const duration = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`
      const km = s.distanceKm !== null ? ` ${s.distanceKm}km` : ''
      return `${s.type} ${duration}${km} effort ${s.perceivedEffort}/10`
    })
    .join('; ')
}

// R13.9 fallback: out-of-enum / parse failure / Gemini error → neutral doc.
export function neutralReview(
  mealCount: number,
  trainingSummary: string,
): Record<string, unknown> {
  return {
    verdict: 'not-assessed',
    reason: 'Logged — no assessment today.',
    suggestion: '',
    mealCount,
    trainingSummary,
    promptVersion: REVIEW_PROMPT_VERSION,
    createdAt: new Date(),
  }
}

export interface ReviewMeal {
  slot: string
  text: string
  tag: string | null
  portionNote: string
}

export function buildReviewPrompt(args: {
  date: string
  phase: string
  macroFocus: string
  meals: ReviewMeal[]
  trainingSummary: string
}): string {
  const mealLines = args.meals
    .map(
      (m) =>
        `- ${m.slot}: ${m.text}${m.tag ? ` (${m.tag})` : ''}${m.portionNote ? ` — ${m.portionNote}` : ''}`,
    )
    .join('\n')
  return `You review one athlete's day of fuelling for endurance training (Kokoda Challenge preparation, ${args.phase} phase). This is performance-fuelling feedback ONLY — NEVER mention body weight, calories, restriction, or dieting.

Day: ${args.date}. Their macro preference: ${args.macroFocus}.
Training completed today: ${args.trainingSummary}.
Meals logged today:
${mealLines}

Return JSON only: {"verdict": one of exactly ["likely under-fuelled","about right","heavier than the day needed"], "reason": one sentence tied to the training load (e.g. "a 20km hike day usually needs more carbs than this"), "suggestion": one practical tip for tomorrow}.
Judge the verdict relative to the training load, not any ideal diet. If unsure, choose "about right".`
}
