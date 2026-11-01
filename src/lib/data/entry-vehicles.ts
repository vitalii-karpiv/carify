import { and, desc, eq, isNotNull, max } from 'drizzle-orm'
import { db } from '@/db/client'
import { energyEntry, serviceEntry } from '@/db/schema'
import type { EntryVehicle } from '@/lib/domain/types'
import { listVehicles } from './vehicles'

/** Active vehicles with their highest odometer and most recently used station, for the add-entry form. */
export async function listEntryVehicles(userId: string): Promise<EntryVehicle[]> {
  const [vehicles, fuelMax, serviceMax, stations] = await Promise.all([
    listVehicles(userId),
    db
      .select({ vehicleId: energyEntry.vehicleId, odo: max(energyEntry.odometer) })
      .from(energyEntry)
      .where(eq(energyEntry.userId, userId))
      .groupBy(energyEntry.vehicleId),
    db
      .select({ vehicleId: serviceEntry.vehicleId, odo: max(serviceEntry.odometer) })
      .from(serviceEntry)
      .where(eq(serviceEntry.userId, userId))
      .groupBy(serviceEntry.vehicleId),
    db
      .selectDistinctOn([energyEntry.vehicleId], {
        vehicleId: energyEntry.vehicleId,
        station: energyEntry.station,
      })
      .from(energyEntry)
      .where(and(eq(energyEntry.userId, userId), isNotNull(energyEntry.station)))
      .orderBy(energyEntry.vehicleId, desc(energyEntry.date), desc(energyEntry.odometer)),
  ])
  const last = new Map<string, number>()
  for (const r of [...fuelMax, ...serviceMax]) {
    if (r.odo !== null) last.set(r.vehicleId, Math.max(last.get(r.vehicleId) ?? r.odo, r.odo))
  }
  const lastStation = new Map(stations.map((r) => [r.vehicleId, r.station as EntryVehicle['lastStation']]))
  return vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    defaultGrade: v.defaultGrade,
    lastOdometer: last.get(v.id) ?? null,
    lastStation: lastStation.get(v.id) ?? null,
  }))
}
