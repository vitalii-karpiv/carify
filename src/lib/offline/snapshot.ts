import type { SnapshotVehicle } from '@/lib/domain/types'
import { openOfflineDb } from './db'

export async function refreshSnapshot(fetchFn: typeof fetch = globalThis.fetch): Promise<void> {
  const res = await fetchFn('/api/offline-snapshot', { credentials: 'same-origin' })
  if (res.status !== 200) return
  const { vehicles } = (await res.json()) as { vehicles: SnapshotVehicle[] }
  const db = await openOfflineDb()
  const tx = db.transaction('snapshot', 'readwrite')
  await tx.store.clear()
  for (const v of vehicles) await tx.store.put(v)
  await tx.done
}

export async function getSnapshotVehicles(): Promise<SnapshotVehicle[]> {
  const db = await openOfflineDb()
  return db.getAll('snapshot')
}

export async function bumpLastOdometer(vehicleId: string, odometer: number): Promise<void> {
  const db = await openOfflineDb()
  const tx = db.transaction('snapshot', 'readwrite')
  const v = await tx.store.get(vehicleId)
  if (v) await tx.store.put({ ...v, lastOdometer: Math.max(v.lastOdometer ?? odometer, odometer) })
  await tx.done
}

export async function getLastUsedVehicleId(): Promise<string | null> {
  const db = await openOfflineDb()
  return ((await db.get('meta', 'lastUsedVehicleId')) as string | undefined) ?? null
}

export async function setLastUsedVehicleId(id: string): Promise<void> {
  const db = await openOfflineDb()
  await db.put('meta', id, 'lastUsedVehicleId')
}
