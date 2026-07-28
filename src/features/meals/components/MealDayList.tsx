import { useState } from 'react'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import EmptyState from '@/components/common/EmptyState'
import SectionCard from '@/components/common/SectionCard'
import {
  useConfirmDraftMealMutation,
  useDeleteMealMutation,
} from '@/services/mealApi'
import { formatTimeBrisbane } from '@/utils/brisbaneDate'
import type { MealPrefs } from '@/features/profile/types/profileTypes'
import {
  MAIN_SLOTS,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  MEAL_TAG_LABELS,
} from '../types/mealTypes'
import type { Meal } from '../types/mealTypes'

interface MealDayListProps {
  meals: Meal[]
  prefs: MealPrefs
  onEdit: (meal: Meal) => void
}

export default function MealDayList({ meals, prefs, onEdit }: MealDayListProps) {
  const [confirmDraftMeal] = useConfirmDraftMealMutation()
  const [deleteMeal] = useDeleteMealMutation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuMeal, setMenuMeal] = useState<Meal | null>(null)

  const logged = meals.filter((meal) => meal.status === 'logged')
  const mainsLogged = new Set(
    logged.filter((m) => MAIN_SLOTS.includes(m.slot)).map((m) => m.slot),
  ).size
  const snacksLogged = logged.filter((m) => m.slot === 'snack').length

  if (meals.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={<RestaurantIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Nothing logged yet"
          description="Tap a meal from your library or add a new one."
        />
      </SectionCard>
    )
  }

  const visibleSlots = MEAL_SLOTS.filter(
    (slot) =>
      slot !== 'during' ||
      prefs.duringTraining ||
      meals.some((m) => m.slot === 'during'),
  )

  return (
    <>
      {/* R11.5 completeness — counts vs the member's own breakdown prefs. */}
      <Chip
        label={`Logged ${Math.min(mainsLogged, prefs.mainMeals)}/${prefs.mainMeals} mains · ${Math.min(snacksLogged, prefs.snacks)}/${prefs.snacks} snacks`}
        color={mainsLogged >= prefs.mainMeals ? 'success' : 'default'}
        variant="outlined"
        sx={{ mb: 2 }}
      />
      {visibleSlots.map((slot) => {
        const slotMeals = meals.filter((meal) => meal.slot === slot)
        if (slotMeals.length === 0) return null
        return (
          <SectionCard key={slot} title={MEAL_SLOT_LABELS[slot]}>
            <List disablePadding>
              {slotMeals.map((meal) => (
                <ListItem
                  key={meal.id}
                  disableGutters
                  sx={meal.status === 'draft' ? { opacity: 0.65 } : undefined}
                  secondaryAction={
                    meal.status === 'draft' ? (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            void confirmDraftMeal({
                              mealId: meal.id,
                              libraryRefId: meal.libraryRefId,
                            })
                          }
                        >
                          Confirm
                        </Button>
                        <IconButton
                          aria-label={`Discard draft ${meal.textSnapshot}`}
                          onClick={() => void deleteMeal({ mealId: meal.id })}
                          sx={{ width: 44, height: 44 }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        edge="end"
                        aria-label={`Options for ${meal.textSnapshot}`}
                        onClick={(event) => {
                          setMenuAnchor(event.currentTarget)
                          setMenuMeal(meal)
                        }}
                        sx={{ width: 44, height: 44 }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <>
                        {meal.textSnapshot}
                        {meal.status === 'draft' && (
                          <Chip
                            label="Draft"
                            size="small"
                            sx={{ ml: 1 }}
                            variant="outlined"
                          />
                        )}
                      </>
                    }
                    secondary={
                      <>
                        {meal.loggedAtMs !== null &&
                          formatTimeBrisbane(meal.loggedAtMs)}
                        {meal.tag && ` · ${MEAL_TAG_LABELS[meal.tag]}`}
                        {meal.portionNote && (
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {meal.portionNote}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        )
      })}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuMeal) onEdit(menuMeal)
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuMeal) void deleteMeal({ mealId: menuMeal.id })
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  )
}
