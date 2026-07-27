"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAMP_CAP = exports.MIN_HISTORY_WEEKS = void 0;
exports.computeVerdict = computeVerdict;
exports.loadCeiling = loadCeiling;
exports.computeAcwr = computeAcwr;
exports.MIN_HISTORY_WEEKS = 4;
exports.RAMP_CAP = 1.1; // +10% weekly load ceiling (spec hard rule)
function computeVerdict(input) {
    if (input.weeksOfHistory < exports.MIN_HISTORY_WEEKS) {
        return {
            verdict: 'hold',
            reason: `Holding steady — building your training history (${input.weeksOfHistory}/${exports.MIN_HISTORY_WEEKS} weeks).`,
        };
    }
    const completion = input.completionPct;
    const effort = input.avgEffort;
    const acwr = input.acwr;
    const shouldScaleBack = (completion !== null && completion < 60) ||
        input.sustainedHighEffort ||
        (acwr !== null && acwr > 1.5);
    if (shouldScaleBack) {
        const reason = acwr !== null && acwr > 1.5
            ? 'Scaled back — your load spiked above the safe ramp (recovery week).'
            : input.sustainedHighEffort
                ? 'Scaled back — effort has been maxed for weeks; time to recover.'
                : 'Scaled back — last week didn’t stick, so we’re consolidating.';
        return { verdict: 'scale_back', reason };
    }
    // Taper never scales up (spec hard rule).
    if (input.phase === 'taper') {
        return { verdict: 'hold', reason: 'Taper — holding load to arrive fresh.' };
    }
    const shouldScaleUp = completion !== null &&
        completion >= 90 &&
        effort !== null &&
        effort <= 4 &&
        acwr !== null &&
        acwr <= 1.2;
    if (shouldScaleUp) {
        return { verdict: 'scale_up', reason: 'Scaled up — you cruised last week.' };
    }
    return { verdict: 'hold', reason: 'Holding — nice and consistent.' };
}
// Load ceiling for next week, in the same units as load (min × effort).
// Computed in code (spec §2.4): the model may never exceed it.
function loadCeiling(lastWeekLoad, verdict) {
    if (lastWeekLoad <= 0)
        return 600; // cold start ≈ 2h at moderate effort
    if (verdict === 'scale_up')
        return Math.round(lastWeekLoad * exports.RAMP_CAP);
    if (verdict === 'scale_back')
        return Math.round(lastWeekLoad * 0.7);
    return Math.round(lastWeekLoad);
}
// ACWR = latest week load ÷ mean of the 4 weeks before it.
function computeAcwr(weeklyLoads) {
    if (weeklyLoads.length < exports.MIN_HISTORY_WEEKS + 1)
        return null;
    const latest = weeklyLoads[weeklyLoads.length - 1];
    const chronic = weeklyLoads.slice(-5, -1);
    const mean = chronic.reduce((sum, load) => sum + load, 0) / chronic.length;
    if (mean === 0)
        return null;
    return Math.round((latest / mean) * 100) / 100;
}
//# sourceMappingURL=verdict.js.map