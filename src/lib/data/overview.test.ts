import { v7 as uuidv7 } from 'uuid'
import { beforeEach, describe, expect, it } from 'vitest'
import { createFuelEntry, createServiceEntry } from './entries'
import { getVehicleOverview, getVehicleStats } from './overview'
import { createTestUser, resetDb } from './test-utils'
import { createVehicle } from './vehicles'

let userId: string
let vehicleId: string

async function fuel(date: string, odometer: number, litres: number, totalKop: number, isFull: boolean) {
  await createFuelEntry(userId, {
    id: uuidv7(),
    vehicleId,
    date: new Date(date),
    odometer,
    litres,
    pricePerLitreKop: Math.round(totalKop / litres),
    totalKop,
    grade: 'A95',
    isFull,
    missedPrevious: false,
    station: null,
    note: null,
  })
}

beforeEach(async () => {
  await resetDb()
  userId = (await createTestUser()).id
  vehicleId = (
    await createVehicle(userId, {
      name: 'Daily',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      plate: 'AA0001AA',
      vin: null,
      defaultGrade: 'A95',
    })
  ).id
  await fuel('2026-09-10T10:00:00Z', 1000, 40, 200000, true)
  await fuel('2026-10-05T10:00:00Z', 1500, 35, 175000, true)
  await fuel('2026-10-20T10:00:00Z', 1800, 20, 100000, false)
  await createServiceEntry(userId, {
    id: uuidv7(),
    vehicleId,
    date: new Date('2026-10-25T10:00:00Z'),
    odometer: 1900,
    category: 'OIL_CHANGE',
    totalKop: 150000,
    garage: null,
    notes: null,
  })
})

describe('getVehicleOverview', () => {
  it('mixes kinds newest first and sums only the current Kyiv month', async () => {
    const o = await getVehicleOverview(userId, vehicleId, new Date('2026-10-28T10:00:00Z'))
    expect(o.recent).toHaveLength(4)
    expect(o.recent.map((r) => r.kind)).toEqual(['service', 'fuel', 'fuel', 'fuel'])
    expect(o.recent[0].label).toBe('Oil change')
    expect(o.recent[1].label).toBe('20 L A-95')
    expect(o.currentOdometer).toBe(1900)
    expect(o.spendThisMonthKop).toBe(175000 + 100000 + 150000)
    // 35 L over 500 km
    expect(o.consumption.lifetime).toBeCloseTo(7, 5)
    expect(o.consumption.last).toBeCloseTo(7, 5)
  })

  it('is empty for a vehicle without entries', async () => {
    const other = await createVehicle(userId, {
      name: 'B', make: 'x', model: 'y', year: 2000, plate: 'BB', vin: null, defaultGrade: 'A95',
    })
    const o = await getVehicleOverview(userId, other.id, new Date())
    expect(o).toEqual({
      currentOdometer: null,
      consumption: { lifetime: null, last: null },
      spendThisMonthKop: 0,
      recent: [],
    })
  })
})

describe('getVehicleStats', () => {
  it('computes totals, monthly buckets, price series and cost per km', async () => {
    const s = await getVehicleStats(userId, vehicleId)
    expect(s.totals).toEqual({ fuelKop: 475000, serviceKop: 150000, totalKop: 625000 })
    expect(s.costPerKmKop).toBe(Math.round(625000 / 900))
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(s.pricePerLitre.A95).toHaveLength(3)
    expect(s.segments.filter((x) => x.valid)).toHaveLength(1)
  })

  it('does not leak another user data', async () => {
    const other = await createTestUser()
    const s = await getVehicleStats(other.id, vehicleId)
    expect(s.totals.totalKop).toBe(0)
    expect(s.costPerKmKop).toBeNull()
  })
})
