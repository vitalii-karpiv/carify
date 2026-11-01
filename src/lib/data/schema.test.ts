import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/client'
import { energyEntry, serviceEntry, vehicle } from '@/db/schema'
import { createTestUser, resetDb } from './test-utils'

async function seedVehicle() {
  const u = await createTestUser()
  const id = uuidv7()
  await db.insert(vehicle).values({
    id,
    userId: u.id,
    name: 'Car',
    make: 'Toyota',
    model: 'Corolla',
    year: 2020,
    plate: 'AA0001AA',
    defaultGrade: 'A95',
  })
  return { userId: u.id, vehicleId: id }
}

describe('schema', () => {
  beforeEach(resetDb)

  it('round-trips numeric(8,3) quantity as string', async () => {
    const { userId, vehicleId } = await seedVehicle()
    const id = uuidv7()
    await db.insert(energyEntry).values({
      id,
      userId,
      vehicleId,
      date: new Date(),
      odometer: 1000,
      quantity: '40.125',
      grade: 'A95',
      pricePerUnit: 5000,
      totalCost: 200625,
    })
    const [row] = await db.select().from(energyEntry).where(eq(energyEntry.id, id))
    expect(row.quantity).toBe('40.125')
    expect(row.unit).toBe('L')
    expect(row.currency).toBe('UAH')
  })

  it('deleting a vehicle cascades to its entries', async () => {
    const { userId, vehicleId } = await seedVehicle()
    await db.insert(energyEntry).values({
      id: uuidv7(), userId, vehicleId, date: new Date(), odometer: 1,
      quantity: '1.000', grade: 'A95', pricePerUnit: 1, totalCost: 1,
    })
    await db.insert(serviceEntry).values({
      id: uuidv7(), userId, vehicleId, date: new Date(), odometer: 1,
      category: 'OIL_CHANGE', totalCost: 1,
    })
    await db.delete(vehicle).where(eq(vehicle.id, vehicleId))
    expect(await db.select().from(energyEntry)).toHaveLength(0)
    expect(await db.select().from(serviceEntry)).toHaveLength(0)
  })
})
