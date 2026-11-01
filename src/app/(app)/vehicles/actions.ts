'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  setVehicleArchived,
  updateVehicle,
} from '@/lib/data/vehicles'
import { vehicleInputSchema } from '@/lib/domain/schemas'
import { clearSelectedVehicleCookieIf, setSelectedVehicleCookie } from '@/lib/vehicle-selection'

type ActionResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[] | undefined>; error?: string }

export async function createVehicleAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = vehicleInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const isFirst = (await listVehicles(user.id, { includeArchived: true })).length === 0
  const created = await createVehicle(user.id, parsed.data)
  if (isFirst) await setSelectedVehicleCookie(created.id)
  revalidatePath('/', 'layout')
  redirect('/vehicles')
}

export async function updateVehicleAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = vehicleInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const updated = await updateVehicle(user.id, id, parsed.data)
  if (!updated) return { ok: false, error: 'Vehicle not found' }
  revalidatePath('/', 'layout')
  redirect('/vehicles')
}

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireUser()
  const ok = await setVehicleArchived(user.id, id, archived)
  if (!ok) return { ok: false, error: 'Vehicle not found' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteVehicleAction(id: string, confirmName: string): Promise<ActionResult> {
  const user = await requireUser()
  const v = await getVehicle(user.id, id)
  if (!v) return { ok: false, error: 'Vehicle not found' }
  if (typeof confirmName !== 'string' || confirmName.trim() !== v.name) {
    return { ok: false, error: 'Name does not match' }
  }
  await deleteVehicle(user.id, id)
  await clearSelectedVehicleCookieIf(id)
  revalidatePath('/', 'layout')
  redirect('/vehicles')
}
