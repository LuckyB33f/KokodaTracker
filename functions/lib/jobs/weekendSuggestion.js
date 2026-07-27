"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weekendSuggestion = weekendSuggestion;
const admin_1 = require("../lib/admin");
const gemini_1 = require("../lib/gemini");
const weekKey_1 = require("../lib/weekKey");
const suggestion_1 = require("../logic/suggestion");
function fallbackSentence(pick) {
    if (!pick) {
        return 'Storms are forecast across the whole weekend — train indoors or keep it short and local, and watch Friday’s update.';
    }
    return `${pick.dayLabel} ${pick.startTime} from ${pick.locationName} looks like the window${pick.reasons.length ? ` — ${pick.reasons[0].toLowerCase()}` : ''}.`;
}
// F10: deterministic gates pick the window; Gemini only phrases it.
async function weekendSuggestion(geminiApiKey) {
    const weatherSnap = await admin_1.db.doc(`weather/${(0, weekKey_1.todayBrisbane)()}`).get();
    const weatherDoc = weatherSnap.exists
        ? weatherSnap
        : // fall back to the most recent stored day
            (await admin_1.db
                .collection('weather')
                .orderBy('__name__', 'desc')
                .limit(1)
                .get()).docs[0];
    if (!weatherDoc?.exists)
        return;
    const locations = weatherDoc.data()?.locations ?? [];
    const pick = (0, suggestion_1.pickWeekendWindow)(locations);
    const weekKey = (0, weekKey_1.weekKeyFor)(new Date());
    const teams = await admin_1.db.collection('teams').get();
    for (const teamDoc of teams.docs) {
        const distanceKm = teamDoc.data().eventDistanceKm ?? 48;
        let reasoning;
        try {
            reasoning = await (0, gemini_1.geminiText)(geminiApiKey, pick
                ? `Write ONE short, friendly Aussie sentence suggesting this weekend hike to a team training for a ${distanceKm}km trail event. Facts (do not contradict them): day ${pick.dayLabel}, start ${pick.startTime}, location ${pick.locationName}, storm probability ${pick.stormProb ?? 0}%, rain probability ${pick.precipProb ?? 0}%, max temp ${pick.tMax ?? 'unknown'}°C. Constraints already applied: ${pick.reasons.join('; ') || 'none'}. No emojis, no medical advice.`
                : `Write ONE short, friendly Aussie sentence telling a hiking team that storms rule out both weekend days, so they should keep training short and local and check Friday's update. No emojis.`);
        }
        catch {
            reasoning = fallbackSentence(pick);
        }
        await teamDoc.ref.collection('suggestions').doc(weekKey).set({
            createdAt: new Date(),
            updatedAt: new Date(),
            status: pick ? 'go' : 'no_window',
            pick: pick
                ? {
                    day: pick.day,
                    dayLabel: pick.dayLabel,
                    startTime: pick.startTime,
                    locationName: pick.locationName,
                    distanceKm: Math.min(20, Math.round(distanceKm / 2)),
                }
                : null,
            reasoning,
            weatherSnapshot: pick
                ? {
                    stormProb: pick.stormProb,
                    precipProb: pick.precipProb,
                    tMax: pick.tMax,
                    gates: pick.reasons,
                }
                : { gates: ['All weekend windows over 30% storm probability'] },
        }, { merge: true });
    }
}
//# sourceMappingURL=weekendSuggestion.js.map