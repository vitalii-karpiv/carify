export type OdometerPoint = { id: string; date: Date; odometer: number }
export type OdometerCheck = { ok: true } | { ok: false; min: number | null; max: number | null }

/** Spec §4.3: min = max odometer at/before `date`; max = min odometer after `date`. */
export function odometerBounds(
  points: OdometerPoint[],
  date: Date,
  excludeId?: string,
): { min: number | null; max: number | null } {
  const t = date.getTime()
  let min: number | null = null
  let max: number | null = null
  for (const p of points) {
    if (p.id === excludeId) continue
    if (p.date.getTime() <= t) {
      if (min === null || p.odometer > min) min = p.odometer
    } else if (max === null || p.odometer < max) {
      max = p.odometer
    }
  }
  return { min, max }
}

export function checkOdometer(
  points: OdometerPoint[],
  candidate: { id?: string; date: Date; odometer: number },
): OdometerCheck {
  const { min, max } = odometerBounds(points, candidate.date, candidate.id)
  const ok = (min === null || candidate.odometer >= min) && (max === null || candidate.odometer <= max)
  return ok ? { ok: true } : { ok: false, min, max }
}
