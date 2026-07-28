import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import SectionCard from '@/components/common/SectionCard'
import {
  useGetStrengthAdviceQuery,
  useRequestStrengthAdviceMutation,
} from '@/services/strengthAdviceApi'
import type { StrengthWorkoutItem } from '../types/strengthAdviceTypes'

const adviceDate = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Australia/Brisbane',
})

interface StrengthCoachCardProps {
  teamId: string
  uid: string
  // Opens the log form prefilled with the suggested workout.
  onLogWorkout: (workout: StrengthWorkoutItem[]) => void
}

// F3.1: AI strength coach — progression tips + a suggested next workout from
// the member's logged strength history (Gemini via the request-queue pattern).
export default function StrengthCoachCard({
  teamId,
  uid,
  onLogWorkout,
}: StrengthCoachCardProps) {
  const { data: request } = useGetStrengthAdviceQuery({ teamId, uid })
  const [requestAdvice, { isLoading: requesting }] =
    useRequestStrengthAdviceMutation()

  const busy =
    requesting ||
    request?.status === 'pending' ||
    request?.status === 'processing'
  const advice = request?.status === 'done' ? request.advice : null

  return (
    <SectionCard title="AI strength coach">
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Reads your logged lifts and suggests what to lift next — progressive
          overload without the spreadsheet.
        </Typography>
        {request?.status === 'error' && (
          <Alert severity="error">
            {request.errorMessage ?? 'Coaching advice failed. Try again.'}
          </Alert>
        )}
        {advice && (
          <>
            <Typography variant="body2">{advice.summary}</Typography>
            {advice.tips.length > 0 && (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {advice.tips.map((tip) => (
                  <Typography
                    key={tip.exercise}
                    component="li"
                    variant="body2"
                    sx={{ mb: 0.5 }}
                  >
                    <strong>{tip.exercise}:</strong> {tip.tip}
                  </Typography>
                ))}
              </Box>
            )}
            <div>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Suggested next workout
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {advice.nextWorkout.map((item, index) => (
                  <Chip
                    key={`${item.name}-${index}`}
                    size="small"
                    label={`${item.name} ${item.sets}×${item.reps}${item.weightKg > 0 ? ` @ ${item.weightKg}kg` : ''}`}
                  />
                ))}
              </Box>
            </div>
          </>
        )}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant={advice ? 'outlined' : 'contained'}
            size="small"
            startIcon={
              busy ? <CircularProgress size={16} /> : <AutoAwesomeIcon />
            }
            disabled={busy}
            onClick={() => void requestAdvice({ teamId })}
          >
            {busy
              ? 'Coach is reviewing your lifts…'
              : advice
                ? 'Refresh advice'
                : 'Get coaching advice'}
          </Button>
          {advice && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PlaylistAddIcon />}
              onClick={() => onLogWorkout(advice.nextWorkout)}
            >
              Log this workout
            </Button>
          )}
        </Stack>
        {advice && request?.updatedAtMs && (
          <Typography variant="caption" color="text.secondary">
            AI-generated general fitness guidance, not medical advice. Updated{' '}
            {adviceDate.format(new Date(request.updatedAtMs))}.
          </Typography>
        )}
      </Stack>
    </SectionCard>
  )
}
