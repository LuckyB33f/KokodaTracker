import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
  MealPlan,
  MealPlanRequest,
} from '@/features/meals/types/mealPlanTypes'
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

export const mealPlanApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMealPlan: builder.query<
      MealPlan | null,
      { uid: string; weekKey: string }
    >({
      queryFn: async () => ({ data: null }),
      async onCacheEntryAdded(
        { uid, weekKey },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          doc(db, 'users', uid, 'mealPlans', weekKey),
          (snap) => {
            updateCachedData(() => {
              if (!snap.exists()) return null
              const data = snap.data()
              const generatedAt = data.generatedAt
              return {
                weekKey,
                phase: (data.phase as string) ?? '',
                version: (data.version as number) ?? 1,
                generatedAtMs:
                  generatedAt instanceof Timestamp
                    ? generatedAt.toMillis()
                    : null,
                libraryCoveragePct: (data.libraryCoveragePct as number) ?? 0,
                days: (data.days as MealPlan['days'] | undefined) ?? [],
              }
            })
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['MealPlan'],
    }),

    // Fire-and-forget (same UX as training plans): write the request doc and
    // return; the latest-request stream reports progress.
    requestMealPlan: builder.mutation<
      { requestId: string },
      { teamId: string; scope: 'self' | 'team' }
    >({
      queryFn: async ({ teamId, scope }) => {
        try {
          const user = auth.currentUser
          if (!user) {
            throw Object.assign(new Error('Sign in first.'), {
              code: 'unauthenticated',
            })
          }
          const requestRef = doc(
            collection(db, 'teams', teamId, 'mealPlanRequests'),
          )
          await setDoc(requestRef, {
            requestedBy: user.uid,
            scope,
            status: 'pending',
            createdAt: serverTimestamp(),
          })
          return { data: { requestId: requestRef.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    getLatestMealPlanRequest: builder.query<MealPlanRequest | null, string>({
      queryFn: async () => ({ data: null }),
      async onCacheEntryAdded(
        teamId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const latestQuery = query(
          collection(db, 'teams', teamId, 'mealPlanRequests'),
          orderBy('createdAt', 'desc'),
          limit(1),
        )
        const unsubscribe = onSnapshot(latestQuery, (snap) => {
          const docSnap = snap.docs[0]
          updateCachedData(() => {
            if (!docSnap) return null
            const data = docSnap.data()
            const createdAt = data.createdAt
            return {
              id: docSnap.id,
              scope: (data.scope as 'self' | 'team') ?? 'self',
              requestedBy: (data.requestedBy as string) ?? '',
              status: data.status as MealPlanRequest['status'],
              results:
                (data.results as MealPlanRequest['results'] | undefined) ??
                null,
              errorMessage: (data.errorMessage as string | undefined) ?? null,
              createdAtMs:
                createdAt instanceof Timestamp ? createdAt.toMillis() : null,
            }
          })
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['MealPlanRequest'],
    }),
  }),
})

export const {
  useGetMealPlanQuery,
  useRequestMealPlanMutation,
  useGetLatestMealPlanRequestQuery,
} = mealPlanApi
