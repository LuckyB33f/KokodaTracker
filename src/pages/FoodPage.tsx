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
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import GroupIcon from '@mui/icons-material/Group'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SEO from '@/components/common/SEO'
import FoodDayList from '@/features/food/components/FoodDayList'
import FoodLogForm from '@/features/food/components/FoodLogForm'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useGetFoodLogsQuery } from '@/services/foodApi'
import {
  formatDateHeading,
  shiftDate,
  todayBrisbane,
} from '@/utils/brisbaneDate'
import type { FoodLog } from '@/features/food/types/foodTypes'

export default function FoodPage() {
  const { uid, teamId, isLoading } = useActiveTeam()
  const [date, setDate] = useState(todayBrisbane())
  const { data: logs = [] } = useGetFoodLogsQuery(
    { teamId: teamId ?? '', date },
    { skip: !teamId },
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FoodLog | undefined>(undefined)
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Food" noindex />
        <LoadingState label="Loading your food log…" />
      </PageContainer>
    )
  }

  if (!teamId) {
    return (
      <PageContainer>
        <SEO title="Food" noindex />
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Join a team first"
          description="Food logs live with your team — fuel up together."
          action={
            <Button component={RouterLink} to="/team" variant="contained">
              Set up your team
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const isToday = date === todayBrisbane()

  return (
    <PageContainer>
      <SEO title="Food" noindex />
      <PageHeader
        title="Food"
        subtitle="Fuel the k's — track what the team is eating."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            Add
          </Button>
        }
      />
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
      <FoodDayList
        teamId={teamId}
        uid={uid ?? ''}
        logs={logs}
        onEdit={(log) => {
          setEditing(log)
          setDialogOpen(true)
        }}
      />
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {editing ? 'Edit entry' : `Add food — ${formatDateHeading(date)}`}
          <IconButton
            aria-label="Close"
            onClick={() => setDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FoodLogForm
            teamId={teamId}
            date={date}
            log={editing}
            onSaved={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
