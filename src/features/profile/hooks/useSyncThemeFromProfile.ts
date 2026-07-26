import { useEffect } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import { setThemePreference } from '@/features/settings/settingsSlice'
import { useGetUserProfileQuery } from '@/services/userApi'

// Firestore is the durable store for the theme preference; the settings slice
// is its runtime mirror. Hydrate the mirror whenever the profile loads.
export function useSyncThemeFromProfile() {
  const user = useAppSelector(selectAuthUser)
  const dispatch = useAppDispatch()
  const { data: profile } = useGetUserProfileQuery(user?.uid ?? skipToken)

  useEffect(() => {
    if (profile?.theme) {
      dispatch(setThemePreference(profile.theme))
    }
  }, [profile?.theme, dispatch])
}
