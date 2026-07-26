import * as yup from 'yup'

const email = yup
  .string()
  .trim()
  .email('Enter a valid email address')
  .required('Email is required')

// Min 6 mirrors the Firebase Auth backend minimum (skill rule: Yup matches
// backend validation).
const password = yup
  .string()
  .min(6, 'Password must be at least 6 characters')
  .required('Password is required')

export const displayNameSchema = yup
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be 50 characters or less')
  .required('Name is required')

export const loginSchema = yup.object({
  email,
  password: yup.string().required('Password is required'),
})

export const registerSchema = yup.object({
  displayName: displayNameSchema,
  email,
  password,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Confirm your password'),
})

export const resetPasswordSchema = yup.object({
  email,
})
