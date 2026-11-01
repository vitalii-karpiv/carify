import { describe, expect, it } from 'vitest'
import { APP_TIME_ZONE, formatDate, monthKey } from './dates'

describe('monthKey', () => {
  it('uses Kyiv summer time (UTC+3)', () => {
    expect(monthKey(new Date('2026-03-31T21:30:00Z'))).toBe('2026-04')
  })
  it('uses Kyiv winter time (UTC+2)', () => {
    expect(monthKey(new Date('2026-01-31T22:30:00Z'))).toBe('2026-02')
    expect(monthKey(new Date('2026-01-31T21:59:00Z'))).toBe('2026-01')
  })
  it('accepts an explicit time zone', () => {
    expect(monthKey(new Date('2026-01-31T22:30:00Z'), 'UTC')).toBe('2026-01')
  })
})

describe('formatDate', () => {
  it('formats as dd.mm.yyyy in Kyiv time', () => {
    expect(APP_TIME_ZONE).toBe('Europe/Kyiv')
    expect(formatDate(new Date('2026-11-01T10:00:00Z'))).toBe('01.11.2026')
    expect(formatDate(new Date('2026-10-31T22:30:00Z'))).toBe('01.11.2026')
  })
})
