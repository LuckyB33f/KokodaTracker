import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import Stack from '@mui/material/Stack'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import GroupIcon from '@mui/icons-material/Group'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import SessionForm from '@/features/sessions/components/SessionForm'
import SessionsList from '@/features/sessions/components/SessionsList'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useGetSessionsQuery } from '@/services/sessionApi'
import type { Session } from '@/features/sessions/types/sessionTypes'

export default function SessionsPage() {
  const { uid, teamId, isLoading } = useActiveTeam()
  const { data: sessions = [] } = useGetSessionsQuery(teamId ?? '', {
    skip: !teamId,
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Session | undefined>(undefined)
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Training log" noindex />
        <LoadingState label="Loading your training log…" />
      </PageContainer>
    )
  }

  if (!teamId) {
    return (
      <PageContainer>
        <SEO title="Training log" noindex />
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Join a team first"
          description="Sessions live with your team so everyone trains together."
          action={
            <Button component={RouterLink} to="/team" variant="contained">
              Set up your team
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title="Training log" noindex />
      <PageHeader
        title="Training log"
        subtitle="Every session counts towards race day."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<GpsFixedIcon />}
              component={RouterLink}
              to="/record"
            >
              Record
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              Log
            </Button>
          </Stack>
        }
      />
      <SectionCard>
        <SessionsList
          teamId={teamId}
          uid={uid ?? ''}
          sessions={sessions}
          onEdit={(session) => {
            setEditing(session)
            setDialogOpen(true)
          }}
        />
      </SectionCard>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {editing ? 'Edit session' : 'Log a session'}
          <IconButton
            aria-label="Close"
            onClick={() => setDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <SessionForm
            teamId={teamId}
            session={editing}
            onSaved={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
