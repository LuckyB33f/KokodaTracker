"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const verdict_1 = require("./verdict");
const base = {
    phase: 'build1',
    weeksOfHistory: 6,
    sustainedHighEffort: false,
};
(0, node_test_1.test)('scenario 1: cruising member scales up', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        completionPct: 95,
        avgEffort: 3.5,
        acwr: 1.1,
    });
    strict_1.default.equal(result.verdict, 'scale_up');
});
(0, node_test_1.test)('scenario 2: struggling member scales back (low completion)', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        completionPct: 45,
        avgEffort: 6,
        acwr: 1.0,
    });
    strict_1.default.equal(result.verdict, 'scale_back');
});
(0, node_test_1.test)('scenario 2b: ACWR spike forces recovery even with high completion', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        completionPct: 100,
        avgEffort: 3,
        acwr: 1.6,
    });
    strict_1.default.equal(result.verdict, 'scale_back');
});
(0, node_test_1.test)('scenario 3: middling week holds', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        completionPct: 75,
        avgEffort: 6,
        acwr: 1.1,
    });
    strict_1.default.equal(result.verdict, 'hold');
});
(0, node_test_1.test)('taper is never scaled up', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        phase: 'taper',
        completionPct: 100,
        avgEffort: 2,
        acwr: 1.0,
    });
    strict_1.default.equal(result.verdict, 'hold');
});
(0, node_test_1.test)('taper can still scale back', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        phase: 'taper',
        completionPct: 40,
        avgEffort: 9,
        acwr: 1.0,
    });
    strict_1.default.equal(result.verdict, 'scale_back');
});
(0, node_test_1.test)('no verdicts before 4 weeks of history', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        weeksOfHistory: 3,
        completionPct: 100,
        avgEffort: 2,
        acwr: 1.0,
    });
    strict_1.default.equal(result.verdict, 'hold');
});
(0, node_test_1.test)('sustained high effort scales back', () => {
    const result = (0, verdict_1.computeVerdict)({
        ...base,
        sustainedHighEffort: true,
        completionPct: 92,
        avgEffort: 8.5,
        acwr: 1.1,
    });
    strict_1.default.equal(result.verdict, 'scale_back');
});
(0, node_test_1.test)('ceiling caps scale_up at +10%', () => {
    strict_1.default.equal((0, verdict_1.loadCeiling)(1000, 'scale_up'), 1100);
    strict_1.default.equal((0, verdict_1.loadCeiling)(1000, 'hold'), 1000);
    strict_1.default.equal((0, verdict_1.loadCeiling)(1000, 'scale_back'), 700);
});
(0, node_test_1.test)('ACWR needs 5 weeks and divides by 4-week chronic mean', () => {
    strict_1.default.equal((0, verdict_1.computeAcwr)([100, 100, 100, 100]), null);
    strict_1.default.equal((0, verdict_1.computeAcwr)([100, 100, 100, 100, 150]), 1.5);
    strict_1.default.equal((0, verdict_1.computeAcwr)([0, 0, 0, 0, 100]), null);
});
//# sourceMappingURL=verdict.test.js.map