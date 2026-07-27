"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
// Admin SDK bypasses security rules — every write path in these functions is
// therefore a §5 "function-written only" surface. Keep it that way.
exports.db = (0, firestore_1.getFirestore)();
//# sourceMappingURL=admin.js.map