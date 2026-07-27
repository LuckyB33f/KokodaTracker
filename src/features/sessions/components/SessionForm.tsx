import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ActionButton from '@/components/common/ActionButton'
import {
  useAddSessionMutation,
  useUpdateSessionMutation,
} from '@/services/sessionApi'
import {
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
} from '../types/sessionTypes'
import type {
  Session,
  SessionFormValues,
  SessionInput,
} from '../types/sessionTypes'
import { sessionSchema } from '../validation/sessionValidationSchemas'

interface SessionFormProps {
  teamId: string
  session?: Session // present = edit mode
  onSaved: () => void
}

// datetime-local wants local wall-clock time, no timezone suffix.
function toDatetimeLocal(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toInput(values: SessionFormValues): SessionInput {
  const distance = values.distanceKm === '' ? undefined : Number(values.distanceKm)
  const elevation =
    values.elevationGainM === '' ? undefined : Number(values.elevationGainM)
  return {
    type: values.type,
    source: 'manual',
    startedAt: new Date(values.startedAt),
    durationMin: Number(values.durationMin),
    distanceKm: distance,
    elevationGainM: elevation,
    perceivedEffort: values.perceivedEffort,
    notes: values.notes.trim() || undefined,
  }
}

export default function SessionForm({
  teamId,
  session,
  onSaved,
}: SessionFormProps) {
  const [addSession] = useAddSessionMutation()
  const [updateSession] = useUpdateSessionMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<SessionFormValues>({
    initialValues: session
      ? {
          type: session.type,
          startedAt: toDatetimeLocal(session.startedAtMs),
          durationMin: String(session.durationMin),
          distanceKm: session.distanceKm === null ? '' : String(session.distanceKm),
          elevationGainM:
            session.elevationGainM === null ? '' : String(session.elevationGainM),
          perceivedEffort: session.perceivedEffort,
          notes: session.notes,
        }
      : {
          type: 'hike',
          startedAt: toDatetimeLocal(Date.now()),
          durationMin: '',
          distanceKm: '',
          elevationGainM: '',
          perceivedEffort: 5,
          notes: '',
        },
    validationSchema: sessionSchema,
    onSubmit: async (values) => {
      setFormError(null)
      const input = toInput(values)
      const result = session
        ? await updateSession({ teamId, sessionId: session.id, input })
        : await addSession({ teamId, input })
      if ('error' in result && result.error) {
        setFormError(
          (result.error as { message?: string }).message ??
            'Couldn’t save the session.',
        )
        return
      }
      onSaved()
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          id="type"
          name="type"
          label="Type"
          select
          value={formik.values.type}
          onChange={formik.handleChange}
        >
          {SESSION_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {SESSION_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="startedAt"
          name="startedAt"
          label="Date & time"
          type="datetime-local"
          value={formik.values.startedAt}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.startedAt && Boolean(formik.errors.startedAt)}
          helperText={formik.touched.startedAt && formik.errors.startedAt}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          id="durationMin"
          name="durationMin"
          label="Duration (minutes)"
          type="number"
          inputProps={{ min: 1, max: 1440, inputMode: 'numeric' }}
          value={formik.values.durationMin}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.durationMin && Boolean(formik.errors.durationMin)}
          helperText={formik.touched.durationMin && formik.errors.durationMin}
        />
        <Stack direction="row" spacing={2}>
          <TextField
            id="distanceKm"
            name="distanceKm"
            label="Distance (km)"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.1, inputMode: 'decimal' }}
            value={formik.values.distanceKm}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.distanceKm && Boolean(formik.errors.distanceKm)}
            helperText={formik.touched.distanceKm && formik.errors.distanceKm}
            fullWidth
          />
          <TextField
            id="elevationGainM"
            name="elevationGainM"
            label="Elevation (m)"
            type="number"
            inputProps={{ min: 0, max: 5000, inputMode: 'numeric' }}
            value={formik.values.elevationGainM}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.touched.elevationGainM &&
              Boolean(formik.errors.elevationGainM)
            }
            helperText={
              formik.touched.elevationGainM && formik.errors.elevationGainM
            }
            fullWidth
          />
        </Stack>
        <div>
          <Typography variant="body2" gutterBottom id="effort-label">
            Effort: {formik.values.perceivedEffort}/10
          </Typography>
          <Slider
            aria-labelledby="effort-label"
            value={formik.values.perceivedEffort}
            onChange={(_event, value) => {
              void formik.setFieldValue('perceivedEffort', value)
            }}
            min={1}
            max={10}
            step={1}
            marks
          />
        </div>
        <TextField
          id="notes"
          name="notes"
          label="Notes (optional)"
          multiline
          minRows={2}
          inputProps={{ maxLength: 500 }}
          value={formik.values.notes}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.notes && Boolean(formik.errors.notes)}
          helperText={formik.touched.notes && formik.errors.notes}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          {session ? 'Save changes' : 'Log session'}
        </ActionButton>
      </Stack>
    </form>
  )
}
