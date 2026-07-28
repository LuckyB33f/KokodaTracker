import { useState, type ReactElement } from 'react'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import HikingIcon from '@mui/icons-material/Hiking'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import StairsIcon from '@mui/icons-material/Stairs'
import EmptyState from '@/components/common/EmptyState'
import SaveTemplateDialog from '@/features/templates/components/SaveTemplateDialog'
import { useGetTeamMembersQuery } from '@/services/teamApi'
import { useDeleteSessionMutation } from '@/services/sessionApi'
import { SESSION_TYPE_LABELS, totalVolumeKg } from '../types/sessionTypes'
import type { Session, SessionType } from '../types/sessionTypes'
import type { SessionTemplatePayload } from '@/features/templates/types/templateTypes'

const TYPE_ICONS: Record<SessionType, ReactElement> = {
  hike: <HikingIcon />,
  run: <DirectionsRunIcon />,
  walk: <DirectionsWalkIcon />,
  stairs: <StairsIcon />,
  strength: <FitnessCenterIcon />,
  other: <MoreHorizIcon />,
}

const sessionDate = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Australia/Brisbane',
})

interface SessionsListProps {
  teamId: string
  uid: string
  isCaptain?: boolean
  sessions: Session[]
  onEdit: (session: Session) => void
}

// R12.3: one action turns a logged session into a reusable template.
function toTemplatePayload(session: Session): SessionTemplatePayload {
  return {
    type: session.type,
    durationMin: session.durationMin,
    ...(session.distanceKm !== null ? { distanceKm: session.distanceKm } : {}),
    ...(session.elevationGainM !== null
      ? { elevationGainM: session.elevationGainM }
      : {}),
    ...(session.exercises !== null && session.exercises.length > 0
      ? { exercises: session.exercises }
      : {}),
    perceivedEffort: session.perceivedEffort,
    ...(session.notes ? { notes: session.notes } : {}),
  }
}

function summarise(session: Session): string {
  const parts = [`${session.durationMin} min`]
  if (session.distanceKm !== null) parts.push(`${session.distanceKm} km`)
  if (session.elevationGainM !== null) parts.push(`${session.elevationGainM} m ↑`)
  if (session.exercises !== null && session.exercises.length > 0) {
    parts.push(
      `${session.exercises.length} exercise${session.exercises.length === 1 ? '' : 's'}`,
      `${totalVolumeKg(session.exercises).toLocaleString()} kg lifted`,
    )
  }
  parts.push(`effort ${session.perceivedEffort}/10`)
  return parts.join(' · ')
}

export default function SessionsList({
  teamId,
  uid,
  isCaptain = false,
  sessions,
  onEdit,
}: SessionsListProps) {
  const { data: members = [] } = useGetTeamMembersQuery(teamId)
  const [deleteSession] = useDeleteSessionMutation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuSession, setMenuSession] = useState<Session | null>(null)
  const [templateSource, setTemplateSource] = useState<Session | null>(null)

  const nameOf = (memberUid: string) =>
    members.find((member) => member.uid === memberUid)?.displayName ?? 'Teammate'

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<HikingIcon color="disabled" sx={{ fontSize: 40 }} />}
        title="No sessions yet"
        description="Log your first training session — it takes under 30 seconds."
      />
    )
  }

  return (
    <>
      <List disablePadding>
        {sessions.map((session) => (
          <ListItem
            key={session.id}
            divider
            disableGutters
            secondaryAction={
              session.uid === uid ? (
                <IconButton
                  edge="end"
                  aria-label={`Session options, ${SESSION_TYPE_LABELS[session.type]} on ${sessionDate.format(new Date(session.startedAtMs))}`}
                  onClick={(event) => {
                    setMenuAnchor(event.currentTarget)
                    setMenuSession(session)
                  }}
                  sx={{ width: 44, height: 44 }}
                >
                  <MoreVertIcon />
                </IconButton>
              ) : undefined
            }
          >
            <ListItemIcon>{TYPE_ICONS[session.type]}</ListItemIcon>
            <ListItemText
              primary={`${SESSION_TYPE_LABELS[session.type]} — ${summarise(session)}`}
              secondary={
                <>
                  {nameOf(session.uid)} ·{' '}
                  {sessionDate.format(new Date(session.startedAtMs))}
                  {session.notes && (
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {session.notes}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuSession) onEdit(menuSession)
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuSession) setTemplateSource(menuSession)
          }}
        >
          Save as template
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuSession) {
              void deleteSession({ teamId, sessionId: menuSession.id })
            }
          }}
        >
          Delete
        </MenuItem>
      </Menu>
      <SaveTemplateDialog
        open={Boolean(templateSource)}
        onClose={() => setTemplateSource(null)}
        kind="session"
        payload={templateSource ? toTemplatePayload(templateSource) : null}
        defaultName={
          templateSource
            ? `${SESSION_TYPE_LABELS[templateSource.type]} ${templateSource.durationMin}min`
            : ''
        }
        createdFrom="history"
        uid={uid}
        teamId={teamId}
        isCaptain={isCaptain}
      />
    </>
  )
}
