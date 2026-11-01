import { monthKey } from './dates'
import type { FuelGrade } from './enums'

export type SpendItem = { date: Date; totalKop: number; kind: 'fuel' | 'service' }
export type MonthlySpend = { month: string; fuelKop: number; serviceKop: number }
export type PricePoint = { date: Date; pricePerLitreKop: number }

function parseMonth(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number)
  return [y, m]
}

export function monthlySpend(items: SpendItem[]): MonthlySpend[] {
  if (items.length === 0) return []
  const buckets = new Map<string, MonthlySpend>()
  for (const item of items) {
    const month = monthKey(item.date)
    const bucket = buckets.get(month) ?? { month, fuelKop: 0, serviceKop: 0 }
    if (item.kind === 'fuel') bucket.fuelKop += item.totalKop
    else bucket.serviceKop += item.totalKop
    buckets.set(month, bucket)
  }
  const keys = [...buckets.keys()].sort()
  const [endY, endM] = parseMonth(keys[keys.length - 1])
  let [y, m] = parseMonth(keys[0])
  const result: MonthlySpend[] = []
  while (y < endY || (y === endY && m <= endM)) {
    const month = `${y}-${String(m).padStart(2, '0')}`
    result.push(buckets.get(month) ?? { month, fuelKop: 0, serviceKop: 0 })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return result
}

export function spendTotals(items: SpendItem[]): {
  fuelKop: number
  serviceKop: number
  totalKop: number
} {
  let fuelKop = 0
  let serviceKop = 0
  for (const item of items) {
    if (item.kind === 'fuel') fuelKop += item.totalKop
    else serviceKop += item.totalKop
  }
  return { fuelKop, serviceKop, totalKop: fuelKop + serviceKop }
}

export function spendInMonth(items: SpendItem[], month: string): number {
  return items
    .filter((i) => monthKey(i.date) === month)
    .reduce((sum, i) => sum + i.totalKop, 0)
}

export function pricePerLitreSeries(
  entries: (PricePoint & { grade: FuelGrade })[],
): Partial<Record<FuelGrade, PricePoint[]>> {
  const result: Partial<Record<FuelGrade, PricePoint[]>> = {}
  for (const { grade, date, pricePerLitreKop } of entries) {
    ;(result[grade] ??= []).push({ date, pricePerLitreKop })
  }
  for (const series of Object.values(result)) {
    series.sort((a, b) => a.date.getTime() - b.date.getTime())
  }
  return result
}

export function currentOdometer(odometers: number[]): number | null {
  return odometers.length === 0 ? null : Math.max(...odometers)
}

export function costPerKm(totalKop: number, odometers: number[]): number | null {
  if (odometers.length < 2) return null
  const distance = Math.max(...odometers) - Math.min(...odometers)
  if (distance === 0) return null
  return Math.round(totalKop / distance)
}
