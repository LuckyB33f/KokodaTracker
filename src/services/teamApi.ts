import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  generateInviteCode,
  normalizeInviteCode,
} from '@/features/team/utils/inviteCode'
import type {
  EventDistanceKm,
  Team,
  TeamMember,
} from '@/features/team/types/teamTypes'
import { baseApi, type ApiError } from './baseApi'

interface CreateTeamArgs {
  name: string
  eventDistanceKm: EventDistanceKm
  eventDate: string // yyyy-mm-dd
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

function toTeam(id: string, data: Record<string, unknown>): Team {
  const eventDate = data.eventDate
  return {
    id,
    name: data.name as string,
    eventDistanceKm: data.eventDistanceKm as Team['eventDistanceKm'],
    eventDateMs:
      eventDate instanceof Timestamp ? eventDate.toMillis() : Date.now(),
    createdBy: data.createdBy as string,
    inviteCode: data.inviteCode as string,
    memberIds: (data.memberIds as string[]) ?? [],
  }
}

function toMember(uid: string, data: Record<string, unknown>): TeamMember {
  const joinedAt = data.joinedAt
  return {
    uid,
    displayName: (data.displayName as string) || 'Team member',
    photoURL: (data.photoURL as string | null) ?? null,
    isCaptain: Boolean(data.isCaptain),
    weeklyTargetHours: (data.weeklyTargetHours as number) ?? 5,
    joinedAtMs: joinedAt instanceof Timestamp ? joinedAt.toMillis() : null,
  }
}

function requireUser() {
  const user = auth.currentUser
  if (!user) {
    throw Object.assign(new Error('Not signed in'), { code: 'unauthenticated' })
  }
  return user
}

// Local date at the event: parse yyyy-mm-dd as midnight Brisbane (UTC+10).
function eventDateToTimestamp(eventDate: string): Timestamp {
  return Timestamp.fromDate(new Date(`${eventDate}T00:00:00+10:00`))
}

export const teamApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Realtime team doc (spec F2 acceptance: joins visible in <2s).
    getTeam: builder.query<Team | null, string>({
      queryFn: async (teamId) => {
        try {
          const snap = await getDoc(doc(db, 'teams', teamId))
          return { data: snap.exists() ? toTeam(snap.id, snap.data()) : null }
        } catch (error) {
          return toApiError(error)
        }
      },
      async onCacheEntryAdded(
        teamId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = onSnapshot(doc(db, 'teams', teamId), (snap) => {
          updateCachedData(() =>
            snap.exists() ? toTeam(snap.id, snap.data()) : null,
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Team'],
    }),

    getTeamMembers: builder.query<TeamMember[], string>({
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
        const membersQuery = query(
          collection(db, 'teams', teamId, 'members'),
          orderBy('joinedAt', 'asc'),
        )
        const unsubscribe = onSnapshot(membersQuery, (snap) => {
          updateCachedData(() =>
            snap.docs.map((docSnap) => toMember(docSnap.id, docSnap.data())),
          )
        })
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['TeamMembers'],
    }),

    // §2.5: team + invite + captain membership + activeTeamId in one batch,
    // validated atomically by rules (getAfter).
    createTeam: builder.mutation<{ teamId: string }, CreateTeamArgs>({
      queryFn: async ({ name, eventDistanceKm, eventDate }) => {
        try {
          const user = requireUser()
          const teamRef = doc(collection(db, 'teams'))
          const inviteCode = generateInviteCode()
          const batch = writeBatch(db)
          batch.set(teamRef, {
            name: name.trim(),
            eventDistanceKm,
            eventDate: eventDateToTimestamp(eventDate),
            createdBy: user.uid,
            inviteCode,
            memberIds: [user.uid],
            createdAt: serverTimestamp(),
          })
          batch.set(doc(db, 'invites', inviteCode), {
            teamId: teamRef.id,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          })
          batch.set(doc(db, 'teams', teamRef.id, 'members', user.uid), {
            displayName: user.displayName ?? 'Team captain',
            photoURL: user.photoURL ?? null,
            isCaptain: true,
            weeklyTargetHours: 5,
            joinedAt: serverTimestamp(),
          })
          batch.update(doc(db, 'users', user.uid), { activeTeamId: teamRef.id })
          await batch.commit()
          return { data: { teamId: teamRef.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
      invalidatesTags: ['UserProfile', 'Team', 'TeamMembers'],
    }),

    // §2.5: join without pre-membership reads — arrayUnion appends self; the
    // rules reject anything but "me, into a team with space".
    joinTeam: builder.mutation<{ teamId: string }, { code: string }>({
      queryFn: async ({ code }) => {
        try {
          const user = requireUser()
          const normalized = normalizeInviteCode(code)
          const inviteSnap = await getDoc(doc(db, 'invites', normalized))
          if (!inviteSnap.exists()) {
            return {
              error: {
                code: 'invalid-code',
                message: 'That invite code doesn’t match a team. Double-check it with your captain.',
              },
            }
          }
          const teamId = inviteSnap.data().teamId as string
          const batch = writeBatch(db)
          batch.update(doc(db, 'teams', teamId), {
            memberIds: arrayUnion(user.uid),
          })
          batch.set(doc(db, 'teams', teamId, 'members', user.uid), {
            displayName: user.displayName ?? 'Team member',
            photoURL: user.photoURL ?? null,
            isCaptain: false,
            weeklyTargetHours: 5,
            joinedAt: serverTimestamp(),
          })
          batch.update(doc(db, 'users', user.uid), { activeTeamId: teamId })
          await batch.commit()
          return { data: { teamId } }
        } catch (error) {
          const firebaseError = error as { code?: string }
          if (firebaseError.code === 'permission-denied') {
            return {
              error: {
                code: 'join-rejected',
                message: 'Couldn’t join — the team may be full (max 5) or you may already be in it.',
              },
            }
          }
          return toApiError(error)
        }
      },
      invalidatesTags: ['UserProfile', 'Team', 'TeamMembers'],
    }),

    regenerateInviteCode: builder.mutation<
      { inviteCode: string },
      { teamId: string; oldCode: string }
    >({
      queryFn: async ({ teamId, oldCode }) => {
        try {
          const inviteCode = generateInviteCode()
          const batch = writeBatch(db)
          batch.update(doc(db, 'teams', teamId), { inviteCode })
          batch.set(doc(db, 'invites', inviteCode), {
            teamId,
            createdBy: requireUser().uid,
            createdAt: serverTimestamp(),
          })
          await batch.commit()
          // Old invite removal is best-effort cleanup; the team doc's
          // inviteCode is the source of truth shown to the captain.
          await deleteDoc(doc(db, 'invites', oldCode)).catch(() => undefined)
          return { data: { inviteCode } }
        } catch (error) {
          return toApiError(error)
        }
      },
      invalidatesTags: ['Team'],
    }),

    updateMemberSettings: builder.mutation<
      void,
      { teamId: string; uid: string; weeklyTargetHours: number }
    >({
      queryFn: async ({ teamId, uid, weeklyTargetHours }) => {
        try {
          await updateDoc(doc(db, 'teams', teamId, 'members', uid), {
            weeklyTargetHours,
          })
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
      invalidatesTags: ['TeamMembers'],
    }),
  }),
})

export const {
  useGetTeamQuery,
  useGetTeamMembersQuery,
  useCreateTeamMutation,
  useJoinTeamMutation,
  useRegenerateInviteCodeMutation,
  useUpdateMemberSettingsMutation,
} = teamApi
