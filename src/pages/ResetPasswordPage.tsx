import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import EmptyState from '@/components/common/EmptyState'
import FormCard from '@/components/common/FormCard'
import SEO from '@/components/common/SEO'
import ResetPasswordForm from '@/features/auth/components/ResetPasswordForm'

export default function ResetPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  return (
    <>
      <SEO title="Reset password" />
      <FormCard>
        {sentTo ? (
          <EmptyState
            icon={<MarkEmailReadIcon color="primary" sx={{ fontSize: 40 }} />}
            title="Check your email"
            description={`If an account exists for ${sentTo}, a reset link is on its way.`}
            action={
              <Link component={RouterLink} to="/login">
                Back to sign in
              </Link>
            }
          />
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </Typography>
            <ResetPasswordForm onSent={setSentTo} />
            <Typography variant="body2" align="center">
              <Link component={RouterLink} to="/login">
                Back to sign in
              </Link>
            </Typography>
          </Stack>
        )}
      </FormCard>
    </>
  )
}
