import * as yup from 'yup'
import { MEAL_SLOTS, MEAL_TAGS } from '../types/mealTypes'

// Mirrors firestore.rules users/{uid}/meals validation (spec convention).
export const mealSchema = yup.object({
  slot: yup
    .string()
    .oneOf([...MEAL_SLOTS])
    .required(),
  text: yup
    .string()
    .trim()
    .required('What did you eat?')
    .min(1)
    .max(200, 'At most 200 characters'),
  portionNote: yup.string().trim().max(120, 'At most 120 characters'),
  tag: yup
    .string()
    .oneOf(['', ...MEAL_TAGS])
    .defined(),
  time: yup
    .string()
    .required('Set a time')
    .matches(/^\d{2}:\d{2}$/, 'Use the time picker'),
})

export const renameLibraryItemSchema = yup.object({
  text: yup
    .string()
    .trim()
    .required('Give it a name')
    .min(1)
    .max(200, 'At most 200 characters'),
})
