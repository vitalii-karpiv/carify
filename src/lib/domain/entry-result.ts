import { odometerRangeMessage, TOTAL_MISMATCH_MESSAGE } from './messages'

export type EntryActionResult =
  | { ok: true }
  | {
      ok: false
      error: 'NOT_FOUND' | 'ODOMETER_OUT_OF_RANGE' | 'VALIDATION'
      min?: number | null
      max?: number | null
      fieldErrors?: Record<string, string[] | undefined>
    }

/** One display message per field, from a failed action result. */
export function entryErrorMessages(
  res: Extract<EntryActionResult, { ok: false }>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (res.error === 'ODOMETER_OUT_OF_RANGE') out.odometer = odometerRangeMessage(res.min, res.max)
  for (const [field, issues] of Object.entries(res.fieldErrors ?? {})) {
    if (!issues?.length) continue
    out[field] = issues.includes('TOTAL_MISMATCH') ? TOTAL_MISMATCH_MESSAGE : 'Invalid value'
  }
  return out
}
