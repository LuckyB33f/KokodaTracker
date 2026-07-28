"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weekKeyFor = weekKeyFor;
exports.brisbaneWeekDates = brisbaneWeekDates;
exports.shiftWeeks = shiftWeeks;
exports.todayBrisbane = todayBrisbane;
// Server mirror of src/utils/weekKey.ts — keep the two in sync.
const brisbaneYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
function weekKeyFor(date) {
    const [year, month, day] = brisbaneYmd
        .format(date)
        .split('-')
        .map((part) => Number(part));
    const utc = new Date(Date.UTC(year, month - 1, day));
    utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
    const isoYear = utc.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
// Mon..Sun yyyy-mm-dd strings for the Brisbane week containing `date`.
function brisbaneWeekDates(date) {
    const [year, month, day] = brisbaneYmd
        .format(date)
        .split('-')
        .map((part) => Number(part));
    const monday = new Date(Date.UTC(year, month - 1, day));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
    });
}
function shiftWeeks(date, weeks) {
    return new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}
function todayBrisbane() {
    return brisbaneYmd.format(new Date());
}
//# sourceMappingURL=weekKey.js.map