import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ActionButton from '@/components/common/ActionButton'
import { useUpdateUserProfileMutation } from '@/services/userApi'
import {
  DIET_STYLES,
  DIET_STYLE_LABELS,
} from '@/features/profile/types/profileTypes'
import type { MealPrefs } from '@/features/profile/types/profileTypes'

// Starter suggestions only — every field accepts free text.
const FAVOURITE_SUGGESTIONS = [
  'Spaghetti bolognese',
  'Chicken and rice',
  'Burritos',
  'Stir fry',
  'Overnight oats',
  'Porridge',
  'Eggs on toast',
  'Yoghurt and granola',
  'Sandwiches',
  'Roast veggies',
  'Steak and potatoes',
  'Curry',
  'Sushi',
  'Smoothies',
]
const TRY_SUGGESTIONS = [
  'Poke bowls',
  'Rice paper rolls',
  'Homemade trail mix',
  'Rice cakes with honey',
  'Bircher muesli',
  'Lentil dahl',
  'Buddha bowls',
  'Homemade energy balls',
  'Couscous salad',
  'Ramen',
  'Shakshuka',
  'Banana pancakes',
]
const AVOID_SUGGESTIONS = [
  'Peanuts',
  'Tree nuts',
  'Shellfish',
  'Dairy',
  'Gluten',
  'Eggs',
  'Mushrooms',
  'Olives',
  'Coriander',
  'Spicy food',
  'Seafood',
]

interface MealPrefsDialogProps {
  open: boolean
  uid: string
  prefs: MealPrefs
  // Set when the dialog gates a generate click — adds a "Save & generate"
  // primary action that fires generation after saving.
  onSavedAndGenerate?: () => void
  onClose: () => void
}

// F13C: the food questionnaire. Answers are stored in users/{uid}.mealPrefs
// and flow into every future meal-plan prompt.
export default function MealPrefsDialog({
  open,
  uid,
  prefs,
  onSavedAndGenerate,
  onClose,
}: MealPrefsDialogProps) {
  const [updateUserProfile, { isLoading: saving }] =
    useUpdateUserProfileMutation()
  const [dietStyle, setDietStyle] = useState(prefs.dietStyle)
  const [favouriteFoods, setFavouriteFoods] = useState(prefs.favouriteFoods)
  const [foodsToTry, setFoodsToTry] = useState(prefs.foodsToTry)
  const [avoidFoods, setAvoidFoods] = useState(prefs.avoidFoods)
  const [extraNotes, setExtraNotes] = useState(prefs.extraNotes)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDietStyle(prefs.dietStyle)
      setFavouriteFoods(prefs.favouriteFoods)
      setFoodsToTry(prefs.foodsToTry)
      setAvoidFoods(prefs.avoidFoods)
      setExtraNotes(prefs.extraNotes)
      setError(null)
    }
  }, [open, prefs])

  const save = async (generateAfter: boolean) => {
    setError(null)
    const result = await updateUserProfile({
      uid,
      patch: {
        mealPrefs: {
          ...prefs,
          dietStyle,
          favouriteFoods,
          foodsToTry,
          avoidFoods,
          extraNotes: extraNotes.trim(),
          questionnaireDone: true,
        },
      },
    })
    if ('error' in result && result.error) {
      setError(
        (result.error as { message?: string }).message ??
          'Couldn’t save your preferences.',
      )
      return
    }
    onClose()
    if (generateAfter) onSavedAndGenerate?.()
  }

  const chipsField = (args: {
    label: string
    placeholder: string
    helper: string
    value: string[]
    suggestions: string[]
    onChange: (next: string[]) => void
  }) => (
    <Autocomplete
      multiple
      freeSolo
      options={args.suggestions.filter((s) => !args.value.includes(s))}
      value={args.value}
      onChange={(_event, next) =>
        args.onChange(
          next
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 15),
        )
      }
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            label={option}
            size="small"
            {...getTagProps({ index })}
            key={`${option}-${index}`}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={args.label}
          placeholder={args.placeholder}
          helperText={args.helper}
        />
      )}
    />
  )

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Your food preferences</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Two minutes now makes every meal plan yours — the AI plans around
            what you actually like eating.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Eating style"
            value={dietStyle}
            onChange={(event) =>
              setDietStyle(event.target.value as MealPrefs['dietStyle'])
            }
          >
            {DIET_STYLES.map((style) => (
              <MenuItem key={style} value={style}>
                {DIET_STYLE_LABELS[style]}
              </MenuItem>
            ))}
          </TextField>
          {chipsField({
            label: 'Foods you love',
            placeholder: 'Type and press Enter…',
            helper: 'The plan leans on these heavily.',
            value: favouriteFoods,
            suggestions: FAVOURITE_SUGGESTIONS,
            onChange: setFavouriteFoods,
          })}
          {chipsField({
            label: 'Foods you’d like to try',
            placeholder: 'Type and press Enter…',
            helper: 'A few of these get worked into each week.',
            value: foodsToTry,
            suggestions: TRY_SUGGESTIONS,
            onChange: setFoodsToTry,
          })}
          {chipsField({
            label: 'Never include (allergies & dislikes)',
            placeholder: 'Type and press Enter…',
            helper: 'Hard rule — these will never appear in a plan.',
            value: avoidFoods,
            suggestions: AVOID_SUGGESTIONS,
            onChange: setAvoidFoods,
          })}
          <TextField
            label="Anything else? (optional)"
            placeholder="e.g. I batch cook on Sundays, big breakfasts, quick weekday dinners…"
            multiline
            minRows={2}
            inputProps={{ maxLength: 300 }}
            value={extraNotes}
            onChange={(event) => setExtraNotes(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        {onSavedAndGenerate ? (
          <>
            <Button disabled={saving} onClick={() => void save(false)}>
              Save only
            </Button>
            <ActionButton
              fullWidth={false}
              loading={saving}
              onClick={() => void save(true)}
            >
              Save & generate
            </ActionButton>
          </>
        ) : (
          <ActionButton
            fullWidth={false}
            loading={saving}
            onClick={() => void save(false)}
          >
            Save preferences
          </ActionButton>
        )}
      </DialogActions>
    </Dialog>
  )
}
