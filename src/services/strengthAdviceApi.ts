import {
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
  StrengthAdvice,
  StrengthAdviceRequest,
} from '@/features/sessions/types/strengthAdviceTypes'
import { baseApi, type ApiError } from './baseApi'

function toApiError(error: unknown): { error: ApiError } {
  const firebaseError = error as { code?: string; message?: string }
  return {
    error: {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? 'Something went wrong. Please try again.',
    },
  }
}

export const strengthAdviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Live view of the member's single advice doc — request progress and the
    // resulting advice both stream through here (queue pattern, spec §2.5).
    getStrengthAdvice: builder.query<
      StrengthAdviceRequest | null,
      { teamId: string; uid: string }
    >({
      queryFn: async () => ({ data: null }),
      async onCacheEntryAdded(
        { teamId, uid },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          doc(db, 'teams', teamId, 'strengthAdviceRequests', uid),
          (snap) => {
            updateCachedData(() => {
              if (!snap.exists()) return null
              const data = snap.data()
              const updatedAt = data.updatedAt
              return {
                status: data.status as StrengthAdviceRequest['status'],
                advice: (data.advice as StrengthAdvice | undefined) ?? null,
                errorMessage: (data.errorMessage as string | undefined) ?? null,
                updatedAtMs:
                  updatedAt instanceof Timestamp ? updatedAt.toMillis() : null,
              }
            })
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['StrengthAdvice'],
    }),

    // Fire-and-forget: reset the doc to 'pending'; the trigger overwrites it
    // with advice and the stream above picks it up.
    requestStrengthAdvice: builder.mutation<void, { teamId: string }>({
      queryFn: async ({ teamId }) => {
        try {
          const user = auth.currentUser
          if (!user) {
            throw Object.assign(new Error('Sign in first.'), {
              code: 'unauthenticated',
            })
          }
          await setDoc(
            doc(db, 'teams', teamId, 'strengthAdviceRequests', user.uid),
            {
              requestedBy: user.uid,
              status: 'pending',
              createdAt: serverTimestamp(),
            },
          )
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),
  }),
})

export const { useGetStrengthAdviceQuery, useRequestStrengthAdviceMutation } =
  strengthAdviceApi
