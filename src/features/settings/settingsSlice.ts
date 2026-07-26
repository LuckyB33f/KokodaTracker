import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'

export type ThemePreference = 'light' | 'dark' | 'system'

interface SettingsState {
  // Runtime mirror only — the durable copy lives on users/{uid}.theme and is
  // hydrated after the profile loads.
  themePreference: ThemePreference
}

const initialState: SettingsState = {
  themePreference: 'system',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setThemePreference(state, action: PayloadAction<ThemePreference>) {
      state.themePreference = action.payload
    },
    resetSettings() {
      return initialState
    },
  },
})

export const { setThemePreference, resetSettings } = settingsSlice.actions

export const selectThemePreference = (state: RootState): ThemePreference =>
  state.settings.themePreference

export default settingsSlice.reducer
