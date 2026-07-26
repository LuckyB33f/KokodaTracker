import { updateProfile } from 'firebase/auth'
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserProfile } from '@/features/profile/types/profileTypes'
import { baseApi, type ApiError } from './baseApi'

interface UpdateUserProfileArgs {
  uid: string
  patch: Partial<Pick<UserProfile, 'activeTeamId' | 'units' | 'theme'>>
  displayName?: string
}

function toApiError(error: unknown): { error: ApiError } {
  const firebaseError = error as { code?: string; message?: string }
  return {
    error: {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? 'Something went wrong. Please try again.',
    },
  }
}

function snapshotToProfile(data: Record<string, unknown>): UserProfile {
  const createdAt = data.createdAt
  return {
    activeTeamId: (data.activeTeamId as string | null) ?? null,
    units: (data.units as UserProfile['units']) ?? 'metric',
    theme: (data.theme as UserProfile['theme']) ?? 'system',
    createdAtMs:
      createdAt instanceof Timestamp ? createdAt.toMillis() : null,
  }
}

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserProfile: builder.query<UserProfile | null, string>({
      queryFn: async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid))
          return {
            data: snap.exists() ? snapshotToProfile(snap.data()) : null,
          }
        } catch (error) {
          return toApiError(error)
        }
      },
      providesTags: ['UserProfile'],
    }),

    // First-login doc creation (spec F1). Idempotent — safe to fire on every
    // sign-in, which lets email/password and Google share one path.
    ensureUserProfile: builder.mutation<void, { uid: string }>({
      queryFn: async ({ uid }) => {
        try {
          const ref = doc(db, 'users', uid)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            await setDoc(ref, {
              activeTeamId: null,
              units: 'metric',
              theme: 'system',
              createdAt: serverTimestamp(),
            })
          }
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
      invalidatesTags: ['UserProfile'],
    }),

    updateUserProfile: builder.mutation<void, UpdateUserProfileArgs>({
      queryFn: async ({ uid, patch, displayName }) => {
        try {
          if (Object.keys(patch).length > 0) {
            await updateDoc(doc(db, 'users', uid), patch)
          }
          const currentUser = auth.currentUser
          if (
            displayName !== undefined &&
            currentUser &&
            displayName !== currentUser.displayName
          ) {
            await updateProfile(currentUser, { displayName })
          }
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
      invalidatesTags: ['UserProfile'],
    }),
  }),
})

export const {
  useGetUserProfileQuery,
  useEnsureUserProfileMutation,
  useUpdateUserProfileMutation,
} = userApi
