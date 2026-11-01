import { v7 as uuidv7 } from 'uuid'
import { beforeEach, describe, expect, it } from 'vitest'
import { createFuelEntry, createServiceEntry } from './entries'
import { getVehicleDashboard } from './overview'
import { createTestUser, resetDb } from './test-utils'
import { createVehicle } from './vehicles'

let userId: string
let vehicleId: string

async function fuel(
  date: string,
  odometer: number,
  litres: number,
  totalKop: number,
  isFull: boolean,
  station: 'OKKO' | 'WOG' | null = null,
) {
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
    station,
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
  await fuel('2026-09-10T10:00:00Z', 1000, 40, 200000, true, 'OKKO')
  await fuel('2026-10-05T10:00:00Z', 1500, 35, 175000, true, 'WOG')
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

describe('getVehicleDashboard', () => {
  it('sums only the current Kyiv month and reports the latest fill', async () => {
    const o = await getVehicleDashboard(userId, vehicleId, new Date('2026-10-28T10:00:00Z'))
    expect(o.lastFill).toEqual({ date: new Date('2026-10-20T10:00:00Z'), station: null, grade: 'A95' })
    expect(o.currentOdometer).toBe(1900)
    expect(o.spendThisMonthKop).toBe(175000 + 100000 + 150000)
    // 35 L over 500 km
    expect(o.consumption.lifetime).toBeCloseTo(7, 5)
    expect(o.consumption.last).toBeCloseTo(7, 5)
  })

  it('uses the Kyiv month for "this month" (already November at 22:30Z on Oct 31)', async () => {
    await fuel('2026-11-01T08:00:00Z', 2000, 30, 90000, true)
    const o = await getVehicleDashboard(userId, vehicleId, new Date('2026-10-31T22:30:00Z'))
    expect(o.spendThisMonthKop).toBe(90000)
  })

  it('is empty for a vehicle without entries', async () => {
    const other = await createVehicle(userId, {
      name: 'B', make: 'x', model: 'y', year: 2000, plate: 'BB', vin: null, defaultGrade: 'A95',
    })
    const o = await getVehicleDashboard(userId, other.id, new Date())
    expect(o).toEqual({
      currentOdometer: null,
      consumption: { lifetime: null, last: null },
      spendThisMonthKop: 0,
      lastFill: null,
      segments: [],
      pricePerLitre: {},
      monthly: [],
      totals: { fuelKop: 0, serviceKop: 0, totalKop: 0 },
      costPerKmKop: null,
      stations: [],
    })
  })

  it('computes totals, monthly buckets, price series, cost per km and stations', async () => {
    const s = await getVehicleDashboard(userId, vehicleId, new Date('2026-10-28T10:00:00Z'))
    expect(s.totals).toEqual({ fuelKop: 475000, serviceKop: 150000, totalKop: 625000 })
    expect(s.costPerKmKop).toBe(Math.round(625000 / 900))
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(s.pricePerLitre.A95).toHaveLength(3)
    expect(s.segments.filter((x) => x.valid)).toHaveLength(1)
    // the one segment started at OKKO; WOG has a fill but no segment of its own
    expect(s.stations.map((x) => [x.station, x.segments])).toEqual([
      ['OKKO', 1],
      ['WOG', 0],
    ])
  })

  it('does not leak another user data', async () => {
    const other = await createTestUser()
    const s = await getVehicleDashboard(other.id, vehicleId, new Date())
    expect(s.totals.totalKop).toBe(0)
    expect(s.costPerKmKop).toBeNull()
  })
})
