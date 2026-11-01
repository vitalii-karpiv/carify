import { computeSegments, summarizeConsumption, type ConsumptionEntry } from './consumption'
import { GAS_STATIONS, type GasStation } from './enums'

/** Stations with fewer scored segments are listed but not compared. */
export const MIN_STATION_SEGMENTS = 3

export type StationFill = ConsumptionEntry & {
  pricePerLitreKop: number
  totalKop: number
  station: GasStation | null
}

export type StationStat = {
  station: GasStation
  /** valid full-to-full segments whose fuel all came from this station */
  segments: number
  km: number
  litres: number
  lPer100: number | null
  /** litre-weighted over every fill at this station */
  avgPricePerLitreKop: number
  costPer100Kop: number | null
  /** cost per 100 km vs the whole vehicle, in percent; negative is cheaper */
  deltaPct: number | null
  enoughData: boolean
  best: boolean
}

const avgPrice = (fills: StationFill[]) => {
  const litres = fills.reduce((sum, f) => sum + f.litres, 0)
  return litres > 0 ? fills.reduce((sum, f) => sum + f.totalKop, 0) / litres : null
}

/**
 * Compares stations by cost per 100 km. A segment's fuel is the fill that started it plus any partials
 * before its end, so the segment counts for a station only when all of those fills are from it.
 */
export function stationStats(fills: StationFill[]): {
  stations: StationStat[]
  baselineCostPer100Kop: number | null
} {
  const segments = computeSegments(fills)
  const byId = new Map(fills.map((f) => [f.id, f]))

  const lifetime = summarizeConsumption(segments).lifetime
  const overallPrice = avgPrice(fills)
  const baselineCostPer100Kop = lifetime !== null && overallPrice !== null ? lifetime * overallPrice : null

  const stations = GAS_STATIONS.flatMap((station): StationStat[] => {
    const own = fills.filter((f) => f.station === station)
    if (own.length === 0) return []
    const mine = segments.filter(
      (s) => s.valid && s.fuelEntryIds.every((id) => byId.get(id)?.station === station),
    )
    const km = mine.reduce((sum, s) => sum + s.km, 0)
    const litres = mine.reduce((sum, s) => sum + s.litres, 0)
    const price = avgPrice(own) as number
    const enoughData = mine.length >= MIN_STATION_SEGMENTS
    const lPer100 = enoughData ? (litres * 100) / km : null
    const costPer100Kop = lPer100 === null ? null : lPer100 * price
    return [
      {
        station,
        segments: mine.length,
        km,
        litres,
        lPer100,
        avgPricePerLitreKop: Math.round(price),
        costPer100Kop,
        deltaPct:
          costPer100Kop === null || baselineCostPer100Kop === null
            ? null
            : (costPer100Kop / baselineCostPer100Kop - 1) * 100,
        enoughData,
        best: false,
      },
    ]
  })

  // Scored stations cheapest first, then the rest in list order.
  stations.sort((a, b) => {
    if (a.costPer100Kop === null || b.costPer100Kop === null) {
      return Number(a.costPer100Kop === null) - Number(b.costPer100Kop === null)
    }
    return a.costPer100Kop - b.costPer100Kop
  })
  const scored = stations.filter((s) => s.enoughData)
  if (scored.length >= 2) scored[0].best = true

  return { stations, baselineCostPer100Kop }
}
