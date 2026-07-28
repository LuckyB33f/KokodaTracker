import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { libraryIdFor, normaliseMealText } from '@/features/meals/utils/mealText'
import type {
  FuellingEntry,
  Meal,
  MealLibraryItem,
  MealTag,
  MealWriteInput,
  NutritionReview,
} from '@/features/meals/types/mealTypes'
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

function requireUid(): string {
  const user = auth.currentUser
  if (!user) {
    throw Object.assign(new Error('Sign in first.'), { code: 'unauthenticated' })
  }
  return user.uid
}

function toMeal(id: string, data: Record<string, unknown>): Meal {
  const loggedAt = data.loggedAt
  const createdAt = data.createdAt
  return {
    id,
    date: data.date as string,
    slot: data.slot as Meal['slot'],
    libraryRefId: (data.libraryRefId as string) ?? '',
    textSnapshot: (data.textSnapshot as string) ?? '',
    portionNote: (data.portionNote as string | undefined) ?? '',
    tag: (data.tag as MealTag | undefined) ?? null,
    status: (data.status as Meal['status']) ?? 'logged',
    loggedAtMs: loggedAt instanceof Timestamp ? loggedAt.toMillis() : null,
    createdAtMs: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
  }
}

function toLibraryItem(
  id: string,
  data: Record<string, unknown>,
): MealLibraryItem {
  const lastUsedAt = data.lastUsedAt
  return {
    id,
    text: (data.text as string) ?? '',
    normalisedText: (data.normalisedText as string) ?? '',
    tag: (data.tag as MealTag | undefined) ?? null,
    useCount: (data.useCount as number) ?? 0,
    lastUsedAtMs:
      lastUsedAt instanceof Timestamp ? lastUsedAt.toMillis() : null,
    favourite: Boolean(data.favourite),
    hidden: Boolean(data.hidden),
  }
}

export const mealApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Realtime day view: equality filter only (no composite index), sorted
    // client-side by loggedAt. Drafts stream in the same list.
    getMeals: builder.query<Meal[], { uid: string; date: string }>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        { uid, date },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const mealsQuery = query(
          collection(db, 'users', uid, 'meals'),
          where('date', '==', date),
        )
        const unsubscribe = onSnapshot(mealsQuery, (snap) => {
          updateCachedData(() =>
            snap.docs
              .map((docSnap) => toMeal(docSnap.id, docSnap.data()))
              .sort((a, b) => (a.loggedAtMs ?? 0) - (b.loggedAtMs ?? 0)),
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Meals'],
    }),

    // Whole personal library (max a few hundred docs) — Recent/Frequent/
    // search are computed client-side from this one stream.
    getMealLibrary: builder.query<MealLibraryItem[], string>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        uid,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          collection(db, 'users', uid, 'mealLibrary'),
          (snap) => {
            updateCachedData(() =>
              snap.docs.map((docSnap) =>
                toLibraryItem(docSnap.id, docSnap.data()),
              ),
            )
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['MealLibrary'],
    }),

    // One batch: meal doc + library upsert. Deterministic library ID makes
    // offline replays collide onto one doc (spec R9); increment() keeps the
    // counter correct under merge.
    addMeal: builder.mutation<{ mealId: string }, { input: MealWriteInput }>({
      queryFn: async ({ input }) => {
        try {
          const uid = requireUid()
          const text = input.text.trim()
          const libraryRefId = input.libraryRefId ?? libraryIdFor(text)
          const mealRef = doc(collection(db, 'users', uid, 'meals'))
          const libRef = doc(db, 'users', uid, 'mealLibrary', libraryRefId)
          const batch = writeBatch(db)
          batch.set(mealRef, {
            date: input.date,
            slot: input.slot,
            libraryRefId,
            textSnapshot: text,
            ...(input.portionNote?.trim()
              ? { portionNote: input.portionNote.trim() }
              : {}),
            ...(input.tag ? { tag: input.tag } : {}),
            status: input.status ?? 'logged',
            loggedAt: Timestamp.fromMillis(input.loggedAtMs),
            createdAt: serverTimestamp(),
          })
          // Drafts don't count as "eaten" — they also don't bump the library
          // until confirmed.
          if ((input.status ?? 'logged') === 'logged') {
            batch.set(
              libRef,
              {
                useCount: increment(1),
                lastUsedAt: serverTimestamp(),
                // One-time fields only on the new-item path so an existing
                // item's favourite/hidden flags are never clobbered.
                ...(input.createLibraryItem
                  ? {
                      text,
                      normalisedText: normaliseMealText(text),
                      tag: input.tag ?? null,
                      favourite: false,
                      hidden: false,
                      createdAt: serverTimestamp(),
                    }
                  : {}),
              },
              { merge: true },
            )
          } else if (input.createLibraryItem) {
            batch.set(
              libRef,
              {
                text,
                normalisedText: normaliseMealText(text),
                tag: input.tag ?? null,
                useCount: increment(0),
                lastUsedAt: serverTimestamp(),
                favourite: false,
                hidden: false,
                createdAt: serverTimestamp(),
              },
              { merge: true },
            )
          }
          await batch.commit()
          return { data: { mealId: mealRef.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    updateMeal: builder.mutation<
      void,
      {
        mealId: string
        input: MealWriteInput
      }
    >({
      queryFn: async ({ mealId, input }) => {
        try {
          const uid = requireUid()
          const text = input.text.trim()
          const libraryRefId = input.libraryRefId ?? libraryIdFor(text)
          const batch = writeBatch(db)
          batch.update(doc(db, 'users', uid, 'meals', mealId), {
            slot: input.slot,
            libraryRefId,
            textSnapshot: text,
            portionNote: input.portionNote?.trim() ?? '',
            tag: input.tag ?? null,
            loggedAt: Timestamp.fromMillis(input.loggedAtMs),
          })
          if (input.createLibraryItem) {
            batch.set(
              doc(db, 'users', uid, 'mealLibrary', libraryRefId),
              {
                text,
                normalisedText: normaliseMealText(text),
                tag: input.tag ?? null,
                useCount: increment(1),
                lastUsedAt: serverTimestamp(),
                favourite: false,
                hidden: false,
                createdAt: serverTimestamp(),
              },
              { merge: true },
            )
          }
          await batch.commit()
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    // Template drafts become real meals here (F12/F13 boundary): only now
    // does the library counter move.
    confirmDraftMeal: builder.mutation<
      void,
      { mealId: string; libraryRefId: string }
    >({
      queryFn: async ({ mealId, libraryRefId }) => {
        try {
          const uid = requireUid()
          const batch = writeBatch(db)
          batch.update(doc(db, 'users', uid, 'meals', mealId), {
            status: 'logged',
            loggedAt: Timestamp.now(),
          })
          batch.set(
            doc(db, 'users', uid, 'mealLibrary', libraryRefId),
            { useCount: increment(1), lastUsedAt: serverTimestamp() },
            { merge: true },
          )
          await batch.commit()
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    deleteMeal: builder.mutation<void, { mealId: string }>({
      queryFn: async ({ mealId }) => {
        try {
          const uid = requireUid()
          await deleteDoc(doc(db, 'users', uid, 'meals', mealId))
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    // R11.4: renames keep the doc ID (chips keep working) and propagate
    // forward only — logged meals keep their textSnapshot.
    renameLibraryItem: builder.mutation<
      void,
      { itemId: string; text: string }
    >({
      queryFn: async ({ itemId, text }) => {
        try {
          const uid = requireUid()
          await updateDoc(doc(db, 'users', uid, 'mealLibrary', itemId), {
            text: text.trim(),
            normalisedText: normaliseMealText(text),
          })
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    // F13B: the member's own nightly review for a date (function-written).
    getNutritionReview: builder.query<
      NutritionReview | null,
      { uid: string; date: string }
    >({
      queryFn: async () => ({ data: null }),
      async onCacheEntryAdded(
        { uid, date },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          doc(db, 'users', uid, 'nutritionReviews', date),
          (snap) => {
            updateCachedData(() => {
              if (!snap.exists()) return null
              const data = snap.data()
              return {
                date,
                verdict: (data.verdict as string) ?? 'not-assessed',
                reason: (data.reason as string) ?? '',
                suggestion: (data.suggestion as string) ?? '',
                mealCount: (data.mealCount as number) ?? 0,
                trainingSummary: (data.trainingSummary as string) ?? '',
              }
            })
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['NutritionReview'],
    }),

    // Team fuelling aggregate (F6 tile) — counts + latest verdict only.
    getFuelling: builder.query<FuellingEntry[], string>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        teamId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(
          collection(db, 'teams', teamId, 'fuelling'),
          (snap) => {
            updateCachedData(() =>
              snap.docs.map((docSnap) => {
                const data = docSnap.data()
                return {
                  uid: docSnap.id,
                  date: (data.date as string) ?? '',
                  mealCount: (data.mealCount as number) ?? 0,
                  review:
                    (data.review as FuellingEntry['review'] | undefined) ??
                    null,
                }
              }),
            )
          },
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Fuelling'],
    }),

    setLibraryItemFlags: builder.mutation<
      void,
      { itemId: string; patch: { favourite?: boolean; hidden?: boolean } }
    >({
      queryFn: async ({ itemId, patch }) => {
        try {
          const uid = requireUid()
          await updateDoc(doc(db, 'users', uid, 'mealLibrary', itemId), patch)
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),
  }),
})

export const {
  useGetMealsQuery,
  useGetMealLibraryQuery,
  useAddMealMutation,
  useUpdateMealMutation,
  useConfirmDraftMealMutation,
  useDeleteMealMutation,
  useRenameLibraryItemMutation,
  useSetLibraryItemFlagsMutation,
  useGetFuellingQuery,
  useGetNutritionReviewQuery,
} = mealApi
