import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/client'
import { energyEntry, serviceEntry } from '@/db/schema'
import type { VehicleInput } from '@/lib/domain/schemas'
import { createTestUser, resetDb } from './test-utils'
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  setVehicleArchived,
  updateVehicle,
} from './vehicles'

const input: VehicleInput = {
  name: 'Daily',
  make: 'Toyota',
  model: 'Corolla',
  year: 2020,
  plate: 'AA0001AA',
  vin: null,
  defaultGrade: 'A95',
}

let a: { id: string }
let b: { id: string }

beforeEach(async () => {
  await resetDb()
  a = await createTestUser()
  b = await createTestUser()
})

describe('vehicles data layer', () => {
  it('creates and lists a vehicle with the domain shape', async () => {
    const created = await createVehicle(a.id, input)
    expect(created).toEqual({
      id: created.id,
      ...input,
      archivedAt: null,
      createdAt: expect.any(Date),
    })
    expect(await listVehicles(a.id)).toEqual([created])
    expect(await getVehicle(a.id, created.id)).toEqual(created)
  })

  it('hides archived by default and includes them on request', async () => {
    const v = await createVehicle(a.id, input)
    expect(await setVehicleArchived(a.id, v.id, true)).toBe(true)
    expect(await listVehicles(a.id)).toEqual([])
    const all = await listVehicles(a.id, { includeArchived: true })
    expect(all).toHaveLength(1)
    expect(all[0].archivedAt).toBeInstanceOf(Date)
    expect(await setVehicleArchived(a.id, v.id, false)).toBe(true)
    expect(await listVehicles(a.id)).toHaveLength(1)
  })

  it('updates a vehicle', async () => {
    const v = await createVehicle(a.id, input)
    const updated = await updateVehicle(a.id, v.id, { ...input, name: 'Weekend' })
    expect(updated?.name).toBe('Weekend')
    expect((await getVehicle(a.id, v.id))?.name).toBe('Weekend')
  })

  it("cannot touch another user's vehicle", async () => {
    const v = await createVehicle(a.id, input)
    expect(await getVehicle(b.id, v.id)).toBeNull()
    expect(await updateVehicle(b.id, v.id, { ...input, name: 'Hacked' })).toBeNull()
    expect(await setVehicleArchived(b.id, v.id, true)).toBe(false)
    expect(await deleteVehicle(b.id, v.id)).toBe(false)
    expect(await listVehicles(b.id, { includeArchived: true })).toEqual([])
    expect(await getVehicle(a.id, v.id)).toEqual(v)
  })

  it('deleteVehicle cascades to entries', async () => {
    const v = await createVehicle(a.id, input)
    await db.insert(energyEntry).values({
      id: uuidv7(),
      userId: a.id,
      vehicleId: v.id,
      date: new Date(),
      odometer: 1000,
      quantity: '40.000',
      grade: 'A95',
      pricePerUnit: 5000,
      totalCost: 200000,
    })
    await db.insert(serviceEntry).values({
      id: uuidv7(),
      userId: a.id,
      vehicleId: v.id,
      date: new Date(),
      odometer: 1000,
      category: 'OIL_CHANGE',
      totalCost: 100000,
    })
    expect(await deleteVehicle(a.id, v.id)).toBe(true)
    expect(await getVehicle(a.id, v.id)).toBeNull()
    expect(await db.select().from(energyEntry).where(eq(energyEntry.vehicleId, v.id))).toEqual([])
    expect(await db.select().from(serviceEntry).where(eq(serviceEntry.vehicleId, v.id))).toEqual([])
  })
})

describe('vehicles non-uuid ids', () => {
  it('return not-found results instead of throwing', async () => {
    expect(await getVehicle(a.id, 'abc')).toBeNull()
    expect(await updateVehicle(a.id, 'abc', input)).toBeNull()
    expect(await setVehicleArchived(a.id, 'abc', true)).toBe(false)
    expect(await deleteVehicle(a.id, 'abc')).toBe(false)
  })
})
