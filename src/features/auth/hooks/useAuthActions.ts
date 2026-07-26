import { useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { useAppDispatch } from '@/app/hooks'
import { auth, googleProvider } from '@/lib/firebase'
import { baseApi } from '@/services/baseApi'
import { resetSettings } from '@/features/settings/settingsSlice'
import { authStateChanged } from '../authSlice'
import { toAuthUser } from './useAuthListener'
import type {
  LoginFormValues,
  RegisterFormValues,
} from '../types/authTypes'

// Wraps Firebase Auth calls. Callers catch and render mapAuthError(error).
export function useAuthActions() {
  const dispatch = useAppDispatch()

  const register = useCallback(
    async ({ displayName, email, password }: RegisterFormValues) => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )
      await updateProfile(credential.user, {
        displayName: displayName.trim(),
      })
      // The listener already fired before displayName existed — re-sync.
      dispatch(authStateChanged(toAuthUser(credential.user)))
    },
    [dispatch],
  )

  const signIn = useCallback(async ({ email, password }: LoginFormValues) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  // Popup, not redirect: signInWithRedirect is unreliable under current
  // Safari/Chrome third-party-cookie rules unless served from authDomain.
  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const sendReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }, [])

  const signOutUser = useCallback(async () => {
    await signOut(auth)
    // Next account on this device must not see the previous user's cache.
    dispatch(baseApi.util.resetApiState())
    dispatch(resetSettings())
  }, [dispatch])

  return { register, signIn, signInWithGoogle, sendReset, signOutUser }
}
