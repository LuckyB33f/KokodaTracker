import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
  FoodLog,
  FoodLogInput,
} from '@/features/food/types/foodTypes'
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

function toFoodLog(id: string, data: Record<string, unknown>): FoodLog {
  const createdAt = data.createdAt
  return {
    id,
    uid: data.uid as string,
    date: data.date as string,
    mealType: data.mealType as FoodLog['mealType'],
    description: data.description as string,
    calories: (data.calories as number | undefined) ?? null,
    notes: (data.notes as string | undefined) ?? '',
    createdAtMs: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
  }
}

export const foodApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Realtime day view. Equality filter only (no orderBy) keeps us off
    // composite indexes; ordering happens client-side.
    getFoodLogs: builder.query<FoodLog[], { teamId: string; date: string }>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        { teamId, date },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const logsQuery = query(
          collection(db, 'teams', teamId, 'foodLogs'),
          where('date', '==', date),
        )
        const unsubscribe = onSnapshot(logsQuery, (snap) => {
          updateCachedData(() =>
            snap.docs
              .map((docSnap) => toFoodLog(docSnap.id, docSnap.data()))
              .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)),
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['FoodLogs'],
    }),

    addFoodLog: builder.mutation<
      { logId: string },
      { teamId: string; input: FoodLogInput }
    >({
      queryFn: async ({ teamId, input }) => {
        try {
          const user = auth.currentUser
          if (!user) throw Object.assign(new Error(), { code: 'unauthenticated' })
          const docRef = await addDoc(
            collection(db, 'teams', teamId, 'foodLogs'),
            {
              uid: user.uid,
              date: input.date,
              mealType: input.mealType,
              description: input.description,
              ...(input.calories !== undefined && { calories: input.calories }),
              ...(input.notes ? { notes: input.notes } : {}),
              createdAt: serverTimestamp(),
            },
          )
          return { data: { logId: docRef.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    updateFoodLog: builder.mutation<
      void,
      { teamId: string; logId: string; input: FoodLogInput }
    >({
      queryFn: async ({ teamId, logId, input }) => {
        try {
          await updateDoc(doc(db, 'teams', teamId, 'foodLogs', logId), {
            date: input.date,
            mealType: input.mealType,
            description: input.description,
            calories: input.calories ?? deleteField(),
            notes: input.notes ?? deleteField(),
          })
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    deleteFoodLog: builder.mutation<void, { teamId: string; logId: string }>({
      queryFn: async ({ teamId, logId }) => {
        try {
          await deleteDoc(doc(db, 'teams', teamId, 'foodLogs', logId))
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),
  }),
})

export const {
  useGetFoodLogsQuery,
  useAddFoodLogMutation,
  useUpdateFoodLogMutation,
  useDeleteFoodLogMutation,
} = foodApi
