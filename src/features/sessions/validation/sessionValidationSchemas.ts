import * as yup from 'yup'
import {
  MAX_EXERCISES,
  MAX_SETS_PER_EXERCISE,
  SESSION_TYPES,
} from '../types/sessionTypes'

const exerciseSetSchema = yup.object({
  reps: yup
    .number()
    .typeError('Reps, e.g. 8')
    .required('Reps?')
    .integer('Whole reps')
    .min(1, 'At least 1')
    .max(200, 'At most 200'),
  weightKg: yup
    .number()
    .typeError('Kg, e.g. 60')
    .required('Weight?')
    .min(0, 'Can’t be negative')
    .max(500, 'At most 500 kg'),
})

const exerciseSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Name the exercise')
    .max(60, 'At most 60 characters'),
  sets: yup
    .array()
    .of(exerciseSetSchema)
    .min(1, 'Add at least one set')
    .max(MAX_SETS_PER_EXERCISE, `At most ${MAX_SETS_PER_EXERCISE} sets`),
})

// Mirrors firestore.rules /sessions validation (spec F3).
export const sessionSchema = yup.object({
  type: yup
    .string()
    .required('Pick a session type')
    .oneOf([...SESSION_TYPES]),
  startedAt: yup.string().required('When did you train?'),
  durationMin: yup
    .number()
    .typeError('Minutes, e.g. 45')
    .required('How long did you train?')
    .min(1, 'At least 1 minute')
    .max(1440, 'At most 24 hours'),
  distanceKm: yup
    .number()
    .typeError('Kilometres, e.g. 6.5')
    .min(0, 'Can’t be negative')
    .max(100, 'At most 100 km')
    .nullable()
    .transform((value, original) => (original === '' ? null : value)),
  elevationGainM: yup
    .number()
    .typeError('Metres, e.g. 350')
    .min(0, 'Can’t be negative')
    .max(5000, 'At most 5000 m')
    .nullable()
    .transform((value, original) => (original === '' ? null : value)),
  exercises: yup
    .array()
    .of(exerciseSchema)
    .max(MAX_EXERCISES, `At most ${MAX_EXERCISES} exercises`),
  perceivedEffort: yup.number().required().min(1).max(10),
  notes: yup.string().max(500, 'At most 500 characters'),
})
