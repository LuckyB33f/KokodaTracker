import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()

// Admin SDK bypasses security rules — every write path in these functions is
// therefore a §5 "function-written only" surface. Keep it that way.
export const db = getFirestore()
