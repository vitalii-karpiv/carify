import { describe, expect, it } from 'vitest'
import { buildOutboxPayload, gradeAfterVehicleChange, isOdometerBelowLast } from './entry-payload'

const V = '0190a5b0-0000-7000-8000-000000000001'
const ID = '0190a5b0-0000-7000-8000-000000000002'

const fuel = {
  vehicleId: V,
  date: '2026-11-01T10:00:00.000Z',
  dateInput: '2026-11-01T12:00',
  odometer: 1000,
  litres: 10,
  pricePerLitreKop: 5000,
  totalKop: 50000,
  grade: 'A95',
  isFull: true,
  missedPrevious: false,
  station: '',
  note: '',
}

describe('buildOutboxPayload', () => {
  it('strips dateInput, sets id, keeps ISO date', () => {
    const r = buildOutboxPayload('fuel', fuel, ID)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.id).toBe(ID)
    expect(r.payload.date).toBe('2026-11-01T10:00:00.000Z')
    expect('dateInput' in r.payload).toBe(false)
  })
  it('maps issues to field errors', () => {
    const a = buildOutboxPayload('fuel', { ...fuel, odometer: undefined }, ID)
    expect(a.ok).toBe(false)
    if (a.ok) return
    expect(a.errors.odometer).toBe('Invalid value')
    const r = buildOutboxPayload('fuel', { ...fuel, totalKop: 1 }, ID)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.totalKop).toBe('Total does not match litres × price')
  })
  it('validates service entries', () => {
    const ok = buildOutboxPayload(
      'service',
      { vehicleId: V, date: fuel.date, odometer: 5, category: 'OIL_CHANGE', totalKop: 0, garage: '', notes: '' },
      ID,
    )
    expect(ok.ok).toBe(true)
    const bad = buildOutboxPayload('service', { vehicleId: V, date: '', odometer: 5, category: 'X', totalKop: 0 }, ID)
    expect(bad.ok).toBe(false)
  })
})

describe('isOdometerBelowLast', () => {
  it('warns only when below a known last', () => {
    expect(isOdometerBelowLast(900, 1000)).toBe(true)
    expect(isOdometerBelowLast(1000, 1000)).toBe(false)
    expect(isOdometerBelowLast(900, null)).toBe(false)
    expect(isOdometerBelowLast(undefined, 1000)).toBe(false)
  })
})

describe('gradeAfterVehicleChange', () => {
  it('follows the vehicle default unless grade was touched', () => {
    expect(gradeAfterVehicleChange(false, 'A95', { defaultGrade: 'DIESEL' })).toBe('DIESEL')
    expect(gradeAfterVehicleChange(true, 'A95', { defaultGrade: 'DIESEL' })).toBe('A95')
    expect(gradeAfterVehicleChange(false, 'A95', undefined)).toBe('A95')
  })
})
