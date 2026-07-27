import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EventNoteIcon from '@mui/icons-material/EventNote'
import GroupIcon from '@mui/icons-material/Group'
import ActionButton from '@/components/common/ActionButton'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import {
  useGeneratePlanMutation,
  useGetActivePlanQuery,
  useGetCheckoffsQuery,
  useSetCheckoffMutation,
} from '@/services/planApi'
import { useGetTeamMembersQuery } from '@/services/teamApi'
import type { PlanDay, ReadinessVerdict } from '@/features/plan/types/planTypes'

const dayHeading = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'Australia/Brisbane',
})

const VERDICT_COLOR: Record<ReadinessVerdict, 'success' | 'default' | 'warning'> =
  { scale_up: 'success', hold: 'default', scale_back: 'warning' }

function targetLabel(day: PlanDay): string {
  if (day.targetType === 'rest') return 'Rest'
  if (day.targetType === 'distance') return `${day.targetValue} km`
  return `${day.targetValue} min`
}

export default function PlanPage() {
  const user = useAppSelector(selectAuthUser)
  const { teamId, isCaptain, isLoading } = useActiveTeam()
  const { data: plan } = useGetActivePlanQuery(teamId ?? '', { skip: !teamId })
  const { data: checkoffs = [] } = useGetCheckoffsQuery(
    { teamId: teamId ?? '', planId: plan?.id ?? '' },
    { skip: !teamId || !plan },
  )
  const { data: members = [] } = useGetTeamMembersQuery(teamId ?? '', {
    skip: !teamId,
  })
  const [generatePlan, { isLoading: generating }] = useGeneratePlanMutation()
  const [setCheckoff] = useSetCheckoffMutation()
  const [generateError, setGenerateError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Training plan" noindex />
        <LoadingState label="Loading your plan…" />
      </PageContainer>
    )
  }

  if (!teamId) {
    return (
      <PageContainer>
        <SEO title="Training plan" noindex />
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Join a team first"
          description="Weekly plans are generated for your whole team."
          action={
            <Button component={RouterLink} to="/team" variant="contained">
              Set up your team
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const nameOf = (uid: string | null) =>
    uid === null
      ? 'Whole team'
      : (members.find((member) => member.uid === uid)?.displayName ?? 'Teammate')

  const doneKeys = new Set(
    checkoffs.filter((checkoff) => checkoff.done).map((c) => c.id),
  )

  const myReadiness = user && plan ? plan.readinessInputs[user.uid] : undefined
  const dates = plan
    ? [...new Set(plan.days.map((day) => day.date))].sort()
    : []

  const generate = async () => {
    setGenerateError(null)
    const result = await generatePlan()
    if ('error' in result && result.error) {
      setGenerateError(
        (result.error as { message?: string }).message ??
          'Couldn’t generate the plan.',
      )
    }
  }

  return (
    <PageContainer>
      <SEO title="Training plan" noindex />
      <PageHeader
        title="Training plan"
        subtitle={
          plan
            ? `Week ${plan.weekKey.split('-W')[1]} · ${plan.phase} phase`
            : 'AI-generated weekly plan for your team.'
        }
        action={
          isCaptain ? (
            <ActionButton
              startIcon={<AutoAwesomeIcon />}
              loading={generating}
              onClick={() => void generate()}
              fullWidth={false}
            >
              {plan ? 'Regenerate' : 'Generate'}
            </ActionButton>
          ) : undefined
        }
      />

      {generateError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {generateError}
        </Alert>
      )}

      {myReadiness && (
        <Chip
          label={myReadiness.reason}
          color={VERDICT_COLOR[myReadiness.verdict]}
          variant="outlined"
          sx={{ mb: 2, height: 'auto', py: 0.5, '& span': { whiteSpace: 'normal' } }}
        />
      )}

      {!plan ? (
        <EmptyState
          icon={<EventNoteIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="No plan yet"
          description={
            isCaptain
              ? 'Generate this week’s plan — it uses everyone’s recent training.'
              : 'Ask your captain to generate this week’s plan.'
          }
        />
      ) : (
        dates.map((date) => {
          const daysForDate = plan.days.filter((day) => day.date === date)
          return (
            <SectionCard key={date} title={dayHeading.format(new Date(`${date}T12:00:00+10:00`))}>
              <List disablePadding>
                {daysForDate.map((day) => {
                  const dayIndex = plan.days.indexOf(day)
                  const mine =
                    user && (day.memberUid === user.uid || day.memberUid === null)
                  const checkKey = user ? `${user.uid}_${dayIndex}` : ''
                  return (
                    <ListItem
                      key={`${day.memberUid ?? 'team'}-${dayIndex}`}
                      disableGutters
                      secondaryAction={
                        mine && day.targetType !== 'rest' ? (
                          <Checkbox
                            edge="end"
                            checked={doneKeys.has(checkKey)}
                            onChange={(event) => {
                              void setCheckoff({
                                teamId,
                                planId: plan.id,
                                dayIndex,
                                done: event.target.checked,
                              })
                            }}
                            inputProps={{
                              'aria-label': `Mark ${day.title} done`,
                            }}
                          />
                        ) : undefined
                      }
                    >
                      <ListItemText
                        primary={
                          <Box
                            component="span"
                            sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                          >
                            {day.title}
                            <Chip
                              label={targetLabel(day)}
                              size="small"
                              variant="outlined"
                            />
                            {day.memberUid === null && (
                              <Chip label="Team" size="small" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={`${nameOf(day.memberUid)} — ${day.detail}`}
                      />
                    </ListItem>
                  )
                })}
              </List>
            </SectionCard>
          )
        })
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2 }}
      >
        Plans are general fitness guidance, not medical advice. Listen to your
        body and see a professional for injuries.
      </Typography>
    </PageContainer>
  )
}
