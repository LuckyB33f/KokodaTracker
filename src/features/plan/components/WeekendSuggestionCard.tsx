import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ThunderstormIcon from '@mui/icons-material/Thunderstorm'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import SectionCard from '@/components/common/SectionCard'
import { useGetWeekendSuggestionQuery } from '@/services/planApi'
import { currentWeekKey } from '@/utils/weekKey'

// F10 dashboard card. Reads only the stored suggestion doc, so it renders
// offline and never touches the Weather API.
export default function WeekendSuggestionCard({ teamId }: { teamId: string }) {
  const { data: suggestion } = useGetWeekendSuggestionQuery({
    teamId,
    weekKey: currentWeekKey(),
  })

  if (!suggestion) return null // nothing stored yet this week — stay quiet

  const snapshot = suggestion.weatherSnapshot

  return (
    <SectionCard title="Weekend hike outlook">
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
        {suggestion.status === 'go' ? (
          <WbSunnyIcon color="primary" />
        ) : (
          <ThunderstormIcon color="warning" />
        )}
        <Typography variant="body1">{suggestion.reasoning}</Typography>
      </Stack>
      {suggestion.pick && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {suggestion.pick.dayLabel} · {suggestion.pick.startTime} ·{' '}
          {suggestion.pick.locationName} · ~{suggestion.pick.distanceKm} km
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {typeof snapshot.stormProb === 'number' && (
          <Chip size="small" variant="outlined" label={`Storms ${snapshot.stormProb}%`} />
        )}
        {typeof snapshot.precipProb === 'number' && (
          <Chip size="small" variant="outlined" label={`Rain ${snapshot.precipProb}%`} />
        )}
        {typeof snapshot.tMax === 'number' && (
          <Chip size="small" variant="outlined" label={`Max ${snapshot.tMax}°C`} />
        )}
      </Stack>
    </SectionCard>
  )
}
