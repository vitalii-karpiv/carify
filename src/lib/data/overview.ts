import { computeSegments, summarizeConsumption, type Segment } from '@/lib/domain/consumption'
import { monthKey } from '@/lib/domain/dates'
import type { FuelGrade, GasStation } from '@/lib/domain/enums'
import { stationStats, type StationStat } from '@/lib/domain/station-stats'
import {
  costPerKm,
  currentOdometer,
  monthlyLitres,
  monthlySpend,
  pricePerLitreSeries,
  spendInMonth,
  spendTotals,
  type MonthlyLitres,
  type MonthlySpend,
  type PricePoint,
  type SpendItem,
} from '@/lib/domain/stats'
import { listFuelEntries, listServiceEntries } from './entries'

export type VehicleDashboard = {
  currentOdometer: number | null
  consumption: { lifetime: number | null; last: number | null }
  spendThisMonthKop: number
  lastFill: { date: Date; station: GasStation | null; grade: FuelGrade } | null
  segments: Segment[]
  pricePerLitre: Partial<Record<FuelGrade, PricePoint[]>>
  monthly: MonthlySpend[]
  monthlyLitres: MonthlyLitres[]
  totals: { fuelKop: number; serviceKop: number; totalKop: number }
  costPerKmKop: number | null
  stations: StationStat[]
}

export async function getVehicleDashboard(
  userId: string,
  vehicleId: string,
  now: Date,
): Promise<VehicleDashboard> {
  const [fuel, service] = await Promise.all([
    listFuelEntries(userId, vehicleId),
    listServiceEntries(userId, vehicleId),
  ])
  const spendItems: SpendItem[] = [
    ...fuel.map((e) => ({ date: e.date, totalKop: e.totalKop, kind: 'fuel' as const })),
    ...service.map((e) => ({ date: e.date, totalKop: e.totalKop, kind: 'service' as const })),
  ]
  const odometers = [...fuel.map((e) => e.odometer), ...service.map((e) => e.odometer)]
  const segments = computeSegments(fuel)
  const totals = spendTotals(spendItems)
  const latest = fuel.reduce<(typeof fuel)[number] | null>(
    (acc, e) => (!acc || e.date.getTime() > acc.date.getTime() ? e : acc),
    null,
  )

  return {
    currentOdometer: currentOdometer(odometers),
    consumption: summarizeConsumption(segments),
    spendThisMonthKop: spendInMonth(spendItems, monthKey(now)),
    lastFill: latest && { date: latest.date, station: latest.station, grade: latest.grade },
    segments,
    pricePerLitre: pricePerLitreSeries(
      fuel.map((e) => ({ grade: e.grade, date: e.date, pricePerLitreKop: e.pricePerLitreKop })),
    ),
    monthly: monthlySpend(spendItems),
    monthlyLitres: monthlyLitres(fuel),
    totals,
    costPerKmKop: costPerKm(totals.totalKop, odometers),
    stations: stationStats(fuel).stations,
  }
}
