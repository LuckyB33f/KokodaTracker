import { logger } from 'firebase-functions'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from '../lib/admin'
import { GEMINI_MODEL, geminiJson, isGeminiApiError } from '../lib/gemini'
import { todayBrisbane } from '../lib/weekKey'
import {
  buildExerciseHistory,
  buildStrengthAdvicePrompt,
  strengthAdviceSchema,
  type StrengthSessionRecord,
} from '../logic/strengthAdvice'

const DAILY_QUOTA = 10
const HISTORY_DAYS = 84

// F3.1: same org-policy-safe queue pattern as onPlanRequest, but the request
// doc is keyed by uid — re-requesting resets the one doc to 'pending' and the
// advice is written back into it, so the collection never grows.
export async function handleStrengthAdviceRequest(args: {
  geminiApiKey: string
  teamId: string
  uid: string
}): Promise<void> {
  const { geminiApiKey, teamId, uid } = args
  const requestRef = db.doc(`teams/${teamId}/strengthAdviceRequests/${uid}`)

  // Claim atomically — Eventarc delivery is at-least-once.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef)
    if (!snap.exists || snap.data()?.status !== 'pending') return false
    tx.update(requestRef, { status: 'processing', updatedAt: new Date() })
    return true
  })
  if (!claimed) return

  try {
    // Rules already guarantee docId == requestedBy == a team member's uid;
    // re-verify membership server-side anyway.
    const team = (await db.doc(`teams/${teamId}`).get()).data() as
      | { memberIds: string[]; eventDistanceKm: number; eventDate: Timestamp }
      | undefined
    if (!team || !team.memberIds.includes(uid)) {
      throw Object.assign(new Error('Not a member of this team.'), {
        code: 'permission-denied',
      })
    }

    const quotaRef = db.doc(`usage/strength_${uid}_${todayBrisbane()}`)
    const used = ((await quotaRef.get()).data()?.count as number | undefined) ?? 0
    if (used >= DAILY_QUOTA) {
      throw Object.assign(
        new Error(`Daily coaching limit reached (${DAILY_QUOTA}). Try again tomorrow.`),
        { code: 'resource-exhausted' },
      )
    }

    const since = Timestamp.fromMillis(Date.now() - HISTORY_DAYS * 86400000)
    const sessionsSnap = await db
      .collection(`teams/${teamId}/sessions`)
      .where('startedAt', '>=', since)
      .get()
    const sessions: StrengthSessionRecord[] = sessionsSnap.docs
      .map((doc) => doc.data())
      .filter((data) => data.uid === uid && data.type === 'strength')
      .map((data) => ({
        startedAtMs:
          data.startedAt instanceof Timestamp
            ? data.startedAt.toMillis()
            : Date.now(),
        durationMin: (data.durationMin as number) ?? 0,
        perceivedEffort: (data.perceivedEffort as number) ?? 5,
        exercises:
          (data.exercises as StrengthSessionRecord['exercises'] | undefined) ??
          [],
      }))

    const weeksToEvent = team.eventDate
      ? Math.max(
          0,
          Math.round((team.eventDate.toMillis() - Date.now()) / (7 * 86400000)),
        )
      : null
    const prompt = buildStrengthAdvicePrompt({
      history: buildExerciseHistory(sessions),
      sessionCount: sessions.length,
      weeksToEvent,
      eventDistanceKm: team.eventDistanceKm ?? null,
    })

    // Gemini → Zod → one retry-with-repair (same shape as plan generation).
    let advice: ReturnType<typeof strengthAdviceSchema.parse> | null = null
    let attemptPrompt = prompt
    for (let attempt = 0; attempt < 2 && !advice; attempt++) {
      try {
        advice = strengthAdviceSchema.parse(
          await geminiJson(geminiApiKey, attemptPrompt),
        )
      } catch (error) {
        // Billing/quota/auth errors can't be repaired by re-prompting.
        if (isGeminiApiError(error)) throw error
        logger.warn('strength advice attempt rejected', {
          uid,
          attempt,
          problems: String(error).slice(0, 300),
        })
        attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${String(error).slice(0, 300)}). Return ONLY corrected JSON matching the schema.`
      }
    }
    if (!advice) {
      throw Object.assign(
        new Error('The AI returned invalid advice twice — try again in a minute.'),
        { code: 'internal' },
      )
    }

    await quotaRef.set(
      { count: used + 1, updatedAt: new Date() },
      { merge: true },
    )
    await requestRef.update({
      status: 'done',
      advice,
      model: GEMINI_MODEL,
      updatedAt: new Date(),
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    logger.error('strength advice failed', { teamId, uid, error })
    await requestRef.update({
      status: 'error',
      errorCode: err.code ?? 'internal',
      errorMessage: err.message ?? 'Coaching advice failed. Try again.',
      updatedAt: new Date(),
    })
  }
}
