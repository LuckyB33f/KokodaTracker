import { useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { useAppDispatch } from '@/app/hooks'
import { auth } from '@/lib/firebase'
import { userApi } from '@/services/userApi'
import { authStateChanged } from '../authSlice'
import type { AuthUser } from '../types/authTypes'

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
}

// Mounted once in App. Firebase Auth is the source of truth; Redux mirrors it.
export function useAuthListener() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(authStateChanged(toAuthUser(user)))
        void dispatch(
          userApi.endpoints.ensureUserProfile.initiate({ uid: user.uid }),
        )
      } else {
        dispatch(authStateChanged(null))
      }
    })
    return unsubscribe
  }, [dispatch])
}
