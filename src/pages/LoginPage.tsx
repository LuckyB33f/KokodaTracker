import { Link as RouterLink } from 'react-router-dom'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FormCard from '@/components/common/FormCard'
import SEO from '@/components/common/SEO'
import GoogleSignInButton from '@/features/auth/components/GoogleSignInButton'
import LoginForm from '@/features/auth/components/LoginForm'

export default function LoginPage() {
  return (
    <>
      <SEO title="Sign in" />
      <FormCard>
        <Stack spacing={2}>
          <LoginForm />
          <Divider>or</Divider>
          <GoogleSignInButton />
          <Typography variant="body2" align="center">
            <Link component={RouterLink} to="/register">
              Create an account
            </Link>
          </Typography>
          <Typography variant="body2" align="center">
            <Link component={RouterLink} to="/reset-password">
              Forgot password?
            </Link>
          </Typography>
        </Stack>
      </FormCard>
    </>
  )
}
