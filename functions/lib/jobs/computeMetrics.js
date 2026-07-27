"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMetrics = computeMetrics;
const admin_1 = require("../lib/admin");
const weekKey_1 = require("../lib/weekKey");
const verdict_1 = require("../logic/verdict");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function phaseFor(nowMs, eventDateMs) {
    const weeksToEvent = (eventDateMs - nowMs) / WEEK_MS;
    if (weeksToEvent <= 3)
        return 'taper';
    if (weeksToEvent <= 10)
        return 'peak';
    if (weeksToEvent <= 20)
        return 'build2';
    if (weeksToEvent <= 32)
        return 'build1';
    return 'base';
}
// F9 daily metrics pass: for every team member, compute last completed week's
// metrics + verdict into teams/{id}/memberMetrics/{uid}_{weekKey}.
async function computeMetrics(now = new Date()) {
    const lastWeek = (0, weekKey_1.weekKeyFor)((0, weekKey_1.shiftWeeks)(now, -1));
    // Loads for the 8 most recent weeks (latest = lastWeek).
    const weekKeys = [-8, -7, -6, -5, -4, -3, -2, -1].map((offset) => (0, weekKey_1.weekKeyFor)((0, weekKey_1.shiftWeeks)(now, offset)));
    const teams = await admin_1.db.collection('teams').get();
    for (const teamDoc of teams.docs) {
        const team = teamDoc.data();
        const memberIds = team.memberIds ?? [];
        const eventDateMs = team.eventDate?.toMillis() ?? now.getTime();
        const phase = phaseFor(now.getTime(), eventDateMs);
        const sessionsSnap = await teamDoc.ref
            .collection('sessions')
            .where('weekKey', 'in', weekKeys.slice(-10))
            .get();
        const sessions = sessionsSnap.docs.map((d) => d.data());
        // Active plan for last week (for completion %), if any.
        const planSnap = await teamDoc.ref
            .collection('plans')
            .where('weekKey', '==', lastWeek)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        const plan = planSnap.docs[0];
        let checkoffsByUid = new Map();
        if (plan) {
            const planDays = plan.data().days ?? [];
            const checkoffsSnap = await plan.ref.collection('checkoffs').get();
            const doneKeys = new Set(checkoffsSnap.docs
                .filter((d) => d.data().done === true)
                .map((d) => d.id));
            checkoffsByUid = new Map(memberIds.map((uid) => {
                const items = planDays
                    .map((day, index) => ({ day, index }))
                    .filter(({ day }) => day.memberUid === uid || day.memberUid === null);
                const done = items.filter(({ index }) => doneKeys.has(`${uid}_${index}`)).length;
                return [uid, { done, total: items.length }];
            }));
        }
        for (const uid of memberIds) {
            const mySessions = sessions.filter((session) => session.uid === uid);
            const loadOf = (weekKey) => mySessions
                .filter((session) => session.weekKey === weekKey)
                .reduce((sum, session) => sum + session.durationMin * (session.perceivedEffort || 5), 0);
            const weeklyLoads = weekKeys.map(loadOf);
            const weeksOfHistory = weeklyLoads.filter((load) => load > 0).length;
            const actualLoad = weeklyLoads[weeklyLoads.length - 1];
            const acwr = (0, verdict_1.computeAcwr)(weeklyLoads);
            const effortWeeks = weekKeys.slice(-2).map((weekKey) => {
                const weekSessions = mySessions.filter((session) => session.weekKey === weekKey);
                if (weekSessions.length === 0)
                    return null;
                return (weekSessions.reduce((sum, session) => sum + (session.perceivedEffort || 5), 0) / weekSessions.length);
            });
            const avgEffort = effortWeeks[effortWeeks.length - 1];
            const sustainedHighEffort = effortWeeks.every((effort) => effort !== null && effort >= 8);
            const checkoff = checkoffsByUid.get(uid);
            const completionPct = checkoff && checkoff.total > 0
                ? Math.round((checkoff.done / checkoff.total) * 100)
                : null;
            const verdict = (0, verdict_1.computeVerdict)({
                completionPct,
                avgEffort,
                acwr,
                phase,
                weeksOfHistory,
                sustainedHighEffort,
            });
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
            });
        }
    }
}
//# sourceMappingURL=computeMetrics.js.map