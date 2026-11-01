import { describe, expect, it } from 'vitest'
import { entryErrorMessages } from './entry-result'
import { odometerRangeMessage } from './messages'

describe('odometerRangeMessage', () => {
  it('shows both bounds', () => {
    expect(odometerRangeMessage(1000, 2000)).toBe(`Must be between ${(1000).toLocaleString('uk-UA')} and ${(2000).toLocaleString('uk-UA')} km`)
  })
  it('omits the missing side', () => {
    expect(odometerRangeMessage(500, null)).toBe('Must be at least 500 km')
    expect(odometerRangeMessage(null, 500)).toBe('Must be at most 500 km')
  })
})

describe('entryErrorMessages', () => {
  it('maps odometer range and field errors', () => {
    expect(entryErrorMessages({ ok: false, error: 'ODOMETER_OUT_OF_RANGE', min: 10, max: 20 }).odometer).toBe(
      'Must be between 10 and 20 km',
    )
    const m = entryErrorMessages({
      ok: false,
      error: 'VALIDATION',
      fieldErrors: { totalKop: ['TOTAL_MISMATCH'], odometer: ['x'] },
    })
    expect(m.totalKop).toMatch(/does not match/)
    expect(m.odometer).toBe('Invalid value')
  })
})
