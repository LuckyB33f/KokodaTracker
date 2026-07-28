"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStrengthAdviceRequest = handleStrengthAdviceRequest;
const firebase_functions_1 = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const gemini_1 = require("../lib/gemini");
const weekKey_1 = require("../lib/weekKey");
const strengthAdvice_1 = require("../logic/strengthAdvice");
const DAILY_QUOTA = 10;
const HISTORY_DAYS = 84;
// F3.1: same org-policy-safe queue pattern as onPlanRequest, but the request
// doc is keyed by uid — re-requesting resets the one doc to 'pending' and the
// advice is written back into it, so the collection never grows.
async function handleStrengthAdviceRequest(args) {
    const { geminiApiKey, teamId, uid } = args;
    const requestRef = admin_1.db.doc(`teams/${teamId}/strengthAdviceRequests/${uid}`);
    // Claim atomically — Eventarc delivery is at-least-once.
    const claimed = await admin_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists || snap.data()?.status !== 'pending')
            return false;
        tx.update(requestRef, { status: 'processing', updatedAt: new Date() });
        return true;
    });
    if (!claimed)
        return;
    try {
        // Rules already guarantee docId == requestedBy == a team member's uid;
        // re-verify membership server-side anyway.
        const team = (await admin_1.db.doc(`teams/${teamId}`).get()).data();
        if (!team || !team.memberIds.includes(uid)) {
            throw Object.assign(new Error('Not a member of this team.'), {
                code: 'permission-denied',
            });
        }
        const quotaRef = admin_1.db.doc(`usage/strength_${uid}_${(0, weekKey_1.todayBrisbane)()}`);
        const used = (await quotaRef.get()).data()?.count ?? 0;
        if (used >= DAILY_QUOTA) {
            throw Object.assign(new Error(`Daily coaching limit reached (${DAILY_QUOTA}). Try again tomorrow.`), { code: 'resource-exhausted' });
        }
        const since = firestore_1.Timestamp.fromMillis(Date.now() - HISTORY_DAYS * 86400000);
        const sessionsSnap = await admin_1.db
            .collection(`teams/${teamId}/sessions`)
            .where('startedAt', '>=', since)
            .get();
        const sessions = sessionsSnap.docs
            .map((doc) => doc.data())
            .filter((data) => data.uid === uid && data.type === 'strength')
            .map((data) => ({
            startedAtMs: data.startedAt instanceof firestore_1.Timestamp
                ? data.startedAt.toMillis()
                : Date.now(),
            durationMin: data.durationMin ?? 0,
            perceivedEffort: data.perceivedEffort ?? 5,
            exercises: data.exercises ??
                [],
        }));
        const weeksToEvent = team.eventDate
            ? Math.max(0, Math.round((team.eventDate.toMillis() - Date.now()) / (7 * 86400000)))
            : null;
        const prompt = (0, strengthAdvice_1.buildStrengthAdvicePrompt)({
            history: (0, strengthAdvice_1.buildExerciseHistory)(sessions),
            sessionCount: sessions.length,
            weeksToEvent,
            eventDistanceKm: team.eventDistanceKm ?? null,
        });
        // Gemini → Zod → one retry-with-repair (same shape as plan generation).
        let advice = null;
        let attemptPrompt = prompt;
        for (let attempt = 0; attempt < 2 && !advice; attempt++) {
            try {
                advice = strengthAdvice_1.strengthAdviceSchema.parse(await (0, gemini_1.geminiJson)(geminiApiKey, attemptPrompt));
            }
            catch (error) {
                // Billing/quota/auth errors can't be repaired by re-prompting.
                if ((0, gemini_1.isGeminiApiError)(error))
                    throw error;
                firebase_functions_1.logger.warn('strength advice attempt rejected', {
                    uid,
                    attempt,
                    problems: String(error).slice(0, 300),
                });
                attemptPrompt = `${prompt}\n\nYour previous answer was invalid (${String(error).slice(0, 300)}). Return ONLY corrected JSON matching the schema.`;
            }
        }
        if (!advice) {
            throw Object.assign(new Error('The AI returned invalid advice twice — try again in a minute.'), { code: 'internal' });
        }
        await quotaRef.set({ count: used + 1, updatedAt: new Date() }, { merge: true });
        await requestRef.update({
            status: 'done',
            advice,
            model: gemini_1.GEMINI_MODEL,
            updatedAt: new Date(),
        });
    }
    catch (error) {
        const err = error;
        firebase_functions_1.logger.error('strength advice failed', { teamId, uid, error });
        await requestRef.update({
            status: 'error',
            errorCode: err.code ?? 'internal',
            errorMessage: err.message ?? 'Coaching advice failed. Try again.',
            updatedAt: new Date(),
        });
    }
}
//# sourceMappingURL=onStrengthAdviceRequest.js.map