"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const generatePlan_1 = require("./generatePlan");
const weekKey_1 = require("../lib/weekKey");
const WEEK = [
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
];
function validDays(uid) {
    return [
        { date: WEEK[0], memberUid: uid, title: 'Walk', detail: 'easy', targetType: 'duration', targetValue: 45 },
        { date: WEEK[1], memberUid: uid, title: 'Rest', detail: 'off', targetType: 'rest', targetValue: 0 },
        { date: WEEK[2], memberUid: uid, title: 'Rest', detail: 'off', targetType: 'rest', targetValue: 0 },
        { date: WEEK[5], memberUid: null, title: 'Team hike', detail: 'trail', targetType: 'distance', targetValue: 15 },
    ];
}
(0, node_test_1.default)('planIssues: clean plan has no issues', () => {
    strict_1.default.deepEqual((0, generatePlan_1.planIssues)(validDays('u1'), ['u1'], WEEK), []);
});
(0, node_test_1.default)('planIssues: flags wrong dates, unknown uids, missing team hike and rest days', () => {
    const days = [
        { date: '2026-01-01', memberUid: 'ghost', title: 'X', detail: 'y', targetType: 'duration', targetValue: 60 },
    ];
    const issues = (0, generatePlan_1.planIssues)(days, ['u1'], WEEK);
    strict_1.default.ok(issues.some((i) => i.includes('2026-01-01')));
    strict_1.default.ok(issues.some((i) => i.includes('ghost')));
    strict_1.default.ok(issues.some((i) => i.includes('Saturday')));
    strict_1.default.ok(issues.some((i) => i.includes('rest day')));
});
(0, node_test_1.default)('planIssues: rest day with nonzero target is flagged', () => {
    const days = validDays('u1');
    days[1] = { ...days[1], targetValue: 30 };
    const issues = (0, generatePlan_1.planIssues)(days, ['u1'], WEEK);
    strict_1.default.ok(issues.some((i) => i.includes('targetValue 0')));
});
(0, node_test_1.default)('brisbaneWeekDates: Monday-first consecutive week containing the date', () => {
    // 2026-07-28 is a Tuesday in Brisbane.
    const dates = (0, weekKey_1.brisbaneWeekDates)(new Date('2026-07-28T12:00:00+10:00'));
    strict_1.default.deepEqual(dates, WEEK);
});
//# sourceMappingURL=generatePlan.test.js.map