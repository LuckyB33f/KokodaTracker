import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { weekKeyFor } from '@/utils/weekKey'
import type {
  Session,
  SessionInput,
  SessionRoute,
} from '@/features/sessions/types/sessionTypes'
import { baseApi, type ApiError } from './baseApi'

// Streaming window for the team feed. Dashboard aggregates read from this
// same cache. Spec R4 (read amplification) accepted at ≤10-user scale.
const FEED_LIMIT = 200

function toApiError(error: unknown): { error: ApiError } {
  const firebaseError = error as { code?: string; message?: string }
  return {
    error: {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? 'Something went wrong. Please try again.',
    },
  }
}

function toSession(id: string, data: Record<string, unknown>): Session {
  const startedAt = data.startedAt
  return {
    id,
    uid: data.uid as string,
    type: data.type as Session['type'],
    source: (data.source as Session['source']) ?? 'manual',
    startedAtMs:
      startedAt instanceof Timestamp ? startedAt.toMillis() : Date.now(),
    durationMin: data.durationMin as number,
    distanceKm: (data.distanceKm as number | undefined) ?? null,
    elevationGainM: (data.elevationGainM as number | undefined) ?? null,
    avgPaceMinPerKm: (data.avgPaceMinPerKm as number | undefined) ?? null,
    route: (data.route as SessionRoute | undefined) ?? null,
    perceivedEffort: data.perceivedEffort as number,
    notes: (data.notes as string | undefined) ?? '',
    weekKey: data.weekKey as string,
  }
}

function paceFor(input: {
  durationMin: number
  distanceKm?: number
}): number | undefined {
  if (!input.distanceKm || input.distanceKm <= 0) return undefined
  return Math.round((input.durationMin / input.distanceKm) * 100) / 100
}

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Realtime team feed, newest first (spec F3: appears instantly).
    getSessions: builder.query<Session[], string>({
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
        const sessionsQuery = query(
          collection(db, 'teams', teamId, 'sessions'),
          orderBy('startedAt', 'desc'),
          limit(FEED_LIMIT),
        )
        const unsubscribe = onSnapshot(sessionsQuery, (snap) => {
          updateCachedData(() =>
            snap.docs.map((docSnap) => toSession(docSnap.id, docSnap.data())),
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Sessions'],
    }),

    addSession: builder.mutation<
      { sessionId: string },
      { teamId: string; input: SessionInput }
    >({
      queryFn: async ({ teamId, input }) => {
        try {
          const user = auth.currentUser
          if (!user) throw Object.assign(new Error(), { code: 'unauthenticated' })
          const pace = paceFor(input)
          const docRef = await addDoc(
            collection(db, 'teams', teamId, 'sessions'),
            {
              uid: user.uid,
              type: input.type,
              source: input.source,
              startedAt: Timestamp.fromDate(input.startedAt),
              durationMin: input.durationMin,
              ...(input.distanceKm !== undefined && {
                distanceKm: input.distanceKm,
              }),
              ...(input.elevationGainM !== undefined && {
                elevationGainM: input.elevationGainM,
              }),
              ...(pace !== undefined && { avgPaceMinPerKm: pace }),
              ...(input.route !== undefined && { route: input.route }),
              perceivedEffort: input.perceivedEffort,
              ...(input.notes ? { notes: input.notes } : {}),
              weekKey: weekKeyFor(input.startedAt),
              createdAt: serverTimestamp(),
            },
          )
          return { data: { sessionId: docRef.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
      // The onSnapshot stream delivers the new doc; no invalidation needed.
    }),

    updateSession: builder.mutation<
      void,
      { teamId: string; sessionId: string; input: SessionInput }
    >({
      queryFn: async ({ teamId, sessionId, input }) => {
        try {
          const pace = paceFor(input)
          await updateDoc(doc(db, 'teams', teamId, 'sessions', sessionId), {
            type: input.type,
            startedAt: Timestamp.fromDate(input.startedAt),
            durationMin: input.durationMin,
            distanceKm: input.distanceKm ?? deleteField(),
            elevationGainM: input.elevationGainM ?? deleteField(),
            avgPaceMinPerKm: pace ?? deleteField(),
            perceivedEffort: input.perceivedEffort,
            notes: input.notes ?? deleteField(),
            weekKey: weekKeyFor(input.startedAt),
          })
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    deleteSession: builder.mutation<
      void,
      { teamId: string; sessionId: string }
    >({
      queryFn: async ({ teamId, sessionId }) => {
        try {
          await deleteDoc(doc(db, 'teams', teamId, 'sessions', sessionId))
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),
  }),
})

export const {
  useGetSessionsQuery,
  useAddSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
} = sessionApi
