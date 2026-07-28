import * as yup from 'yup'
import { EVENT_DISTANCES } from '../types/teamTypes'

// Mirrors firestore.rules /teams validation (spec convention).
export const createTeamSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Give your team a name')
    .min(3, 'At least 3 characters')
    .max(40, 'At most 40 characters'),
  eventDistanceKm: yup
    .number()
    .required('Pick your event distance')
    .oneOf([...EVENT_DISTANCES], 'Pick 18, 30, 48 or 96 km'),
  eventDate: yup
    .string()
    .required('Set the event date')
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker'),
})

export const joinTeamSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required('Enter your invite code')
    .length(6, 'Codes are 6 characters'),
})
