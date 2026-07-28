import * as yup from 'yup'
import { displayNameSchema } from '@/features/auth/validation/authValidationSchemas'
import { MACRO_FOCUS } from '../types/profileTypes'

export const profileSchema = yup.object({
  displayName: displayNameSchema,
  units: yup
    .string()
    .oneOf(['metric', 'imperial'] as const)
    .required(),
  theme: yup
    .string()
    .oneOf(['light', 'dark', 'system'] as const)
    .required(),
  aiMealsEnabled: yup.boolean().required(),
  mainMeals: yup.number().integer().min(2).max(4).required(),
  snacks: yup.number().integer().min(0).max(4).required(),
  duringTraining: yup.boolean().required(),
  macroFocus: yup
    .string()
    .oneOf([...MACRO_FOCUS])
    .required(),
})
