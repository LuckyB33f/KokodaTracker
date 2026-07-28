"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROMPT_VERSION = void 0;
exports.planIssues = planIssues;
exports.generatePlanHandler = generatePlanHandler;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const admin_1 = require("../lib/admin");
const gemini_1 = require("../lib/gemini");
const weekKey_1 = require("../lib/weekKey");
const verdict_1 = require("../logic/verdict");
exports.PROMPT_VERSION = 1;
const DAILY_QUOTA = 5;
const planDaySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    memberUid: zod_1.z.string().nullable(),
    title: zod_1.z.string().min(1).max(80),
    detail: zod_1.z.string().min(1).max(300),
    targetType: zod_1.z.enum(['duration', 'distance', 'rest']),
    targetValue: zod_1.z.number().min(0).max(1440),
});
const planSchema = zod_1.z.object({ days: zod_1.z.array(planDaySchema).min(7).max(60) });
function phaseFor(nowMs, eventDateMs) {
    const weeks = (eventDateMs - nowMs) / (7 * 24 * 60 * 60 * 1000);
    if (weeks <= 3)
        return 'taper';
    if (weeks <= 10)
        return 'peak';
    if (weeks <= 20)
        return 'build2';
    if (weeks <= 32)
        return 'build1';
    return 'base';
}
function buildPrompt(args) {
    return `You are a trail-endurance coach writing ONE week of training for a small team preparing for the Kokoda Challenge (${args.distanceKm} km trail event on ${args.eventDate}). Current phase: ${args.phase}. Week: ${args.weekKey}.

Members (28-day history and hard constraints):
${args.members
        .map((member) => `- uid "${member.uid}" (${member.displayName}): ${member.sessions28d} sessions, ${member.hours28d}h, ${member.km28d}km, ${member.elevation28d}m climbed, longest hike ${member.longestHikeKm}km. Readiness: ${member.verdict} (${member.verdictReason}). HARD LOAD CEILING for the week: ${member.ceiling} load-units (load = minutes × effort 1-10). Do not exceed it.`)
        .join('\n')}

Rules (non-negotiable):
- Return JSON ONLY matching: {"days":[{"date":"YYYY-MM-DD","memberUid":"<uid or null>","title":"...","detail":"...","targetType":"duration|distance|rest","targetValue":<number>}]}
- Use ONLY these dates (Monday to Sunday of week ${args.weekKey}): ${args.weekDates.join(', ')}.
- Use ONLY the member uids listed above (or null for the whole team).
- Saturday ${args.weekDates[5]} is the mandatory whole-team hike: one entry with memberUid null.
- Per member: include at least 2 rest days (targetType "rest", targetValue 0).
- Respect each member's ceiling; scale_back members get a recovery week.
- duration targetValue is minutes; distance targetValue is km.
- General fitness guidance only — no medical advice; keep detail practical (terrain, pacing, water).`;
}
// Semantic checks Zod can't express — wrong dates, unknown uids, a missing
// Saturday team hike or missing rest days all go back to Gemini for repair.
function planIssues(days, memberIds, weekDates) {
    const issues = [];
    const dateSet = new Set(weekDates);
    const uidSet = new Set(memberIds);
    for (const day of days) {
        if (!dateSet.has(day.date))
            issues.push(`date ${day.date} is not in week ${weekDates[0]}..${weekDates[6]}`);
        if (day.memberUid !== null && !uidSet.has(day.memberUid))
            issues.push(`unknown memberUid "${day.memberUid}"`);
        if (day.targetType === 'rest' && day.targetValue !== 0)
            issues.push(`rest day ${day.date} must have targetValue 0`);
    }
    if (!days.some((d) => d.date === weekDates[5] && d.memberUid === null)) {
        issues.push(`missing the whole-team Saturday hike (memberUid null on ${weekDates[5]})`);
    }
    for (const uid of memberIds) {
        const rest = days.filter((d) => d.memberUid === uid && d.targetType === 'rest').length;
        if (rest < 2)
            issues.push(`member ${uid} has ${rest} rest day(s); needs at least 2`);
    }
    return [...new Set(issues)].slice(0, 10);
}
async function generatePlanHandler({ geminiApiKey, uid, }) {
    // Quota: 5 generations per user per Brisbane day (spec §2.2).
    const quotaRef = admin_1.db.doc(`usage/${uid}_${(0, weekKey_1.todayBrisbane)()}`);
    const quotaSnap = await quotaRef.get();
    const used = quotaSnap.data()?.count ?? 0;
    if (used >= DAILY_QUOTA) {
        throw new https_1.HttpsError('resource-exhausted', 'Daily plan-generation limit reached (5). Try again tomorrow.');
    }
    const userSnap = await admin_1.db.doc(`users/${uid}`).get();
    const teamId = userSnap.data()?.activeTeamId;
    if (!teamId)
        throw new https_1.HttpsError('failed-precondition', 'Join a team first.');
    const teamRef = admin_1.db.doc(`teams/${teamId}`);
    const teamSnap = await teamRef.get();
    const team = teamSnap.data();
    if (!team || !team.memberIds.includes(uid)) {
        throw new https_1.HttpsError('permission-denied', 'Not a member of this team.');
    }
    if (team.createdBy !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Only the captain can generate the plan.');
    }
    const now = new Date();
    const weekKey = (0, weekKey_1.weekKeyFor)(now);
    const phase = phaseFor(now.getTime(), team.eventDate.toMillis());
    // 28-day aggregates per member.
    const since = firestore_1.Timestamp.fromMillis(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const sessionsSnap = await teamRef
        .collection('sessions')
        .where('startedAt', '>=', since)
        .get();
    const sessions = sessionsSnap.docs.map((d) => d.data());
    const membersSnap = await teamRef.collection('members').get();
    const nameOf = new Map(membersSnap.docs.map((d) => [d.id, d.data().displayName]));
    const lastWeekKey = (0, weekKey_1.weekKeyFor)(new Date(now.getTime() - 7 * 86400000));
    const members = [];
    for (const memberUid of team.memberIds) {
        const mine = sessions.filter((s) => s.uid === memberUid);
        const metricSnap = await teamRef
            .collection('memberMetrics')
            .doc(`${memberUid}_${lastWeekKey}`)
            .get();
        const verdict = metricSnap.data()?.verdict ?? 'hold';
        const verdictReason = metricSnap.data()?.reason ??
            'No readiness history yet — holding steady.';
        const lastWeekLoad = mine
            .filter((s) => s.weekKey === lastWeekKey)
            .reduce((sum, s) => sum + s.durationMin * (s.perceivedEffort || 5), 0);
        members.push({
            uid: memberUid,
            displayName: nameOf.get(memberUid) ?? 'Member',
            sessions28d: mine.length,
            hours28d: Math.round((mine.reduce((sum, s) => sum + s.durationMin, 0) / 60) *
                10) / 10,
            km28d: Math.round(mine.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0) * 10) / 10,
            elevation28d: Math.round(mine.reduce((sum, s) => sum + (s.elevationGainM ?? 0), 0)),
            longestHikeKm: Math.max(0, ...mine
                .filter((s) => s.type === 'hike')
                .map((s) => s.distanceKm ?? 0)),
            lastWeekLoad,
            verdict,
            verdictReason,
            ceiling: (0, verdict_1.loadCeiling)(lastWeekLoad, verdict),
        });
    }
    const weekDates = (0, weekKey_1.brisbaneWeekDates)(now);
    const prompt = buildPrompt({
        eventDate: team.eventDate.toDate().toISOString().slice(0, 10),
        distanceKm: team.eventDistanceKm,
        phase,
        weekKey,
        weekDates,
        members,
    });
    // Gemini → Zod + semantic checks → one retry-with-repair (spec §2.4).
    let parsed = null;
    let attemptPrompt = prompt;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        let problems;
        try {
            const candidate = planSchema.parse(await (0, gemini_1.geminiJson)(geminiApiKey, attemptPrompt));
            const issues = planIssues(candidate.days, team.memberIds, weekDates);
            if (issues.length === 0) {
                parsed = candidate;
                break;
            }
            problems = issues.join('; ');
        }
        catch (error) {
            // Billing/quota/auth failures can't be repaired by re-prompting —
            // surface the real reason instead of "invalid plan twice".
            if ((0, gemini_1.isGeminiApiError)(error)) {
                throw new https_1.HttpsError('unavailable', error.message);
            }
            problems = String(error).slice(0, 200);
        }
        firebase_functions_1.logger.warn('plan attempt rejected', { attempt, problems });
        attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${problems.slice(0, 600)}). Return ONLY corrected JSON matching the schema and every rule above.`;
    }
    if (!parsed) {
        throw new https_1.HttpsError('internal', 'The AI returned an invalid plan twice — try again in a minute.');
    }
    // Enforce ceilings in code: clamp duration-type load (minutes × assumed
    // effort 6) so the model can never exceed a member's cap.
    for (const member of members) {
        const memberDays = parsed.days.filter((d) => d.memberUid === member.uid);
        const plannedLoad = memberDays
            .filter((d) => d.targetType === 'duration')
            .reduce((sum, d) => sum + d.targetValue * 6, 0);
        if (plannedLoad > member.ceiling * 1.05) {
            const scale = member.ceiling / plannedLoad;
            for (const day of memberDays) {
                if (day.targetType === 'duration') {
                    day.targetValue = Math.max(0, Math.round(day.targetValue * scale));
                }
            }
        }
    }
    // Supersede prior active plan + write the new one atomically.
    const batch = admin_1.db.batch();
    const activeSnap = await teamRef
        .collection('plans')
        .where('status', '==', 'active')
        .get();
    for (const doc of activeSnap.docs) {
        batch.update(doc.ref, { status: 'superseded' });
    }
    const planRef = teamRef.collection('plans').doc();
    batch.set(planRef, {
        generatedAt: new Date(),
        model: gemini_1.GEMINI_MODEL,
        promptVersion: exports.PROMPT_VERSION,
        phase,
        weekKey,
        status: 'active',
        readinessInputs: Object.fromEntries(members.map((m) => [
            m.uid,
            { verdict: m.verdict, reason: m.verdictReason, ceiling: m.ceiling },
        ])),
        days: parsed.days,
    });
    batch.set(quotaRef, { count: used + 1, updatedAt: new Date() }, { merge: true });
    await batch.commit();
    return { planId: planRef.id };
}
//# sourceMappingURL=generatePlan.js.map