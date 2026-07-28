// Calendar-date helpers pinned to Australia/Brisbane (MVP-SPEC §2.2).
const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Brisbane',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const readable = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Australia/Brisbane',
})

export function todayBrisbane(): string {
  return ymd.format(new Date())
}

// Pure calendar arithmetic on a yyyy-mm-dd string; timezone-safe.
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

const hm = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Australia/Brisbane',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function nowTimeBrisbane(): string {
  return hm.format(new Date())
}

// Brisbane is fixed UTC+10 (no DST), so a literal offset is safe.
export function brisbaneDateTimeToMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00+10:00`).getTime()
}

export function formatTimeBrisbane(ms: number): string {
  return hm.format(new Date(ms))
}

export function formatDateHeading(date: string): string {
  if (date === todayBrisbane()) return 'Today'
  if (date === shiftDate(todayBrisbane(), -1)) return 'Yesterday'
  const [year, month, day] = date.split('-').map(Number)
  return readable.format(new Date(Date.UTC(year, month - 1, day, 2)))
}
