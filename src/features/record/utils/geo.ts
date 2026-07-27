export interface GeoPoint {
  lat: number
  lng: number
  timestampMs: number
}

const EARTH_RADIUS_M = 6371000

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function totalDistanceMeters(points: GeoPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i])
  }
  return total
}

// Google encoded polyline algorithm — keeps route docs tiny (spec §2.2).
export function encodePolyline(points: GeoPoint[]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ''
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1
    let chunk = ''
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    chunk += String.fromCharCode(v + 63)
    return chunk
  }
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lng = Math.round(point.lng * 1e5)
    result += encodeValue(lat - lastLat) + encodeValue(lng - lastLng)
    lastLat = lat
    lastLng = lng
  }
  return result
}

export function boundsOf(points: GeoPoint[]) {
  return {
    north: Math.max(...points.map((p) => p.lat)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    west: Math.min(...points.map((p) => p.lng)),
  }
}
