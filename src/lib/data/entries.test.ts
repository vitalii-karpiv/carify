import { v7 as uuidv7 } from 'uuid'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/client'
import { energyEntry } from '@/db/schema'
import type { FuelEntryInput, ServiceEntryInput } from '@/lib/domain/schemas'
import {
  createFuelEntry,
  createServiceEntry,
  deleteFuelEntry,
  deleteServiceEntry,
  getFuelEntry,
  getServiceEntry,
  listFuelEntries,
  listOdometerPoints,
  listServiceEntries,
  updateFuelEntry,
  updateServiceEntry,
} from './entries'
import { createTestUser, resetDb } from './test-utils'
import { createVehicle } from './vehicles'

let a: { id: string }
let b: { id: string }
let vehicleId: string

const vehicleInput = {
  name: 'Daily',
  make: 'Toyota',
  model: 'Corolla',
  year: 2020,
  plate: 'AA0001AA',
  vin: null,
  defaultGrade: 'A95' as const,
}

function fuel(over: Partial<FuelEntryInput> = {}): FuelEntryInput {
  return {
    id: uuidv7(),
    vehicleId,
    date: new Date('2026-01-10T10:00:00Z'),
    odometer: 1000,
    litres: 40.5,
    pricePerLitreKop: 5000,
    totalKop: 202500,
    grade: 'A95',
    isFull: true,
    missedPrevious: false,
    station: null,
    note: null,
    ...over,
  }
}

function service(over: Partial<ServiceEntryInput> = {}): ServiceEntryInput {
  return {
    id: uuidv7(),
    vehicleId,
    date: new Date('2026-01-10T10:00:00Z'),
    odometer: 1000,
    category: 'OIL_CHANGE',
    totalKop: 150000,
    garage: null,
    notes: null,
    ...over,
  }
}

function upd<T extends { id: string; vehicleId: string }>(e: T): Omit<T, 'id' | 'vehicleId'> {
  const { id, vehicleId, ...rest } = e
  void id
  void vehicleId
  return rest
}

beforeEach(async () => {
  await resetDb()
  a = await createTestUser()
  b = await createTestUser()
  vehicleId = (await createVehicle(a.id, vehicleInput)).id
})

describe('create', () => {
  it('creates a fuel entry and lists litres as a number', async () => {
    const input = fuel()
    expect(await createFuelEntry(a.id, input)).toEqual({ status: 'created' })
    const [e] = await listFuelEntries(a.id, vehicleId)
    expect(e).toEqual({ ...input, currency: 'UAH' })
    expect(typeof e.litres).toBe('number')
  })

  it('creates a service entry', async () => {
    const input = service()
    expect(await createServiceEntry(a.id, input)).toEqual({ status: 'created' })
    expect(await listServiceEntries(a.id, vehicleId)).toEqual([{ ...input, currency: 'UAH' }])
  })

  it('replay of the same payload is a duplicate and adds no row', async () => {
    const input = fuel()
    await createFuelEntry(a.id, input)
    expect(await createFuelEntry(a.id, input)).toEqual({ status: 'duplicate' })
    expect(await db.select().from(energyEntry)).toHaveLength(1)
  })

  it('replay is still a duplicate after a newer entry made its odometer invalid', async () => {
    const input = fuel({ odometer: 1000, date: new Date('2026-01-10T10:00:00Z') })
    await createFuelEntry(a.id, input)
    await createFuelEntry(a.id, fuel({ odometer: 900, date: new Date('2026-01-09T10:00:00Z') }))
    await createServiceEntry(a.id, service({ odometer: 1100, date: new Date('2026-01-11T10:00:00Z') }))
    expect(await createFuelEntry(a.id, { ...input, odometer: 1200 })).toEqual({ status: 'duplicate' })
  })

  it('a fuel id replayed as service is a duplicate', async () => {
    const input = fuel()
    await createFuelEntry(a.id, input)
    expect(await createServiceEntry(a.id, service({ id: input.id }))).toEqual({ status: 'duplicate' })
  })

  it('same id by another user is a conflict', async () => {
    const input = fuel()
    await createFuelEntry(a.id, input)
    const bVehicle = await createVehicle(b.id, vehicleInput)
    expect(await createFuelEntry(b.id, { ...input, vehicleId: bVehicle.id })).toEqual({
      status: 'conflict',
    })
  })

  it("creating on another user's vehicle is vehicle_not_found", async () => {
    expect(await createFuelEntry(b.id, fuel())).toEqual({ status: 'vehicle_not_found' })
    expect(await createServiceEntry(b.id, service())).toEqual({ status: 'vehicle_not_found' })
    expect(await db.select().from(energyEntry)).toHaveLength(0)
  })

  it('rejects an odometer below an earlier entry', async () => {
    await createFuelEntry(a.id, fuel({ odometer: 1000 }))
    expect(
      await createFuelEntry(a.id, fuel({ odometer: 900, date: new Date('2026-02-01T00:00:00Z') })),
    ).toEqual({ status: 'odometer_out_of_range', min: 1000, max: null })
  })

  it('counts service entries as odometer points for fuel and vice versa', async () => {
    await createServiceEntry(a.id, service({ odometer: 2000 }))
    expect(
      await createFuelEntry(a.id, fuel({ odometer: 1500, date: new Date('2026-02-01T00:00:00Z') })),
    ).toEqual({ status: 'odometer_out_of_range', min: 2000, max: null })
    await createFuelEntry(a.id, fuel({ odometer: 3000, date: new Date('2026-03-01T00:00:00Z') }))
    expect(
      await createServiceEntry(a.id, service({ odometer: 2500, date: new Date('2026-04-01T00:00:00Z') })),
    ).toEqual({ status: 'odometer_out_of_range', min: 3000, max: null })
  })

  it('accepts entries on an archived vehicle', async () => {
    const { setVehicleArchived } = await import('./vehicles')
    await setVehicleArchived(a.id, vehicleId, true)
    expect(await createFuelEntry(a.id, fuel())).toEqual({ status: 'created' })
  })
})

describe('update', () => {
  it('updates within bounds, excluding itself', async () => {
    const e = fuel({ odometer: 1000 })
    await createFuelEntry(a.id, e)
    await createFuelEntry(a.id, fuel({ odometer: 1500, date: new Date('2026-02-01T00:00:00Z') }))
    const rest = upd(e)
    expect(await updateFuelEntry(a.id, e.id, { ...rest, odometer: 1200, litres: 30 })).toEqual({
      status: 'updated',
    })
    const got = await getFuelEntry(a.id, e.id)
    expect(got?.odometer).toBe(1200)
    expect(got?.litres).toBe(30)
    expect(await updateFuelEntry(a.id, e.id, { ...rest, odometer: 1600 })).toEqual({
      status: 'odometer_out_of_range',
      min: null,
      max: 1500,
    })
  })

  it('updates a service entry and rejects out-of-range', async () => {
    const s = service({ odometer: 1000 })
    await createServiceEntry(a.id, s)
    await createFuelEntry(a.id, fuel({ odometer: 1500, date: new Date('2026-02-01T00:00:00Z') }))
    const rest = upd(s)
    expect(await updateServiceEntry(a.id, s.id, { ...rest, odometer: 1100, garage: 'X' })).toEqual({
      status: 'updated',
    })
    expect((await getServiceEntry(a.id, s.id))?.garage).toBe('X')
    expect(await updateServiceEntry(a.id, s.id, { ...rest, odometer: 1600 })).toEqual({
      status: 'odometer_out_of_range',
      min: null,
      max: 1500,
    })
  })

  it('delete removes the entry', async () => {
    const e = fuel()
    const s = service({ odometer: 1100, date: new Date('2026-02-01T00:00:00Z') })
    await createFuelEntry(a.id, e)
    await createServiceEntry(a.id, s)
    expect(await deleteFuelEntry(a.id, e.id)).toBe(true)
    expect(await deleteServiceEntry(a.id, s.id)).toBe(true)
    expect(await getFuelEntry(a.id, e.id)).toBeNull()
    expect(await deleteFuelEntry(a.id, e.id)).toBe(false)
  })
})

describe('user scoping', () => {
  it("another user cannot update, delete or get a user's entries", async () => {
    const e = fuel()
    const s = service({ odometer: 1100, date: new Date('2026-02-01T00:00:00Z') })
    await createFuelEntry(a.id, e)
    await createServiceEntry(a.id, s)
    const fr = upd(e)
    const sr = upd(s)
    expect(await updateFuelEntry(b.id, e.id, fr)).toEqual({ status: 'not_found' })
    expect(await updateServiceEntry(b.id, s.id, sr)).toEqual({ status: 'not_found' })
    expect(await deleteFuelEntry(b.id, e.id)).toBe(false)
    expect(await deleteServiceEntry(b.id, s.id)).toBe(false)
    expect(await getFuelEntry(b.id, e.id)).toBeNull()
    expect(await getServiceEntry(b.id, s.id)).toBeNull()
    expect(await listFuelEntries(b.id, vehicleId)).toEqual([])
    expect(await listServiceEntries(b.id, vehicleId)).toEqual([])
    expect(await listOdometerPoints(b.id, vehicleId)).toEqual([])
    expect(await getFuelEntry(a.id, e.id)).not.toBeNull()
  })
})

describe('lists', () => {
  it('lists fuel and service date desc and odometer points from both', async () => {
    const f1 = fuel({ date: new Date('2026-01-01T00:00:00Z'), odometer: 100 })
    const f2 = fuel({ date: new Date('2026-03-01T00:00:00Z'), odometer: 300 })
    const s1 = service({ date: new Date('2026-02-01T00:00:00Z'), odometer: 200 })
    await createFuelEntry(a.id, f1)
    await createFuelEntry(a.id, f2)
    await createServiceEntry(a.id, s1)
    expect((await listFuelEntries(a.id, vehicleId)).map((e) => e.id)).toEqual([f2.id, f1.id])
    const pts = await listOdometerPoints(a.id, vehicleId)
    expect(pts.map((p) => p.id).sort()).toEqual([f1.id, f2.id, s1.id].sort())
    expect(pts.find((p) => p.id === s1.id)).toEqual({
      id: s1.id,
      date: s1.date,
      odometer: 200,
    })
  })
})

describe('non-uuid ids', () => {
  it('return not-found results instead of throwing', async () => {
    const fr = upd(fuel())
    const sr = upd(service())
    expect(await getFuelEntry(a.id, 'abc')).toBeNull()
    expect(await getServiceEntry(a.id, 'abc')).toBeNull()
    expect(await deleteFuelEntry(a.id, 'abc')).toBe(false)
    expect(await deleteServiceEntry(a.id, 'abc')).toBe(false)
    expect(await updateFuelEntry(a.id, 'abc', fr)).toEqual({ status: 'not_found' })
    expect(await updateServiceEntry(a.id, 'abc', sr)).toEqual({ status: 'not_found' })
  })
})
