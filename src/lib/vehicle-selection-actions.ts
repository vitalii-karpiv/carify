'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { getVehicle } from '@/lib/data/vehicles'
import { setSelectedVehicleCookie } from '@/lib/vehicle-selection'

export async function selectVehicleAction(vehicleId: string): Promise<void> {
  const user = await requireUser()
  const v = await getVehicle(user.id, vehicleId)
  if (!v || v.archivedAt) return
  await setSelectedVehicleCookie(v.id)
  revalidatePath('/', 'layout')
}
