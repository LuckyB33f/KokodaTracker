import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'

// Spec F7: visible offline indicator. Firestore keeps working from cache;
// this just tells the user their logs will sync later.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <Alert severity="warning" square sx={{ borderRadius: 0 }}>
      You're offline — anything you log will sync when you're back in range.
    </Alert>
  )
}
