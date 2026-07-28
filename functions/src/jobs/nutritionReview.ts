import { logger } from 'firebase-functions'
import { db } from '../lib/admin'
import { geminiJson } from '../lib/gemini'
import { todayBrisbane } from '../lib/weekKey'
import {
  REVIEW_PROMPT_VERSION,
  buildReviewPrompt,
  neutralReview,
  reviewSchema,
  shouldReview,
  summariseTraining,
  type ReviewMeal,
  type ReviewSession,
} from '../logic/nutritionReview'

function phaseFor(nowMs: number, eventDateMs: number): string {
  const weeks = (eventDateMs - nowMs) / (7 * 24 * 60 * 60 * 1000)
  if (weeks <= 3) return 'taper'
  if (weeks <= 10) return 'peak'
  if (weeks <= 20) return 'build2'
  if (weeks <= 32) return 'build1'
  return 'base'
}

// F13B nightly review (8:30pm Brisbane). Per member, in order: AI-toggle
// gate → zero-meals gate (R13.7: no Gemini call, no doc, no notification) →
// Gemini review → enum-validated write. Idempotent per member per date
// (doc ID is the date).
export async function nutritionReview(geminiApiKey: string): Promise<void> {
  const today = todayBrisbane()
  const dayStart = new Date(`${today}T00:00:00+10:00`)

  const teamsSnap = await db.collection('teams').get()
  // Dedupe members across teams so each gets exactly one review.
  const memberTeams = new Map<string, string[]>()
  const teamEventMs = new Map<string, number>()
  for (const teamDoc of teamsSnap.docs) {
    const data = teamDoc.data()
    teamEventMs.set(
      teamDoc.id,
      (data.eventDate?.toMillis?.() as number | undefined) ?? Date.now(),
    )
    for (const uid of (data.memberIds as string[] | undefined) ?? []) {
      memberTeams.set(uid, [...(memberTeams.get(uid) ?? []), teamDoc.id])
    }
  }

  for (const [uid, teamIds] of memberTeams) {
    try {
      const profile = (await db.doc(`users/${uid}`).get()).data() as
        | {
            aiMealsEnabled?: boolean
            mealPrefs?: { macroFocus?: string }
          }
        | undefined

      // Cheap pre-gate: skip the meals query entirely when the toggle is off.
      if (shouldReview(profile, 1) === 'skip-disabled') {
        logger.info('nutritionReview skip (ai disabled)', { uid })
        continue
      }

      const mealsSnap = await db
        .collection(`users/${uid}/meals`)
        .where('date', '==', today)
        .where('status', '==', 'logged')
        .get()
      if (shouldReview(profile, mealsSnap.size) === 'skip-empty') {
        logger.info('nutritionReview skip (no meals logged)', { uid })
        continue
      }

      const meals: ReviewMeal[] = mealsSnap.docs.map((d) => ({
        slot: (d.data().slot as string) ?? 'snack',
        text: (d.data().textSnapshot as string) ?? '',
        tag: (d.data().tag as string | null) ?? null,
        portionNote: (d.data().portionNote as string | undefined) ?? '',
      }))

      // Today's completed training across all their teams.
      const sessions: ReviewSession[] = []
      for (const teamId of teamIds) {
        const sessionsSnap = await db
          .collection(`teams/${teamId}/sessions`)
          .where('startedAt', '>=', dayStart)
          .get()
        for (const doc of sessionsSnap.docs) {
          const data = doc.data()
          if (data.uid !== uid) continue
          sessions.push({
            type: (data.type as string) ?? 'other',
            durationMin: (data.durationMin as number) ?? 0,
            distanceKm: (data.distanceKm as number | undefined) ?? null,
            perceivedEffort: (data.perceivedEffort as number) ?? 5,
          })
        }
      }
      const trainingSummary = summariseTraining(sessions)

      const prompt = buildReviewPrompt({
        date: today,
        phase: phaseFor(
          Date.now(),
          teamEventMs.get(teamIds[0]) ?? Date.now(),
        ),
        macroFocus: profile?.mealPrefs?.macroFocus ?? 'balanced',
        meals,
        trainingSummary,
      })

      // One repair retry, then neutral fallback (R13.9).
      let reviewDoc: Record<string, unknown> | null = null
      let attemptPrompt = prompt
      for (let attempt = 0; attempt < 2 && !reviewDoc; attempt++) {
        try {
          const parsed = reviewSchema.parse(
            await geminiJson(geminiApiKey, attemptPrompt),
          )
          reviewDoc = {
            ...parsed,
            mealCount: mealsSnap.size,
            trainingSummary,
            promptVersion: REVIEW_PROMPT_VERSION,
            createdAt: new Date(),
          }
        } catch (error) {
          attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${String(error).slice(0, 200)}). Return ONLY corrected JSON with the exact verdict enum.`
        }
      }
      reviewDoc = reviewDoc ?? neutralReview(mealsSnap.size, trainingSummary)

      await db.doc(`users/${uid}/nutritionReviews/${today}`).set(reviewDoc)
      for (const teamId of teamIds) {
        await db.doc(`teams/${teamId}/fuelling/${uid}`).set(
          {
            date: today,
            mealCount: mealsSnap.size,
            review: { date: today, verdict: reviewDoc.verdict },
            updatedAt: new Date(),
          },
          { merge: true },
        )
      }
      logger.info('nutritionReview written', { uid, verdict: reviewDoc.verdict })
    } catch (error) {
      // One member's failure never blocks the rest.
      logger.error('nutritionReview failed for member', { uid, error })
    }
  }
}
