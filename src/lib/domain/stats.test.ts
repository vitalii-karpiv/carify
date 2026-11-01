import { describe, expect, it } from 'vitest'
import {
  costPerKm,
  currentOdometer,
  monthlySpend,
  pricePerLitreSeries,
  spendInMonth,
  spendTotals,
  type SpendItem,
} from './stats'

const items: SpendItem[] = [
  { date: new Date('2026-01-10T10:00:00Z'), totalKop: 1000, kind: 'fuel' },
  { date: new Date('2026-03-05T10:00:00Z'), totalKop: 2000, kind: 'fuel' },
  { date: new Date('2026-03-20T10:00:00Z'), totalKop: 500, kind: 'service' },
]

describe('monthlySpend', () => {
  it('is contiguous and zero-filled', () => {
    expect(monthlySpend(items)).toEqual([
      { month: '2026-01', fuelKop: 1000, serviceKop: 0 },
      { month: '2026-02', fuelKop: 0, serviceKop: 0 },
      { month: '2026-03', fuelKop: 2000, serviceKop: 500 },
    ])
  })
  it('returns [] for no items', () => {
    expect(monthlySpend([])).toEqual([])
  })
  it('crosses year boundaries', () => {
    const r = monthlySpend([
      { date: new Date('2025-12-10T10:00:00Z'), totalKop: 1, kind: 'fuel' },
      { date: new Date('2026-02-10T10:00:00Z'), totalKop: 1, kind: 'service' },
    ])
    expect(r.map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})

describe('spendTotals / spendInMonth', () => {
  it('sums by kind', () => {
    expect(spendTotals(items)).toEqual({ fuelKop: 3000, serviceKop: 500, totalKop: 3500 })
    expect(spendTotals([])).toEqual({ fuelKop: 0, serviceKop: 0, totalKop: 0 })
  })
  it('sums a month', () => {
    expect(spendInMonth(items, '2026-03')).toBe(2500)
    expect(spendInMonth(items, '2026-02')).toBe(0)
  })
})

describe('pricePerLitreSeries', () => {
  it('groups by grade sorted by date, omitting empty grades', () => {
    const a = new Date('2026-01-01T00:00:00Z')
    const b = new Date('2026-02-01T00:00:00Z')
    const r = pricePerLitreSeries([
      { date: b, pricePerLitreKop: 5100, grade: 'A95' },
      { date: a, pricePerLitreKop: 5000, grade: 'A95' },
      { date: a, pricePerLitreKop: 4800, grade: 'DIESEL' },
    ])
    expect(r.A95).toEqual([
      { date: a, pricePerLitreKop: 5000 },
      { date: b, pricePerLitreKop: 5100 },
    ])
    expect(r.DIESEL).toEqual([{ date: a, pricePerLitreKop: 4800 }])
    expect(r.A92).toBeUndefined()
  })
})

describe('currentOdometer', () => {
  it('returns max or null', () => {
    expect(currentOdometer([])).toBeNull()
    expect(currentOdometer([1000, 5000, 3000])).toBe(5000)
  })
})

describe('costPerKm', () => {
  it('computes kopecks per km', () => {
    expect(costPerKm(150000, [10000, 11000])).toBe(150)
  })
  it('is null without distance', () => {
    expect(costPerKm(150000, [10000])).toBeNull()
    expect(costPerKm(150000, [10000, 10000])).toBeNull()
  })
})
