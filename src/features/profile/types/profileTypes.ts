import type { ThemePreference } from '@/features/settings/settingsSlice'

export type Units = 'metric' | 'imperial'

// Mirrors users/{uid} in MVP-SPEC §2.3. createdAt is converted to millis at
// the api layer so the RTK Query cache stays serializable.
export interface UserProfile {
  activeTeamId: string | null
  units: Units
  theme: ThemePreference
  createdAtMs: number | null
}

export interface ProfileFormValues {
  displayName: string
  units: Units
  theme: ThemePreference
}
