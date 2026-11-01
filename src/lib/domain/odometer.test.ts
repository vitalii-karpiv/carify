import { describe, expect, it } from 'vitest'
import { checkOdometer, odometerBounds, type OdometerPoint } from './odometer'

const d = (m: number, day: number) => new Date(2026, m - 1, day)
const a: OdometerPoint = { id: 'a', date: d(1, 1), odometer: 1000 }
const b: OdometerPoint = { id: 'b', date: d(2, 1), odometer: 2000 }
const points = [a, b]

describe('odometerBounds', () => {
  it('returns surrounding bounds between points', () => {
    expect(odometerBounds(points, d(1, 15))).toEqual({ min: 1000, max: 2000 })
  })

  it('treats a point with the same timestamp as previous', () => {
    expect(odometerBounds(points, d(1, 1))).toEqual({ min: 1000, max: 2000 })
  })

  it('has no max after all points', () => {
    expect(odometerBounds(points, d(3, 1))).toEqual({ min: 2000, max: null })
  })

  it('has no min before all points', () => {
    expect(odometerBounds(points, new Date(2025, 0, 1))).toEqual({
      min: null,
      max: 1000,
    })
  })

  it('returns nulls for empty points', () => {
    expect(odometerBounds([], d(1, 1))).toEqual({ min: null, max: null })
  })

  it('ignores the excluded id', () => {
    const c = { id: 'c', date: d(1, 15), odometer: 1500 }
    expect(odometerBounds([...points, c], d(1, 20), 'c')).toEqual({ min: 1000, max: 2000 })
  })
})

describe('checkOdometer', () => {
  it('accepts values within bounds', () => {
    expect(checkOdometer(points, { date: d(1, 15), odometer: 1500 })).toEqual({ ok: true })
  })

  it('rejects values below min or above max with both bounds', () => {
    expect(checkOdometer(points, { date: d(1, 15), odometer: 999 })).toEqual({ ok: false, min: 1000, max: 2000 })
    expect(checkOdometer(points, { date: d(1, 15), odometer: 2001 })).toEqual({ ok: false, min: 1000, max: 2000 })
  })

  it('allows values equal to bounds', () => {
    expect(checkOdometer(points, { date: d(1, 15), odometer: 1000 })).toEqual({ ok: true })
    expect(checkOdometer(points, { date: d(1, 15), odometer: 2000 })).toEqual({ ok: true })
  })

  it('accepts any value with no points', () => {
    expect(checkOdometer([], { date: d(1, 1), odometer: 5 })).toEqual({ ok: true })
  })

  it('excludes the entry being edited', () => {
    const c: OdometerPoint = { id: 'c', date: d(1, 15), odometer: 1500 }
    expect(checkOdometer([...points, c], { id: 'c', date: d(1, 15), odometer: 1800 })).toEqual({ ok: true })
  })
})
