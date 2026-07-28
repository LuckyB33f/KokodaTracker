import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EventNoteIcon from '@mui/icons-material/EventNote'
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
  useGetLatestMealPlanRequestQuery,
  useGetMealPlanQuery,
  useRequestMealPlanMutation,
} from '@/services/mealPlanApi'
import { useAddMealMutation, useGetMealLibraryQuery } from '@/services/mealApi'
import { useGetUserProfileQuery } from '@/services/userApi'
import { currentWeekKey } from '@/utils/weekKey'
import {
  brisbaneDateTimeToMs,
  nowTimeBrisbane,
  todayBrisbane,
} from '@/utils/brisbaneDate'
import { MEAL_SLOT_LABELS } from '@/features/meals/types/mealTypes'
import type { MealPlanMeal } from '@/features/meals/types/mealPlanTypes'

const dayHeading = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'Australia/Brisbane',
})

export default function MealPlanPage() {
  const user = useAppSelector(selectAuthUser)
  const uid = user?.uid ?? ''
  const { teamId, isLoading } = useActiveTeam()
  const weekKey = currentWeekKey()
  const { data: plan } = useGetMealPlanQuery({ uid, weekKey }, { skip: !uid })
  const { data: profile } = useGetUserProfileQuery(uid, { skip: !uid })
  const { data: library = [] } = useGetMealLibraryQuery(uid, { skip: !uid })
  const { data: latestRequest } = useGetLatestMealPlanRequestQuery(
    teamId ?? '',
    { skip: !teamId },
  )
  const [requestMealPlan, { isLoading: firing }] = useRequestMealPlanMutation()
  const [addMeal] = useAddMealMutation()
  const [requestError, setRequestError] = useState<string | null>(null)
  const [loggedSnack, setLoggedSnack] = useState<string | null>(null)

  const aiEnabled = profile?.aiMealsEnabled ?? true

  // Same freshness guard as the training plan page: a dead request can't
  // lock the button past 15 minutes.
  const requestAgeMs = latestRequest?.createdAtMs
    ? Date.now() - latestRequest.createdAtMs
    : 0
  const generating =
    firing ||
    ((latestRequest?.status === 'pending' ||
      latestRequest?.status === 'processing') &&
      requestAgeMs < 15 * 60 * 1000)

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Meal plan" noindex />
        <LoadingState label="Loading your meal plan…" />
      </PageContainer>
    )
  }

  const generate = async () => {
    if (!teamId) return
    setRequestError(null)
    const result = await requestMealPlan({ teamId, scope: 'self' })
    if ('error' in result && result.error) {
      setRequestError(
        (result.error as { message?: string }).message ??
          'Couldn’t request a meal plan.',
      )
    }
  }

  // R13.3: planned meal → logged meal in one tap, feeding the library loop.
  const logPlanned = (date: string, meal: MealPlanMeal) => {
    const known =
      meal.libraryRefId !== null &&
      library.some((item) => item.id === meal.libraryRefId)
    void addMeal({
      input: {
        date,
        slot: meal.slot,
        text: meal.text,
        tag: meal.tag ?? undefined,
        loggedAtMs:
          date === todayBrisbane()
            ? Date.now()
            : brisbaneDateTimeToMs(date, nowTimeBrisbane()),
        libraryRefId: known ? (meal.libraryRefId ?? undefined) : undefined,
        createLibraryItem: !known,
      },
    })
    setLoggedSnack(meal.text)
  }

  return (
    <PageContainer>
      <SEO title="Meal plan" noindex />
      <PageHeader
        title="Meal plan"
        subtitle={
          plan
            ? `Week ${weekKey.split('-W')[1]} · v${plan.version} · ${plan.phase} phase`
            : 'A week of training fuel, built from your own meals.'
        }
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              component={RouterLink}
              to="/food"
              startIcon={<ArrowBackIcon />}
            >
              Food diary
            </Button>
            {aiEnabled && teamId && (
              <ActionButton
                startIcon={<AutoAwesomeIcon />}
                loading={generating}
                onClick={() => void generate()}
                fullWidth={false}
              >
                {generating ? 'Generating…' : plan ? 'Regenerate' : 'Generate'}
              </ActionButton>
            )}
          </Box>
        }
      />

      {!aiEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          AI meal suggestions are turned off in your{' '}
          <RouterLink to="/profile">profile settings</RouterLink>. Turn them on
          to generate meal plans.
        </Alert>
      )}

      {generating && !firing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your meal plan is generating — it usually takes a minute or two. You
          can leave this page and come back; it’ll appear here when ready.
        </Alert>
      )}

      {requestError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {requestError}
        </Alert>
      )}

      {latestRequest?.status === 'error' &&
        !generating &&
        latestRequest.requestedBy === uid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {latestRequest.errorMessage ?? 'Meal plan generation failed.'}
          </Alert>
        )}

      {!plan ? (
        <EmptyState
          icon={<EventNoteIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="No meal plan yet"
          description={
            aiEnabled
              ? 'Generate this week’s plan — it uses your meal library and your training week.'
              : 'Enable AI meal suggestions in your profile to generate one.'
          }
        />
      ) : (
        plan.days.map((day) => (
          <SectionCard
            key={day.date}
            title={dayHeading.format(new Date(`${day.date}T12:00:00+10:00`))}
          >
            <List disablePadding>
              {day.meals.map((meal, index) => (
                <ListItem
                  key={`${day.date}-${index}`}
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => logPlanned(day.date, meal)}
                    >
                      Log this
                    </Button>
                  }
                >
                  <ListItemText
                    primary={
                      <Box
                        component="span"
                        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        {meal.text}
                        {meal.libraryRefId && (
                          <Chip label="From your library" size="small" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={MEAL_SLOT_LABELS[meal.slot]}
                  />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        ))
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2 }}
      >
        Training-fuel guidance only — not medical or dietetic advice.
      </Typography>

      <Snackbar
        open={Boolean(loggedSnack)}
        autoHideDuration={2000}
        onClose={() => setLoggedSnack(null)}
        message={loggedSnack ? `Logged: ${loggedSnack}` : ''}
      />
    </PageContainer>
  )
}
