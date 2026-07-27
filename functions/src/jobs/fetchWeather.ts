import { db } from '../lib/admin'
import { todayBrisbane } from '../lib/weekKey'
import type { ForecastDay, LocationForecast } from '../logic/suggestion'

// The five mapped training locations (MVP-SPEC F10).
export const TRAINING_LOCATIONS = [
  { name: 'Mt Coot-tha', lat: -27.4847, lng: 152.9497 },
  { name: 'Brookfield Reserve', lat: -27.4939, lng: 152.9047 },
  { name: 'Gap Creek', lat: -27.4909, lng: 152.9294 },
  { name: 'Walkabout Creek', lat: -27.4433, lng: 152.9186 },
  { name: 'Mt Glorious (D’Aguilar)', lat: -27.3336, lng: 152.7626 },
] as const

interface WeatherApiDay {
  interval?: { startTime?: string }
  displayDate?: { year?: number; month?: number; day?: number }
  maxTemperature?: { degrees?: number }
  minTemperature?: { degrees?: number }
  daytimeForecast?: {
    precipitation?: { probability?: { percent?: number } }
    thunderstormProbability?: number
    weatherCondition?: { description?: { text?: string } }
  }
  sunEvents?: { sunriseTime?: string; sunsetTime?: string }
}

function toForecastDay(day: WeatherApiDay): ForecastDay {
  const displayDate = day.displayDate
  const date =
    displayDate?.year && displayDate.month && displayDate.day
      ? `${displayDate.year}-${String(displayDate.month).padStart(2, '0')}-${String(displayDate.day).padStart(2, '0')}`
      : (day.interval?.startTime ?? '').slice(0, 10)
  return {
    date,
    tMin: day.minTemperature?.degrees ?? null,
    tMax: day.maxTemperature?.degrees ?? null,
    precipProb: day.daytimeForecast?.precipitation?.probability?.percent ?? null,
    stormProb: day.daytimeForecast?.thunderstormProbability ?? null,
    sunrise: day.sunEvents?.sunriseTime ?? null,
    sunset: day.sunEvents?.sunsetTime ?? null,
    summary: day.daytimeForecast?.weatherCondition?.description?.text ?? null,
  }
}

export async function fetchWeather(weatherApiKey: string): Promise<void> {
  const locations: LocationForecast[] = []
  for (const location of TRAINING_LOCATIONS) {
    const url =
      `https://weather.googleapis.com/v1/forecast/days:lookup?key=${weatherApiKey}` +
      `&location.latitude=${location.lat}&location.longitude=${location.lng}&days=3`
    const response = await fetch(url)
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Weather API ${response.status} for ${location.name}: ${detail.slice(0, 200)}`,
      )
    }
    const payload = (await response.json()) as { forecastDays?: WeatherApiDay[] }
    locations.push({
      name: location.name,
      days: (payload.forecastDays ?? []).map(toForecastDay),
    })
  }

  await db.doc(`weather/${todayBrisbane()}`).set({
    fetchedAt: new Date(),
    locations: locations.map((location) => ({
      ...location,
      // Firestore rejects nested arrays only; plain objects are fine.
      days: location.days.map((day) => ({ ...day })),
    })),
  })
}
