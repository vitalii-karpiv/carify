import { describe, expect, it } from 'vitest'
import { computeSegments, summarizeConsumption, type ConsumptionEntry, type Segment } from './consumption'

let n = 0
const e = (
  odometer: number,
  litres: number,
  opts: Partial<Pick<ConsumptionEntry, 'isFull' | 'missedPrevious' | 'date'>> = {},
): ConsumptionEntry => ({
  id: `e${++n}`,
  date: new Date(Date.UTC(2026, 0, 1 + n)),
  odometer,
  litres,
  isFull: true,
  missedPrevious: false,
  ...opts,
})
const partial = (odo: number, litres: number, opts = {}) => e(odo, litres, { isFull: false, ...opts })

const seg = (km: number, litres: number, valid = true): Segment => ({
  endEntryId: 'x',
  endDate: new Date(0),
  startOdometer: 0,
  endOdometer: km,
  km,
  litres,
  lPer100: valid ? (litres / km) * 100 : null,
  valid,
})

describe('computeSegments', () => {
  it('two full fills', () => {
    const s = computeSegments([e(10000, 40), e(10500, 35)])
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ km: 500, litres: 35, lPer100: 7, valid: true, startOdometer: 10000, endOdometer: 10500 })
  })

  it('partials accumulate', () => {
    const s = computeSegments([e(10000, 40), partial(10200, 15), e(10600, 25)])
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ km: 600, litres: 40 })
    expect(s[0].lPer100).toBeCloseTo(6.667, 3)
  })

  it('leading partial ignored', () => {
    const s = computeSegments([partial(9800, 10), e(10000, 40), e(10500, 35)])
    expect(s).toHaveLength(1)
    expect(s[0].lPer100).toBe(7)
  })

  it('trailing partials after last full produce no segment', () => {
    expect(computeSegments([e(10000, 40), e(10500, 35), partial(10700, 10)])).toHaveLength(1)
  })

  it('missed fill invalidates segment and resets baseline', () => {
    const s = computeSegments([e(10000, 40), e(10500, 35, { missedPrevious: true }), e(11000, 30)])
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ valid: false, lPer100: null })
    expect(s[1]).toMatchObject({ startOdometer: 10500, lPer100: 6, valid: true })
  })

  it('missed flag on a partial inside the segment invalidates it', () => {
    const s = computeSegments([e(10000, 40), partial(10200, 15, { missedPrevious: true }), e(10600, 25)])
    expect(s).toHaveLength(1)
    expect(s[0].valid).toBe(false)
  })

  it('zero km is invalid', () => {
    const s = computeSegments([e(10000, 40), e(10000, 5)])
    expect(s[0]).toMatchObject({ valid: false, lPer100: null })
  })

  it('unsorted input is sorted by (date, odometer) without mutating input', () => {
    const a = e(10000, 40)
    const b = e(10500, 35)
    const input = [b, a]
    const s = computeSegments(input)
    expect(s).toHaveLength(1)
    expect(s[0].lPer100).toBe(7)
    expect(input).toEqual([b, a])
  })

  it('no full fill', () => {
    expect(computeSegments([partial(10000, 10), partial(10100, 5)])).toEqual([])
    expect(summarizeConsumption([])).toEqual({ lifetime: null, last: null })
  })
})

describe('summarizeConsumption', () => {
  it('lifetime is distance-weighted', () => {
    const r = summarizeConsumption([seg(500, 35), seg(1000, 60)])
    expect(r.lifetime).toBeCloseTo(6.3333, 4)
    expect(r.last).toBe(6)
  })

  it('last skips trailing invalid segment', () => {
    const r = summarizeConsumption([seg(500, 35), seg(1000, 60), seg(300, 20, false)])
    expect(r.last).toBe(6)
    expect(r.lifetime).toBeCloseTo(6.3333, 4)
  })

  it('all invalid gives nulls', () => {
    expect(summarizeConsumption([seg(0, 5, false)])).toEqual({ lifetime: null, last: null })
  })
})
