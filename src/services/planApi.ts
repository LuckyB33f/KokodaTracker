import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
  Checkoff,
  Plan,
  WeekendSuggestion,
} from '@/features/plan/types/planTypes'
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

function toPlan(id: string, data: Record<string, unknown>): Plan {
  const generatedAt = data.generatedAt
  return {
    id,
    weekKey: data.weekKey as string,
    phase: data.phase as string,
    status: data.status as Plan['status'],
    generatedAtMs:
      generatedAt instanceof Timestamp ? generatedAt.toMillis() : null,
    promptVersion: (data.promptVersion as number) ?? 1,
    readinessInputs:
      (data.readinessInputs as Plan['readinessInputs'] | undefined) ?? {},
    days: (data.days as Plan['days'] | undefined) ?? [],
  }
}

export const planApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivePlan: builder.query<Plan | null, string>({
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
        const planQuery = query(
          collection(db, 'teams', teamId, 'plans'),
          where('status', '==', 'active'),
          limit(1),
        )
        const unsubscribe = onSnapshot(planQuery, (snap) => {
          const docSnap = snap.docs[0]
          updateCachedData(() =>
            docSnap ? toPlan(docSnap.id, docSnap.data()) : null,
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Plan'],
    }),

    getCheckoffs: builder.query<
      Checkoff[],
      { teamId: string; planId: string }
    >({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        { teamId, planId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          collection(db, 'teams', teamId, 'plans', planId, 'checkoffs'),
          (snap) => {
            updateCachedData(() =>
              snap.docs.map((docSnap) => ({
                id: docSnap.id,
                uid: docSnap.data().uid as string,
                dayIndex: docSnap.data().dayIndex as number,
                done: Boolean(docSnap.data().done),
              })),
            )
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Checkoffs'],
    }),

    setCheckoff: builder.mutation<
      void,
      { teamId: string; planId: string; dayIndex: number; done: boolean }
    >({
      queryFn: async ({ teamId, planId, dayIndex, done }) => {
        try {
          const user = auth.currentUser
          if (!user) throw Object.assign(new Error(), { code: 'unauthenticated' })
          await setDoc(
            doc(
              db,
              'teams',
              teamId,
              'plans',
              planId,
              'checkoffs',
              `${user.uid}_${dayIndex}`,
            ),
            { uid: user.uid, dayIndex, done, updatedAt: serverTimestamp() },
          )
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    // §2.5 org-policy-safe flow: write a rules-guarded planRequests doc, then
    // stream it until the onPlanRequest trigger reports done/error. (Callables
    // need an allUsers invoker grant the org policy forbids.)
    generatePlan: builder.mutation<{ planId: string }, { teamId: string }>({
      queryFn: async ({ teamId }) => {
        try {
          const user = auth.currentUser
          if (!user) {
            throw Object.assign(new Error('Sign in first.'), {
              code: 'unauthenticated',
            })
          }
          const requestRef = doc(collection(db, 'teams', teamId, 'planRequests'))
          await setDoc(requestRef, {
            requestedBy: user.uid,
            status: 'pending',
            createdAt: serverTimestamp(),
          })
          const planId = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              unsubscribe()
              reject(
                Object.assign(
                  new Error('Plan generation timed out — try again.'),
                  { code: 'deadline-exceeded' },
                ),
              )
            }, 120_000)
            const settle = (fn: () => void) => {
              clearTimeout(timeout)
              unsubscribe()
              fn()
            }
            const unsubscribe = onSnapshot(
              requestRef,
              (snap) => {
                const data = snap.data()
                if (data?.status === 'done') {
                  settle(() => resolve(data.planId as string))
                } else if (data?.status === 'error') {
                  settle(() =>
                    reject(
                      Object.assign(
                        new Error(
                          (data.errorMessage as string) ??
                            'Plan generation failed. Try again.',
                        ),
                        { code: (data.errorCode as string) ?? 'internal' },
                      ),
                    ),
                  )
                }
              },
              (error) => settle(() => reject(error)),
            )
          })
          return { data: { planId } }
        } catch (error) {
          return toApiError(error)
        }
      },
      // Active-plan stream picks up the new doc; no invalidation needed.
    }),

    getWeekendSuggestion: builder.query<
      WeekendSuggestion | null,
      { teamId: string; weekKey: string }
    >({
      queryFn: async () => ({ data: null }),
      async onCacheEntryAdded(
        { teamId, weekKey },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          doc(db, 'teams', teamId, 'suggestions', weekKey),
          (snap) => {
            if (!snap.exists()) {
              updateCachedData(() => null)
              return
            }
            const data = snap.data()
            const updatedAt = data.updatedAt
            updateCachedData(() => ({
              weekKey,
              status: (data.status as 'go' | 'no_window') ?? 'go',
              pick:
                (data.pick as WeekendSuggestion['pick'] | undefined) ?? null,
              reasoning: (data.reasoning as string) ?? '',
              weatherSnapshot:
                (data.weatherSnapshot as WeekendSuggestion['weatherSnapshot']) ??
                {},
              updatedAtMs:
                updatedAt instanceof Timestamp ? updatedAt.toMillis() : null,
            }))
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Suggestion'],
    }),
  }),
})

export const {
  useGetActivePlanQuery,
  useGetCheckoffsQuery,
  useSetCheckoffMutation,
  useGeneratePlanMutation,
  useGetWeekendSuggestionQuery,
} = planApi
