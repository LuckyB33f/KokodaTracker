import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import type { AuthStatus, AuthUser } from './types/authTypes'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

// 'initializing' until the first onAuthStateChanged callback — this is what
// stops ProtectedRoute redirecting to /login during the refresh handshake.
const initialState: AuthState = {
  status: 'initializing',
  user: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStateChanged(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload
      state.status = action.payload ? 'authenticated' : 'unauthenticated'
    },
  },
})

export const { authStateChanged } = authSlice.actions

export const selectAuthStatus = (state: RootState): AuthStatus =>
  state.auth.status
export const selectAuthUser = (state: RootState): AuthUser | null =>
  state.auth.user

export default authSlice.reducer
