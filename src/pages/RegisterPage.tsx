import { Link as RouterLink } from 'react-router-dom'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FormCard from '@/components/common/FormCard'
import SEO from '@/components/common/SEO'
import GoogleSignInButton from '@/features/auth/components/GoogleSignInButton'
import RegisterForm from '@/features/auth/components/RegisterForm'

export default function RegisterPage() {
  return (
    <>
      <SEO title="Create account" />
      <FormCard>
        <Stack spacing={2}>
          <RegisterForm />
          <Divider>or</Divider>
          <GoogleSignInButton />
          <Typography variant="body2" align="center">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Sign in
            </Link>
          </Typography>
        </Stack>
      </FormCard>
    </>
  )
}
