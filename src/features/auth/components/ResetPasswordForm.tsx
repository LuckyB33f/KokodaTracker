import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useAuthActions } from '../hooks/useAuthActions'
import { mapAuthError } from '../utils/mapAuthError'
import { resetPasswordSchema } from '../validation/authValidationSchemas'
import type { ResetPasswordFormValues } from '../types/authTypes'

interface ResetPasswordFormProps {
  onSent: (email: string) => void
}

export default function ResetPasswordForm({ onSent }: ResetPasswordFormProps) {
  const { sendReset } = useAuthActions()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<ResetPasswordFormValues>({
    initialValues: { email: '' },
    validationSchema: resetPasswordSchema,
    onSubmit: async ({ email }) => {
      setFormError(null)
      try {
        await sendReset(email.trim())
        onSent(email.trim())
      } catch (error) {
        setFormError(mapAuthError(error))
      }
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email && Boolean(formik.errors.email)}
          helperText={formik.touched.email && formik.errors.email}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Send reset email
        </ActionButton>
      </Stack>
    </form>
  )
}
