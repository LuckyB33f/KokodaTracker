"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MEAL_PREFS = exports.mealPlanSchema = exports.MEAL_SLOTS = exports.MEAL_PLAN_PROMPT_VERSION = void 0;
exports.buildMealPlanPrompt = buildMealPlanPrompt;
exports.mealPlanIssues = mealPlanIssues;
exports.libraryCoveragePct = libraryCoveragePct;
const zod_1 = require("zod");
exports.MEAL_PLAN_PROMPT_VERSION = 1;
exports.MEAL_SLOTS = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'during',
];
const MAIN_SLOTS = ['breakfast', 'lunch', 'dinner'];
exports.mealPlanSchema = zod_1.z.object({
    days: zod_1.z
        .array(zod_1.z.object({
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        meals: zod_1.z
            .array(zod_1.z.object({
            slot: zod_1.z.enum(exports.MEAL_SLOTS),
            libraryRefId: zod_1.z.string().nullable(),
            text: zod_1.z.string().min(1).max(200),
            tag: zod_1.z.enum(['carb', 'protein', 'light']).nullable(),
        }))
            .min(1)
            .max(10),
    }))
        .length(7),
});
exports.DEFAULT_MEAL_PREFS = {
    mainMeals: 3,
    snacks: 2,
    duringTraining: true,
    macroFocus: 'balanced',
    dietStyle: 'none',
    favouriteFoods: [],
    foodsToTry: [],
    avoidFoods: [],
    extraNotes: '',
    questionnaireDone: false,
};
const DIET_RULE = {
    vegetarian: 'STRICT vegetarian — no meat, poultry, fish or seafood in any meal.',
    vegan: 'STRICT vegan — no meat, fish, dairy, eggs or honey in any meal.',
    pescatarian: 'Pescatarian — fish and seafood are fine; no other meat or poultry.',
};
// Clamp free-text lists before they hit the prompt (defensive: prefs are
// client-written).
function cleanList(items, max = 15) {
    return (items ?? [])
        .map((item) => String(item).trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, max);
}
const MACRO_LINE = {
    carb: 'Lean carb-forward across the week',
    protein: 'Lean protein-forward across the week',
    balanced: 'Keep the week balanced across carbs and protein',
};
function buildMealPlanPrompt(args) {
    const trainingLines = args.trainingDays.length > 0
        ? args.trainingDays
            .map((d) => `- ${d.date}: ${d.title} (${d.targetType} ${d.targetValue}${d.targetType === 'distance' ? 'km' : d.targetType === 'duration' ? 'min' : ''})`)
            .join('\n')
        : '- No planned sessions this week.';
    const libraryLines = args.library.length > 0
        ? args.library
            .map((item) => `- id "${item.id}" | ${item.text}${item.tag ? ` | ${item.tag}` : ''}${item.favourite ? ' | favourite' : ''}`)
            .join('\n')
        : '- (empty — use plain descriptions with libraryRefId null)';
    const duringRule = args.prefs.duringTraining
        ? `Include "during" slot fuel ONLY on the training days listed above (30-60g carbs/hr style on long hikes).`
        : `NEVER use the "during" slot — this member doesn't log during-training fuel.`;
    // F13C questionnaire → taste context + hard dietary rules.
    const favourites = cleanList(args.prefs.favouriteFoods);
    const toTry = cleanList(args.prefs.foodsToTry);
    const avoid = cleanList(args.prefs.avoidFoods);
    const notes = (args.prefs.extraNotes ?? '').trim().slice(0, 300);
    const tasteLines = [
        favourites.length > 0
            ? `Foods they love (lean on these often): ${favourites.join(', ')}.`
            : null,
        toTry.length > 0
            ? `Foods they want to try: ${toTry.join(', ')}. Work 3-5 of these into the week as simple, practical meals (libraryRefId null).`
            : null,
        notes ? `Their own words about food preferences: "${notes}"` : null,
    ]
        .filter(Boolean)
        .join('\n');
    const dietRules = [
        args.prefs.dietStyle !== 'none' ? `- ${DIET_RULE[args.prefs.dietStyle]}` : null,
        avoid.length > 0
            ? `- NEVER include these foods in any meal (allergies/dislikes): ${avoid.join(', ')}.`
            : null,
    ]
        .filter(Boolean)
        .join('\n');
    return `You are a practical endurance-training fuelling assistant writing ONE week of meals for ${args.displayName}, who is training for the Kokoda Challenge (${args.distanceKm} km trail event on ${args.eventDate}). Training phase: ${args.phase}. Week: ${args.weekKey}.

Their planned training this week:
${trainingLines}

Their meal library (foods they actually eat — strongly prefer these):
${libraryLines}
${tasteLines ? `\n${tasteLines}\n` : ''}${dietRules ? `\nDietary rules (non-negotiable):\n${dietRules}\n` : ''}
Structure rules (non-negotiable):
- Return JSON ONLY matching: {"days":[{"date":"YYYY-MM-DD","meals":[{"slot":"breakfast|lunch|dinner|snack|during","libraryRefId":"<id or null>","text":"...","tag":"carb|protein|light" or null}]} x7]}
- Use ONLY these dates, one entry each, in order: ${args.weekDates.join(', ')}.
- Each day MUST have exactly ${args.prefs.mainMeals} main meals (slots breakfast/lunch/dinner) and at most ${args.prefs.snacks} snacks.
- ${duringRule}
- When a meal is from the library, set libraryRefId to its id and copy its text; otherwise libraryRefId null. Use library items for at least half the meals when the library has 10 or more items.
- ${MACRO_LINE[args.prefs.macroFocus]}, and always carb-centred around the key sessions listed.

Nutrition principles (apply, don't recite):
- Carb-centred meals around key sessions; roughly 20-30g protein after training.
- Gut training on long hikes (30-60g carbs/hr) from Feb 2027 onwards.
- Race-week guidance only if the phase is taper.

Tone constraints (non-negotiable):
- NO calorie counts or targets. NO weight-loss, restriction, or body-composition framing. No medical or dietetic advice. Practical training fuel only — keep each text short and concrete.`;
}
// Semantic checks Zod can't express; failures go back to Gemini for repair.
function mealPlanIssues(days, args) {
    const issues = [];
    const seenDates = days.map((d) => d.date);
    for (const date of args.weekDates) {
        if (!seenDates.includes(date))
            issues.push(`missing date ${date}`);
    }
    for (const day of days) {
        if (!args.weekDates.includes(day.date)) {
            issues.push(`date ${day.date} is not in this week`);
            continue;
        }
        const mains = day.meals.filter((m) => MAIN_SLOTS.includes(m.slot)).length;
        if (mains !== args.prefs.mainMeals) {
            issues.push(`${day.date} has ${mains} main meals; needs exactly ${args.prefs.mainMeals}`);
        }
        const snacks = day.meals.filter((m) => m.slot === 'snack').length;
        if (snacks > args.prefs.snacks) {
            issues.push(`${day.date} has ${snacks} snacks; at most ${args.prefs.snacks} allowed`);
        }
        for (const meal of day.meals) {
            if (meal.slot === 'during') {
                if (!args.prefs.duringTraining) {
                    issues.push(`"during" slot used on ${day.date} but member has it off`);
                }
                else if (!args.trainingDates.has(day.date)) {
                    issues.push(`"during" slot on ${day.date}, which has no training`);
                }
            }
            if (meal.libraryRefId !== null && !args.libraryIds.has(meal.libraryRefId)) {
                issues.push(`unknown libraryRefId "${meal.libraryRefId}"`);
            }
            // Deterministic allergy/dislike guard — the prompt already forbids
            // these; a slip goes back to Gemini for repair. Substring match on
            // terms ≥3 chars keeps false positives rare.
            const text = meal.text.toLowerCase();
            for (const term of cleanList(args.prefs.avoidFoods)) {
                if (term.length >= 3 && text.includes(term.toLowerCase())) {
                    issues.push(`"${meal.text}" on ${day.date} contains avoided food "${term}"`);
                }
            }
        }
    }
    if (args.libraryIds.size >= 10) {
        const all = days.flatMap((d) => d.meals);
        const fromLibrary = all.filter((m) => m.libraryRefId !== null).length;
        if (fromLibrary / all.length < 0.5) {
            issues.push(`only ${fromLibrary}/${all.length} meals use the library; at least half must (library has ${args.libraryIds.size} items)`);
        }
    }
    return [...new Set(issues)].slice(0, 12);
}
function libraryCoveragePct(days) {
    const all = days.flatMap((d) => d.meals);
    if (all.length === 0)
        return 0;
    return Math.round((all.filter((m) => m.libraryRefId !== null).length / all.length) * 100);
}
//# sourceMappingURL=mealPlan.js.map