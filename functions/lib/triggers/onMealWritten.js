"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMealWritten = handleMealWritten;
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("../lib/admin");
const weekKey_1 = require("../lib/weekKey");
// Keeps the dashboard fuelling tile live: recount today's logged meals on
// any meal write. No Gemini, no toggle check — counts are the R11.6-approved
// aggregate. Idempotent, so Eventarc at-least-once delivery is harmless.
async function handleMealWritten(args) {
    const { uid, beforeDate, afterDate } = args;
    const today = (0, weekKey_1.todayBrisbane)();
    if (beforeDate !== today && afterDate !== today)
        return;
    const countSnap = await admin_1.db
        .collection(`users/${uid}/meals`)
        .where('date', '==', today)
        .where('status', '==', 'logged')
        .get();
    const activeTeamId = (await admin_1.db.doc(`users/${uid}`).get()).data()
        ?.activeTeamId;
    if (!activeTeamId)
        return;
    await admin_1.db.doc(`teams/${activeTeamId}/fuelling/${uid}`).set({ date: today, mealCount: countSnap.size, updatedAt: new Date() }, { merge: true });
    firebase_functions_1.logger.info('fuelling count updated', { uid, count: countSnap.size });
}
//# sourceMappingURL=onMealWritten.js.map