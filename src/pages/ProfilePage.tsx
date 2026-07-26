import { useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import LogoutIcon from '@mui/icons-material/Logout'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import { useAuthActions } from '@/features/auth/hooks/useAuthActions'
import ProfileForm from '@/features/profile/components/ProfileForm'
import { useGetUserProfileQuery } from '@/services/userApi'

export default function ProfilePage() {
  const user = useAppSelector(selectAuthUser)
  const { signOutUser } = useAuthActions()
  const [signingOut, setSigningOut] = useState(false)

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useGetUserProfileQuery(user?.uid ?? skipToken)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOutUser()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <PageContainer>
      <SEO title="Profile" noindex />
      <PageHeader title="Profile" subtitle={user?.email ?? undefined} />
      <Stack spacing={2}>
        <SectionCard title="Your details">
          {isLoading ? (
            <LoadingState label="Loading your profile…" />
          ) : isError ? (
            <ErrorState
              message="Could not load your profile."
              onRetry={() => void refetch()}
            />
          ) : profile && user ? (
            <ProfileForm
              uid={user.uid}
              profile={profile}
              initialDisplayName={user.displayName ?? ''}
            />
          ) : (
            <LoadingState label="Setting up your profile…" />
          )}
        </SectionCard>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          disabled={signingOut}
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </Stack>
    </PageContainer>
  )
}
