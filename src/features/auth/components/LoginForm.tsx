import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useAuthActions } from '../hooks/useAuthActions'
import { mapAuthError } from '../utils/mapAuthError'
import { loginSchema } from '../validation/authValidationSchemas'
import type { LoginFormValues } from '../types/authTypes'

export default function LoginForm() {
  const { signIn } = useAuthActions()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: loginSchema,
    onSubmit: async (values) => {
      setFormError(null)
      try {
        await signIn(values)
        // Redirect is handled by PublicOnlyRoute once auth state updates.
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
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password && Boolean(formik.errors.password)}
          helperText={formik.touched.password && formik.errors.password}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Sign in
        </ActionButton>
      </Stack>
    </form>
  )
}
