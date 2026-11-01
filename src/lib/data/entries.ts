import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { energyEntry, serviceEntry, vehicle } from '@/db/schema'
import { checkOdometer, type OdometerPoint } from '@/lib/domain/odometer'
import type {
  FuelEntryInput,
  FuelEntryUpdate,
  ServiceEntryInput,
  ServiceEntryUpdate,
} from '@/lib/domain/schemas'
import type { FuelEntry, ServiceEntry } from '@/lib/domain/types'
import { isUuid } from './ids'

export type CreateResult =
  | { status: 'created' }
  | { status: 'duplicate' }
  | { status: 'conflict' }
  | { status: 'vehicle_not_found' }
  | { status: 'odometer_out_of_range'; min: number | null; max: number | null }

export type UpdateResult =
  | { status: 'updated' }
  | { status: 'not_found' }
  | { status: 'odometer_out_of_range'; min: number | null; max: number | null }

type Executor = Pick<typeof db, 'select'>

type FuelRow = typeof energyEntry.$inferSelect
type ServiceRow = typeof serviceEntry.$inferSelect

function toFuelEntry(row: FuelRow): FuelEntry {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    date: row.date,
    odometer: row.odometer,
    litres: Number(row.quantity),
    pricePerLitreKop: row.pricePerUnit,
    totalKop: row.totalCost,
    currency: 'UAH',
    grade: row.grade as FuelEntry['grade'],
    isFull: row.isFull,
    missedPrevious: row.missedPrevious,
    station: row.station,
    note: row.note,
  }
}

function toServiceEntry(row: ServiceRow): ServiceEntry {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    date: row.date,
    odometer: row.odometer,
    category: row.category as ServiceEntry['category'],
    totalKop: row.totalCost,
    currency: 'UAH',
    garage: row.garage,
    notes: row.notes,
  }
}

function fuelFields(input: FuelEntryUpdate) {
  return {
    date: input.date,
    odometer: input.odometer,
    quantity: input.litres.toFixed(3),
    unit: 'L',
    grade: input.grade,
    pricePerUnit: input.pricePerLitreKop,
    totalCost: input.totalKop,
    isFull: input.isFull,
    missedPrevious: input.missedPrevious,
    station: input.station,
    note: input.note,
  }
}

function serviceFields(input: ServiceEntryUpdate) {
  return {
    date: input.date,
    odometer: input.odometer,
    category: input.category,
    totalCost: input.totalKop,
    garage: input.garage,
    notes: input.notes,
  }
}

async function points(ex: Executor, userId: string, vehicleId: string): Promise<OdometerPoint[]> {
  const [fuelRows, serviceRows] = await Promise.all([
    ex
      .select({ id: energyEntry.id, date: energyEntry.date, odometer: energyEntry.odometer })
      .from(energyEntry)
      .where(and(eq(energyEntry.vehicleId, vehicleId), eq(energyEntry.userId, userId))),
    ex
      .select({ id: serviceEntry.id, date: serviceEntry.date, odometer: serviceEntry.odometer })
      .from(serviceEntry)
      .where(and(eq(serviceEntry.vehicleId, vehicleId), eq(serviceEntry.userId, userId))),
  ])
  return [...fuelRows, ...serviceRows]
}

export function listOdometerPoints(userId: string, vehicleId: string): Promise<OdometerPoint[]> {
  if (!isUuid(vehicleId)) return Promise.resolve([])
  return points(db, userId, vehicleId)
}

type EntryInsert = { id: string; vehicleId: string; date: Date; odometer: number }

async function createEntry(
  userId: string,
  input: EntryInsert,
  insert: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<unknown>,
): Promise<CreateResult> {
  return db.transaction(async (tx) => {
    const [fuelHit] = await tx
      .select({ userId: energyEntry.userId })
      .from(energyEntry)
      .where(eq(energyEntry.id, input.id))
    const [serviceHit] = fuelHit
      ? []
      : await tx
          .select({ userId: serviceEntry.userId })
          .from(serviceEntry)
          .where(eq(serviceEntry.id, input.id))
    const hit = fuelHit ?? serviceHit
    if (hit) return { status: hit.userId === userId ? 'duplicate' : 'conflict' }

    const [owned] = await tx
      .select({ id: vehicle.id })
      .from(vehicle)
      .where(and(eq(vehicle.id, input.vehicleId), eq(vehicle.userId, userId)))
    if (!owned) return { status: 'vehicle_not_found' }

    const check = checkOdometer(await points(tx, userId, input.vehicleId), input)
    if (!check.ok) {
      return { status: 'odometer_out_of_range', min: check.min, max: check.max }
    }

    await insert(tx)
    return { status: 'created' }
  })
}

export function createFuelEntry(userId: string, input: FuelEntryInput): Promise<CreateResult> {
  return createEntry(userId, input, (tx) =>
    tx
      .insert(energyEntry)
      .values({ id: input.id, userId, vehicleId: input.vehicleId, ...fuelFields(input) }),
  )
}

export function createServiceEntry(
  userId: string,
  input: ServiceEntryInput,
): Promise<CreateResult> {
  return createEntry(userId, input, (tx) =>
    tx
      .insert(serviceEntry)
      .values({ id: input.id, userId, vehicleId: input.vehicleId, ...serviceFields(input) }),
  )
}

export async function updateFuelEntry(
  userId: string,
  id: string,
  input: FuelEntryUpdate,
): Promise<UpdateResult> {
  if (!isUuid(id)) return { status: 'not_found' }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ vehicleId: energyEntry.vehicleId })
      .from(energyEntry)
      .where(and(eq(energyEntry.id, id), eq(energyEntry.userId, userId)))
    if (!row) return { status: 'not_found' }
    const check = checkOdometer(await points(tx, userId, row.vehicleId), { id, ...input })
    if (!check.ok) return { status: 'odometer_out_of_range', min: check.min, max: check.max }
    await tx
      .update(energyEntry)
      .set({ ...fuelFields(input), updatedAt: new Date() })
      .where(and(eq(energyEntry.id, id), eq(energyEntry.userId, userId)))
    return { status: 'updated' }
  })
}

export async function updateServiceEntry(
  userId: string,
  id: string,
  input: ServiceEntryUpdate,
): Promise<UpdateResult> {
  if (!isUuid(id)) return { status: 'not_found' }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ vehicleId: serviceEntry.vehicleId })
      .from(serviceEntry)
      .where(and(eq(serviceEntry.id, id), eq(serviceEntry.userId, userId)))
    if (!row) return { status: 'not_found' }
    const check = checkOdometer(await points(tx, userId, row.vehicleId), { id, ...input })
    if (!check.ok) return { status: 'odometer_out_of_range', min: check.min, max: check.max }
    await tx
      .update(serviceEntry)
      .set({ ...serviceFields(input), updatedAt: new Date() })
      .where(and(eq(serviceEntry.id, id), eq(serviceEntry.userId, userId)))
    return { status: 'updated' }
  })
}

export async function deleteFuelEntry(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false
  const rows = await db
    .delete(energyEntry)
    .where(and(eq(energyEntry.id, id), eq(energyEntry.userId, userId)))
    .returning({ id: energyEntry.id })
  return rows.length > 0
}

export async function deleteServiceEntry(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false
  const rows = await db
    .delete(serviceEntry)
    .where(and(eq(serviceEntry.id, id), eq(serviceEntry.userId, userId)))
    .returning({ id: serviceEntry.id })
  return rows.length > 0
}

export async function getFuelEntry(userId: string, id: string): Promise<FuelEntry | null> {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(energyEntry)
    .where(and(eq(energyEntry.id, id), eq(energyEntry.userId, userId)))
  return row ? toFuelEntry(row) : null
}

export async function getServiceEntry(userId: string, id: string): Promise<ServiceEntry | null> {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(serviceEntry)
    .where(and(eq(serviceEntry.id, id), eq(serviceEntry.userId, userId)))
  return row ? toServiceEntry(row) : null
}

export async function listFuelEntries(userId: string, vehicleId: string): Promise<FuelEntry[]> {
  if (!isUuid(vehicleId)) return []
  const rows = await db
    .select()
    .from(energyEntry)
    .where(and(eq(energyEntry.vehicleId, vehicleId), eq(energyEntry.userId, userId)))
    .orderBy(desc(energyEntry.date))
  return rows.map(toFuelEntry)
}

export async function listServiceEntries(
  userId: string,
  vehicleId: string,
): Promise<ServiceEntry[]> {
  if (!isUuid(vehicleId)) return []
  const rows = await db
    .select()
    .from(serviceEntry)
    .where(and(eq(serviceEntry.vehicleId, vehicleId), eq(serviceEntry.userId, userId)))
    .orderBy(desc(serviceEntry.date))
  return rows.map(toServiceEntry)
}
