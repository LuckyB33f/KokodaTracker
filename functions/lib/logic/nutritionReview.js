"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewSchema = exports.REVIEW_VERDICTS = exports.REVIEW_PROMPT_VERSION = void 0;
exports.shouldReview = shouldReview;
exports.summariseTraining = summariseTraining;
exports.neutralReview = neutralReview;
exports.buildReviewPrompt = buildReviewPrompt;
const zod_1 = require("zod");
exports.REVIEW_PROMPT_VERSION = 1;
// Coarse 3-value enum (risk R7); anything else degrades to a neutral doc.
exports.REVIEW_VERDICTS = [
    'likely under-fuelled',
    'about right',
    'heavier than the day needed',
];
exports.reviewSchema = zod_1.z.object({
    verdict: zod_1.z.enum(exports.REVIEW_VERDICTS),
    reason: zod_1.z.string().min(1).max(160),
    suggestion: zod_1.z.string().min(1).max(200),
});
// R13.7 + AI toggle: both gates are deterministic code, evaluated before any
// model involvement, in this order.
function shouldReview(profile, mealCount) {
    if (profile?.aiMealsEnabled === false)
        return 'skip-disabled';
    if (mealCount === 0)
        return 'skip-empty';
    return 'review';
}
function summariseTraining(sessions) {
    if (sessions.length === 0)
        return 'rest day — no sessions logged';
    return sessions
        .map((s) => {
        const hours = Math.floor(s.durationMin / 60);
        const mins = s.durationMin % 60;
        const duration = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;
        const km = s.distanceKm !== null ? ` ${s.distanceKm}km` : '';
        return `${s.type} ${duration}${km} effort ${s.perceivedEffort}/10`;
    })
        .join('; ');
}
// R13.9 fallback: out-of-enum / parse failure / Gemini error → neutral doc.
function neutralReview(mealCount, trainingSummary) {
    return {
        verdict: 'not-assessed',
        reason: 'Logged — no assessment today.',
        suggestion: '',
        mealCount,
        trainingSummary,
        promptVersion: exports.REVIEW_PROMPT_VERSION,
        createdAt: new Date(),
    };
}
function buildReviewPrompt(args) {
    const mealLines = args.meals
        .map((m) => `- ${m.slot}: ${m.text}${m.tag ? ` (${m.tag})` : ''}${m.portionNote ? ` — ${m.portionNote}` : ''}`)
        .join('\n');
    return `You review one athlete's day of fuelling for endurance training (Kokoda Challenge preparation, ${args.phase} phase). This is performance-fuelling feedback ONLY — NEVER mention body weight, calories, restriction, or dieting.

Day: ${args.date}. Their macro preference: ${args.macroFocus}.
Training completed today: ${args.trainingSummary}.
Meals logged today:
${mealLines}

Return JSON only: {"verdict": one of exactly ["likely under-fuelled","about right","heavier than the day needed"], "reason": one sentence tied to the training load (e.g. "a 20km hike day usually needs more carbs than this"), "suggestion": one practical tip for tomorrow}.
Judge the verdict relative to the training load, not any ideal diet. If unsure, choose "about right".`;
}
//# sourceMappingURL=nutritionReview.js.map