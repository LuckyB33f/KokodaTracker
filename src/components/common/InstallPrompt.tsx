import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VISITS_KEY = 'kokoda:visits'
const DISMISSED_KEY = 'kokoda:install-dismissed'

// Custom A2HS prompt from the second visit (spec F7). Browsers without
// beforeinstallprompt (iOS Safari) never fire it, so this stays silent there.
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1
    localStorage.setItem(VISITS_KEY, String(visits))
    setEligible(visits >= 2 && localStorage.getItem(DISMISSED_KEY) !== 'true')

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setInstallEvent(null)
  }

  return (
    <Snackbar
      open={Boolean(installEvent) && eligible}
      message="Add Kokoda Tracker to your home screen?"
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') dismiss()
      }}
      action={
        <>
          <Button
            size="small"
            onClick={() => {
              void installEvent?.prompt().then(() => dismiss())
            }}
          >
            Install
          </Button>
          <Button size="small" color="inherit" onClick={dismiss}>
            Not now
          </Button>
        </>
      }
    />
  )
}
