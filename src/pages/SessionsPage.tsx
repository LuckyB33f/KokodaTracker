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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
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
import TemplatePicker from '@/features/templates/components/TemplatePicker'
import { seedSessionTemplates } from '@/features/templates/utils/seedTemplates'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useGetSessionsQuery } from '@/services/sessionApi'
import {
  useAddTemplateMutation,
  useBumpTemplateUseMutation,
  useGetPersonalTemplatesQuery,
  useGetTeamTemplatesQuery,
} from '@/services/templateApi'
import { phaseFor } from '@/utils/trainingPhase'
import { isSessionTemplate } from '@/features/templates/types/templateTypes'
import type { Template } from '@/features/templates/types/templateTypes'
import type {
  Session,
  SessionFormValues,
} from '@/features/sessions/types/sessionTypes'

type LogStep =
  | { kind: 'closed' }
  | { kind: 'pick' }
  | { kind: 'form'; prefill?: Partial<SessionFormValues> }
  | { kind: 'edit'; session: Session }

export default function SessionsPage() {
  const { uid, teamId, team, isCaptain, isLoading } = useActiveTeam()
  const { data: sessions = [] } = useGetSessionsQuery(teamId ?? '', {
    skip: !teamId,
  })
  const { data: personalTemplates = [] } = useGetPersonalTemplatesQuery(
    uid ?? '',
    { skip: !uid },
  )
  const { data: teamTemplates = [] } = useGetTeamTemplatesQuery(teamId ?? '', {
    skip: !teamId,
  })
  const [bumpTemplateUse] = useBumpTemplateUseMutation()
  const [addTemplate, { isLoading: seeding }] = useAddTemplateMutation()
  const [step, setStep] = useState<LogStep>({ kind: 'closed' })
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

  const close = () => setStep({ kind: 'closed' })

  const pickTemplate = (template: Template) => {
    if (!isSessionTemplate(template)) return
    void bumpTemplateUse({
      scope: template.scope,
      ownerId: template.scope === 'team' ? teamId : (uid ?? ''),
      templateId: template.id,
    })
    const p = template.payload
    setStep({
      kind: 'form',
      prefill: {
        type: p.type,
        durationMin: String(p.durationMin),
        distanceKm: p.distanceKm !== undefined ? String(p.distanceKm) : '',
        elevationGainM:
          p.elevationGainM !== undefined ? String(p.elevationGainM) : '',
        perceivedEffort: p.perceivedEffort,
        notes: p.notes ?? '',
      },
    })
  }

  // R12.1 seed set: captain-only, offered while the team library is empty.
  const offerSeeds =
    isCaptain &&
    team !== null &&
    !teamTemplates.some((template) => template.kind === 'session')

  const addSeeds = async () => {
    if (!team) return
    const seeds = seedSessionTemplates(phaseFor(Date.now(), team.eventDateMs))
    for (const seed of seeds) {
      await addTemplate({
        scope: 'team',
        ownerId: teamId,
        kind: 'session',
        name: seed.name,
        payload: seed.payload,
        createdFrom: 'seed',
      })
    }
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
              onClick={() => setStep({ kind: 'pick' })}
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
          isCaptain={isCaptain}
          sessions={sessions}
          onEdit={(session) => setStep({ kind: 'edit', session })}
        />
      </SectionCard>
      <Dialog
        open={step.kind !== 'closed'}
        onClose={close}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {step.kind === 'edit'
            ? 'Edit session'
            : step.kind === 'form'
              ? 'Log a session'
              : 'Start from…'}
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
            <>
              <TemplatePicker
                kind="session"
                personal={personalTemplates}
                team={teamTemplates}
                onPick={pickTemplate}
                onBlank={() => setStep({ kind: 'form' })}
                blankLabel="Blank session"
              />
              {offerSeeds && (
                <Button
                  startIcon={<AutoAwesomeIcon />}
                  disabled={seeding}
                  onClick={() => void addSeeds()}
                  sx={{ mt: 2 }}
                >
                  Add starter templates for this phase
                </Button>
              )}
            </>
          )}
          {step.kind === 'form' && (
            <SessionForm
              teamId={teamId}
              prefill={step.prefill}
              onSaved={close}
            />
          )}
          {step.kind === 'edit' && (
            <SessionForm
              teamId={teamId}
              session={step.session}
              onSaved={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
