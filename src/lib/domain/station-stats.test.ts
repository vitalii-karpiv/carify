import { describe, expect, it } from 'vitest'
import type { GasStation } from './enums'
import { MIN_STATION_SEGMENTS, stationStats, type StationFill } from './station-stats'

let n = 0
const fill = (
  station: GasStation | null,
  odometer: number,
  litres: number,
  priceUah: number,
  opts: Partial<StationFill> = {},
): StationFill => ({
  id: `f${++n}`,
  date: new Date(Date.UTC(2026, 0, 1 + n)),
  odometer,
  litres,
  pricePerLitreKop: priceUah * 100,
  totalKop: Math.round(litres * priceUah * 100),
  isFull: true,
  missedPrevious: false,
  station,
  ...opts,
})

/** `count` consecutive full fills at one station, 500 km apart, each burning `litres`. */
function run(station: GasStation, startOdo: number, count: number, litres: number, priceUah: number) {
  return Array.from({ length: count }, (_, i) => fill(station, startOdo + i * 500, litres, priceUah))
}

describe('stationStats', () => {
  it('needs the minimum number of segments before scoring', () => {
    expect(MIN_STATION_SEGMENTS).toBe(3)
  })

  it('attributes each segment to the station of the fill that started it', () => {
    // OKKO fills start 3 segments of 40 L / 500 km; the WOG fill only ends the last one.
    const fills = [...run('OKKO', 10000, 4, 40, 50), fill('WOG', 12000, 45, 60)]
    const { stations } = stationStats(fills)
    const okko = stations.find((s) => s.station === 'OKKO')!
    expect(okko).toMatchObject({ segments: 4, km: 2000, enoughData: true })
    // segments ending at OKKO fills burn 40 L, the one ending at WOG burns 45 L
    expect(okko.lPer100).toBeCloseTo(((40 * 3 + 45) / 2000) * 100, 6)
    const wog = stations.find((s) => s.station === 'WOG')!
    expect(wog).toMatchObject({ segments: 0, enoughData: false, lPer100: null, costPer100Kop: null, deltaPct: null })
  })

  it('skips segments whose fuel came from more than one station', () => {
    const fills = [
      fill('OKKO', 10000, 40, 50),
      fill('WOG', 10200, 15, 55, { isFull: false }),
      fill('OKKO', 10600, 25, 50),
    ]
    const okko = stationStats(fills).stations.find((s) => s.station === 'OKKO')!
    expect(okko.segments).toBe(0)
  })

  it('counts a segment with same-station partials', () => {
    const fills = [
      fill('UPG', 10000, 40, 50),
      fill('UPG', 10200, 15, 50, { isFull: false }),
      fill('UPG', 10600, 25, 50),
    ]
    const upg = stationStats(fills).stations.find((s) => s.station === 'UPG')!
    expect(upg).toMatchObject({ segments: 1, km: 600, litres: 40 })
  })

  it('skips invalid segments and fills without a station', () => {
    const fills = [
      fill(null, 10000, 40, 50),
      fill('OKKO', 10500, 40, 50),
      fill('OKKO', 11000, 40, 50, { missedPrevious: true }),
    ]
    const { stations } = stationStats(fills)
    expect(stations.map((s) => s.station)).toEqual(['OKKO'])
    expect(stations[0].segments).toBe(0)
  })

  it('prices by litre-weighted average over all fills at the station', () => {
    const fills = [fill('WOG', 10000, 10, 50), fill('WOG', 10500, 30, 60)]
    const wog = stationStats(fills).stations[0]
    // (10 × 50 + 30 × 60) / 40 = 57.5 ₴
    expect(wog.avgPricePerLitreKop).toBe(5750)
  })

  it('scores cost per 100 km against the vehicle average, cheapest first, best only among scored', () => {
    // OKKO segments burn 3 × 40 L + 35 L (ended by the first WOG fill) over 2000 km = 7.75 L/100 at 50 ₴.
    // WOG segments burn 3 × 35 L + 30 L (ended by the first UPG fill) over 2000 km = 6.75 L/100 at 60 ₴.
    const fills = [
      ...run('OKKO', 10000, 4, 40, 50),
      ...run('WOG', 12000, 4, 35, 60),
      ...run('UPG', 14000, 2, 30, 40),
    ]
    const { stations, baselineCostPer100Kop } = stationStats(fills)
    expect(stations.map((s) => s.station)).toEqual(['OKKO', 'WOG', 'UPG'])
    const [okko, wog, upg] = stations
    expect(okko.costPer100Kop).toBeCloseTo(38750, 6)
    expect(wog.costPer100Kop).toBeCloseTo(40500, 6)
    // whole vehicle: 320 L over 4500 km, at (160 L × 50 + 140 L × 60 + 60 L × 40) / 360 L
    expect(baselineCostPer100Kop).toBeCloseTo((320 / 4500) * 100 * (1880000 / 360), 6)
    expect(wog.deltaPct!).toBeGreaterThan(okko.deltaPct!)
    expect(okko.deltaPct!).toBeCloseTo((okko.costPer100Kop! / baselineCostPer100Kop! - 1) * 100, 6)
    expect(stations.filter((s) => s.best).map((s) => s.station)).toEqual(['OKKO'])
    expect(upg).toMatchObject({ enoughData: false, deltaPct: null, best: false })
  })

  it('marks no best station when only one has enough data', () => {
    const { stations } = stationStats(run('OKKO', 10000, 5, 40, 50))
    expect(stations[0]).toMatchObject({ enoughData: true, best: false })
  })

  it('returns nothing without station fills', () => {
    expect(stationStats([])).toEqual({ stations: [], baselineCostPer100Kop: null })
  })
})
