import type { PaletteMode } from '@mui/material'
import { createTheme, type Theme } from '@mui/material/styles'

// Single source of colour truth for the app. Never hardcode colours in
// components — consume theme.palette.* tokens only.
export function getTheme(mode: PaletteMode): Theme {
  const isLight = mode === 'light'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#2e7d32' : '#81c784',
      },
      secondary: {
        main: isLight ? '#6d4c41' : '#bcaaa4',
      },
      background: isLight
        ? { default: '#f7f8f5', paper: '#ffffff' }
        : { default: '#121513', paper: '#1c201d' },
    },
    shape: { borderRadius: 12 },
    typography: {
      h1: { fontSize: '1.6rem', fontWeight: 700 },
      h2: { fontSize: '1.3rem', fontWeight: 600 },
      h3: { fontSize: '1.1rem', fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // 44px minimum touch target (NFR §4)
          root: { minHeight: 44, textTransform: 'none' },
        },
      },
      MuiTextField: {
        defaultProps: { fullWidth: true },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
      },
    },
  })
}
