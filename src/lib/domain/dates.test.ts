import { describe, expect, it } from 'vitest'
import { APP_TIME_ZONE, formatDate, fromKyivLocalInput, monthKey, toKyivLocalInput } from './dates'

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

describe('Kyiv local datetime-local conversion', () => {
  it('renders an instant as Kyiv local time (summer and winter)', () => {
    expect(toKyivLocalInput(new Date('2026-07-01T09:30:00Z'))).toBe('2026-07-01T12:30')
    expect(toKyivLocalInput(new Date('2026-01-15T09:30:00Z'))).toBe('2026-01-15T11:30')
  })
  it('parses Kyiv local time back to the right instant', () => {
    expect(fromKyivLocalInput('2026-07-01T12:30').toISOString()).toBe('2026-07-01T09:30:00.000Z')
    expect(fromKyivLocalInput('2026-01-15T11:30').toISOString()).toBe('2026-01-15T09:30:00.000Z')
  })
  it('is DST-correct around transitions', () => {
    // spring forward 2026-03-29 03:00 -> 04:00 (UTC+2 -> UTC+3)
    expect(fromKyivLocalInput('2026-03-29T02:30').toISOString()).toBe('2026-03-29T00:30:00.000Z')
    expect(fromKyivLocalInput('2026-03-29T04:30').toISOString()).toBe('2026-03-29T01:30:00.000Z')
    // fall back 2026-10-25 04:00 -> 03:00 (UTC+3 -> UTC+2)
    expect(fromKyivLocalInput('2026-10-25T02:30').toISOString()).toBe('2026-10-24T23:30:00.000Z')
    expect(fromKyivLocalInput('2026-10-25T12:00').toISOString()).toBe('2026-10-25T10:00:00.000Z')
  })
  it('round-trips', () => {
    const d = new Date('2026-11-01T10:15:00Z')
    expect(fromKyivLocalInput(toKyivLocalInput(d)).getTime()).toBe(d.getTime())
  })
  it('returns an invalid date for garbage', () => {
    expect(Number.isNaN(fromKyivLocalInput('nope').getTime())).toBe(true)
  })
})
