import * as yup from 'yup'
import { SESSION_TYPES } from '../types/sessionTypes'

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
  perceivedEffort: yup.number().required().min(1).max(10),
  notes: yup.string().max(500, 'At most 500 characters'),
})
