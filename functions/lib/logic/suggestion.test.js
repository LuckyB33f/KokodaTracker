"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const suggestion_1 = require("./suggestion");
// 2026-08-01 is a Saturday, 2026-08-02 a Sunday.
function forecast(saturday, sunday) {
    const blank = {
        tMin: 10,
        tMax: 22,
        precipProb: 10,
        stormProb: 0,
        sunrise: null,
        sunset: null,
        summary: null,
    };
    return [
        {
            name: 'Brookfield Reserve',
            days: [
                { ...blank, date: '2026-08-01', ...saturday },
                { ...blank, date: '2026-08-02', ...sunday },
            ],
        },
    ];
}
(0, node_test_1.test)('stormy Saturday, clear Sunday → picks Sunday', () => {
    const pick = (0, suggestion_1.pickWeekendWindow)(forecast({ stormProb: 60 }, { stormProb: 5 }));
    strict_1.default.ok(pick);
    strict_1.default.equal(pick.dayLabel, 'Sunday');
    strict_1.default.ok(pick.reasons.some((r) => r.includes('Saturday rejected')));
});
(0, node_test_1.test)('hot day → early 5:30am start', () => {
    const pick = (0, suggestion_1.pickWeekendWindow)(forecast({ tMax: 33 }, { tMax: 35 }));
    strict_1.default.ok(pick);
    strict_1.default.equal(pick.startTime, '5:30am');
    strict_1.default.equal(pick.dayLabel, 'Saturday'); // cooler of the two
});
(0, node_test_1.test)('mild weekend → normal start, lower-rain day wins', () => {
    const pick = (0, suggestion_1.pickWeekendWindow)(forecast({ precipProb: 40 }, { precipProb: 5 }));
    strict_1.default.ok(pick);
    strict_1.default.equal(pick.startTime, '6:30am');
    strict_1.default.equal(pick.dayLabel, 'Sunday');
});
(0, node_test_1.test)('both days stormy → no pick (stay home)', () => {
    const pick = (0, suggestion_1.pickWeekendWindow)(forecast({ stormProb: 70 }, { stormProb: 45 }));
    strict_1.default.equal(pick, null);
});
//# sourceMappingURL=suggestion.test.js.map