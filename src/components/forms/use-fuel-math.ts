'use client'

import { useState } from 'react'
import { applyFuelChange, initFuelState } from '@/lib/domain/fuel-inputs'
import { derivedField, type FuelField, type FuelValues } from '@/lib/domain/fuel-math'

/**
 * Two-of-three fuel math. `inputs` are display strings (UAH / litres, comma decimals),
 * `values` are kopecks / litres, `derived` is the read-only field.
 */
export function useFuelMath(initial?: FuelValues) {
  const [state, setState] = useState(() => initFuelState(initial))
  return {
    inputs: state.inputs,
    derived: derivedField(state.sources),
    values: state.values,
    onChange: (field: FuelField, raw: string) => setState((s) => applyFuelChange(s, field, raw)),
  }
}
