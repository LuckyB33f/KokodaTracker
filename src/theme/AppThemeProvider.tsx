import { useMemo, type ReactNode } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ThemeProvider } from '@mui/material/styles'
import { useAppSelector } from '@/app/hooks'
import { selectThemePreference } from '@/features/settings/settingsSlice'
import { getTheme } from './theme'

export default function AppThemeProvider({
  children,
}: {
  children: ReactNode
}) {
  const preference = useAppSelector(selectThemePreference)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  const mode =
    preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference

  const theme = useMemo(() => getTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
