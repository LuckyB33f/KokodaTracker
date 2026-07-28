import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SectionCard from '@/components/common/SectionCard'
import { useGetFuellingQuery } from '@/services/mealApi'
import {
  useGetLatestMealPlanRequestQuery,
  useRequestMealPlanMutation,
} from '@/services/mealPlanApi'
import { useGetTeamMembersQuery } from '@/services/teamApi'
import { useGetUserProfileQuery } from '@/services/userApi'
import { todayBrisbane } from '@/utils/brisbaneDate'

const VERDICT_COLOR: Record<string, 'warning' | 'success' | 'default'> = {
  'likely under-fuelled': 'warning',
  'about right': 'success',
  'heavier than the day needed': 'default',
}

interface FuellingCardProps {
  teamId: string
  uid: string
  isCaptain: boolean
}

// F6 amendment: per-member meal counts + latest nutrition review verdict
// (aggregate doc only — raw meals stay private) and the meal plan generator.
export default function FuellingCard({
  teamId,
  uid,
  isCaptain,
}: FuellingCardProps) {
  const { data: members = [] } = useGetTeamMembersQuery(teamId)
  const { data: fuelling = [] } = useGetFuellingQuery(teamId)
  const { data: profile } = useGetUserProfileQuery(uid, { skip: !uid })
  const { data: latestRequest } = useGetLatestMealPlanRequestQuery(teamId)
  const [requestMealPlan, { isLoading: firing }] = useRequestMealPlanMutation()
  const [error, setError] = useState<string | null>(null)

  const aiEnabled = profile?.aiMealsEnabled ?? true
  const today = todayBrisbane()

  const requestAgeMs = latestRequest?.createdAtMs
    ? Date.now() - latestRequest.createdAtMs
    : 0
  const generating =
    firing ||
    ((latestRequest?.status === 'pending' ||
      latestRequest?.status === 'processing') &&
      requestAgeMs < 15 * 60 * 1000)

  const generate = async (scope: 'self' | 'team') => {
    setError(null)
    const result = await requestMealPlan({ teamId, scope })
    if ('error' in result && result.error) {
      setError(
        (result.error as { message?: string }).message ??
          'Couldn’t request a meal plan.',
      )
    }
  }

  return (
    <SectionCard title="Fuelling">
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {members.map((member) => {
          const entry = fuelling.find((f) => f.uid === member.uid)
          const mealsToday = entry?.date === today ? entry.mealCount : 0
          const review =
            entry?.review && entry.review.date === today ? entry.review : null
          return (
            <Box
              key={member.uid}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2">{member.displayName}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {mealsToday} meal{mealsToday === 1 ? '' : 's'} today
                </Typography>
                {review && (
                  <Chip
                    label={review.verdict}
                    size="small"
                    variant="outlined"
                    color={VERDICT_COLOR[review.verdict] ?? 'default'}
                  />
                )}
              </Box>
            </Box>
          )
        })}
      </Stack>
      {generating ? (
        <Typography variant="body2" color="text.secondary">
          Meal plan generating — check{' '}
          <RouterLink to="/food/plan">the meal plan page</RouterLink> in a few
          minutes.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {aiEnabled && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => void generate('self')}
            >
              Generate my meal plan
            </Button>
          )}
          {isCaptain && (
            <Button
              size="small"
              color="inherit"
              onClick={() => void generate('team')}
            >
              Whole team
            </Button>
          )}
          <Button size="small" component={RouterLink} to="/food/plan">
            View plan
          </Button>
        </Box>
      )}
    </SectionCard>
  )
}
