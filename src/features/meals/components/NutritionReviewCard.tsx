import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import SectionCard from '@/components/common/SectionCard'
import { useGetNutritionReviewQuery } from '@/services/mealApi'

const VERDICT_COLOR: Record<string, 'warning' | 'success' | 'default'> = {
  'likely under-fuelled': 'warning',
  'about right': 'success',
  'heavier than the day needed': 'default',
}

interface NutritionReviewCardProps {
  uid: string
  date: string
}

// R13.10: renders the nightly review on the day view. Quiet when no review
// exists (empty log days never get one — that's by design, R13.7).
export default function NutritionReviewCard({
  uid,
  date,
}: NutritionReviewCardProps) {
  const { data: review } = useGetNutritionReviewQuery(
    { uid, date },
    { skip: !uid },
  )

  if (!review) return null

  if (review.verdict === 'not-assessed') {
    return (
      <SectionCard title="Fuelling review">
        <Typography variant="body2" color="text.secondary">
          Logged — no assessment today.
        </Typography>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Fuelling review">
      <Chip
        label={review.verdict}
        color={VERDICT_COLOR[review.verdict] ?? 'default'}
        variant="outlined"
        sx={{ mb: 1 }}
      />
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {review.reason}
      </Typography>
      {review.suggestion && (
        <Typography variant="body2" color="text.secondary">
          Tomorrow: {review.suggestion}
        </Typography>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1 }}
      >
        Based on {review.mealCount} logged meal
        {review.mealCount === 1 ? '' : 's'} and: {review.trainingSummary}.
        General guidance only — not medical advice.
      </Typography>
    </SectionCard>
  )
}
