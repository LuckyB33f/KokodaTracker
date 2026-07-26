// Serializable projection of firebase/auth User — the raw User object never
// enters Redux.
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

export interface LoginFormValues {
  email: string
  password: string
}

export interface RegisterFormValues {
  displayName: string
  email: string
  password: string
  confirmPassword: string
}

export interface ResetPasswordFormValues {
  email: string
}
