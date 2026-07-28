import { logger } from 'firebase-functions'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db } from '../lib/admin'
import { GEMINI_MODEL, geminiJson, isGeminiApiError } from '../lib/gemini'
import { brisbaneWeekDates, todayBrisbane, weekKeyFor } from '../lib/weekKey'
import {
  DEFAULT_MEAL_PREFS,
  MEAL_PLAN_PROMPT_VERSION,
  buildMealPlanPrompt,
  libraryCoveragePct,
  mealPlanIssues,
  mealPlanSchema,
  type LibraryEntry,
  type MealPrefs,
  type TrainingDay,
} from '../logic/mealPlan'

const DAILY_MEAL_PLAN_QUOTA = 3

function phaseFor(nowMs: number, eventDateMs: number): string {
  const weeks = (eventDateMs - nowMs) / (7 * 24 * 60 * 60 * 1000)
  if (weeks <= 3) return 'taper'
  if (weeks <= 10) return 'peak'
  if (weeks <= 20) return 'build2'
  if (weeks <= 32) return 'build1'
  return 'base'
}

type TargetResult = 'done' | 'skipped-disabled' | 'error'

// F13A queue worker — same org-policy-safe shape as onPlanRequest: rules
// guarantee only members create requests ('team' scope: captain only); the
// trigger re-verifies everything and fans out one personalised plan per
// AI-enabled member.
export async function handleMealPlanRequest(args: {
  geminiApiKey: string
  teamId: string
  requestId: string
}): Promise<void> {
  const { geminiApiKey, teamId, requestId } = args
  const requestRef = db.doc(`teams/${teamId}/mealPlanRequests/${requestId}`)

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef)
    if (!snap.exists || snap.data()?.status !== 'pending') return false
    tx.update(requestRef, { status: 'processing', updatedAt: new Date() })
    return true
  })
  if (!claimed) {
    logger.info('mealPlanRequest already claimed, skipping', {
      teamId,
      requestId,
    })
    return
  }

  const request = (await requestRef.get()).data() as
    | { requestedBy?: string; scope?: string }
    | undefined
  const requestedBy = request?.requestedBy
  const scope = request?.scope === 'team' ? 'team' : 'self'

  try {
    if (!requestedBy) {
      throw Object.assign(new Error('Request has no requester.'), {
        code: 'invalid-argument',
      })
    }
    const teamSnap = await db.doc(`teams/${teamId}`).get()
    const team = teamSnap.data() as
      | {
          createdBy: string
          memberIds: string[]
          eventDistanceKm: number
          eventDate: Timestamp
        }
      | undefined
    if (!team || !team.memberIds.includes(requestedBy)) {
      throw Object.assign(new Error('Requester is not a team member.'), {
        code: 'permission-denied',
      })
    }
    if (scope === 'team' && team.createdBy !== requestedBy) {
      throw Object.assign(
        new Error('Only the captain can generate for the team.'),
        { code: 'permission-denied' },
      )
    }

    const now = new Date()
    const weekKey = weekKeyFor(now)
    const weekDates = brisbaneWeekDates(now)
    const phase = phaseFor(now.getTime(), team.eventDate.toMillis())
    const today = todayBrisbane()

    // Active training plan → per-member training days for the prompt.
    const activePlanSnap = await db
      .collection(`teams/${teamId}/plans`)
      .where('status', '==', 'active')
      .limit(1)
      .get()
    const planDays =
      (activePlanSnap.docs[0]?.data()?.days as
        | Array<{
            date: string
            memberUid: string | null
            title: string
            targetType: string
            targetValue: number
          }>
        | undefined) ?? []

    const membersSnap = await db.collection(`teams/${teamId}/members`).get()
    const nameOf = new Map(
      membersSnap.docs.map((d) => [d.id, d.data().displayName as string]),
    )

    const targets = scope === 'team' ? team.memberIds : [requestedBy]
    const results: Record<string, TargetResult> = {}
    let firstError: string | null = null

    for (const uid of targets) {
      try {
        const userSnap = await db.doc(`users/${uid}`).get()
        const userData = userSnap.data() ?? {}
        // AI toggle gate — checked server-side before any Gemini work.
        if (userData.aiMealsEnabled === false) {
          results[uid] = 'skipped-disabled'
          continue
        }
        const prefs: MealPrefs = {
          ...DEFAULT_MEAL_PREFS,
          ...((userData.mealPrefs as Partial<MealPrefs> | undefined) ?? {}),
        }

        const quotaRef = db.doc(`usage/meal_${uid}_${today}`)
        const used =
          ((await quotaRef.get()).data()?.count as number | undefined) ?? 0
        if (used >= DAILY_MEAL_PLAN_QUOTA) {
          results[uid] = 'error'
          firstError =
            firstError ??
            `Daily meal-plan limit reached (${DAILY_MEAL_PLAN_QUOTA}). Try again tomorrow.`
          continue
        }

        const librarySnap = await db
          .collection(`users/${uid}/mealLibrary`)
          .get()
        const library: LibraryEntry[] = librarySnap.docs
          .map((d) => ({
            id: d.id,
            text: (d.data().text as string) ?? '',
            tag: (d.data().tag as string | null) ?? null,
            favourite: Boolean(d.data().favourite),
            hidden: Boolean(d.data().hidden),
            useCount: (d.data().useCount as number) ?? 0,
          }))
          .filter((item) => !item.hidden && item.text)
          .sort((a, b) => b.useCount - a.useCount)
          .slice(0, 40)

        const trainingDays: TrainingDay[] = planDays
          .filter(
            (d) =>
              (d.memberUid === uid || d.memberUid === null) &&
              d.targetType !== 'rest' &&
              weekDates.includes(d.date),
          )
          .map((d) => ({
            date: d.date,
            title: d.title,
            targetType: d.targetType,
            targetValue: d.targetValue,
          }))

        const prompt = buildMealPlanPrompt({
          displayName: nameOf.get(uid) ?? 'a team member',
          eventDate: team.eventDate.toDate().toISOString().slice(0, 10),
          distanceKm: team.eventDistanceKm,
          phase,
          weekKey,
          weekDates,
          prefs,
          library,
          trainingDays,
        })

        const libraryIds = new Set(library.map((item) => item.id))
        const trainingDates = new Set(trainingDays.map((d) => d.date))

        // Gemini → Zod + semantic checks → one retry-with-repair.
        let parsed: z.infer<typeof mealPlanSchema> | null = null
        let attemptPrompt = prompt
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          let problems: string
          try {
            const candidate = mealPlanSchema.parse(
              await geminiJson(geminiApiKey, attemptPrompt),
            )
            const issues = mealPlanIssues(candidate.days, {
              weekDates,
              prefs,
              libraryIds,
              trainingDates,
            })
            if (issues.length === 0) {
              parsed = candidate
              break
            }
            problems = issues.join('; ')
          } catch (error) {
            // Billing/quota/auth errors can't be repaired by re-prompting —
            // bubble up so the member sees the real reason.
            if (isGeminiApiError(error)) throw error
            problems = String(error).slice(0, 200)
          }
          logger.warn('meal plan attempt rejected', { uid, attempt, problems })
          attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${problems.slice(0, 600)}). Return ONLY corrected JSON matching the schema and every rule above.`
        }
        if (!parsed) {
          results[uid] = 'error'
          firstError =
            firstError ??
            'The AI returned an invalid meal plan twice — try again in a minute.'
          continue
        }

        const planRef = db.doc(`users/${uid}/mealPlans/${weekKey}`)
        const priorVersion =
          ((await planRef.get()).data()?.version as number | undefined) ?? 0
        const batch = db.batch()
        batch.set(planRef, {
          generatedAt: new Date(),
          model: GEMINI_MODEL,
          promptVersion: MEAL_PLAN_PROMPT_VERSION,
          phase,
          weekKey,
          version: priorVersion + 1,
          prefsSnapshot: prefs,
          libraryCoveragePct: libraryCoveragePct(parsed.days),
          days: parsed.days,
        })
        batch.set(
          quotaRef,
          { count: used + 1, updatedAt: new Date() },
          { merge: true },
        )
        await batch.commit()
        results[uid] = 'done'
      } catch (error) {
        logger.error('meal plan generation failed for member', {
          teamId,
          requestId,
          uid,
          error,
        })
        results[uid] = 'error'
        firstError =
          firstError ?? (error as { message?: string }).message ?? 'Failed.'
      }
    }

    const anyDone = Object.values(results).some((r) => r === 'done')
    const allDisabled =
      Object.values(results).length > 0 &&
      Object.values(results).every((r) => r === 'skipped-disabled')
    await requestRef.update({
      status: anyDone || allDisabled ? 'done' : 'error',
      results,
      ...(anyDone || allDisabled
        ? {}
        : {
            errorCode: 'internal',
            errorMessage: firstError ?? 'Meal plan generation failed.',
          }),
      updatedAt: new Date(),
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    logger.error('meal plan request failed', { teamId, requestId, error })
    await requestRef.update({
      status: 'error',
      errorCode: err.code ?? 'internal',
      errorMessage: err.message ?? 'Meal plan generation failed. Try again.',
      updatedAt: new Date(),
    })
  }

  // Housekeeping: drop requests older than 7 days.
  const stale = await db
    .collection(`teams/${teamId}/mealPlanRequests`)
    .where('createdAt', '<', new Date(Date.now() - 7 * 86400000))
    .limit(20)
    .get()
  if (!stale.empty) {
    const batch = db.batch()
    for (const doc of stale.docs) batch.delete(doc.ref)
    await batch.commit()
  }
}
