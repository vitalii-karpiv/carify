'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { getVehicle, listVehicles } from '@/lib/data/vehicles'
import type { Vehicle } from '@/lib/domain/types'

const COOKIE = 'vehicleId'

export async function getSelectedVehicle(userId: string): Promise<Vehicle | null> {
  const id = (await cookies()).get(COOKIE)?.value
  if (id) {
    const v = await getVehicle(userId, id)
    if (v && !v.archivedAt) return v
  }
  const [first] = await listVehicles(userId)
  return first ?? null
}

export async function selectVehicleAction(vehicleId: string): Promise<void> {
  const user = await requireUser()
  const v = await getVehicle(user.id, vehicleId)
  if (!v || v.archivedAt) return
  ;(await cookies()).set(COOKIE, v.id, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })
  revalidatePath('/', 'layout')
}
