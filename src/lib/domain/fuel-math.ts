export type FuelField = 'litres' | 'pricePerLitreKop' | 'totalKop'
export type FuelValues = { litres: number; pricePerLitreKop: number; totalKop: number }
export type PartialFuel = Partial<FuelValues>
type Sources = [FuelField, FuelField]

export const DEFAULT_SOURCES: Sources = ['litres', 'pricePerLitreKop']
export const FUEL_TOLERANCE_KOP = 100

const ALL_FIELDS: FuelField[] = ['litres', 'pricePerLitreKop', 'totalKop']

const round3 = (x: number) => Math.round(x * 1000) / 1000

export function nextSources(prev: Sources, edited: FuelField): Sources {
  return [edited, prev[0] === edited ? prev[1] : prev[0]]
}

export function derivedField(sources: Sources): FuelField {
  return ALL_FIELDS.find((f) => !sources.includes(f)) as FuelField
}

const isPositive = (n: number | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

export function deriveFuel(values: PartialFuel, sources: Sources): FuelValues | null {
  const [a, b] = sources
  const va = values[a]
  const vb = values[b]
  if (!isPositive(va) || !isPositive(vb)) return null

  const src: PartialFuel = { [a]: va, [b]: vb }
  const target = derivedField(sources)
  let { litres: L, pricePerLitreKop: P, totalKop: T } = src

  if (target === 'totalKop') {
    T = Math.round(L! * P!)
  } else if (target === 'pricePerLitreKop') {
    P = Math.round(T! / L!)
    if (P === 0) return null
  } else {
    L = round3(T! / P!)
    if (L === 0) return null
  }
  return { litres: L!, pricePerLitreKop: P!, totalKop: T! }
}

export function isFuelConsistent(v: FuelValues): boolean {
  return Math.abs(Math.round(v.litres * v.pricePerLitreKop) - v.totalKop) <= FUEL_TOLERANCE_KOP
}
