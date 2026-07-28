import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import EventNoteIcon from '@mui/icons-material/EventNote'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SEO from '@/components/common/SEO'
import MealDayList from '@/features/meals/components/MealDayList'
import MealForm from '@/features/meals/components/MealForm'
import MealQuickPicker from '@/features/meals/components/MealQuickPicker'
import NutritionReviewCard from '@/features/meals/components/NutritionReviewCard'
import SaveTemplateDialog from '@/features/templates/components/SaveTemplateDialog'
import TemplatePicker from '@/features/templates/components/TemplatePicker'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useGetMealsQuery, useGetMealLibraryQuery, useAddMealMutation } from '@/services/mealApi'
import {
  useApplyMealDayTemplateMutation,
  useBumpTemplateUseMutation,
  useGetPersonalTemplatesQuery,
  useGetTeamTemplatesQuery,
} from '@/services/templateApi'
import { useGetUserProfileQuery } from '@/services/userApi'
import { DEFAULT_MEAL_PREFS } from '@/features/profile/types/profileTypes'
import { isMealDayTemplate } from '@/features/templates/types/templateTypes'
import type {
  MealDayTemplatePayload,
  Template,
} from '@/features/templates/types/templateTypes'
import {
  brisbaneDateTimeToMs,
  formatDateHeading,
  nowTimeBrisbane,
  shiftDate,
  todayBrisbane,
} from '@/utils/brisbaneDate'
import type { Meal, MealLibraryItem } from '@/features/meals/types/mealTypes'

type AddStep =
  | { kind: 'closed' }
  | { kind: 'pick' }
  | { kind: 'new'; text: string }
  | { kind: 'edit'; meal: Meal }
  | { kind: 'applyTemplate' }

export default function FoodPage() {
  const user = useAppSelector(selectAuthUser)
  const uid = user?.uid ?? ''
  const { teamId, isCaptain } = useActiveTeam()
  const [date, setDate] = useState(todayBrisbane())
  const { data: meals = [] } = useGetMealsQuery({ uid, date }, { skip: !uid })
  const { data: library = [] } = useGetMealLibraryQuery(uid, { skip: !uid })
  const { data: profile } = useGetUserProfileQuery(uid, { skip: !uid })
  const { data: personalTemplates = [] } = useGetPersonalTemplatesQuery(uid, {
    skip: !uid,
  })
  const { data: teamTemplates = [] } = useGetTeamTemplatesQuery(teamId ?? '', {
    skip: !teamId,
  })
  const [addMeal] = useAddMealMutation()
  const [applyMealDayTemplate] = useApplyMealDayTemplateMutation()
  const [bumpTemplateUse] = useBumpTemplateUseMutation()
  const [step, setStep] = useState<AddStep>({ kind: 'closed' })
  const [dayMenuAnchor, setDayMenuAnchor] = useState<HTMLElement | null>(null)
  const [savingDayTemplate, setSavingDayTemplate] = useState(false)
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const prefs = profile?.mealPrefs ?? DEFAULT_MEAL_PREFS

  // R12.3: the day's logged meals, in time order, as a reusable template.
  const dayTemplatePayload: MealDayTemplatePayload = {
    items: meals
      .filter((meal) => meal.status === 'logged')
      .slice(0, 12)
      .map((meal) => ({
        slot: meal.slot,
        text: meal.textSnapshot,
        libraryRefId: meal.libraryRefId,
        ...(meal.tag ? { tag: meal.tag } : {}),
      })),
  }

  const applyTemplate = (template: Template) => {
    if (!isMealDayTemplate(template)) return
    void bumpTemplateUse({
      scope: template.scope,
      ownerId: template.scope === 'team' ? (teamId ?? '') : uid,
      templateId: template.id,
    })
    void applyMealDayTemplate({ date, template, library })
    setStep({ kind: 'closed' })
  }

  if (!user) {
    return (
      <PageContainer>
        <SEO title="Food" noindex />
        <LoadingState label="Loading your food diary…" />
      </PageContainer>
    )
  }

  const isToday = date === todayBrisbane()
  const close = () => setStep({ kind: 'closed' })

  // Chip tap = instant log with the current slot guess (R11.3: ≤2 taps).
  const quickLog = (item: MealLibraryItem) => {
    const hour = Number(nowTimeBrisbane().split(':')[0])
    const slot =
      hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 17 ? 'snack' : 'dinner'
    void addMeal({
      input: {
        date,
        slot,
        text: item.text,
        tag: item.tag ?? undefined,
        loggedAtMs: isToday
          ? Date.now()
          : brisbaneDateTimeToMs(date, nowTimeBrisbane()),
        libraryRefId: item.id,
      },
    })
    close()
  }

  return (
    <PageContainer>
      <SEO title="Food" noindex />
      <PageHeader
        title="Food"
        subtitle="Fuel the k's — your meals, your library."
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              component={RouterLink}
              to="/food/library"
              aria-label="Meal library"
              sx={{ width: 44, height: 44 }}
            >
              <RestaurantMenuIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to="/food/plan"
              aria-label="Meal plan"
              sx={{ width: 44, height: 44 }}
            >
              <EventNoteIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setStep({ kind: 'pick' })}
            >
              Add
            </Button>
            <IconButton
              aria-label="Day options"
              onClick={(event) => setDayMenuAnchor(event.currentTarget)}
              sx={{ width: 44, height: 44 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        }
      />
      <Menu
        anchorEl={dayMenuAnchor}
        open={Boolean(dayMenuAnchor)}
        onClose={() => setDayMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setDayMenuAnchor(null)
            setStep({ kind: 'applyTemplate' })
          }}
        >
          Apply meal-day template
        </MenuItem>
        <MenuItem
          disabled={dayTemplatePayload.items.length === 0}
          onClick={() => {
            setDayMenuAnchor(null)
            setSavingDayTemplate(true)
          }}
        >
          Save day as template
        </MenuItem>
      </Menu>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <IconButton
          aria-label="Previous day"
          onClick={() => setDate(shiftDate(date, -1))}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h3" component="p">
          {formatDateHeading(date)}
        </Typography>
        <IconButton
          aria-label="Next day"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={isToday}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <NutritionReviewCard uid={uid} date={date} />

      <MealDayList
        meals={meals}
        prefs={prefs}
        onEdit={(meal) => setStep({ kind: 'edit', meal })}
      />

      <Dialog
        open={step.kind !== 'closed'}
        onClose={close}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {step.kind === 'edit'
            ? 'Edit meal'
            : step.kind === 'new'
              ? 'New meal'
              : step.kind === 'applyTemplate'
                ? 'Apply a meal day'
                : `Add meal — ${formatDateHeading(date)}`}
          <IconButton
            aria-label="Close"
            onClick={close}
            sx={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {step.kind === 'pick' && (
            <MealQuickPicker
              library={library}
              onPick={quickLog}
              onNew={(text) => setStep({ kind: 'new', text })}
            />
          )}
          {step.kind === 'new' && (
            <MealForm
              date={date}
              library={library}
              initialText={step.text}
              duringTrainingEnabled={prefs.duringTraining}
              onSaved={close}
            />
          )}
          {step.kind === 'edit' && (
            <MealForm
              date={date}
              library={library}
              meal={step.meal}
              duringTrainingEnabled={prefs.duringTraining}
              onSaved={close}
            />
          )}
          {step.kind === 'applyTemplate' && (
            <TemplatePicker
              kind="mealDay"
              personal={personalTemplates}
              team={teamTemplates}
              onPick={applyTemplate}
              onBlank={() => setStep({ kind: 'pick' })}
              blankLabel="Just add a meal"
            />
          )}
        </DialogContent>
      </Dialog>

      <SaveTemplateDialog
        open={savingDayTemplate}
        onClose={() => setSavingDayTemplate(false)}
        kind="mealDay"
        payload={
          dayTemplatePayload.items.length > 0 ? dayTemplatePayload : null
        }
        defaultName={`${formatDateHeading(date)} meals`}
        createdFrom="history"
        uid={uid}
        teamId={teamId ?? undefined}
        isCaptain={isCaptain}
      />
    </PageContainer>
  )
}
