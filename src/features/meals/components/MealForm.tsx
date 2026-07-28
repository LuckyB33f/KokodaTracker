import { useState } from 'react'
import { useFormik } from 'formik'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ActionButton from '@/components/common/ActionButton'
import {
  useAddMealMutation,
  useUpdateMealMutation,
} from '@/services/mealApi'
import { brisbaneDateTimeToMs, nowTimeBrisbane } from '@/utils/brisbaneDate'
import { libraryIdFor } from '../utils/mealText'
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  MEAL_TAGS,
  MEAL_TAG_LABELS,
} from '../types/mealTypes'
import type {
  Meal,
  MealFormValues,
  MealLibraryItem,
  MealTag,
} from '../types/mealTypes'
import { mealSchema } from '../validation/mealValidationSchemas'

interface MealFormProps {
  date: string
  library: MealLibraryItem[]
  meal?: Meal // present = edit mode
  // From the quick picker: prefills text/tag and pins the library item so
  // renamed items keep collecting taps.
  fromLibraryItem?: MealLibraryItem
  initialText?: string
  duringTrainingEnabled: boolean
  onSaved: () => void
}

export default function MealForm({
  date,
  library,
  meal,
  fromLibraryItem,
  initialText,
  duringTrainingEnabled,
  onSaved,
}: MealFormProps) {
  const [addMeal] = useAddMealMutation()
  const [updateMeal] = useUpdateMealMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const slots = MEAL_SLOTS.filter(
    (slot) => slot !== 'during' || duringTrainingEnabled || meal?.slot === 'during',
  )

  const formik = useFormik<MealFormValues>({
    initialValues: meal
      ? {
          slot: meal.slot,
          text: meal.textSnapshot,
          portionNote: meal.portionNote,
          tag: meal.tag ?? '',
          time: meal.loggedAtMs
            ? new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Australia/Brisbane',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(new Date(meal.loggedAtMs))
            : nowTimeBrisbane(),
        }
      : {
          slot: 'breakfast',
          text: fromLibraryItem?.text ?? initialText ?? '',
          portionNote: '',
          tag: fromLibraryItem?.tag ?? '',
          time: nowTimeBrisbane(),
        },
    validationSchema: mealSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setFormError(null)
      const text = values.text.trim()
      // Reuse the picked item's id when the text wasn't changed; otherwise
      // derive from text and check the (fully-streamed) library for existence.
      const pinnedId =
        fromLibraryItem && text === fromLibraryItem.text.trim()
          ? fromLibraryItem.id
          : undefined
      const derivedId = pinnedId ?? libraryIdFor(text)
      const exists =
        pinnedId !== undefined ||
        library.some((item) => item.id === derivedId)
      const input = {
        date,
        slot: values.slot,
        text,
        portionNote: values.portionNote,
        tag: values.tag === '' ? undefined : (values.tag as MealTag),
        loggedAtMs: brisbaneDateTimeToMs(date, values.time),
        libraryRefId: pinnedId,
        createLibraryItem: !exists,
      }
      const result = meal
        ? await updateMeal({ mealId: meal.id, input })
        : await addMeal({ input })
      if ('error' in result && result.error) {
        setFormError(
          (result.error as { message?: string }).message ??
            'Couldn’t save that.',
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
          id="slot"
          name="slot"
          label="Meal"
          select
          value={formik.values.slot}
          onChange={formik.handleChange}
        >
          {slots.map((slot) => (
            <MenuItem key={slot} value={slot}>
              {MEAL_SLOT_LABELS[slot]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="text"
          name="text"
          label="What did you eat?"
          placeholder="e.g. Chicken and rice with veg"
          inputProps={{ maxLength: 200 }}
          value={formik.values.text}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.text && Boolean(formik.errors.text)}
          helperText={formik.touched.text && formik.errors.text}
        />
        <TextField
          id="portionNote"
          name="portionNote"
          label="Portion (optional)"
          placeholder="e.g. big bowl"
          inputProps={{ maxLength: 120 }}
          value={formik.values.portionNote}
          onChange={formik.handleChange}
        />
        <div>
          <Typography variant="caption" color="text.secondary">
            Type (optional)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            {MEAL_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={MEAL_TAG_LABELS[tag]}
                color={formik.values.tag === tag ? 'primary' : 'default'}
                variant={formik.values.tag === tag ? 'filled' : 'outlined'}
                onClick={() =>
                  void formik.setFieldValue(
                    'tag',
                    formik.values.tag === tag ? '' : tag,
                  )
                }
              />
            ))}
          </Box>
        </div>
        <TextField
          id="time"
          name="time"
          label="Time"
          type="time"
          value={formik.values.time}
          onChange={formik.handleChange}
          InputLabelProps={{ shrink: true }}
        />
        <ActionButton type="submit" loading={formik.isSubmitting}>
          {meal ? 'Save changes' : 'Log meal'}
        </ActionButton>
      </Stack>
    </form>
  )
}
