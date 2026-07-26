import * as yup from 'yup'
import { displayNameSchema } from '@/features/auth/validation/authValidationSchemas'

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
})
