import { Timestamp } from 'firebase-admin/firestore'
import { db } from '../lib/admin'
import { weekKeyFor, shiftWeeks } from '../lib/weekKey'
import {
  computeAcwr,
  computeVerdict,
  type Phase,
  type VerdictResult,
} from '../logic/verdict'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function phaseFor(nowMs: number, eventDateMs: number): Phase {
  const weeksToEvent = (eventDateMs - nowMs) / WEEK_MS
  if (weeksToEvent <= 3) return 'taper'
  if (weeksToEvent <= 10) return 'peak'
  if (weeksToEvent <= 20) return 'build2'
  if (weeksToEvent <= 32) return 'build1'
  return 'base'
}

interface SessionDoc {
  uid: string
  durationMin: number
  perceivedEffort: number
  weekKey: string
}

// F9 daily metrics pass: for every team member, compute last completed week's
// metrics + verdict into teams/{id}/memberMetrics/{uid}_{weekKey}.
export async function computeMetrics(now: Date = new Date()): Promise<void> {
  const lastWeek = weekKeyFor(shiftWeeks(now, -1))
  // Loads for the 8 most recent weeks (latest = lastWeek).
  const weekKeys = [-8, -7, -6, -5, -4, -3, -2, -1].map((offset) =>
    weekKeyFor(shiftWeeks(now, offset)),
  )

  const teams = await db.collection('teams').get()
  for (const teamDoc of teams.docs) {
    const team = teamDoc.data() as {
      memberIds?: string[]
      eventDate?: Timestamp
    }
    const memberIds = team.memberIds ?? []
    const eventDateMs = team.eventDate?.toMillis() ?? now.getTime()
    const phase = phaseFor(now.getTime(), eventDateMs)

    const sessionsSnap = await teamDoc.ref
      .collection('sessions')
      .where('weekKey', 'in', weekKeys.slice(-10))
      .get()
    const sessions = sessionsSnap.docs.map((d) => d.data() as SessionDoc)

    // Active plan for last week (for completion %), if any.
    const planSnap = await teamDoc.ref
      .collection('plans')
      .where('weekKey', '==', lastWeek)
      .where('status', '==', 'active')
      .limit(1)
      .get()
    const plan = planSnap.docs[0]
    let checkoffsByUid = new Map<string, { done: number; total: number }>()
    if (plan) {
      const planDays =
        (plan.data().days as { memberUid: string | null }[] | undefined) ?? []
      const checkoffsSnap = await plan.ref.collection('checkoffs').get()
      const doneKeys = new Set(
        checkoffsSnap.docs
          .filter((d) => d.data().done === true)
          .map((d) => d.id),
      )
      checkoffsByUid = new Map(
        memberIds.map((uid) => {
          const items = planDays
            .map((day, index) => ({ day, index }))
            .filter(
              ({ day }) => day.memberUid === uid || day.memberUid === null,
            )
          const done = items.filter(({ index }) =>
            doneKeys.has(`${uid}_${index}`),
          ).length
          return [uid, { done, total: items.length }]
        }),
      )
    }

    for (const uid of memberIds) {
      const mySessions = sessions.filter((session) => session.uid === uid)
      const loadOf = (weekKey: string) =>
        mySessions
          .filter((session) => session.weekKey === weekKey)
          .reduce(
            (sum, session) =>
              sum + session.durationMin * (session.perceivedEffort || 5),
            0,
          )
      const weeklyLoads = weekKeys.map(loadOf)
      const weeksOfHistory = weeklyLoads.filter((load) => load > 0).length
      const actualLoad = weeklyLoads[weeklyLoads.length - 1]
      const acwr = computeAcwr(weeklyLoads)

      const effortWeeks = weekKeys.slice(-2).map((weekKey) => {
        const weekSessions = mySessions.filter(
          (session) => session.weekKey === weekKey,
        )
        if (weekSessions.length === 0) return null
        return (
          weekSessions.reduce(
            (sum, session) => sum + (session.perceivedEffort || 5),
            0,
          ) / weekSessions.length
        )
      })
      const avgEffort = effortWeeks[effortWeeks.length - 1]
      const sustainedHighEffort = effortWeeks.every(
        (effort) => effort !== null && effort >= 8,
      )

      const checkoff = checkoffsByUid.get(uid)
      const completionPct =
        checkoff && checkoff.total > 0
          ? Math.round((checkoff.done / checkoff.total) * 100)
          : null

      const verdict: VerdictResult = computeVerdict({
        completionPct,
        avgEffort,
        acwr,
        phase,
        weeksOfHistory,
        sustainedHighEffort,
      })

      await teamDoc.ref
        .collection('memberMetrics')
        .doc(`${uid}_${lastWeek}`)
        .set({
        uid,
        weekKey: lastWeek,
        plannedLoad: checkoff?.total ?? null,
        actualLoad,
        completionPct,
        avgEffort: avgEffort === null ? null : Math.round(avgEffort * 10) / 10,
        acwr,
        verdict: verdict.verdict,
        reason: verdict.reason,
        computedAt: new Date(),
      })
    }
  }
}
