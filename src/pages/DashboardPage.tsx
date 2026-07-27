import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import GroupIcon from '@mui/icons-material/Group'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import WeekendSuggestionCard from '@/features/plan/components/WeekendSuggestionCard'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useGetSessionsQuery } from '@/services/sessionApi'
import { useGetTeamMembersQuery } from '@/services/teamApi'
import { currentWeekKey } from '@/utils/weekKey'
import {
  PHASE_LABELS,
  daysToEvent,
  phaseFor,
} from '@/utils/trainingPhase'
import type { Session } from '@/features/sessions/types/sessionTypes'

interface MemberWeek {
  uid: string
  displayName: string
  weeklyTargetHours: number
  hours: number
  km: number
  elevation: number
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function longestHikeKm(sessions: Session[], uid: string): number {
  return round1(
    Math.max(
      0,
      ...sessions
        .filter((session) => session.uid === uid && session.type === 'hike')
        .map((session) => session.distanceKm ?? 0),
    ),
  )
}

export default function DashboardPage() {
  const user = useAppSelector(selectAuthUser)
  const { team, teamId, isLoading } = useActiveTeam()
  const { data: sessions = [] } = useGetSessionsQuery(teamId ?? '', {
    skip: !teamId,
  })
  const { data: members = [] } = useGetTeamMembersQuery(teamId ?? '', {
    skip: !teamId,
  })
  const firstName = user?.displayName?.split(' ')[0]

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Dashboard" noindex />
        <LoadingState label="Loading your dashboard…" />
      </PageContainer>
    )
  }

  if (!teamId || !team) {
    return (
      <PageContainer>
        <SEO title="Dashboard" noindex />
        <PageHeader
          title={firstName ? `G'day, ${firstName}` : 'Dashboard'}
          subtitle="Kokoda Challenge Brisbane"
        />
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Set up your team to start tracking"
          description="The dashboard shows team progress once you've created or joined a team."
          action={
            <Button component={RouterLink} to="/team" variant="contained">
              Set up your team
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const now = Date.now()
  const days = daysToEvent(now, team.eventDateMs)
  const phase = phaseFor(now, team.eventDateMs)
  const weekKey = currentWeekKey()

  const weekSessions = sessions.filter((session) => session.weekKey === weekKey)
  const memberWeeks: MemberWeek[] = members.map((member) => {
    const mine = weekSessions.filter((session) => session.uid === member.uid)
    return {
      uid: member.uid,
      displayName: member.displayName,
      weeklyTargetHours: member.weeklyTargetHours,
      hours: round1(
        mine.reduce((sum, session) => sum + session.durationMin, 0) / 60,
      ),
      km: round1(mine.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0)),
      elevation: Math.round(
        mine.reduce((sum, session) => sum + (session.elevationGainM ?? 0), 0),
      ),
    }
  })

  // Virtual Kokoda (spec F6): train 3× the event distance before taper.
  const targetKm = team.eventDistanceKm * 3
  const totalKm = round1(
    sessions.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0),
  )
  const progress = Math.min(100, (totalKm / targetKm) * 100)

  return (
    <PageContainer>
      <SEO title="Dashboard" noindex />
      <PageHeader
        title={firstName ? `G'day, ${firstName}` : 'Dashboard'}
        subtitle={team.name}
      />

      <SectionCard>
        <Stack direction="row" alignItems="baseline" spacing={1.5}>
          <Typography variant="h1" component="p" sx={{ fontSize: '3rem' }}>
            {days}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            days to race day · {team.eventDistanceKm} km
          </Typography>
        </Stack>
        <Chip
          label={PHASE_LABELS[phase]}
          color="primary"
          size="small"
          sx={{ mt: 1 }}
        />
      </SectionCard>

      <WeekendSuggestionCard teamId={teamId} />

      <SectionCard title="This week">
        {memberWeeks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No members yet.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {memberWeeks.map((member) => (
              <Box key={member.uid}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="body2">{member.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {member.hours}h of {member.weeklyTargetHours}h ·{' '}
                    {member.km} km · {member.elevation} m ↑
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (member.hours / Math.max(1, member.weeklyTargetHours)) * 100,
                  )}
                  aria-label={`${member.displayName} weekly progress`}
                />
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>

      <SectionCard title="Virtual Kokoda">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Team target: train {targetKm} km (3× event distance) before taper.
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
          aria-label="Team cumulative distance"
        />
        <Typography variant="body2" sx={{ mb: 2 }}>
          {totalKm} of {targetKm} km ({Math.round(progress)}%)
        </Typography>
        <Stack spacing={0.5}>
          {members.map((member) => (
            <Typography key={member.uid} variant="body2" color="text.secondary">
              {member.displayName} — longest hike{' '}
              {longestHikeKm(sessions, member.uid)} km
            </Typography>
          ))}
        </Stack>
      </SectionCard>
    </PageContainer>
  )
}
