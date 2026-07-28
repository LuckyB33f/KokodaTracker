import { useMemo } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import type { FormikErrors } from 'formik'
import {
  useAddTemplateMutation,
  useBumpTemplateUseMutation,
  useDeleteTemplateMutation,
  useGetPersonalTemplatesQuery,
} from '@/services/templateApi'
import { isExerciseTemplate } from '@/features/templates/types/templateTypes'
import type { ExerciseTemplate } from '@/features/templates/types/templateTypes'
import {
  catalogWithCustom,
  type CatalogExercise,
} from '../data/exerciseCatalog'
import {
  MAX_EXERCISES,
  MAX_SETS_PER_EXERCISE,
  fromExerciseFormValues,
} from '../types/sessionTypes'
import type {
  SessionExercise,
  SessionExerciseFormValues,
} from '../types/sessionTypes'

interface ExerciseEditorProps {
  uid: string | null
  exercises: SessionExerciseFormValues[]
  // formik.errors.exercises — string when the array itself fails, per-row
  // objects otherwise. Only shown once formik has flagged submitCount > 0.
  errors?: string | string[] | FormikErrors<SessionExerciseFormValues>[]
  showErrors: boolean
  onChange: (next: SessionExerciseFormValues[]) => void
}

const EMPTY_SET = { reps: '', weightKg: '' }

function rowError(
  errors: ExerciseEditorProps['errors'],
  index: number,
): FormikErrors<SessionExerciseFormValues> | undefined {
  if (!Array.isArray(errors)) return undefined
  const entry = errors[index]
  return typeof entry === 'object' ? entry : undefined
}

function setError(
  row: FormikErrors<SessionExerciseFormValues> | undefined,
  index: number,
  field: 'reps' | 'weightKg',
): string | undefined {
  if (!row || !Array.isArray(row.sets)) return undefined
  const entry = row.sets[index]
  if (typeof entry !== 'object' || entry === null) return undefined
  return entry[field]
}

function presetLabel(template: ExerciseTemplate): string {
  const { exercise } = template.payload
  const first = exercise.sets[0]
  if (!first) return exercise.name
  const uniform = exercise.sets.every(
    (set) => set.reps === first.reps && set.weightKg === first.weightKg,
  )
  return uniform
    ? `${exercise.name} ${exercise.sets.length}×${first.reps} @ ${first.weightKg}kg`
    : `${exercise.name} ${exercise.sets.length} sets`
}

const filterOptions = createFilterOptions<CatalogExercise>({
  stringify: (option) => `${option.name} ${option.group}`,
})

export default function ExerciseEditor({
  uid,
  exercises,
  errors,
  showErrors,
  onChange,
}: ExerciseEditorProps) {
  const { data: personalTemplates = [] } = useGetPersonalTemplatesQuery(
    uid ?? '',
    { skip: !uid },
  )
  const [addTemplate] = useAddTemplateMutation()
  const [deleteTemplate] = useDeleteTemplateMutation()
  const [bumpTemplateUse] = useBumpTemplateUseMutation()

  const presets = useMemo(
    () => personalTemplates.filter(isExerciseTemplate),
    [personalTemplates],
  )

  // Catalog + preset names + names already typed this session, so your own
  // exercises are searchable too. All in-memory — no queries.
  const options = useMemo(
    () =>
      catalogWithCustom([
        ...presets.map((preset) => preset.payload.exercise.name),
        ...exercises.map((row) => row.name),
      ]),
    [presets, exercises],
  )

  const update = (
    index: number,
    patch: Partial<SessionExerciseFormValues>,
  ) => {
    onChange(
      exercises.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  const addExercise = (prefill?: SessionExercise) => {
    if (exercises.length >= MAX_EXERCISES) return
    onChange([
      ...exercises,
      prefill
        ? {
            name: prefill.name,
            sets: prefill.sets.map((set) => ({
              reps: String(set.reps),
              weightKg: String(set.weightKg),
            })),
          }
        : { name: '', sets: [{ ...EMPTY_SET }] },
    ])
  }

  const applyPreset = (preset: ExerciseTemplate) => {
    addExercise(preset.payload.exercise)
    if (uid) {
      void bumpTemplateUse({
        scope: 'personal',
        ownerId: uid,
        templateId: preset.id,
      })
    }
  }

  const savePreset = async (row: SessionExerciseFormValues) => {
    if (!uid || row.name.trim() === '') return
    const [exercise] = fromExerciseFormValues([row])
    if (!exercise || exercise.sets.length === 0) return
    // Re-saving an exercise updates the preset (progression!) instead of
    // stacking duplicates.
    const existing = presets.find(
      (preset) =>
        preset.payload.exercise.name.toLowerCase() ===
        exercise.name.toLowerCase(),
    )
    if (existing) {
      await deleteTemplate({
        scope: 'personal',
        ownerId: uid,
        templateId: existing.id,
      })
    }
    await addTemplate({
      scope: 'personal',
      ownerId: uid,
      kind: 'exercise',
      name: exercise.name,
      payload: { exercise },
      createdFrom: 'manual',
    })
  }

  const arrayError =
    showErrors && typeof errors === 'string' ? errors : undefined

  return (
    <Stack spacing={1.5}>
      <Typography
        variant="subtitle2"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <FitnessCenterIcon fontSize="small" />
        Exercises
      </Typography>
      {presets.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {presets.map((preset) => (
            <Chip
              key={preset.id}
              label={presetLabel(preset)}
              size="small"
              onClick={() => applyPreset(preset)}
              onDelete={() => {
                if (!uid) return
                void deleteTemplate({
                  scope: 'personal',
                  ownerId: uid,
                  templateId: preset.id,
                })
              }}
            />
          ))}
        </Box>
      )}
      {exercises.map((row, exerciseIndex) => {
        const rowErrors = showErrors
          ? rowError(errors, exerciseIndex)
          : undefined
        return (
          <Box
            key={exerciseIndex}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.5} alignItems="flex-start">
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={options}
                  filterOptions={filterOptions}
                  groupBy={(option) => option.group}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.name
                  }
                  inputValue={row.name}
                  onInputChange={(_event, value) =>
                    update(exerciseIndex, { name: value })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`Exercise ${exerciseIndex + 1}`}
                      placeholder="Search or type…"
                      size="small"
                      error={Boolean(rowErrors?.name)}
                      helperText={rowErrors?.name}
                    />
                  )}
                />
                <Tooltip title="Save as preset">
                  <IconButton
                    aria-label={`Save ${row.name || 'exercise'} as preset`}
                    onClick={() => void savePreset(row)}
                    disabled={!uid || row.name.trim() === ''}
                    sx={{ width: 40, height: 40 }}
                  >
                    <BookmarkAddOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove exercise">
                  <IconButton
                    aria-label={`Remove exercise ${exerciseIndex + 1}`}
                    onClick={() =>
                      onChange(
                        exercises.filter((_, i) => i !== exerciseIndex),
                      )
                    }
                    sx={{ width: 40, height: 40 }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              {row.sets.map((set, setIndex) => (
                <Stack
                  key={setIndex}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ width: 24, flexShrink: 0 }}
                  >
                    #{setIndex + 1}
                  </Typography>
                  <TextField
                    label="Reps"
                    type="number"
                    size="small"
                    inputProps={{ min: 1, max: 200, inputMode: 'numeric' }}
                    value={set.reps}
                    onChange={(event) =>
                      update(exerciseIndex, {
                        sets: row.sets.map((s, i) =>
                          i === setIndex
                            ? { ...s, reps: event.target.value }
                            : s,
                        ),
                      })
                    }
                    error={Boolean(setError(rowErrors, setIndex, 'reps'))}
                    helperText={setError(rowErrors, setIndex, 'reps')}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Weight (kg)"
                    type="number"
                    size="small"
                    inputProps={{
                      min: 0,
                      max: 500,
                      step: 0.5,
                      inputMode: 'decimal',
                    }}
                    value={set.weightKg}
                    onChange={(event) =>
                      update(exerciseIndex, {
                        sets: row.sets.map((s, i) =>
                          i === setIndex
                            ? { ...s, weightKg: event.target.value }
                            : s,
                        ),
                      })
                    }
                    error={Boolean(setError(rowErrors, setIndex, 'weightKg'))}
                    helperText={setError(rowErrors, setIndex, 'weightKg')}
                    sx={{ flex: 1 }}
                  />
                  <Tooltip title="Duplicate set">
                    <span>
                      <IconButton
                        aria-label={`Duplicate set ${setIndex + 1}`}
                        disabled={row.sets.length >= MAX_SETS_PER_EXERCISE}
                        onClick={() =>
                          update(exerciseIndex, {
                            sets: [
                              ...row.sets.slice(0, setIndex + 1),
                              { ...set },
                              ...row.sets.slice(setIndex + 1),
                            ],
                          })
                        }
                        sx={{ width: 36, height: 36 }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove set">
                    <span>
                      <IconButton
                        aria-label={`Remove set ${setIndex + 1}`}
                        disabled={row.sets.length <= 1}
                        onClick={() =>
                          update(exerciseIndex, {
                            sets: row.sets.filter((_, i) => i !== setIndex),
                          })
                        }
                        sx={{ width: 36, height: 36 }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                disabled={row.sets.length >= MAX_SETS_PER_EXERCISE}
                onClick={() =>
                  update(exerciseIndex, {
                    // New set starts from the last one — most sets repeat.
                    sets: [
                      ...row.sets,
                      { ...(row.sets[row.sets.length - 1] ?? EMPTY_SET) },
                    ],
                  })
                }
                sx={{ alignSelf: 'flex-start' }}
              >
                Add set
              </Button>
            </Stack>
          </Box>
        )
      })}
      {arrayError && (
        <Typography variant="caption" color="error">
          {arrayError}
        </Typography>
      )}
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        disabled={exercises.length >= MAX_EXERCISES}
        onClick={() => addExercise()}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add exercise
      </Button>
    </Stack>
  )
}
