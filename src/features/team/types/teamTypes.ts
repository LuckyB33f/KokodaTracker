export const EVENT_DISTANCES = [18, 30, 48] as const
export type EventDistanceKm = (typeof EVENT_DISTANCES)[number]

// Mirrors teams/{teamId} in MVP-SPEC §2.3. Timestamps become millis at the
// api layer so the RTK Query cache stays serializable.
export interface Team {
  id: string
  name: string
  eventDistanceKm: EventDistanceKm
  eventDateMs: number
  createdBy: string
  inviteCode: string
  memberIds: string[]
}

export interface TeamMember {
  uid: string
  displayName: string
  photoURL: string | null
  isCaptain: boolean
  weeklyTargetHours: number
  joinedAtMs: number | null
}

export interface CreateTeamFormValues {
  name: string
  eventDistanceKm: EventDistanceKm
  eventDate: string // yyyy-mm-dd from the date input
}

export interface JoinTeamFormValues {
  code: string
}
