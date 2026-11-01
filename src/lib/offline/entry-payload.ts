import type { FieldErrors } from '@/components/forms/field'
import { fuelEntryInputSchema, serviceEntryInputSchema } from '@/lib/domain/schemas'
import type { OutboxKind } from './outbox'

export type PayloadResult =
  | { ok: true; payload: { id: string } & Record<string, unknown> }
  | { ok: false; errors: FieldErrors }

/**
 * Validates a form payload (from `readFuelForm` / `readServiceForm`) with the Zod input schema and
 * returns the outbox payload: ISO date string, `dateInput` stripped, forced `id`.
 */
export function buildOutboxPayload(
  kind: OutboxKind,
  form: Record<string, unknown>,
  id: string,
): PayloadResult {
  const { dateInput: _dateInput, ...rest } = form
  void _dateInput
  const payload = { ...rest, id }
  const schema = kind === 'fuel' ? fuelEntryInputSchema : serviceEntryInputSchema
  const parsed = schema.safeParse(payload)
  if (parsed.success) return { ok: true, payload }
  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form')
    if (errors[field]) continue
    errors[field] =
      issue.message === 'TOTAL_MISMATCH' ? 'Total does not match litres × price' : 'Invalid value'
  }
  return { ok: false, errors }
}

/** True when the odometer is below the last known reading (soft, non-blocking warning). */
export function isOdometerBelowLast(odometer: number | undefined, last: number | null | undefined): boolean {
  return odometer !== undefined && Number.isFinite(odometer) && last != null && odometer < last
}
