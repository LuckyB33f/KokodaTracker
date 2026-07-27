import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import {
  useAddFoodLogMutation,
  useUpdateFoodLogMutation,
} from '@/services/foodApi'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../types/foodTypes'
import type {
  FoodLog,
  FoodLogFormValues,
  FoodLogInput,
} from '../types/foodTypes'
import { foodLogSchema } from '../validation/foodValidationSchemas'

interface FoodLogFormProps {
  teamId: string
  date: string
  log?: FoodLog // present = edit mode
  onSaved: () => void
}

function toInput(values: FoodLogFormValues, date: string): FoodLogInput {
  return {
    date,
    mealType: values.mealType,
    description: values.description.trim(),
    calories: values.calories === '' ? undefined : Number(values.calories),
    notes: values.notes.trim() || undefined,
  }
}

export default function FoodLogForm({
  teamId,
  date,
  log,
  onSaved,
}: FoodLogFormProps) {
  const [addFoodLog] = useAddFoodLogMutation()
  const [updateFoodLog] = useUpdateFoodLogMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const formik = useFormik<FoodLogFormValues>({
    initialValues: log
      ? {
          mealType: log.mealType,
          description: log.description,
          calories: log.calories === null ? '' : String(log.calories),
          notes: log.notes,
        }
      : {
          mealType: 'breakfast',
          description: '',
          calories: '',
          notes: '',
        },
    validationSchema: foodLogSchema,
    onSubmit: async (values, helpers) => {
      setFormError(null)
      const input = toInput(values, log?.date ?? date)
      const result = log
        ? await updateFoodLog({ teamId, logId: log.id, input })
        : await addFoodLog({ teamId, input })
      if ('error' in result && result.error) {
        setFormError(
          (result.error as { message?: string }).message ??
            'Couldn’t save that.',
        )
        return
      }
      // Quick-log flow: keep the meal selected, clear the rest for the next
      // entry (F3.5 target is <15s per entry).
      helpers.resetForm({
        values: { ...values, description: '', calories: '', notes: '' },
      })
      onSaved()
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          id="mealType"
          name="mealType"
          label="Meal"
          select
          value={formik.values.mealType}
          onChange={formik.handleChange}
        >
          {MEAL_TYPES.map((meal) => (
            <MenuItem key={meal} value={meal}>
              {MEAL_TYPE_LABELS[meal]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="description"
          name="description"
          label="What did you eat?"
          placeholder="e.g. Chicken and salad wrap"
          inputProps={{ maxLength: 200 }}
          value={formik.values.description}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.description && Boolean(formik.errors.description)}
          helperText={formik.touched.description && formik.errors.description}
        />
        <TextField
          id="calories"
          name="calories"
          label="Calories (optional)"
          type="number"
          inputProps={{ min: 0, max: 5000, inputMode: 'numeric' }}
          value={formik.values.calories}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.calories && Boolean(formik.errors.calories)}
          helperText={formik.touched.calories && formik.errors.calories}
        />
        <TextField
          id="notes"
          name="notes"
          label="Notes (optional)"
          multiline
          minRows={2}
          inputProps={{ maxLength: 300 }}
          value={formik.values.notes}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.notes && Boolean(formik.errors.notes)}
          helperText={formik.touched.notes && formik.errors.notes}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          {log ? 'Save changes' : 'Add food'}
        </ActionButton>
      </Stack>
    </form>
  )
}
