import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
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
      aiMealsEnabled: profile.aiMealsEnabled,
      mainMeals: profile.mealPrefs.mainMeals,
      snacks: profile.mealPrefs.snacks,
      duringTraining: profile.mealPrefs.duringTraining,
      macroFocus: profile.mealPrefs.macroFocus,
    },
    validationSchema: profileSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaved(false)
      setFormError(null)
      const result = await updateUserProfile({
        uid,
        patch: {
          units: values.units,
          theme: values.theme,
          aiMealsEnabled: values.aiMealsEnabled,
          // Spread first: the food questionnaire (F13C) also lives in
          // mealPrefs and must survive a profile save.
          mealPrefs: {
            ...profile.mealPrefs,
            mainMeals: values.mainMeals,
            snacks: values.snacks,
            duringTraining: values.duringTraining,
            macroFocus: values.macroFocus,
          },
        },
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
        <Divider />
        <Typography variant="subtitle1">Meals</Typography>
        <div>
          <FormControlLabel
            control={
              <Switch
                id="aiMealsEnabled"
                name="aiMealsEnabled"
                checked={formik.values.aiMealsEnabled}
                onChange={formik.handleChange}
              />
            }
            label="AI meal suggestions"
          />
          <FormHelperText>
            When off, no AI meal plans or nightly nutrition reviews are
            generated for you.
          </FormHelperText>
        </div>
        <TextField
          id="mainMeals"
          name="mainMeals"
          label="Main meals per day"
          select
          value={formik.values.mainMeals}
          onChange={formik.handleChange}
        >
          {[2, 3, 4].map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="snacks"
          name="snacks"
          label="Snacks per day"
          select
          value={formik.values.snacks}
          onChange={formik.handleChange}
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <div>
          <FormControlLabel
            control={
              <Switch
                id="duringTraining"
                name="duringTraining"
                checked={formik.values.duringTraining}
                onChange={formik.handleChange}
              />
            }
            label="During-training fuel"
          />
          <FormHelperText>
            Include on-trail / during-session meals in your day and plans.
          </FormHelperText>
        </div>
        <TextField
          id="macroFocus"
          name="macroFocus"
          label="Macro emphasis"
          select
          value={formik.values.macroFocus}
          onChange={formik.handleChange}
        >
          <MenuItem value="balanced">Balanced</MenuItem>
          <MenuItem value="carb">Carb-forward</MenuItem>
          <MenuItem value="protein">Protein-forward</MenuItem>
        </TextField>
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Save changes
        </ActionButton>
      </Stack>
    </form>
  )
}
