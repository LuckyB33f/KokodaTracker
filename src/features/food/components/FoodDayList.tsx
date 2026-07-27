import { useState } from 'react'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import EmptyState from '@/components/common/EmptyState'
import SectionCard from '@/components/common/SectionCard'
import { useGetTeamMembersQuery } from '@/services/teamApi'
import { useDeleteFoodLogMutation } from '@/services/foodApi'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../types/foodTypes'
import type { FoodLog } from '../types/foodTypes'

interface FoodDayListProps {
  teamId: string
  uid: string
  logs: FoodLog[]
  onEdit: (log: FoodLog) => void
}

export default function FoodDayList({
  teamId,
  uid,
  logs,
  onEdit,
}: FoodDayListProps) {
  const { data: members = [] } = useGetTeamMembersQuery(teamId)
  const [deleteFoodLog] = useDeleteFoodLogMutation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuLog, setMenuLog] = useState<FoodLog | null>(null)

  const nameOf = (memberUid: string) =>
    members.find((member) => member.uid === memberUid)?.displayName ?? 'Teammate'

  const totalCalories = logs.reduce((sum, log) => sum + (log.calories ?? 0), 0)
  const anyCalories = logs.some((log) => log.calories !== null)

  if (logs.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={<RestaurantIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Nothing logged yet"
          description="Add your first meal — fuelling counts as training."
        />
      </SectionCard>
    )
  }

  return (
    <>
      {anyCalories && (
        <Chip
          label={`Day total: ${totalCalories} cal`}
          color="primary"
          variant="outlined"
          sx={{ mb: 2 }}
        />
      )}
      {MEAL_TYPES.map((meal) => {
        const mealLogs = logs.filter((log) => log.mealType === meal)
        if (mealLogs.length === 0) return null
        return (
          <SectionCard key={meal} title={MEAL_TYPE_LABELS[meal]}>
            <List disablePadding>
              {mealLogs.map((log) => (
                <ListItem
                  key={log.id}
                  disableGutters
                  secondaryAction={
                    log.uid === uid ? (
                      <IconButton
                        edge="end"
                        aria-label={`Options for ${log.description}`}
                        onClick={(event) => {
                          setMenuAnchor(event.currentTarget)
                          setMenuLog(log)
                        }}
                        sx={{ width: 44, height: 44 }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemText
                    primary={log.description}
                    secondary={
                      <>
                        {nameOf(log.uid)}
                        {log.calories !== null && ` · ${log.calories} cal`}
                        {log.notes && (
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {log.notes}
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
            if (menuLog) onEdit(menuLog)
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuLog) {
              void deleteFoodLog({ teamId, logId: menuLog.id })
            }
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  )
}
