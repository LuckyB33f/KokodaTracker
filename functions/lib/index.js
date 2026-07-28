"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMealWritten = exports.nutritionReviewJob = exports.suggestionJob = exports.dailyJob = exports.onMealPlanRequest = exports.onPlanRequest = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const onPlanRequest_1 = require("./triggers/onPlanRequest");
const onMealPlanRequest_1 = require("./triggers/onMealPlanRequest");
const onMealWritten_1 = require("./triggers/onMealWritten");
const computeMetrics_1 = require("./jobs/computeMetrics");
const fetchWeather_1 = require("./jobs/fetchWeather");
const nutritionReview_1 = require("./jobs/nutritionReview");
const weekendSuggestion_1 = require("./jobs/weekendSuggestion");
(0, v2_1.setGlobalOptions)({ region: 'australia-southeast1', maxInstances: 2 });
const GEMINI_API_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
const WEATHER_API_KEY = (0, params_1.defineSecret)('WEATHER_API_KEY');
// F5: captain-triggered weekly plan generation (spec §2.4), via a Firestore
// request queue instead of a callable — the org's Domain Restricted Sharing
// policy blocks the allUsers invoker grant callables require (§2.5 decision).
exports.onPlanRequest = (0, firestore_1.onDocumentCreated)({
    document: 'teams/{teamId}/planRequests/{requestId}',
    secrets: [GEMINI_API_KEY],
}, async (event) => {
    await (0, onPlanRequest_1.handlePlanRequest)({
        geminiApiKey: GEMINI_API_KEY.value(),
        teamId: event.params.teamId,
        requestId: event.params.requestId,
    });
});
// F13A: meal plan generation queue (spec v1.2) — same request-doc pattern.
exports.onMealPlanRequest = (0, firestore_1.onDocumentCreated)({
    document: 'teams/{teamId}/mealPlanRequests/{requestId}',
    secrets: [GEMINI_API_KEY],
}, async (event) => {
    await (0, onMealPlanRequest_1.handleMealPlanRequest)({
        geminiApiKey: GEMINI_API_KEY.value(),
        teamId: event.params.teamId,
        requestId: event.params.requestId,
    });
});
// Daily 5:00am Brisbane: weather fetch (F10) then metrics (F9).
// One scheduler job for both keeps us inside the 3-job free tier.
exports.dailyJob = (0, scheduler_1.onSchedule)({
    schedule: '0 5 * * *',
    timeZone: 'Australia/Brisbane',
    secrets: [WEATHER_API_KEY],
}, async () => {
    try {
        await (0, fetchWeather_1.fetchWeather)(WEATHER_API_KEY.value());
    }
    catch (error) {
        firebase_functions_1.logger.error('fetchWeather failed', error);
    }
    await (0, computeMetrics_1.computeMetrics)();
});
// Thu + Fri 6:00am Brisbane: weekend suggestion (F10).
exports.suggestionJob = (0, scheduler_1.onSchedule)({
    schedule: '0 6 * * 4,5',
    timeZone: 'Australia/Brisbane',
    secrets: [GEMINI_API_KEY],
}, async () => {
    await (0, weekendSuggestion_1.weekendSuggestion)(GEMINI_API_KEY.value());
});
// F13B: daily 8:30pm Brisbane nutrition review (after dinner logging).
exports.nutritionReviewJob = (0, scheduler_1.onSchedule)({
    schedule: '30 20 * * *',
    timeZone: 'Australia/Brisbane',
    secrets: [GEMINI_API_KEY],
}, async () => {
    await (0, nutritionReview_1.nutritionReview)(GEMINI_API_KEY.value());
});
// F6 fuelling tile: live per-member meal counts (aggregate only — raw meals
// stay private to their owner).
exports.onMealWritten = (0, firestore_1.onDocumentWritten)('users/{uid}/meals/{mealId}', async (event) => {
    await (0, onMealWritten_1.handleMealWritten)({
        uid: event.params.uid,
        beforeDate: event.data?.before.data()?.date,
        afterDate: event.data?.after.data()?.date,
    });
});
//# sourceMappingURL=index.js.map