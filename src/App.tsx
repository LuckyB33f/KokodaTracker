import AppRoutes from '@/routes/AppRoutes'
import { useAuthListener } from '@/features/auth/hooks/useAuthListener'
import { useSyncThemeFromProfile } from '@/features/profile/hooks/useSyncThemeFromProfile'

export default function App() {
  useAuthListener()
  useSyncThemeFromProfile()
  return <AppRoutes />
}
