import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import LoadingState from '@/components/common/LoadingState'
import { useAppSelector } from '@/app/hooks'
import { selectAuthStatus } from '@/features/auth/authSlice'

// Inverse guard: signed-in users never see Login/Register (spec F1).
export default function PublicOnlyRoute({
  children,
}: {
  children: ReactNode
}) {
  const status = useAppSelector(selectAuthStatus)
  const location = useLocation()

  if (status === 'initializing') {
    return <LoadingState fullScreen label="Loading…" />
  }

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  return children
}
