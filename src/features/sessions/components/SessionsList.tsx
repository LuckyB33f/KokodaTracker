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
import { useGetTeamMembersQuery } from '@/services/teamApi'
import { useDeleteSessionMutation } from '@/services/sessionApi'
import { SESSION_TYPE_LABELS } from '../types/sessionTypes'
import type { Session, SessionType } from '../types/sessionTypes'

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
  sessions: Session[]
  onEdit: (session: Session) => void
}

function summarise(session: Session): string {
  const parts = [`${session.durationMin} min`]
  if (session.distanceKm !== null) parts.push(`${session.distanceKm} km`)
  if (session.elevationGainM !== null) parts.push(`${session.elevationGainM} m ↑`)
  parts.push(`effort ${session.perceivedEffort}/10`)
  return parts.join(' · ')
}

export default function SessionsList({
  teamId,
  uid,
  sessions,
  onEdit,
}: SessionsListProps) {
  const { data: members = [] } = useGetTeamMembersQuery(teamId)
  const [deleteSession] = useDeleteSessionMutation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuSession, setMenuSession] = useState<Session | null>(null)

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
            if (menuSession) {
              void deleteSession({ teamId, sessionId: menuSession.id })
            }
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  )
}
