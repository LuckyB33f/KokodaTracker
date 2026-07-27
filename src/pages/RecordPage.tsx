import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import GroupIcon from '@mui/icons-material/Group'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ActionButton from '@/components/common/ActionButton'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import RouteMap from '@/features/record/components/RouteMap'
import { useGpsRecorder } from '@/features/record/hooks/useGpsRecorder'
import {
  boundsOf,
  encodePolyline,
  totalDistanceMeters,
  type GeoPoint,
} from '@/features/record/utils/geo'
import { clearBuffer } from '@/features/record/utils/recordingBuffer'
import { useActiveTeam } from '@/features/team/hooks/useActiveTeam'
import { useAddSessionMutation } from '@/services/sessionApi'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export default function RecordPage() {
  const navigate = useNavigate()
  const { teamId, isLoading } = useActiveTeam()
  const recorder = useGpsRecorder()
  const [addSession] = useAddSessionMutation()
  const [effort, setEffort] = useState(5)
  const [notes, setNotes] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (isLoading) {
    return (
      <PageContainer>
        <SEO title="Record hike" noindex />
        <LoadingState label="Loading…" />
      </PageContainer>
    )
  }

  if (!teamId) {
    return (
      <PageContainer>
        <SEO title="Record hike" noindex />
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="Join a team first"
          description="Recorded hikes are saved to your team's training log."
          action={
            <Button component={RouterLink} to="/team" variant="contained">
              Set up your team
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const saveRecording = async (points: GeoPoint[], durationMinOverride?: number) => {
    setSaving(true)
    setSaveError(null)
    const distanceKm =
      Math.round((totalDistanceMeters(points) / 1000) * 100) / 100
    const startMs = points[0]?.timestampMs ?? Date.now()
    const endMs = points[points.length - 1]?.timestampMs ?? Date.now()
    const durationMin =
      durationMinOverride ??
      Math.max(1, Math.round((endMs - startMs) / 60000))
    const result = await addSession({
      teamId,
      input: {
        type: 'hike',
        source: 'gps',
        startedAt: new Date(startMs),
        durationMin,
        distanceKm: Math.min(100, distanceKm),
        perceivedEffort: effort,
        notes: notes.trim() || undefined,
        route: {
          encodedPolyline: encodePolyline(points),
          bounds: boundsOf(points),
          pointCount: points.length,
        },
      },
    })
    setSaving(false)
    if ('error' in result && result.error) {
      setSaveError(
        (result.error as { message?: string }).message ?? 'Couldn’t save.',
      )
      return
    }
    await clearBuffer().catch(() => undefined)
    void navigate('/sessions')
  }

  const { status } = recorder

  return (
    <PageContainer>
      <SEO title="Record hike" noindex />
      <PageHeader
        title="Record a hike"
        subtitle="GPS tracks your route, distance and pace."
      />

      {recorder.recoveredPoints && status === 'idle' && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <>
              <Button
                size="small"
                onClick={() => void saveRecording(recorder.recoveredPoints ?? [])}
              >
                Save it
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={() => void recorder.discardRecovered()}
              >
                Discard
              </Button>
            </>
          }
        >
          Found an unsaved recording ({recorder.recoveredPoints.length} points)
          from a previous run.
        </Alert>
      )}

      {(status === 'denied' || status === 'unsupported') && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button size="small" component={RouterLink} to="/sessions">
              Log manually
            </Button>
          }
        >
          {status === 'denied'
            ? 'Location permission was denied — you can still log the session manually.'
            : 'This browser can’t track location — log the session manually instead.'}
        </Alert>
      )}

      <SectionCard>
        <RouteMap points={recorder.points} />
        <Stack
          direction="row"
          spacing={3}
          sx={{ mt: 2, justifyContent: 'space-around', textAlign: 'center' }}
        >
          <Box>
            <Typography variant="h2" component="p">
              {formatElapsed(recorder.elapsedMs)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              time
            </Typography>
          </Box>
          <Box>
            <Typography variant="h2" component="p">
              {recorder.distanceKm.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              km
            </Typography>
          </Box>
          <Box>
            <Typography variant="h2" component="p">
              {recorder.paceMinPerKm ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              min/km
            </Typography>
          </Box>
        </Stack>
      </SectionCard>

      {status === 'idle' && (
        <ActionButton
          startIcon={<PlayArrowIcon />}
          onClick={() => void recorder.start()}
        >
          Start recording
        </ActionButton>
      )}

      {(status === 'recording' || status === 'paused') && (
        <Stack direction="row" spacing={2}>
          {status === 'recording' ? (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PauseIcon />}
              onClick={recorder.pause}
              sx={{ minHeight: 44 }}
            >
              Pause
            </Button>
          ) : (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PlayArrowIcon />}
              onClick={() => void recorder.resume()}
              sx={{ minHeight: 44 }}
            >
              Resume
            </Button>
          )}
          <Button
            variant="contained"
            color="error"
            fullWidth
            startIcon={<StopIcon />}
            onClick={recorder.finish}
            sx={{ minHeight: 44 }}
          >
            Finish
          </Button>
        </Stack>
      )}

      {status === 'finished' && (
        <SectionCard title="Save your hike">
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          {recorder.points.length < 2 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Not enough GPS points were captured to save a route. You can
                log the session manually instead.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => void recorder.discard()}
                >
                  Discard
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  component={RouterLink}
                  to="/sessions"
                >
                  Log manually
                </Button>
              </Stack>
            </>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {recorder.distanceKm.toFixed(2)} km ·{' '}
                {formatElapsed(recorder.elapsedMs)} ·{' '}
                {recorder.points.length} GPS points
              </Typography>
              <div>
                <Typography variant="body2" gutterBottom id="record-effort">
                  Effort: {effort}/10
                </Typography>
                <Slider
                  aria-labelledby="record-effort"
                  value={effort}
                  onChange={(_e, value) => setEffort(value as number)}
                  min={1}
                  max={10}
                  step={1}
                  marks
                />
              </div>
              <TextField
                label="Notes (optional)"
                multiline
                minRows={2}
                inputProps={{ maxLength: 500 }}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => void recorder.discard()}
                  disabled={saving}
                >
                  Discard
                </Button>
                <ActionButton
                  loading={saving}
                  onClick={() =>
                    void saveRecording(
                      recorder.points,
                      Math.max(1, Math.round(recorder.elapsedMs / 60000)),
                    )
                  }
                >
                  Save hike
                </ActionButton>
              </Stack>
            </Stack>
          )}
        </SectionCard>
      )}
    </PageContainer>
  )
}
