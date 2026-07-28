"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mealText_1 = require("./mealText");
(0, node_test_1.default)('normaliseMealText: case, whitespace and punctuation collapse', () => {
    strict_1.default.equal((0, mealText_1.normaliseMealText)('  Chicken & Rice,  with veg!! '), 'chicken rice with veg');
    strict_1.default.equal((0, mealText_1.normaliseMealText)('CHICKEN and rice'), 'chicken and rice');
    strict_1.default.equal((0, mealText_1.normaliseMealText)('weet-bix + milk'), 'weet bix milk');
});
(0, node_test_1.default)('normaliseMealText: keeps unicode letters and digits', () => {
    strict_1.default.equal((0, mealText_1.normaliseMealText)('Açaí bowl ×2'), 'açaí bowl 2');
});
(0, node_test_1.default)('fnv1a64: stable known vectors', () => {
    // Classic FNV-1a 64 test vectors.
    strict_1.default.equal((0, mealText_1.fnv1a64)(''), 'cbf29ce484222325');
    strict_1.default.equal((0, mealText_1.fnv1a64)('a'), 'af63dc4c8601ec8c');
});
(0, node_test_1.default)('libraryIdFor: same meal in different casing/punctuation collides', () => {
    strict_1.default.equal((0, mealText_1.libraryIdFor)('Chicken & rice, with veg'), (0, mealText_1.libraryIdFor)('chicken   rice with veg'));
});
(0, node_test_1.default)('libraryIdFor: distinct meals get distinct ids', () => {
    strict_1.default.notEqual((0, mealText_1.libraryIdFor)('chicken and rice'), (0, mealText_1.libraryIdFor)('tuna pasta'));
});
(0, node_test_1.default)('libraryIdFor: 16-char lowercase hex', () => {
    strict_1.default.match((0, mealText_1.libraryIdFor)('porridge with banana'), /^[0-9a-f]{16}$/);
});
//# sourceMappingURL=mealText.test.js.map