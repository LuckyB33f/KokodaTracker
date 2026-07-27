// Phase derivation (MVP-SPEC §2.3: base|build1|build2|peak|taper over
// Aug 2026 → Jun 2027). Derived from weeks-to-event so it tracks whatever
// event date the captain sets.
export type TrainingPhase = 'base' | 'build1' | 'build2' | 'peak' | 'taper'

export const PHASE_LABELS: Record<TrainingPhase, string> = {
  base: 'Base — build the habit',
  build1: 'Build 1 — extend the distance',
  build2: 'Build 2 — back-to-back days',
  peak: 'Peak — biggest weeks',
  taper: 'Taper — freshen up',
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function phaseFor(nowMs: number, eventDateMs: number): TrainingPhase {
  const weeksToEvent = (eventDateMs - nowMs) / WEEK_MS
  if (weeksToEvent <= 3) return 'taper'
  if (weeksToEvent <= 10) return 'peak'
  if (weeksToEvent <= 20) return 'build2'
  if (weeksToEvent <= 32) return 'build1'
  return 'base'
}

export function daysToEvent(nowMs: number, eventDateMs: number): number {
  return Math.max(0, Math.ceil((eventDateMs - nowMs) / (24 * 60 * 60 * 1000)))
}
