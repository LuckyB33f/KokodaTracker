"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOT_DAY_C = exports.STORM_REJECT_PCT = void 0;
exports.pickWeekendWindow = pickWeekendWindow;
exports.STORM_REJECT_PCT = 30;
exports.HOT_DAY_C = 30;
function dayLabelOf(date) {
    const [y, m, d] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (weekday === 6)
        return 'Saturday';
    if (weekday === 0)
        return 'Sunday';
    return null;
}
// Choose the best Sat/Sun window across locations. Returns null when every
// candidate fails the storm gate (honest "stay home" outcome).
function pickWeekendWindow(locations) {
    const candidates = [];
    for (const location of locations) {
        for (const day of location.days) {
            const label = dayLabelOf(day.date);
            if (!label)
                continue;
            candidates.push({
                date: day.date,
                dayLabel: label,
                location: location.name,
                day,
            });
        }
    }
    if (candidates.length === 0)
        return null;
    const safe = candidates.filter((candidate) => (candidate.day.stormProb ?? 0) <= exports.STORM_REJECT_PCT);
    if (safe.length === 0)
        return null;
    // Score: prefer low storm, then low rain, then cooler max.
    const scored = safe
        .map((candidate) => ({
        candidate,
        score: (candidate.day.stormProb ?? 0) * 3 +
            (candidate.day.precipProb ?? 0) * 2 +
            Math.max(0, (candidate.day.tMax ?? 25) - 24),
    }))
        .sort((a, b) => a.score - b.score);
    const best = scored[0].candidate;
    const reasons = [];
    const hot = (best.day.tMax ?? 0) > exports.HOT_DAY_C;
    const rejectedLabels = new Set(candidates
        .filter((c) => (c.day.stormProb ?? 0) > exports.STORM_REJECT_PCT)
        .map((c) => c.dayLabel));
    if (rejectedLabels.has(best.dayLabel === 'Saturday' ? 'Sunday' : 'Saturday')) {
        reasons.push(`${best.dayLabel === 'Saturday' ? 'Sunday' : 'Saturday'} rejected — storm probability above ${exports.STORM_REJECT_PCT}%`);
    }
    if (hot) {
        reasons.push(`Forecast max ${best.day.tMax}°C — start early before the heat`);
    }
    if ((best.day.precipProb ?? 0) > 0 || (best.day.stormProb ?? 0) > 0) {
        reasons.push(`Rain ${best.day.precipProb ?? 0}% · storms ${best.day.stormProb ?? 0}%`);
    }
    return {
        day: best.date,
        dayLabel: best.dayLabel,
        startTime: hot ? '5:30am' : '6:30am',
        locationName: best.location,
        reasons,
        stormProb: best.day.stormProb,
        precipProb: best.day.precipProb,
        tMax: best.day.tMax,
    };
}
//# sourceMappingURL=suggestion.js.map