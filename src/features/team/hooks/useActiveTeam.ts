import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import { useGetUserProfileQuery } from '@/services/userApi'
import { useGetTeamQuery } from '@/services/teamApi'

// One hook answering "what team am I on?" for every feature page.
export function useActiveTeam() {
  const user = useAppSelector(selectAuthUser)
  const profileQuery = useGetUserProfileQuery(user?.uid ?? '', {
    skip: !user,
  })
  const teamId = profileQuery.data?.activeTeamId ?? null
  const teamQuery = useGetTeamQuery(teamId ?? '', { skip: !teamId })

  return {
    uid: user?.uid ?? null,
    teamId,
    team: teamId ? (teamQuery.data ?? null) : null,
    isCaptain: Boolean(
      user && teamQuery.data && teamQuery.data.createdBy === user.uid,
    ),
    isLoading:
      profileQuery.isLoading || (Boolean(teamId) && teamQuery.isLoading),
    isError: profileQuery.isError || teamQuery.isError,
    refetch: () => {
      void profileQuery.refetch()
      if (teamId) void teamQuery.refetch()
    },
  }
}
