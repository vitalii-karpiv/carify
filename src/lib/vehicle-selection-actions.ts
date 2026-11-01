'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth/session'
import { getVehicle } from '@/lib/data/vehicles'
import { VEHICLE_COOKIE } from '@/lib/vehicle-selection'

export async function selectVehicleAction(vehicleId: string): Promise<void> {
  const user = await requireUser()
  const v = await getVehicle(user.id, vehicleId)
  if (!v || v.archivedAt) return
  ;(await cookies()).set(VEHICLE_COOKIE, v.id, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })
  revalidatePath('/', 'layout')
}
