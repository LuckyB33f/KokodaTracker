"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const nutritionReview_1 = require("./nutritionReview");
(0, node_test_1.default)('shouldReview: toggle-off wins over everything (checked first)', () => {
    strict_1.default.equal((0, nutritionReview_1.shouldReview)({ aiMealsEnabled: false }, 5), 'skip-disabled');
    strict_1.default.equal((0, nutritionReview_1.shouldReview)({ aiMealsEnabled: false }, 0), 'skip-disabled');
});
(0, node_test_1.default)('shouldReview: zero meals skips; missing profile defaults to enabled', () => {
    strict_1.default.equal((0, nutritionReview_1.shouldReview)(undefined, 0), 'skip-empty');
    strict_1.default.equal((0, nutritionReview_1.shouldReview)({}, 0), 'skip-empty');
    strict_1.default.equal((0, nutritionReview_1.shouldReview)({ aiMealsEnabled: true }, 0), 'skip-empty');
});
(0, node_test_1.default)('shouldReview: enabled with meals reviews', () => {
    strict_1.default.equal((0, nutritionReview_1.shouldReview)(undefined, 1), 'review');
    strict_1.default.equal((0, nutritionReview_1.shouldReview)({ aiMealsEnabled: true }, 3), 'review');
});
(0, node_test_1.default)('reviewSchema: accepts exactly the three verdicts, rejects others', () => {
    for (const verdict of nutritionReview_1.REVIEW_VERDICTS) {
        strict_1.default.ok(nutritionReview_1.reviewSchema.safeParse({ verdict, reason: 'r', suggestion: 's' }).success);
    }
    strict_1.default.equal(nutritionReview_1.reviewSchema.safeParse({
        verdict: 'eat less', // diet-culture drift → must be rejected
        reason: 'r',
        suggestion: 's',
    }).success, false);
    strict_1.default.equal(nutritionReview_1.reviewSchema.safeParse({ verdict: 'about right', reason: '', suggestion: 's' })
        .success, false);
});
(0, node_test_1.default)('neutralReview: not-assessed doc shape', () => {
    const doc = (0, nutritionReview_1.neutralReview)(2, 'rest day — no sessions logged');
    strict_1.default.equal(doc.verdict, 'not-assessed');
    strict_1.default.equal(doc.mealCount, 2);
    strict_1.default.ok(typeof doc.reason === 'string');
});
(0, node_test_1.default)('summariseTraining: rest day and multi-session days', () => {
    strict_1.default.equal((0, nutritionReview_1.summariseTraining)([]), 'rest day — no sessions logged');
    const summary = (0, nutritionReview_1.summariseTraining)([
        { type: 'hike', durationMin: 190, distanceKm: 14, perceivedEffort: 7 },
        { type: 'strength', durationMin: 45, distanceKm: null, perceivedEffort: 6 },
    ]);
    strict_1.default.ok(summary.includes('hike 3h10m 14km effort 7/10'));
    strict_1.default.ok(summary.includes('strength 45m effort 6/10'));
});
(0, node_test_1.default)('review prompt: framing constraints and enum present, no diet language', () => {
    const prompt = (0, nutritionReview_1.buildReviewPrompt)({
        date: '2026-07-28',
        phase: 'base',
        macroFocus: 'balanced',
        meals: [
            { slot: 'breakfast', text: 'Porridge', tag: 'carb', portionNote: 'big bowl' },
        ],
        trainingSummary: 'hike 2h 10km effort 6/10',
    });
    strict_1.default.ok(prompt.includes('NEVER mention body weight, calories, restriction, or dieting'));
    strict_1.default.ok(prompt.includes('"likely under-fuelled","about right","heavier than the day needed"'));
    strict_1.default.ok(prompt.includes('If unsure, choose "about right"'));
    strict_1.default.ok(prompt.includes('breakfast: Porridge (carb) — big bowl'));
    strict_1.default.ok(prompt.includes('hike 2h 10km'));
});
//# sourceMappingURL=nutritionReview.test.js.map