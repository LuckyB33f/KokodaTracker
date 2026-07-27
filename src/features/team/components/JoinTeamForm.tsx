import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useJoinTeamMutation } from '@/services/teamApi'
import type { JoinTeamFormValues } from '../types/teamTypes'
import { joinTeamSchema } from '../validation/teamValidationSchemas'

export default function JoinTeamForm() {
  const [joinTeam] = useJoinTeamMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<JoinTeamFormValues>({
    initialValues: { code: '' },
    validationSchema: joinTeamSchema,
    onSubmit: async (values) => {
      setFormError(null)
      const result = await joinTeam({ code: values.code })
      if ('error' in result && result.error) {
        const apiError = result.error as { message?: string }
        setFormError(apiError.message ?? 'Couldn’t join that team.')
      }
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          id="code"
          name="code"
          label="Invite code"
          placeholder="e.g. 7KQ2XM"
          value={formik.values.code}
          onChange={(event) => {
            formik.setFieldValue('code', event.target.value.toUpperCase())
          }}
          onBlur={formik.handleBlur}
          error={formik.touched.code && Boolean(formik.errors.code)}
          helperText={formik.touched.code && formik.errors.code}
          inputProps={{ maxLength: 6, style: { letterSpacing: 4 } }}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          Join team
        </ActionButton>
      </Stack>
    </form>
  )
}
