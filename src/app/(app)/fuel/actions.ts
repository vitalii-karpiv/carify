'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { deleteFuelEntry, updateFuelEntry } from '@/lib/data/entries'
import type { EntryActionResult } from '@/lib/domain/entry-result'
import { fuelEntryUpdateSchema } from '@/lib/domain/schemas'

export async function updateFuelEntryAction(id: string, data: unknown): Promise<EntryActionResult> {
  const user = await requireUser()
  const parsed = fuelEntryUpdateSchema.safeParse(data)
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
