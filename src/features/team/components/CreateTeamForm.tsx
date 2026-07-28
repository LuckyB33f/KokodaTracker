import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useCreateTeamMutation } from '@/services/teamApi'
import { EVENT_DISTANCES } from '../types/teamTypes'
import type { CreateTeamFormValues } from '../types/teamTypes'
import { createTeamSchema } from '../validation/teamValidationSchemas'

export default function CreateTeamForm() {
  const [createTeam] = useCreateTeamMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<CreateTeamFormValues>({
    initialValues: {
      name: '',
      eventDistanceKm: 96,
      eventDate: '2027-06-19',
    },
    validationSchema: createTeamSchema,
    onSubmit: async (values) => {
      setFormError(null)
      const result = await createTeam(values)
      if ('error' in result && result.error) {
        setFormError(
          (result.error as { message?: string }).message ??
            'Couldn’t create the team.',
        )
      }
      // On success the profile invalidation flips TeamPage to the team view.
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          id="name"
          name="name"
          label="Team name"
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.name && Boolean(formik.errors.name)}
          helperText={formik.touched.name && formik.errors.name}
        />
        <TextField
          id="eventDistanceKm"
          name="eventDistanceKm"
          label="Event distance"
          select
          value={formik.values.eventDistanceKm}
          onChange={formik.handleChange}
        >
          {EVENT_DISTANCES.map((km) => (
            <MenuItem key={km} value={km}>
              {km} km
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="eventDate"
          name="eventDate"
          label="Event date"
          type="date"
          value={formik.values.eventDate}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.eventDate && Boolean(formik.errors.eventDate)}
          helperText={formik.touched.eventDate && formik.errors.eventDate}
          InputLabelProps={{ shrink: true }}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Create team
        </ActionButton>
      </Stack>
    </form>
  )
}
