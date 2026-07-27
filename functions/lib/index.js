"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestionJob = exports.dailyJob = exports.generatePlan = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const generatePlan_1 = require("./callable/generatePlan");
const computeMetrics_1 = require("./jobs/computeMetrics");
const fetchWeather_1 = require("./jobs/fetchWeather");
const weekendSuggestion_1 = require("./jobs/weekendSuggestion");
(0, v2_1.setGlobalOptions)({ region: 'australia-southeast1', maxInstances: 2 });
const GEMINI_API_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
const WEATHER_API_KEY = (0, params_1.defineSecret)('WEATHER_API_KEY');
// F5: captain-triggered weekly plan generation (spec §2.4).
exports.generatePlan = (0, https_1.onCall)({ secrets: [GEMINI_API_KEY] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in first.');
    }
    return (0, generatePlan_1.generatePlanHandler)({
        geminiApiKey: GEMINI_API_KEY.value(),
        uid: request.auth.uid,
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
//# sourceMappingURL=index.js.map