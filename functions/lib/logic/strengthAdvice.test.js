"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const strengthAdvice_1 = require("./strengthAdvice");
const day = 86400000;
const now = Date.now();
const sessions = [
    {
        startedAtMs: now - 2 * day,
        durationMin: 45,
        perceivedEffort: 7,
        exercises: [
            {
                name: 'Back squat',
                sets: [
                    { reps: 8, weightKg: 60 },
                    { reps: 8, weightKg: 60 },
                    { reps: 6, weightKg: 65 },
                ],
            },
            { name: 'Weighted step-up', sets: [{ reps: 10, weightKg: 20 }] },
        ],
    },
    {
        startedAtMs: now - 9 * day,
        durationMin: 40,
        perceivedEffort: 6,
        exercises: [
            {
                // Case-insensitive merge with "Back squat" above.
                name: 'back squat',
                sets: [{ reps: 8, weightKg: 70 }],
            },
        ],
    },
];
(0, node_test_1.test)('buildExerciseHistory merges names case-insensitively', () => {
    const history = (0, strengthAdvice_1.buildExerciseHistory)(sessions);
    strict_1.default.equal(history.length, 2);
    const squat = history.find((h) => h.name.toLowerCase() === 'back squat');
    strict_1.default.ok(squat);
    strict_1.default.equal(squat.sessionCount, 2);
});
(0, node_test_1.test)('buildExerciseHistory tracks best set vs latest top set separately', () => {
    const squat = (0, strengthAdvice_1.buildExerciseHistory)(sessions).find((h) => h.name.toLowerCase() === 'back squat');
    strict_1.default.ok(squat);
    // Best ever was 8×70 a week ago; the most recent session topped out at 6×65.
    strict_1.default.deepEqual(squat.bestSet, { reps: 8, weightKg: 70 });
    strict_1.default.deepEqual(squat.latestTopSet, { reps: 6, weightKg: 65 });
    strict_1.default.equal(squat.latestVolumeKg, 8 * 60 + 8 * 60 + 6 * 65);
});
(0, node_test_1.test)('buildExerciseHistory sorts by most recently trained', () => {
    const history = (0, strengthAdvice_1.buildExerciseHistory)(sessions);
    strict_1.default.equal(history[0].lastTrainedMs, now - 2 * day);
});
(0, node_test_1.test)('buildExerciseHistory skips empty names and set-less exercises', () => {
    const history = (0, strengthAdvice_1.buildExerciseHistory)([
        {
            startedAtMs: now,
            durationMin: 30,
            perceivedEffort: 5,
            exercises: [
                { name: '  ', sets: [{ reps: 5, weightKg: 10 }] },
                { name: 'Bench press', sets: [] },
            ],
        },
    ]);
    strict_1.default.equal(history.length, 0);
});
(0, node_test_1.test)('prompt includes exercise numbers and event context', () => {
    const prompt = (0, strengthAdvice_1.buildStrengthAdvicePrompt)({
        history: (0, strengthAdvice_1.buildExerciseHistory)(sessions),
        sessionCount: sessions.length,
        weeksToEvent: 12,
        eventDistanceKm: 48,
    });
    strict_1.default.match(prompt, /Back squat/);
    strict_1.default.match(prompt, /8×70kg/);
    strict_1.default.match(prompt, /12 weeks out/);
    strict_1.default.match(prompt, /48 km/);
    strict_1.default.match(prompt, /JSON ONLY/);
});
(0, node_test_1.test)('prompt handles empty history without event date', () => {
    const prompt = (0, strengthAdvice_1.buildStrengthAdvicePrompt)({
        history: [],
        sessionCount: 0,
        weeksToEvent: null,
        eventDistanceKm: null,
    });
    strict_1.default.match(prompt, /No exercise-level history/);
});
(0, node_test_1.test)('advice schema accepts a valid response', () => {
    const advice = strengthAdvice_1.strengthAdviceSchema.parse({
        summary: 'Solid squat progress; keep building the posterior chain.',
        tips: [{ exercise: 'Back squat', tip: 'Add 2.5kg to your top set.' }],
        nextWorkout: [{ name: 'Back squat', sets: 3, reps: 8, weightKg: 62.5 }],
    });
    strict_1.default.equal(advice.nextWorkout[0].weightKg, 62.5);
});
(0, node_test_1.test)('advice schema rejects an empty workout or absurd weight', () => {
    strict_1.default.throws(() => strengthAdvice_1.strengthAdviceSchema.parse({ summary: 'x', tips: [], nextWorkout: [] }));
    strict_1.default.throws(() => strengthAdvice_1.strengthAdviceSchema.parse({
        summary: 'x',
        tips: [],
        nextWorkout: [{ name: 'Squat', sets: 3, reps: 8, weightKg: 1000 }],
    }));
});
//# sourceMappingURL=strengthAdvice.test.js.map