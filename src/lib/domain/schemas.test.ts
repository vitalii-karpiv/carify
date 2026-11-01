import { describe, expect, it } from 'vitest'
import {
  fuelEntryInputSchema,
  fuelEntryUpdateSchema,
  serviceEntryInputSchema,
  vehicleInputSchema,
} from './schemas'

const uuid = '123e4567-e89b-42d3-a456-426614174000'
const fuel = {
  id: uuid,
  vehicleId: uuid,
  date: '2026-10-01T10:00:00.000Z',
  odometer: 12345,
  litres: 40,
  pricePerLitreKop: 5000,
  totalKop: 200000,
  grade: 'A95',
  isFull: true,
  missedPrevious: false,
  station: '',
  note: null,
}
const vehicle = {
  name: 'Golf',
  make: 'VW',
  model: 'Golf',
  year: 2015,
  plate: ' aa1234bb ',
  vin: '',
  defaultGrade: 'A95',
}
const service = {
  id: uuid,
  vehicleId: uuid,
  date: '2026-10-01',
  odometer: 100,
  category: 'REPAIR',
  totalKop: 0,
  garage: ' Joe ',
  notes: '',
}

describe('fuelEntryInputSchema', () => {
  it('parses ISO date to Date and empty optional text to null', () => {
    const r = fuelEntryInputSchema.parse(fuel)
    expect(r.date).toBeInstanceOf(Date)
    expect(r.station).toBeNull()
    expect(r.note).toBeNull()
  })
  it('flags TOTAL_MISMATCH when total is off by 101', () => {
    const r = fuelEntryInputSchema.safeParse({ ...fuel, totalKop: 200101 })
    expect(r.success).toBe(false)
    expect(r.error!.issues).toContainEqual(
      expect.objectContaining({ path: ['totalKop'], message: 'TOTAL_MISMATCH' }),
    )
  })
  it('rejects litres 0', () => {
    expect(fuelEntryInputSchema.safeParse({ ...fuel, litres: 0 }).success).toBe(false)
  })
  it('update schema omits ids and keeps TOTAL_MISMATCH', () => {
    const rest: Partial<typeof fuel> = { ...fuel }
    delete rest.id
    delete rest.vehicleId
    expect(fuelEntryUpdateSchema.safeParse(rest).success).toBe(true)
    const bad = fuelEntryUpdateSchema.safeParse({ ...rest, totalKop: 200101 })
    expect(bad.success).toBe(false)
    expect(bad.error!.issues[0].message).toBe('TOTAL_MISMATCH')
  })
})

describe('vehicleInputSchema', () => {
  it('trims and uppercases plate, empty vin -> null', () => {
    const r = vehicleInputSchema.parse(vehicle)
    expect(r.plate).toBe('AA1234BB')
    expect(r.vin).toBeNull()
  })
  it('uppercases vin', () => {
    expect(vehicleInputSchema.parse({ ...vehicle, vin: 'wvwzzz1kzaw000001' }).vin).toBe(
      'WVWZZZ1KZAW000001',
    )
  })
  it('rejects vin containing O', () => {
    expect(vehicleInputSchema.safeParse({ ...vehicle, vin: 'WVWZZZ1KZAW00000O' }).success).toBe(
      false,
    )
  })
  it('rejects year beyond current year + 1', () => {
    const y = new Date().getFullYear()
    expect(vehicleInputSchema.safeParse({ ...vehicle, year: y + 1 }).success).toBe(true)
    expect(vehicleInputSchema.safeParse({ ...vehicle, year: y + 2 }).success).toBe(false)
  })
})

describe('serviceEntryInputSchema', () => {
  it('accepts totalKop 0 and normalises text', () => {
    const r = serviceEntryInputSchema.parse(service)
    expect(r.totalKop).toBe(0)
    expect(r.garage).toBe('Joe')
    expect(r.notes).toBeNull()
  })
})
