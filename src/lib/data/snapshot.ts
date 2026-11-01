import { eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { energyEntry, serviceEntry } from "@/db/schema";
import type { SnapshotVehicle } from "@/lib/domain/types";
import { listVehicles } from "./vehicles";

export async function getOfflineSnapshot(
  userId: string,
): Promise<SnapshotVehicle[]> {
  const [vehicles, fuelMax, serviceMax] = await Promise.all([
    listVehicles(userId),
    db
      .select({
        vehicleId: energyEntry.vehicleId,
        odo: max(energyEntry.odometer),
      })
      .from(energyEntry)
      .where(eq(energyEntry.userId, userId))
      .groupBy(energyEntry.vehicleId),
    db
      .select({
        vehicleId: serviceEntry.vehicleId,
        odo: max(serviceEntry.odometer),
      })
      .from(serviceEntry)
      .where(eq(serviceEntry.userId, userId))
      .groupBy(serviceEntry.vehicleId),
  ]);
  const last = new Map<string, number>();
  for (const r of [...fuelMax, ...serviceMax]) {
    if (r.odo !== null)
      last.set(r.vehicleId, Math.max(last.get(r.vehicleId) ?? r.odo, r.odo));
  }
  return vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    defaultGrade: v.defaultGrade,
    lastOdometer: last.get(v.id) ?? null,
  }));
}
