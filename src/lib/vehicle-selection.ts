import { cookies } from 'next/headers'
import { getVehicle, listVehicles } from '@/lib/data/vehicles'
import type { Vehicle } from '@/lib/domain/types'

import { VEHICLE_COOKIE } from '@/lib/vehicle-cookie'

export { VEHICLE_COOKIE }

export async function getSelectedVehicle(userId: string): Promise<Vehicle | null> {
  const id = (await cookies()).get(VEHICLE_COOKIE)?.value
  if (id) {
    const v = await getVehicle(userId, id)
    if (v && !v.archivedAt) return v
  }
  const [first] = await listVehicles(userId)
  return first ?? null
}

const COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
} as const

export async function setSelectedVehicleCookie(vehicleId: string): Promise<void> {
  ;(await cookies()).set(VEHICLE_COOKIE, vehicleId, COOKIE_OPTIONS)
}

export async function clearSelectedVehicleCookieIf(vehicleId: string): Promise<void> {
  const store = await cookies()
  if (store.get(VEHICLE_COOKIE)?.value === vehicleId) store.delete(VEHICLE_COOKIE)
}
