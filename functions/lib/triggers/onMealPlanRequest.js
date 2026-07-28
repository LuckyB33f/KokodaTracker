"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMealPlanRequest = handleMealPlanRequest;
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("../lib/admin");
const gemini_1 = require("../lib/gemini");
const weekKey_1 = require("../lib/weekKey");
const mealPlan_1 = require("../logic/mealPlan");
const DAILY_MEAL_PLAN_QUOTA = 3;
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
// F13A queue worker — same org-policy-safe shape as onPlanRequest: rules
// guarantee only members create requests ('team' scope: captain only); the
// trigger re-verifies everything and fans out one personalised plan per
// AI-enabled member.
async function handleMealPlanRequest(args) {
    const { geminiApiKey, teamId, requestId } = args;
    const requestRef = admin_1.db.doc(`teams/${teamId}/mealPlanRequests/${requestId}`);
    const claimed = await admin_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists || snap.data()?.status !== 'pending')
            return false;
        tx.update(requestRef, { status: 'processing', updatedAt: new Date() });
        return true;
    });
    if (!claimed) {
        firebase_functions_1.logger.info('mealPlanRequest already claimed, skipping', {
            teamId,
            requestId,
        });
        return;
    }
    const request = (await requestRef.get()).data();
    const requestedBy = request?.requestedBy;
    const scope = request?.scope === 'team' ? 'team' : 'self';
    try {
        if (!requestedBy) {
            throw Object.assign(new Error('Request has no requester.'), {
                code: 'invalid-argument',
            });
        }
        const teamSnap = await admin_1.db.doc(`teams/${teamId}`).get();
        const team = teamSnap.data();
        if (!team || !team.memberIds.includes(requestedBy)) {
            throw Object.assign(new Error('Requester is not a team member.'), {
                code: 'permission-denied',
            });
        }
        if (scope === 'team' && team.createdBy !== requestedBy) {
            throw Object.assign(new Error('Only the captain can generate for the team.'), { code: 'permission-denied' });
        }
        const now = new Date();
        const weekKey = (0, weekKey_1.weekKeyFor)(now);
        const weekDates = (0, weekKey_1.brisbaneWeekDates)(now);
        const phase = phaseFor(now.getTime(), team.eventDate.toMillis());
        const today = (0, weekKey_1.todayBrisbane)();
        // Active training plan → per-member training days for the prompt.
        const activePlanSnap = await admin_1.db
            .collection(`teams/${teamId}/plans`)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        const planDays = activePlanSnap.docs[0]?.data()?.days ?? [];
        const membersSnap = await admin_1.db.collection(`teams/${teamId}/members`).get();
        const nameOf = new Map(membersSnap.docs.map((d) => [d.id, d.data().displayName]));
        const targets = scope === 'team' ? team.memberIds : [requestedBy];
        const results = {};
        let firstError = null;
        for (const uid of targets) {
            try {
                const userSnap = await admin_1.db.doc(`users/${uid}`).get();
                const userData = userSnap.data() ?? {};
                // AI toggle gate — checked server-side before any Gemini work.
                if (userData.aiMealsEnabled === false) {
                    results[uid] = 'skipped-disabled';
                    continue;
                }
                const prefs = {
                    ...mealPlan_1.DEFAULT_MEAL_PREFS,
                    ...(userData.mealPrefs ?? {}),
                };
                const quotaRef = admin_1.db.doc(`usage/meal_${uid}_${today}`);
                const used = (await quotaRef.get()).data()?.count ?? 0;
                if (used >= DAILY_MEAL_PLAN_QUOTA) {
                    results[uid] = 'error';
                    firstError =
                        firstError ??
                            `Daily meal-plan limit reached (${DAILY_MEAL_PLAN_QUOTA}). Try again tomorrow.`;
                    continue;
                }
                const librarySnap = await admin_1.db
                    .collection(`users/${uid}/mealLibrary`)
                    .get();
                const library = librarySnap.docs
                    .map((d) => ({
                    id: d.id,
                    text: d.data().text ?? '',
                    tag: d.data().tag ?? null,
                    favourite: Boolean(d.data().favourite),
                    hidden: Boolean(d.data().hidden),
                    useCount: d.data().useCount ?? 0,
                }))
                    .filter((item) => !item.hidden && item.text)
                    .sort((a, b) => b.useCount - a.useCount)
                    .slice(0, 40);
                const trainingDays = planDays
                    .filter((d) => (d.memberUid === uid || d.memberUid === null) &&
                    d.targetType !== 'rest' &&
                    weekDates.includes(d.date))
                    .map((d) => ({
                    date: d.date,
                    title: d.title,
                    targetType: d.targetType,
                    targetValue: d.targetValue,
                }));
                const prompt = (0, mealPlan_1.buildMealPlanPrompt)({
                    displayName: nameOf.get(uid) ?? 'a team member',
                    eventDate: team.eventDate.toDate().toISOString().slice(0, 10),
                    distanceKm: team.eventDistanceKm,
                    phase,
                    weekKey,
                    weekDates,
                    prefs,
                    library,
                    trainingDays,
                });
                const libraryIds = new Set(library.map((item) => item.id));
                const trainingDates = new Set(trainingDays.map((d) => d.date));
                // Gemini → Zod + semantic checks → one retry-with-repair.
                let parsed = null;
                let attemptPrompt = prompt;
                for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
                    let problems;
                    try {
                        const candidate = mealPlan_1.mealPlanSchema.parse(await (0, gemini_1.geminiJson)(geminiApiKey, attemptPrompt));
                        const issues = (0, mealPlan_1.mealPlanIssues)(candidate.days, {
                            weekDates,
                            prefs,
                            libraryIds,
                            trainingDates,
                        });
                        if (issues.length === 0) {
                            parsed = candidate;
                            break;
                        }
                        problems = issues.join('; ');
                    }
                    catch (error) {
                        // Billing/quota/auth errors can't be repaired by re-prompting —
                        // bubble up so the member sees the real reason.
                        if ((0, gemini_1.isGeminiApiError)(error))
                            throw error;
                        problems = String(error).slice(0, 200);
                    }
                    firebase_functions_1.logger.warn('meal plan attempt rejected', { uid, attempt, problems });
                    attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${problems.slice(0, 600)}). Return ONLY corrected JSON matching the schema and every rule above.`;
                }
                if (!parsed) {
                    results[uid] = 'error';
                    firstError =
                        firstError ??
                            'The AI returned an invalid meal plan twice — try again in a minute.';
                    continue;
                }
                const planRef = admin_1.db.doc(`users/${uid}/mealPlans/${weekKey}`);
                const priorVersion = (await planRef.get()).data()?.version ?? 0;
                const batch = admin_1.db.batch();
                batch.set(planRef, {
                    generatedAt: new Date(),
                    model: gemini_1.GEMINI_MODEL,
                    promptVersion: mealPlan_1.MEAL_PLAN_PROMPT_VERSION,
                    phase,
                    weekKey,
                    version: priorVersion + 1,
                    prefsSnapshot: prefs,
                    libraryCoveragePct: (0, mealPlan_1.libraryCoveragePct)(parsed.days),
                    days: parsed.days,
                });
                batch.set(quotaRef, { count: used + 1, updatedAt: new Date() }, { merge: true });
                await batch.commit();
                results[uid] = 'done';
            }
            catch (error) {
                firebase_functions_1.logger.error('meal plan generation failed for member', {
                    teamId,
                    requestId,
                    uid,
                    error,
                });
                results[uid] = 'error';
                firstError =
                    firstError ?? error.message ?? 'Failed.';
            }
        }
        const anyDone = Object.values(results).some((r) => r === 'done');
        const allDisabled = Object.values(results).length > 0 &&
            Object.values(results).every((r) => r === 'skipped-disabled');
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
        });
    }
    catch (error) {
        const err = error;
        firebase_functions_1.logger.error('meal plan request failed', { teamId, requestId, error });
        await requestRef.update({
            status: 'error',
            errorCode: err.code ?? 'internal',
            errorMessage: err.message ?? 'Meal plan generation failed. Try again.',
            updatedAt: new Date(),
        });
    }
    // Housekeeping: drop requests older than 7 days.
    const stale = await admin_1.db
        .collection(`teams/${teamId}/mealPlanRequests`)
        .where('createdAt', '<', new Date(Date.now() - 7 * 86400000))
        .limit(20)
        .get();
    if (!stale.empty) {
        const batch = admin_1.db.batch();
        for (const doc of stale.docs)
            batch.delete(doc.ref);
        await batch.commit();
    }
}
//# sourceMappingURL=onMealPlanRequest.js.map