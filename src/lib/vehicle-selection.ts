import { cookies } from 'next/headers'
import { getVehicle, listVehicles } from '@/lib/data/vehicles'
import type { Vehicle } from '@/lib/domain/types'

export const VEHICLE_COOKIE = 'vehicleId'

export async function getSelectedVehicle(userId: string): Promise<Vehicle | null> {
  const id = (await cookies()).get(VEHICLE_COOKIE)?.value
  if (id) {
    const v = await getVehicle(userId, id)
    if (v && !v.archivedAt) return v
  }
  const [first] = await listVehicles(userId)
  return first ?? null
}
