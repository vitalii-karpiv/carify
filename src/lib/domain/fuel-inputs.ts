import {
  DEFAULT_SOURCES,
  type FuelField,
  type FuelValues,
  deriveFuel,
  derivedField,
  nextSources,
} from './fuel-math'
import { formatNumber, parseDecimal, uahToKop } from './money'

type Sources = [FuelField, FuelField]

export type FuelState = {
  /** What the user sees: UAH / litres with comma decimals. */
  inputs: Record<FuelField, string>
  sources: Sources
  /** Values in kopecks / litres, or null while the sources are incomplete or invalid. */
  values: FuelValues | null
}

/** Display text → kopecks (money fields) or litres; undefined when empty/invalid. */
export function parseFuelInput(field: FuelField, raw: string): number | undefined {
  const n = parseDecimal(raw)
  if (n === null) return undefined
  return field === 'litres' ? n : uahToKop(n)
}

function formatFuelField(field: FuelField, value: number): string {
  if (field === 'litres') return Number(value.toFixed(3)).toString().replace('.', ',')
  return formatNumber(value / 100, 2)
}

const EMPTY_INPUTS: Record<FuelField, string> = { litres: '', pricePerLitreKop: '', totalKop: '' }

export function initFuelState(initial?: FuelValues): FuelState {
  if (!initial) return { inputs: { ...EMPTY_INPUTS }, sources: [...DEFAULT_SOURCES], values: null }
  return {
    inputs: {
      litres: formatFuelField('litres', initial.litres),
      pricePerLitreKop: formatFuelField('pricePerLitreKop', initial.pricePerLitreKop),
      totalKop: formatFuelField('totalKop', initial.totalKop),
    },
    sources: [...DEFAULT_SOURCES],
    values: initial,
  }
}

export function applyFuelChange(state: FuelState, field: FuelField, raw: string): FuelState {
  const sources = nextSources(state.sources, field)
  const inputs = { ...state.inputs, [field]: raw }
  const target = derivedField(sources)
  const partial = {
    [sources[0]]: parseFuelInput(sources[0], inputs[sources[0]]),
    [sources[1]]: parseFuelInput(sources[1], inputs[sources[1]]),
  }
  const values = deriveFuel(partial, sources)
  inputs[target] = values ? formatFuelField(target, values[target]) : ''
  return { inputs, sources, values }
}
