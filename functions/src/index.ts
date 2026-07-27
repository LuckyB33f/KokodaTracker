import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { handlePlanRequest } from './triggers/onPlanRequest'
import { computeMetrics } from './jobs/computeMetrics'
import { fetchWeather } from './jobs/fetchWeather'
import { weekendSuggestion } from './jobs/weekendSuggestion'

setGlobalOptions({ region: 'australia-southeast1', maxInstances: 2 })

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const WEATHER_API_KEY = defineSecret('WEATHER_API_KEY')

// F5: captain-triggered weekly plan generation (spec §2.4), via a Firestore
// request queue instead of a callable — the org's Domain Restricted Sharing
// policy blocks the allUsers invoker grant callables require (§2.5 decision).
export const onPlanRequest = onDocumentCreated(
  {
    document: 'teams/{teamId}/planRequests/{requestId}',
    secrets: [GEMINI_API_KEY],
  },
  async (event) => {
    await handlePlanRequest({
      geminiApiKey: GEMINI_API_KEY.value(),
      teamId: event.params.teamId,
      requestId: event.params.requestId,
    })
  },
)

// Daily 5:00am Brisbane: weather fetch (F10) then metrics (F9).
// One scheduler job for both keeps us inside the 3-job free tier.
export const dailyJob = onSchedule(
  {
    schedule: '0 5 * * *',
    timeZone: 'Australia/Brisbane',
    secrets: [WEATHER_API_KEY],
  },
  async () => {
    try {
      await fetchWeather(WEATHER_API_KEY.value())
    } catch (error) {
      logger.error('fetchWeather failed', error)
    }
    await computeMetrics()
  },
)

// Thu + Fri 6:00am Brisbane: weekend suggestion (F10).
export const suggestionJob = onSchedule(
  {
    schedule: '0 6 * * 4,5',
    timeZone: 'Australia/Brisbane',
    secrets: [GEMINI_API_KEY],
  },
  async () => {
    await weekendSuggestion(GEMINI_API_KEY.value())
  },
)
