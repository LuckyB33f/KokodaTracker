"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePlanRequest = handlePlanRequest;
const firebase_functions_1 = require("firebase-functions");
const generatePlan_1 = require("../callable/generatePlan");
const admin_1 = require("../lib/admin");
// Org-policy-safe replacement for the generatePlan callable (TODO.md Option A):
// the org's Domain Restricted Sharing forbids the allUsers invoker grant that
// callables need, but Firestore triggers are invoked via a service account.
// Rules guarantee only the team captain can create a planRequests doc with
// status 'pending'; the handler re-verifies everything server-side anyway.
async function handlePlanRequest(args) {
    const { geminiApiKey, teamId, requestId } = args;
    const requestRef = admin_1.db.doc(`teams/${teamId}/planRequests/${requestId}`);
    // Claim the request atomically: Eventarc delivery is at-least-once, so a
    // redelivered event must not generate (and bill) a second plan.
    const claimed = await admin_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists || snap.data()?.status !== 'pending')
            return false;
        tx.update(requestRef, { status: 'processing', updatedAt: new Date() });
        return true;
    });
    if (!claimed) {
        firebase_functions_1.logger.info('planRequest already claimed, skipping', { teamId, requestId });
        return;
    }
    const requestedBy = (await requestRef.get()).data()?.requestedBy;
    try {
        if (!requestedBy) {
            throw Object.assign(new Error('Request has no requester.'), {
                code: 'invalid-argument',
            });
        }
        // The handler derives the team from users/{uid}.activeTeamId — make sure
        // the request wasn't written into some other team's collection.
        const activeTeamId = (await admin_1.db.doc(`users/${requestedBy}`).get()).data()
            ?.activeTeamId;
        if (activeTeamId !== teamId) {
            throw Object.assign(new Error('Request team mismatch.'), {
                code: 'permission-denied',
            });
        }
        const { planId } = await (0, generatePlan_1.generatePlanHandler)({
            geminiApiKey,
            uid: requestedBy,
        });
        await requestRef.update({
            status: 'done',
            planId,
            updatedAt: new Date(),
        });
    }
    catch (error) {
        const err = error;
        firebase_functions_1.logger.error('plan generation failed', { teamId, requestId, error });
        await requestRef.update({
            status: 'error',
            errorCode: err.code ?? 'internal',
            errorMessage: err.message ?? 'Plan generation failed. Try again.',
            updatedAt: new Date(),
        });
    }
    // Housekeeping: drop requests older than 7 days so the collection stays tiny.
    const stale = await admin_1.db
        .collection(`teams/${teamId}/planRequests`)
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
//# sourceMappingURL=onPlanRequest.js.map