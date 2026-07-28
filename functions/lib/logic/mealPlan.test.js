"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mealPlan_1 = require("./mealPlan");
const WEEK = [
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
];
function validWeek(libId = null) {
    return WEEK.map((date) => ({
        date,
        meals: [
            { slot: 'breakfast', libraryRefId: libId, text: 'Porridge', tag: 'carb' },
            { slot: 'lunch', libraryRefId: null, text: 'Wrap', tag: null },
            { slot: 'dinner', libraryRefId: null, text: 'Chicken and rice', tag: null },
            { slot: 'snack', libraryRefId: null, text: 'Banana', tag: null },
        ],
    }));
}
const BASE_ARGS = {
    weekDates: WEEK,
    prefs: mealPlan_1.DEFAULT_MEAL_PREFS,
    libraryIds: new Set(),
    trainingDates: new Set([WEEK[5]]),
};
(0, node_test_1.default)('mealPlanIssues: clean plan passes', () => {
    strict_1.default.deepEqual((0, mealPlan_1.mealPlanIssues)(validWeek(), BASE_ARGS), []);
});
(0, node_test_1.default)('mealPlanIssues: wrong main count and too many snacks flagged', () => {
    const days = validWeek();
    days[0].meals = days[0].meals.filter((m) => m.slot !== 'dinner');
    days[1].meals.push({ slot: 'snack', libraryRefId: null, text: 'Chips', tag: null }, { slot: 'snack', libraryRefId: null, text: 'Lollies', tag: null });
    const issues = (0, mealPlan_1.mealPlanIssues)(days, BASE_ARGS);
    strict_1.default.ok(issues.some((i) => i.includes('main meals')));
    strict_1.default.ok(issues.some((i) => i.includes('snacks')));
});
(0, node_test_1.default)('mealPlanIssues: during slot rejected off training days and when pref off', () => {
    const days = validWeek();
    days[0].meals.push({
        slot: 'during',
        libraryRefId: null,
        text: 'Gel',
        tag: 'carb',
    });
    const onRestDay = (0, mealPlan_1.mealPlanIssues)(days, BASE_ARGS);
    strict_1.default.ok(onRestDay.some((i) => i.includes('no training')));
    const days2 = validWeek();
    days2[5].meals.push({
        slot: 'during',
        libraryRefId: null,
        text: 'Gel',
        tag: 'carb',
    });
    strict_1.default.deepEqual((0, mealPlan_1.mealPlanIssues)(days2, BASE_ARGS), []);
    const prefOff = (0, mealPlan_1.mealPlanIssues)(days2, {
        ...BASE_ARGS,
        prefs: { ...mealPlan_1.DEFAULT_MEAL_PREFS, duringTraining: false },
    });
    strict_1.default.ok(prefOff.some((i) => i.includes('member has it off')));
});
(0, node_test_1.default)('mealPlanIssues: unknown libraryRefId flagged', () => {
    const days = validWeek('ghost-id');
    const issues = (0, mealPlan_1.mealPlanIssues)(days, BASE_ARGS);
    strict_1.default.ok(issues.some((i) => i.includes('ghost-id')));
});
(0, node_test_1.default)('mealPlanIssues: library coverage enforced at >=10 items', () => {
    const libraryIds = new Set(Array.from({ length: 10 }, (_, i) => `item-${i}`));
    const days = validWeek(); // zero library usage
    const issues = (0, mealPlan_1.mealPlanIssues)(days, { ...BASE_ARGS, libraryIds });
    strict_1.default.ok(issues.some((i) => i.includes('at least half')));
    // Under 10 items the rule doesn't apply.
    const smallLib = new Set(['item-0']);
    strict_1.default.deepEqual((0, mealPlan_1.mealPlanIssues)(validWeek(), { ...BASE_ARGS, libraryIds: smallLib }), []);
});
(0, node_test_1.default)('mealPlanIssues: missing dates flagged', () => {
    const days = validWeek();
    days[6].date = '2026-08-09';
    const issues = (0, mealPlan_1.mealPlanIssues)(days, BASE_ARGS);
    strict_1.default.ok(issues.some((i) => i.includes('missing date 2026-08-02')));
    strict_1.default.ok(issues.some((i) => i.includes('not in this week')));
});
(0, node_test_1.default)('prompt: includes prefs structure, dates, library ids and tone rules', () => {
    const prompt = (0, mealPlan_1.buildMealPlanPrompt)({
        displayName: 'Jason',
        eventDate: '2027-06-19',
        distanceKm: 96,
        phase: 'base',
        weekKey: '2026-W31',
        weekDates: WEEK,
        prefs: { ...mealPlan_1.DEFAULT_MEAL_PREFS, macroFocus: 'carb' },
        library: [{ id: 'abc123', text: 'Chicken and rice', tag: 'protein', favourite: true }],
        trainingDays: [
            { date: WEEK[5], title: 'Team hike', targetType: 'distance', targetValue: 15 },
        ],
    });
    strict_1.default.ok(prompt.includes('exactly 3 main meals'));
    strict_1.default.ok(prompt.includes('at most 2 snacks'));
    strict_1.default.ok(prompt.includes('id "abc123"'));
    strict_1.default.ok(prompt.includes(WEEK[0]) && prompt.includes(WEEK[6]));
    strict_1.default.ok(prompt.includes('NO calorie counts'));
    strict_1.default.ok(prompt.includes('96 km'));
    strict_1.default.ok(!prompt.includes('weight-loss framing is fine'));
});
(0, node_test_1.default)('prompt: questionnaire prefs become taste context and hard rules', () => {
    const prompt = (0, mealPlan_1.buildMealPlanPrompt)({
        displayName: 'Jason',
        eventDate: '2027-06-19',
        distanceKm: 96,
        phase: 'base',
        weekKey: '2026-W31',
        weekDates: WEEK,
        prefs: {
            ...mealPlan_1.DEFAULT_MEAL_PREFS,
            dietStyle: 'vegetarian',
            favouriteFoods: ['Burritos', 'Overnight oats'],
            foodsToTry: ['Poke bowls'],
            avoidFoods: ['Peanuts', 'Mushrooms'],
            extraNotes: 'I batch cook Sundays',
        },
        library: [],
        trainingDays: [],
    });
    strict_1.default.ok(prompt.includes('STRICT vegetarian'));
    strict_1.default.ok(prompt.includes('Burritos, Overnight oats'));
    strict_1.default.ok(prompt.includes('want to try: Poke bowls'));
    strict_1.default.ok(prompt.includes('NEVER include these foods'));
    strict_1.default.ok(prompt.includes('Peanuts, Mushrooms'));
    strict_1.default.ok(prompt.includes('batch cook Sundays'));
});
(0, node_test_1.default)('prompt: default prefs add no taste or diet sections', () => {
    const prompt = (0, mealPlan_1.buildMealPlanPrompt)({
        displayName: 'Jason',
        eventDate: '2027-06-19',
        distanceKm: 96,
        phase: 'base',
        weekKey: '2026-W31',
        weekDates: WEEK,
        prefs: mealPlan_1.DEFAULT_MEAL_PREFS,
        library: [],
        trainingDays: [],
    });
    strict_1.default.ok(!prompt.includes('Dietary rules'));
    strict_1.default.ok(!prompt.includes('Foods they love'));
});
(0, node_test_1.default)('mealPlanIssues: avoided foods in meal text are flagged for repair', () => {
    const days = validWeek();
    days[2].meals[2] = {
        slot: 'dinner',
        libraryRefId: null,
        text: 'Peanut satay noodles',
        tag: null,
    };
    const issues = (0, mealPlan_1.mealPlanIssues)(days, {
        ...BASE_ARGS,
        prefs: { ...mealPlan_1.DEFAULT_MEAL_PREFS, avoidFoods: ['peanut'] },
    });
    strict_1.default.ok(issues.some((i) => i.includes('avoided food "peanut"')));
    // Clean plan with the same avoid list passes.
    strict_1.default.deepEqual((0, mealPlan_1.mealPlanIssues)(validWeek(), {
        ...BASE_ARGS,
        prefs: { ...mealPlan_1.DEFAULT_MEAL_PREFS, avoidFoods: ['peanut'] },
    }), []);
});
(0, node_test_1.default)('schema: rejects wrong slot and >10 meals per day', () => {
    const bad = {
        days: validWeek().map((d, i) => i === 0
            ? { ...d, meals: [{ slot: 'supper', libraryRefId: null, text: 'x', tag: null }] }
            : d),
    };
    strict_1.default.equal(mealPlan_1.mealPlanSchema.safeParse(bad).success, false);
});
(0, node_test_1.default)('libraryCoveragePct', () => {
    strict_1.default.equal((0, mealPlan_1.libraryCoveragePct)(validWeek('lib-1')), 25);
    strict_1.default.equal((0, mealPlan_1.libraryCoveragePct)(validWeek()), 0);
});
//# sourceMappingURL=mealPlan.test.js.map