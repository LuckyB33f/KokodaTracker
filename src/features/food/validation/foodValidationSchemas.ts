import * as yup from 'yup'
import { MEAL_TYPES } from '../types/foodTypes'

// Mirrors firestore.rules /foodLogs validation (spec F3.5).
export const foodLogSchema = yup.object({
  mealType: yup
    .string()
    .required('Which meal?')
    .oneOf([...MEAL_TYPES]),
  description: yup
    .string()
    .trim()
    .required('What did you eat?')
    .min(1)
    .max(200, 'At most 200 characters'),
  calories: yup
    .number()
    .typeError('Whole number, e.g. 450')
    .integer('Whole number, e.g. 450')
    .min(0, 'Can’t be negative')
    .max(5000, 'At most 5000')
    .nullable()
    .transform((value, original) => (original === '' ? null : value)),
  notes: yup.string().max(300, 'At most 300 characters'),
})
