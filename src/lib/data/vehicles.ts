import { and, asc, eq, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { db } from '@/db/client'
import { vehicle } from '@/db/schema'
import type { VehicleInput } from '@/lib/domain/schemas'
import type { Vehicle } from '@/lib/domain/types'
import { isUuid } from './ids'

type VehicleRow = typeof vehicle.$inferSelect

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    make: row.make,
    model: row.model,
    year: row.year,
    plate: row.plate,
    vin: row.vin,
    defaultGrade: row.defaultGrade as Vehicle['defaultGrade'],
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
  }
}

function fields(input: VehicleInput) {
  return {
    name: input.name,
    make: input.make,
    model: input.model,
    year: input.year,
    plate: input.plate,
    vin: input.vin ?? null,
    defaultGrade: input.defaultGrade,
  }
}

export async function listVehicles(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<Vehicle[]> {
  const where = opts.includeArchived
    ? eq(vehicle.userId, userId)
    : and(eq(vehicle.userId, userId), isNull(vehicle.archivedAt))
  const rows = await db.select().from(vehicle).where(where).orderBy(asc(vehicle.createdAt))
  return rows.map(toVehicle)
}

export async function getVehicle(userId: string, id: string): Promise<Vehicle | null> {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, userId)))
  return row ? toVehicle(row) : null
}

export async function createVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
  const [row] = await db
    .insert(vehicle)
    .values({ id: uuidv7(), userId, ...fields(input) })
    .returning()
  return toVehicle(row)
}

export async function updateVehicle(
  userId: string,
  id: string,
  input: VehicleInput,
): Promise<Vehicle | null> {
  if (!isUuid(id)) return null
  const [row] = await db
    .update(vehicle)
    .set({ ...fields(input), updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, userId)))
    .returning()
  return row ? toVehicle(row) : null
}

export async function setVehicleArchived(
  userId: string,
  id: string,
  archived: boolean,
): Promise<boolean> {
  if (!isUuid(id)) return false
  const rows = await db
    .update(vehicle)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, userId)))
    .returning({ id: vehicle.id })
  return rows.length > 0
}

export async function deleteVehicle(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false
  const rows = await db
    .delete(vehicle)
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, userId)))
    .returning({ id: vehicle.id })
  return rows.length > 0
}
