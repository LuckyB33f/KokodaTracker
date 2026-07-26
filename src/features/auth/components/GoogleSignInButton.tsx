import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import GoogleIcon from '@mui/icons-material/Google'
import ActionButton from '@/components/common/ActionButton'
import { useAuthActions } from '../hooks/useAuthActions'
import { mapAuthError } from '../utils/mapAuthError'

export default function GoogleSignInButton() {
  const { signInWithGoogle } = useAuthActions()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      const code = (err as { code?: string }).code
      // Cancelling the popup isn't an error worth shouting about.
      if (
        code !== 'auth/popup-closed-by-user' &&
        code !== 'auth/cancelled-popup-request'
      ) {
        setError(mapAuthError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <ActionButton
        variant="outlined"
        color="inherit"
        loading={loading}
        onClick={handleClick}
        startIcon={<GoogleIcon />}
      >
        Continue with Google
      </ActionButton>
    </Stack>
  )
}
