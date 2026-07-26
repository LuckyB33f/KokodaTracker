import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useAuthActions } from '../hooks/useAuthActions'
import { mapAuthError } from '../utils/mapAuthError'
import { registerSchema } from '../validation/authValidationSchemas'
import type { RegisterFormValues } from '../types/authTypes'

export default function RegisterForm() {
  const { register } = useAuthActions()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<RegisterFormValues>({
    initialValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: registerSchema,
    onSubmit: async (values) => {
      setFormError(null)
      try {
        await register(values)
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
          id="displayName"
          name="displayName"
          label="Name"
          autoComplete="name"
          value={formik.values.displayName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={
            formik.touched.displayName && Boolean(formik.errors.displayName)
          }
          helperText={formik.touched.displayName && formik.errors.displayName}
        />
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
          autoComplete="new-password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password && Boolean(formik.errors.password)}
          helperText={formik.touched.password && formik.errors.password}
        />
        <TextField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={formik.values.confirmPassword}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={
            formik.touched.confirmPassword &&
            Boolean(formik.errors.confirmPassword)
          }
          helperText={
            formik.touched.confirmPassword && formik.errors.confirmPassword
          }
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Create account
        </ActionButton>
      </Stack>
    </form>
  )
}
