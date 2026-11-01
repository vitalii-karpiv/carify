'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { deleteFuelEntry, getFuelEntry, updateFuelEntry } from '@/lib/data/entries'
import { toKyivLocalInput } from '@/lib/domain/dates'
import type { EntryActionResult } from '@/lib/domain/entry-result'
import { fuelEntryUpdateSchema } from '@/lib/domain/schemas'

// The datetime-local input drops seconds and the DST occurrence, so an untouched date must keep the stored instant.
async function keepUnchangedDate(userId: string, id: string, data: unknown): Promise<unknown> {
  if (typeof data !== 'object' || data === null) return data
  const { dateInput, ...rest } = data as Record<string, unknown>
  if (typeof dateInput !== 'string') return rest
  const existing = await getFuelEntry(userId, id)
  if (existing && toKyivLocalInput(existing.date) === dateInput) return { ...rest, date: existing.date }
  return rest
}

export async function updateFuelEntryAction(id: string, data: unknown): Promise<EntryActionResult> {
  const user = await requireUser()
  const parsed = fuelEntryUpdateSchema.safeParse(await keepUnchangedDate(user.id, id, data))
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION', fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const res = await updateFuelEntry(user.id, id, parsed.data)
  if (res.status === 'not_found') return { ok: false, error: 'NOT_FOUND' }
  if (res.status === 'odometer_out_of_range') {
    return { ok: false, error: 'ODOMETER_OUT_OF_RANGE', min: res.min, max: res.max }
  }
  revalidatePath('/', 'layout')
  redirect('/fuel')
}

export async function deleteFuelEntryAction(id: string): Promise<EntryActionResult> {
  const user = await requireUser()
  const deleted = await deleteFuelEntry(user.id, id)
  if (!deleted) return { ok: false, error: 'NOT_FOUND' }
  revalidatePath('/', 'layout')
  redirect('/fuel')
}
