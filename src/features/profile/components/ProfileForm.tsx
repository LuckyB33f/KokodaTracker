import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useAppDispatch } from '@/app/hooks'
import { setThemePreference } from '@/features/settings/settingsSlice'
import { useUpdateUserProfileMutation } from '@/services/userApi'
import { profileSchema } from '../validation/profileValidationSchema'
import type { ProfileFormValues, UserProfile } from '../types/profileTypes'

interface ProfileFormProps {
  uid: string
  profile: UserProfile
  initialDisplayName: string
}

export default function ProfileForm({
  uid,
  profile,
  initialDisplayName,
}: ProfileFormProps) {
  const dispatch = useAppDispatch()
  const [updateUserProfile] = useUpdateUserProfileMutation()
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<ProfileFormValues>({
    initialValues: {
      displayName: initialDisplayName,
      units: profile.units,
      theme: profile.theme,
    },
    validationSchema: profileSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaved(false)
      setFormError(null)
      const result = await updateUserProfile({
        uid,
        patch: { units: values.units, theme: values.theme },
        displayName: values.displayName.trim(),
      })
      if ('error' in result && result.error) {
        setFormError(
          'message' in result.error
            ? (result.error.message ?? 'Could not save your profile.')
            : 'Could not save your profile.',
        )
        return
      }
      dispatch(setThemePreference(values.theme))
      setSaved(true)
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        {saved && <Alert severity="success">Profile saved.</Alert>}
        <TextField
          id="displayName"
          name="displayName"
          label="Display name"
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
          id="units"
          name="units"
          label="Units"
          select
          value={formik.values.units}
          onChange={formik.handleChange}
        >
          <MenuItem value="metric">Metric (km, m)</MenuItem>
          <MenuItem value="imperial">Imperial (mi, ft)</MenuItem>
        </TextField>
        <TextField
          id="theme"
          name="theme"
          label="Theme"
          select
          value={formik.values.theme}
          onChange={formik.handleChange}
        >
          <MenuItem value="system">Match device</MenuItem>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
        </TextField>
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Save changes
        </ActionButton>
      </Stack>
    </form>
  )
}
