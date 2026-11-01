import { describe, expect, it } from 'vitest'
import { applyFuelChange, initFuelState, parseFuelInput } from './fuel-inputs'

describe('parseFuelInput', () => {
  it('parses litres and money with comma or dot', () => {
    expect(parseFuelInput('litres', '45,5')).toBe(45.5)
    expect(parseFuelInput('litres', '45.5')).toBe(45.5)
    expect(parseFuelInput('pricePerLitreKop', '58,99')).toBe(5899)
    expect(parseFuelInput('totalKop', '2 684,05')).toBe(268405)
  })
  it('returns undefined for empty or invalid text', () => {
    expect(parseFuelInput('litres', '')).toBeUndefined()
    expect(parseFuelInput('totalKop', 'abc')).toBeUndefined()
  })
})

describe('initFuelState', () => {
  it('is empty without initial values', () => {
    const s = initFuelState()
    expect(s.inputs).toEqual({ litres: '', pricePerLitreKop: '', totalKop: '' })
    expect(s.values).toBeNull()
    expect(s.sources).toEqual(['litres', 'pricePerLitreKop'])
  })
  it('formats initial values with comma decimals and keeps them as the values', () => {
    const v = { litres: 45.5, pricePerLitreKop: 5899, totalKop: 268405 }
    const s = initFuelState(v)
    expect(s.inputs.litres).toBe('45,5')
    expect(s.inputs.pricePerLitreKop).toBe('58,99')
    expect(parseFuelInput('totalKop', s.inputs.totalKop)).toBe(268405)
    expect(s.values).toEqual(v)
  })
})

describe('applyFuelChange', () => {
  it('derives total from litres and price', () => {
    let s = initFuelState()
    s = applyFuelChange(s, 'litres', '45,5')
    expect(s.values).toBeNull()
    s = applyFuelChange(s, 'pricePerLitreKop', '58,99')
    expect(s.values).toEqual({ litres: 45.5, pricePerLitreKop: 5899, totalKop: 268405 })
    expect(parseFuelInput('totalKop', s.inputs.totalKop)).toBe(268405)
    expect(s.inputs.litres).toBe('45,5')
  })
  it('editing total makes price derived and keeps litres a source', () => {
    let s = initFuelState({ litres: 45.5, pricePerLitreKop: 5899, totalKop: 268405 })
    s = applyFuelChange(s, 'totalKop', '2700')
    expect(s.sources).toEqual(['totalKop', 'litres'])
    expect(s.inputs.litres).toBe('45,5')
    expect(s.inputs.totalKop).toBe('2700')
    expect(s.values).toEqual({ litres: 45.5, pricePerLitreKop: 5934, totalKop: 270000 })
    expect(s.inputs.pricePerLitreKop).toBe('59,34')
  })
  it('clears the derived input and values when a source becomes invalid', () => {
    let s = applyFuelChange(applyFuelChange(initFuelState(), 'litres', '45,5'), 'pricePerLitreKop', '58,99')
    s = applyFuelChange(s, 'litres', '')
    expect(s.values).toBeNull()
    expect(s.inputs.totalKop).toBe('')
  })
})
