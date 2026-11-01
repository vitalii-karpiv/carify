import { computeSegments, summarizeConsumption, type Segment } from '@/lib/domain/consumption'
import { monthKey } from '@/lib/domain/dates'
import { FUEL_GRADE_LABELS, SERVICE_CATEGORY_LABELS, type FuelGrade } from '@/lib/domain/enums'
import { formatNumber } from '@/lib/domain/money'
import {
  costPerKm,
  currentOdometer,
  monthlySpend,
  pricePerLitreSeries,
  spendInMonth,
  spendTotals,
  type MonthlySpend,
  type PricePoint,
  type SpendItem,
} from '@/lib/domain/stats'
import { listFuelEntries, listServiceEntries } from './entries'

export type RecentEntry = {
  kind: 'fuel' | 'service'
  id: string
  date: Date
  odometer: number
  totalKop: number
  label: string
}

const RECENT_COUNT = 5

async function loadEntries(userId: string, vehicleId: string) {
  const [fuel, service] = await Promise.all([
    listFuelEntries(userId, vehicleId),
    listServiceEntries(userId, vehicleId),
  ])
  const spendItems: SpendItem[] = [
    ...fuel.map((e) => ({ date: e.date, totalKop: e.totalKop, kind: 'fuel' as const })),
    ...service.map((e) => ({ date: e.date, totalKop: e.totalKop, kind: 'service' as const })),
  ]
  const odometers = [...fuel.map((e) => e.odometer), ...service.map((e) => e.odometer)]
  return { fuel, service, spendItems, odometers }
}

export async function getVehicleOverview(
  userId: string,
  vehicleId: string,
  now: Date,
): Promise<{
  currentOdometer: number | null
  consumption: { lifetime: number | null; last: number | null }
  spendThisMonthKop: number
  recent: RecentEntry[]
}> {
  const { fuel, service, spendItems, odometers } = await loadEntries(userId, vehicleId)
  const recent: RecentEntry[] = [
    ...fuel.map((e) => ({
      kind: 'fuel' as const,
      id: e.id,
      date: e.date,
      odometer: e.odometer,
      totalKop: e.totalKop,
      label: `${formatNumber(e.litres, e.litres % 1 === 0 ? 0 : 2)} L ${FUEL_GRADE_LABELS[e.grade]}`,
    })),
    ...service.map((e) => ({
      kind: 'service' as const,
      id: e.id,
      date: e.date,
      odometer: e.odometer,
      totalKop: e.totalKop,
      label: SERVICE_CATEGORY_LABELS[e.category],
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, RECENT_COUNT)

  return {
    currentOdometer: currentOdometer(odometers),
    consumption: summarizeConsumption(computeSegments(fuel)),
    spendThisMonthKop: spendInMonth(spendItems, monthKey(now)),
    recent,
  }
}

export async function getVehicleStats(
  userId: string,
  vehicleId: string,
): Promise<{
  segments: Segment[]
  consumption: { lifetime: number | null; last: number | null }
  pricePerLitre: Partial<Record<FuelGrade, PricePoint[]>>
  monthly: MonthlySpend[]
  totals: { fuelKop: number; serviceKop: number; totalKop: number }
  costPerKmKop: number | null
}> {
  const { fuel, spendItems, odometers } = await loadEntries(userId, vehicleId)
  const segments = computeSegments(fuel)
  const totals = spendTotals(spendItems)
  return {
    segments,
    consumption: summarizeConsumption(segments),
    pricePerLitre: pricePerLitreSeries(
      fuel.map((e) => ({ grade: e.grade, date: e.date, pricePerLitreKop: e.pricePerLitreKop })),
    ),
    monthly: monthlySpend(spendItems),
    totals,
    costPerKmKop: costPerKm(totals.totalKop, odometers),
  }
}
