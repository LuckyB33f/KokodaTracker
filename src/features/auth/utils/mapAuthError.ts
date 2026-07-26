const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in popup. Allow popups and try again.',
}

export function mapAuthError(error: unknown): string {
  const code = (error as { code?: string }).code
  if (code && MESSAGES[code]) {
    return MESSAGES[code]
  }
  return 'Something went wrong. Please try again.'
}
