import { logger } from 'firebase-functions'
import { db } from '../lib/admin'
import { todayBrisbane } from '../lib/weekKey'

// Keeps the dashboard fuelling tile live: recount today's logged meals on
// any meal write. No Gemini, no toggle check — counts are the R11.6-approved
// aggregate. Idempotent, so Eventarc at-least-once delivery is harmless.
export async function handleMealWritten(args: {
  uid: string
  beforeDate?: string
  afterDate?: string
}): Promise<void> {
  const { uid, beforeDate, afterDate } = args
  const today = todayBrisbane()
  if (beforeDate !== today && afterDate !== today) return

  const countSnap = await db
    .collection(`users/${uid}/meals`)
    .where('date', '==', today)
    .where('status', '==', 'logged')
    .get()

  const activeTeamId = (await db.doc(`users/${uid}`).get()).data()
    ?.activeTeamId as string | undefined
  if (!activeTeamId) return

  await db.doc(`teams/${activeTeamId}/fuelling/${uid}`).set(
    { date: today, mealCount: countSnap.size, updatedAt: new Date() },
    { merge: true },
  )
  logger.info('fuelling count updated', { uid, count: countSnap.size })
}
