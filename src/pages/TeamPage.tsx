import { useState } from 'react'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import EventIcon from '@mui/icons-material/Event'
import StraightenIcon from '@mui/icons-material/Straighten'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import CreateTeamForm from '@/features/team/components/CreateTeamForm'
import JoinTeamForm from '@/features/team/components/JoinTeamForm'
import InviteCodeCard from '@/features/team/components/InviteCodeCard'
import TeamMembersList from '@/features/team/components/TeamMembersList'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'

const brisbaneDate = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'long',
  timeZone: 'Australia/Brisbane',
})

export default function TeamPage() {
  const { team, teamId, isCaptain, isLoading, isError, refetch } =
    useActiveTeam()
  const [tab, setTab] = useState(0)

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Team" noindex />
        <LoadingState label="Loading your team…" />
      </PageContainer>
    )
  }

  if (isError) {
    return (
      <PageContainer>
        <SEO title="Team" noindex />
        <ErrorState onRetry={refetch} />
      </PageContainer>
    )
  }

  if (!teamId || !team) {
    return (
      <PageContainer>
        <SEO title="Team" noindex />
        <PageHeader
          title="Your team"
          subtitle="Train for Kokoda together — create a team or join with a code."
        />
        <SectionCard>
          <Tabs
            value={tab}
            onChange={(_event, next: number) => setTab(next)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab label="Create a team" />
            <Tab label="Join with code" />
          </Tabs>
          {tab === 0 ? <CreateTeamForm /> : <JoinTeamForm />}
        </SectionCard>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title={team.name} noindex />
      <PageHeader title={team.name} subtitle="Kokoda Challenge Brisbane" />
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip
          icon={<StraightenIcon />}
          label={`${team.eventDistanceKm} km event`}
          color="primary"
          variant="outlined"
        />
        <Chip
          icon={<EventIcon />}
          label={brisbaneDate.format(new Date(team.eventDateMs))}
          variant="outlined"
        />
      </Stack>
      <InviteCodeCard team={team} isCaptain={isCaptain} />
      <TeamMembersList teamId={teamId} />
    </PageContainer>
  )
}
