import { useCallback, useEffect, useRef, useState } from 'react'
import { totalDistanceMeters, type GeoPoint } from '../utils/geo'
import {
  clearBuffer,
  loadBuffer,
  saveBuffer,
} from '../utils/recordingBuffer'

export type RecorderStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'finished'
  | 'unsupported'
  | 'denied'

const MIN_POINT_INTERVAL_MS = 5000 // 1 point / 5s cap (spec §2.3)

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

export function useGpsRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [points, setPoints] = useState<GeoPoint[]>([])
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const lastPointAtRef = useRef(0)
  const pointsRef = useRef<GeoPoint[]>([])
  const pausedMsRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)

  // Crash recovery: surface any buffered points from a previous run.
  const [recoveredPoints, setRecoveredPoints] = useState<GeoPoint[] | null>(
    null,
  )
  useEffect(() => {
    void loadBuffer().then((buffered) => {
      if (buffered && buffered.points.length >= 2) {
        setRecoveredPoints(buffered.points)
      }
    })
  }, [])

  // Elapsed ticker (excludes paused time).
  useEffect(() => {
    if (status !== 'recording' || startedAtMs === null) return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtMs - pausedMsRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [status, startedAtMs])

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
      }
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen')
      }
    } catch {
      // Wake Lock is best-effort (spec R1); recording continues without it.
    }
  }, [])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    void wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
  }, [])

  const startWatching = useCallback(() => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastPointAtRef.current < MIN_POINT_INTERVAL_MS) return
        lastPointAtRef.current = now
        const point: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestampMs: now,
        }
        pointsRef.current = [...pointsRef.current, point]
        setPoints(pointsRef.current)
        void saveBuffer({
          startedAtMs: pointsRef.current[0]?.timestampMs ?? now,
          points: pointsRef.current,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stopWatching()
          setStatus('denied')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    )
  }, [stopWatching])

  const start = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    pointsRef.current = []
    setPoints([])
    pausedMsRef.current = 0
    lastPointAtRef.current = 0
    setStartedAtMs(Date.now())
    setElapsedMs(0)
    setRecoveredPoints(null)
    await clearBuffer().catch(() => undefined)
    setStatus('recording')
    await acquireWakeLock()
    startWatching()
  }, [acquireWakeLock, startWatching])

  const pause = useCallback(() => {
    stopWatching()
    pausedAtRef.current = Date.now()
    setStatus('paused')
  }, [stopWatching])

  const resume = useCallback(async () => {
    if (pausedAtRef.current !== null) {
      pausedMsRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
    setStatus('recording')
    await acquireWakeLock()
    startWatching()
  }, [acquireWakeLock, startWatching])

  const finish = useCallback(() => {
    stopWatching()
    if (pausedAtRef.current !== null) {
      pausedMsRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
    setStatus('finished')
  }, [stopWatching])

  const discard = useCallback(async () => {
    stopWatching()
    pointsRef.current = []
    setPoints([])
    setStatus('idle')
    setStartedAtMs(null)
    setElapsedMs(0)
    await clearBuffer().catch(() => undefined)
  }, [stopWatching])

  const discardRecovered = useCallback(async () => {
    setRecoveredPoints(null)
    await clearBuffer().catch(() => undefined)
  }, [])

  useEffect(() => stopWatching, [stopWatching])

  const distanceM = totalDistanceMeters(points)
  const distanceKm = Math.round((distanceM / 1000) * 100) / 100
  const elapsedMin = elapsedMs / 60000
  const paceMinPerKm =
    distanceKm > 0.05 ? Math.round((elapsedMin / distanceKm) * 10) / 10 : null

  return {
    status,
    points,
    startedAtMs,
    elapsedMs,
    distanceKm,
    paceMinPerKm,
    recoveredPoints,
    start,
    pause,
    resume,
    finish,
    discard,
    discardRecovered,
  }
}
