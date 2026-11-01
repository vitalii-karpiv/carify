import { formatNumber } from './money'

export type EntryActionResult =
  | { ok: true }
  | {
      ok: false
      error: 'NOT_FOUND' | 'ODOMETER_OUT_OF_RANGE' | 'VALIDATION'
      min?: number | null
      max?: number | null
      fieldErrors?: Record<string, string[] | undefined>
    }

/** 'Must be between 1 000 and 2 000 km'; omits the missing side. */
export function odometerRangeMessage(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min == null ? null : formatNumber(min, 0)
  const hi = max == null ? null : formatNumber(max, 0)
  if (lo !== null && hi !== null) return `Must be between ${lo} and ${hi} km`
  if (lo !== null) return `Must be at least ${lo} km`
  if (hi !== null) return `Must be at most ${hi} km`
  return 'Invalid odometer'
}

/** One display message per field, from a failed action result. */
export function entryErrorMessages(
  res: Extract<EntryActionResult, { ok: false }>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (res.error === 'ODOMETER_OUT_OF_RANGE') out.odometer = odometerRangeMessage(res.min, res.max)
  for (const [field, issues] of Object.entries(res.fieldErrors ?? {})) {
    if (!issues?.length) continue
    out[field] = issues.includes('TOTAL_MISMATCH') ? 'Total does not match litres × price' : 'Invalid value'
  }
  return out
}
