// weekKey e.g. "2026-W35" (MVP-SPEC §2.3) — ISO week of the *Brisbane* local
// date, since all display is Australia/Brisbane (§2.2).
const brisbaneYmd = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Brisbane',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function weekKeyFor(date: Date): string {
  const [year, month, day] = brisbaneYmd
    .format(date)
    .split('-')
    .map((part) => Number(part))
  const utc = new Date(Date.UTC(year, month - 1, day))
  // Shift to the Thursday of this ISO week, which fixes the ISO year.
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const isoYear = utc.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function currentWeekKey(): string {
  return weekKeyFor(new Date())
}

// Mon..Sun yyyy-mm-dd strings for the current Brisbane week (manual plan grid).
export function currentWeekDates(): string[] {
  const [year, month, day] = brisbaneYmd
    .format(new Date())
    .split('-')
    .map((part) => Number(part))
  const monday = new Date(Date.UTC(year, month - 1, day))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}
