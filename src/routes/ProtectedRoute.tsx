import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import LoadingState from '@/components/common/LoadingState'
import { useAppSelector } from '@/app/hooks'
import { selectAuthStatus } from '@/features/auth/authSlice'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAppSelector(selectAuthStatus)
  const location = useLocation()

  if (status === 'initializing') {
    return <LoadingState fullScreen label="Signing you in…" />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
