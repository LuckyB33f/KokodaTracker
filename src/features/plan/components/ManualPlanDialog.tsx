import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ActionButton from '@/components/common/ActionButton'
import { useSaveManualPlanMutation } from '@/services/planApi'
import { currentWeekDates, currentWeekKey } from '@/utils/weekKey'
import type { TeamMember } from '@/features/team/types/teamTypes'
import type { PlanDay, PlanTargetType } from '@/features/plan/types/planTypes'

// MUI Select can't hold null, so the whole-team option uses this sentinel.
const TEAM = 'team'

interface ManualRow {
  date: string
  memberUid: string // uid or TEAM
  title: string
  detail: string
  targetType: PlanTargetType
  targetValue: string // free text until save so typing isn't fought
}

interface ManualPlanDialogProps {
  open: boolean
  onClose: () => void
  teamId: string
  members: TeamMember[]
}

function defaultRows(): ManualRow[] {
  const saturday = currentWeekDates()[5]
  return [
    {
      date: saturday,
      memberUid: TEAM,
      title: 'Team hike',
      detail: '',
      targetType: 'duration',
      targetValue: '120',
    },
  ]
}

function rowError(row: ManualRow): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return 'Every session needs a date.'
  if (!row.title.trim()) return 'Every session needs a title.'
  if (row.title.trim().length > 80) return 'Titles are 80 characters max.'
  if (row.detail.trim().length > 300) return 'Details are 300 characters max.'
  if (row.targetType !== 'rest') {
    const value = Number(row.targetValue)
    if (!Number.isFinite(value) || value <= 0 || value > 1440) {
      return 'Targets must be between 1 and 1440.'
    }
  }
  return null
}

export default function ManualPlanDialog({
  open,
  onClose,
  teamId,
  members,
}: ManualPlanDialogProps) {
  const [saveManualPlan, { isLoading }] = useSaveManualPlanMutation()
  const [rows, setRows] = useState<ManualRow[]>(defaultRows)
  const [error, setError] = useState<string | null>(null)

  const patchRow = (index: number, patch: Partial<ManualRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  const save = async () => {
    setError(null)
    if (rows.length === 0) {
      setError('Add at least one session.')
      return
    }
    for (const row of rows) {
      const problem = rowError(row)
      if (problem) {
        setError(problem)
        return
      }
    }
    const days: PlanDay[] = [...rows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date: row.date,
        memberUid: row.memberUid === TEAM ? null : row.memberUid,
        title: row.title.trim(),
        detail: row.detail.trim(),
        targetType: row.targetType,
        targetValue: row.targetType === 'rest' ? 0 : Number(row.targetValue),
      }))
    const result = await saveManualPlan({
      teamId,
      weekKey: currentWeekKey(),
      days,
    })
    if ('error' in result && result.error) {
      setError(
        (result.error as { message?: string }).message ??
          'Couldn’t save the plan.',
      )
      return
    }
    setRows(defaultRows())
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Manual plan</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Build this week’s plan yourself. Saving replaces the current plan for
          the whole team.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          {rows.map((row, index) => (
            <Box
              key={index}
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr 1fr',
                  sm: '150px 1fr 1fr 40px',
                },
                alignItems: 'start',
              }}
            >
              <TextField
                label="Date"
                type="date"
                size="small"
                value={row.date}
                onChange={(e) => patchRow(index, { date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Who"
                select
                size="small"
                value={row.memberUid}
                onChange={(e) => patchRow(index, { memberUid: e.target.value })}
              >
                <MenuItem value={TEAM}>Whole team</MenuItem>
                {members.map((member) => (
                  <MenuItem key={member.uid} value={member.uid}>
                    {member.displayName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Title"
                size="small"
                value={row.title}
                onChange={(e) => patchRow(index, { title: e.target.value })}
                placeholder="e.g. Hill repeats"
              />
              <IconButton
                aria-label="Remove session"
                onClick={() =>
                  setRows((prev) => prev.filter((_, i) => i !== index))
                }
                sx={{ mt: 0.25 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
              <TextField
                label="Type"
                select
                size="small"
                value={row.targetType}
                onChange={(e) =>
                  patchRow(index, {
                    targetType: e.target.value as PlanTargetType,
                  })
                }
              >
                <MenuItem value="duration">Duration (min)</MenuItem>
                <MenuItem value="distance">Distance (km)</MenuItem>
                <MenuItem value="rest">Rest</MenuItem>
              </TextField>
              {row.targetType !== 'rest' && (
                <TextField
                  label={row.targetType === 'duration' ? 'Minutes' : 'Km'}
                  type="number"
                  size="small"
                  value={row.targetValue}
                  onChange={(e) =>
                    patchRow(index, { targetValue: e.target.value })
                  }
                />
              )}
              <TextField
                label="Detail (optional)"
                size="small"
                value={row.detail}
                onChange={(e) => patchRow(index, { detail: e.target.value })}
                placeholder="Terrain, pacing, what to bring…"
                sx={{
                  gridColumn: {
                    xs: '1 / -1',
                    sm: row.targetType !== 'rest' ? 'auto / span 2' : 'auto / span 3',
                  },
                }}
              />
            </Box>
          ))}
        </Stack>
        <Button
          startIcon={<AddIcon />}
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                date: currentWeekDates()[0],
                memberUid: TEAM,
                title: '',
                detail: '',
                targetType: 'duration',
                targetValue: '60',
              },
            ])
          }
          sx={{ mt: 2 }}
        >
          Add session
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <ActionButton
          onClick={() => void save()}
          loading={isLoading}
          fullWidth={false}
        >
          Save plan
        </ActionButton>
      </DialogActions>
    </Dialog>
  )
}
