"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nutritionReview = nutritionReview;
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("../lib/admin");
const gemini_1 = require("../lib/gemini");
const weekKey_1 = require("../lib/weekKey");
const nutritionReview_1 = require("../logic/nutritionReview");
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
// F13B nightly review (8:30pm Brisbane). Per member, in order: AI-toggle
// gate → zero-meals gate (R13.7: no Gemini call, no doc, no notification) →
// Gemini review → enum-validated write. Idempotent per member per date
// (doc ID is the date).
async function nutritionReview(geminiApiKey) {
    const today = (0, weekKey_1.todayBrisbane)();
    const dayStart = new Date(`${today}T00:00:00+10:00`);
    const teamsSnap = await admin_1.db.collection('teams').get();
    // Dedupe members across teams so each gets exactly one review.
    const memberTeams = new Map();
    const teamEventMs = new Map();
    for (const teamDoc of teamsSnap.docs) {
        const data = teamDoc.data();
        teamEventMs.set(teamDoc.id, data.eventDate?.toMillis?.() ?? Date.now());
        for (const uid of data.memberIds ?? []) {
            memberTeams.set(uid, [...(memberTeams.get(uid) ?? []), teamDoc.id]);
        }
    }
    for (const [uid, teamIds] of memberTeams) {
        try {
            const profile = (await admin_1.db.doc(`users/${uid}`).get()).data();
            // Cheap pre-gate: skip the meals query entirely when the toggle is off.
            if ((0, nutritionReview_1.shouldReview)(profile, 1) === 'skip-disabled') {
                firebase_functions_1.logger.info('nutritionReview skip (ai disabled)', { uid });
                continue;
            }
            const mealsSnap = await admin_1.db
                .collection(`users/${uid}/meals`)
                .where('date', '==', today)
                .where('status', '==', 'logged')
                .get();
            if ((0, nutritionReview_1.shouldReview)(profile, mealsSnap.size) === 'skip-empty') {
                firebase_functions_1.logger.info('nutritionReview skip (no meals logged)', { uid });
                continue;
            }
            const meals = mealsSnap.docs.map((d) => ({
                slot: d.data().slot ?? 'snack',
                text: d.data().textSnapshot ?? '',
                tag: d.data().tag ?? null,
                portionNote: d.data().portionNote ?? '',
            }));
            // Today's completed training across all their teams.
            const sessions = [];
            for (const teamId of teamIds) {
                const sessionsSnap = await admin_1.db
                    .collection(`teams/${teamId}/sessions`)
                    .where('startedAt', '>=', dayStart)
                    .get();
                for (const doc of sessionsSnap.docs) {
                    const data = doc.data();
                    if (data.uid !== uid)
                        continue;
                    sessions.push({
                        type: data.type ?? 'other',
                        durationMin: data.durationMin ?? 0,
                        distanceKm: data.distanceKm ?? null,
                        perceivedEffort: data.perceivedEffort ?? 5,
                    });
                }
            }
            const trainingSummary = (0, nutritionReview_1.summariseTraining)(sessions);
            const prompt = (0, nutritionReview_1.buildReviewPrompt)({
                date: today,
                phase: phaseFor(Date.now(), teamEventMs.get(teamIds[0]) ?? Date.now()),
                macroFocus: profile?.mealPrefs?.macroFocus ?? 'balanced',
                meals,
                trainingSummary,
            });
            // One repair retry, then neutral fallback (R13.9).
            let reviewDoc = null;
            let attemptPrompt = prompt;
            for (let attempt = 0; attempt < 2 && !reviewDoc; attempt++) {
                try {
                    const parsed = nutritionReview_1.reviewSchema.parse(await (0, gemini_1.geminiJson)(geminiApiKey, attemptPrompt));
                    reviewDoc = {
                        ...parsed,
                        mealCount: mealsSnap.size,
                        trainingSummary,
                        promptVersion: nutritionReview_1.REVIEW_PROMPT_VERSION,
                        createdAt: new Date(),
                    };
                }
                catch (error) {
                    attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${String(error).slice(0, 200)}). Return ONLY corrected JSON with the exact verdict enum.`;
                }
            }
            reviewDoc = reviewDoc ?? (0, nutritionReview_1.neutralReview)(mealsSnap.size, trainingSummary);
            await admin_1.db.doc(`users/${uid}/nutritionReviews/${today}`).set(reviewDoc);
            for (const teamId of teamIds) {
                await admin_1.db.doc(`teams/${teamId}/fuelling/${uid}`).set({
                    date: today,
                    mealCount: mealsSnap.size,
                    review: { date: today, verdict: reviewDoc.verdict },
                    updatedAt: new Date(),
                }, { merge: true });
            }
            firebase_functions_1.logger.info('nutritionReview written', { uid, verdict: reviewDoc.verdict });
        }
        catch (error) {
            // One member's failure never blocks the rest.
            firebase_functions_1.logger.error('nutritionReview failed for member', { uid, error });
        }
    }
}
//# sourceMappingURL=nutritionReview.js.map