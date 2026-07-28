import { HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db } from '../lib/admin'
import { geminiJson } from '../lib/gemini'
import { brisbaneWeekDates, weekKeyFor, todayBrisbane } from '../lib/weekKey'
import { loadCeiling, type Verdict } from '../logic/verdict'

export const PROMPT_VERSION = 1
const DAILY_QUOTA = 5

const planDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberUid: z.string().nullable(),
  title: z.string().min(1).max(80),
  detail: z.string().min(1).max(300),
  targetType: z.enum(['duration', 'distance', 'rest']),
  targetValue: z.number().min(0).max(1440),
})
const planSchema = z.object({ days: z.array(planDaySchema).min(7).max(60) })

interface MemberAggregates {
  uid: string
  displayName: string
  sessions28d: number
  hours28d: number
  km28d: number
  elevation28d: number
  longestHikeKm: number
  lastWeekLoad: number
  verdict: Verdict
  verdictReason: string
  ceiling: number
}

function phaseFor(nowMs: number, eventDateMs: number): string {
  const weeks = (eventDateMs - nowMs) / (7 * 24 * 60 * 60 * 1000)
  if (weeks <= 3) return 'taper'
  if (weeks <= 10) return 'peak'
  if (weeks <= 20) return 'build2'
  if (weeks <= 32) return 'build1'
  return 'base'
}

function buildPrompt(args: {
  eventDate: string
  distanceKm: number
  phase: string
  weekKey: string
  weekDates: string[]
  members: MemberAggregates[]
}): string {
  return `You are a trail-endurance coach writing ONE week of training for a small team preparing for the Kokoda Challenge (${args.distanceKm} km trail event on ${args.eventDate}). Current phase: ${args.phase}. Week: ${args.weekKey}.

Members (28-day history and hard constraints):
${args.members
  .map(
    (member) =>
      `- uid "${member.uid}" (${member.displayName}): ${member.sessions28d} sessions, ${member.hours28d}h, ${member.km28d}km, ${member.elevation28d}m climbed, longest hike ${member.longestHikeKm}km. Readiness: ${member.verdict} (${member.verdictReason}). HARD LOAD CEILING for the week: ${member.ceiling} load-units (load = minutes × effort 1-10). Do not exceed it.`,
  )
  .join('\n')}

Rules (non-negotiable):
- Return JSON ONLY matching: {"days":[{"date":"YYYY-MM-DD","memberUid":"<uid or null>","title":"...","detail":"...","targetType":"duration|distance|rest","targetValue":<number>}]}
- Use ONLY these dates (Monday to Sunday of week ${args.weekKey}): ${args.weekDates.join(', ')}.
- Use ONLY the member uids listed above (or null for the whole team).
- Saturday ${args.weekDates[5]} is the mandatory whole-team hike: one entry with memberUid null.
- Per member: include at least 2 rest days (targetType "rest", targetValue 0).
- Respect each member's ceiling; scale_back members get a recovery week.
- duration targetValue is minutes; distance targetValue is km.
- General fitness guidance only — no medical advice; keep detail practical (terrain, pacing, water).`
}

// Semantic checks Zod can't express — wrong dates, unknown uids, a missing
// Saturday team hike or missing rest days all go back to Gemini for repair.
export function planIssues(
  days: z.infer<typeof planSchema>['days'],
  memberIds: string[],
  weekDates: string[],
): string[] {
  const issues: string[] = []
  const dateSet = new Set(weekDates)
  const uidSet = new Set(memberIds)
  for (const day of days) {
    if (!dateSet.has(day.date))
      issues.push(`date ${day.date} is not in week ${weekDates[0]}..${weekDates[6]}`)
    if (day.memberUid !== null && !uidSet.has(day.memberUid))
      issues.push(`unknown memberUid "${day.memberUid}"`)
    if (day.targetType === 'rest' && day.targetValue !== 0)
      issues.push(`rest day ${day.date} must have targetValue 0`)
  }
  if (!days.some((d) => d.date === weekDates[5] && d.memberUid === null)) {
    issues.push(`missing the whole-team Saturday hike (memberUid null on ${weekDates[5]})`)
  }
  for (const uid of memberIds) {
    const rest = days.filter(
      (d) => d.memberUid === uid && d.targetType === 'rest',
    ).length
    if (rest < 2) issues.push(`member ${uid} has ${rest} rest day(s); needs at least 2`)
  }
  return [...new Set(issues)].slice(0, 10)
}

export interface GeneratePlanDeps {
  geminiApiKey: string
  uid: string
}

export async function generatePlanHandler({
  geminiApiKey,
  uid,
}: GeneratePlanDeps): Promise<{ planId: string }> {
  // Quota: 5 generations per user per Brisbane day (spec §2.2).
  const quotaRef = db.doc(`usage/${uid}_${todayBrisbane()}`)
  const quotaSnap = await quotaRef.get()
  const used = (quotaSnap.data()?.count as number | undefined) ?? 0
  if (used >= DAILY_QUOTA) {
    throw new HttpsError(
      'resource-exhausted',
      'Daily plan-generation limit reached (5). Try again tomorrow.',
    )
  }

  const userSnap = await db.doc(`users/${uid}`).get()
  const teamId = userSnap.data()?.activeTeamId as string | undefined
  if (!teamId) throw new HttpsError('failed-precondition', 'Join a team first.')

  const teamRef = db.doc(`teams/${teamId}`)
  const teamSnap = await teamRef.get()
  const team = teamSnap.data() as
    | {
        createdBy: string
        memberIds: string[]
        eventDistanceKm: number
        eventDate: Timestamp
      }
    | undefined
  if (!team || !team.memberIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'Not a member of this team.')
  }
  if (team.createdBy !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Only the captain can generate the plan.',
    )
  }

  const now = new Date()
  const weekKey = weekKeyFor(now)
  const phase = phaseFor(now.getTime(), team.eventDate.toMillis())

  // 28-day aggregates per member.
  const since = Timestamp.fromMillis(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const sessionsSnap = await teamRef
    .collection('sessions')
    .where('startedAt', '>=', since)
    .get()
  const sessions = sessionsSnap.docs.map((d) => d.data())

  const membersSnap = await teamRef.collection('members').get()
  const nameOf = new Map(
    membersSnap.docs.map((d) => [d.id, d.data().displayName as string]),
  )

  const lastWeekKey = weekKeyFor(new Date(now.getTime() - 7 * 86400000))
  const members: MemberAggregates[] = []
  for (const memberUid of team.memberIds) {
    const mine = sessions.filter((s) => s.uid === memberUid)
    const metricSnap = await teamRef
      .collection('memberMetrics')
      .doc(`${memberUid}_${lastWeekKey}`)
      .get()
    const verdict = (metricSnap.data()?.verdict as Verdict | undefined) ?? 'hold'
    const verdictReason =
      (metricSnap.data()?.reason as string | undefined) ??
      'No readiness history yet — holding steady.'
    const lastWeekLoad = mine
      .filter((s) => s.weekKey === lastWeekKey)
      .reduce(
        (sum, s) =>
          sum + (s.durationMin as number) * ((s.perceivedEffort as number) || 5),
        0,
      )
    members.push({
      uid: memberUid,
      displayName: nameOf.get(memberUid) ?? 'Member',
      sessions28d: mine.length,
      hours28d:
        Math.round(
          (mine.reduce((sum, s) => sum + (s.durationMin as number), 0) / 60) *
            10,
        ) / 10,
      km28d:
        Math.round(
          mine.reduce((sum, s) => sum + ((s.distanceKm as number) ?? 0), 0) * 10,
        ) / 10,
      elevation28d: Math.round(
        mine.reduce((sum, s) => sum + ((s.elevationGainM as number) ?? 0), 0),
      ),
      longestHikeKm: Math.max(
        0,
        ...mine
          .filter((s) => s.type === 'hike')
          .map((s) => (s.distanceKm as number) ?? 0),
      ),
      lastWeekLoad,
      verdict,
      verdictReason,
      ceiling: loadCeiling(lastWeekLoad, verdict),
    })
  }

  const weekDates = brisbaneWeekDates(now)
  const prompt = buildPrompt({
    eventDate: team.eventDate.toDate().toISOString().slice(0, 10),
    distanceKm: team.eventDistanceKm,
    phase,
    weekKey,
    weekDates,
    members,
  })

  // Gemini → Zod + semantic checks → one retry-with-repair (spec §2.4).
  let parsed: z.infer<typeof planSchema> | null = null
  let attemptPrompt = prompt
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    let problems: string
    try {
      const candidate = planSchema.parse(
        await geminiJson(geminiApiKey, attemptPrompt),
      )
      const issues = planIssues(candidate.days, team.memberIds, weekDates)
      if (issues.length === 0) {
        parsed = candidate
        break
      }
      problems = issues.join('; ')
    } catch (error) {
      problems = String(error).slice(0, 200)
    }
    attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${problems.slice(
      0,
      600,
    )}). Return ONLY corrected JSON matching the schema and every rule above.`
  }
  if (!parsed) {
    throw new HttpsError(
      'internal',
      'The AI returned an invalid plan twice — try again in a minute.',
    )
  }

  // Enforce ceilings in code: clamp duration-type load (minutes × assumed
  // effort 6) so the model can never exceed a member's cap.
  for (const member of members) {
    const memberDays = parsed.days.filter((d) => d.memberUid === member.uid)
    const plannedLoad = memberDays
      .filter((d) => d.targetType === 'duration')
      .reduce((sum, d) => sum + d.targetValue * 6, 0)
    if (plannedLoad > member.ceiling * 1.05) {
      const scale = member.ceiling / plannedLoad
      for (const day of memberDays) {
        if (day.targetType === 'duration') {
          day.targetValue = Math.max(0, Math.round(day.targetValue * scale))
        }
      }
    }
  }

  // Supersede prior active plan + write the new one atomically.
  const batch = db.batch()
  const activeSnap = await teamRef
    .collection('plans')
    .where('status', '==', 'active')
    .get()
  for (const doc of activeSnap.docs) {
    batch.update(doc.ref, { status: 'superseded' })
  }
  const planRef = teamRef.collection('plans').doc()
  batch.set(planRef, {
    generatedAt: new Date(),
    model: 'gemini-2.5-flash',
    promptVersion: PROMPT_VERSION,
    phase,
    weekKey,
    status: 'active',
    readinessInputs: Object.fromEntries(
      members.map((m) => [
        m.uid,
        { verdict: m.verdict, reason: m.verdictReason, ceiling: m.ceiling },
      ]),
    ),
    days: parsed.days,
  })
  batch.set(
    quotaRef,
    { count: used + 1, updatedAt: new Date() },
    { merge: true },
  )
  await batch.commit()

  return { planId: planRef.id }
}
