import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MapIcon from '@mui/icons-material/Map'
import type { GeoPoint } from '../utils/geo'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => unknown
        Polyline: new (opts: unknown) => { setPath: (p: unknown[]) => void; setMap: (m: unknown) => void }
        LatLngBounds: new () => { extend: (p: unknown) => void }
      }
    }
    __kokodaMapsLoading?: Promise<void>
  }
}

function loadMapsScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__kokodaMapsLoading) return window.__kokodaMapsLoading
  window.__kokodaMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&loading=async`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Maps failed to load'))
    document.head.appendChild(script)
  })
  return window.__kokodaMapsLoading
}

interface RouteMapProps {
  points: GeoPoint[]
  heightPx?: number
}

// Live route display (spec F4). Without an API key we degrade to a stats-only
// placeholder — recording itself never depends on the map.
export default function RouteMap({ points, heightPx = 260 }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const polylineRef = useRef<{ setPath: (p: unknown[]) => void } | null>(null)

  useEffect(() => {
    if (!MAPS_KEY || !containerRef.current) return
    let cancelled = false
    void loadMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return
        if (!mapRef.current) {
          const center = points[points.length - 1] ?? {
            lat: -27.4698,
            lng: 152.9508, // D'Aguilar NP side of Brisbane
          }
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center: { lat: center.lat, lng: center.lng },
            zoom: 15,
            disableDefaultUI: true,
          })
          const polyline = new window.google.maps.Polyline({
            path: [],
            strokeColor: '#2e7d32',
            strokeWeight: 4,
          })
          polyline.setMap(mapRef.current)
          polylineRef.current = polyline
        }
        polylineRef.current?.setPath(
          points.map((p) => ({ lat: p.lat, lng: p.lng })),
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [points])

  if (!MAPS_KEY) {
    return (
      <Box
        sx={{
          height: heightPx,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <MapIcon color="disabled" sx={{ fontSize: 40 }} />
        <Typography variant="body2" color="text.secondary" align="center">
          Live map needs a Google Maps key
          <br />
          (set VITE_GOOGLE_MAPS_API_KEY) — recording still works.
        </Typography>
      </Box>
    )
  }

  return <Box ref={containerRef} sx={{ height: heightPx, borderRadius: 1 }} />
}
