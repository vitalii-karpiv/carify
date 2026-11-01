import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCES,
  deriveFuel,
  derivedField,
  isFuelConsistent,
  nextSources,
} from './fuel-math'

describe('nextSources', () => {
  it('keeps the most recent other source', () => {
    expect(nextSources(['litres', 'totalKop'], 'pricePerLitreKop')).toEqual(['pricePerLitreKop', 'litres'])
    expect(nextSources(['litres', 'totalKop'], 'totalKop')).toEqual(['totalKop', 'litres'])
    expect(nextSources(['litres', 'totalKop'], 'litres')).toEqual(['litres', 'totalKop'])
  })
})

describe('derivedField', () => {
  it('returns the field that is not a source', () => {
    expect(derivedField(['litres', 'pricePerLitreKop'])).toBe('totalKop')
    expect(derivedField(['totalKop', 'pricePerLitreKop'])).toBe('litres')
    expect(derivedField(['litres', 'totalKop'])).toBe('pricePerLitreKop')
  })
})

describe('deriveFuel', () => {
  it('derives total', () => {
    expect(deriveFuel({ litres: 40, pricePerLitreKop: 5899 }, ['litres', 'pricePerLitreKop'])).toEqual({
      litres: 40, pricePerLitreKop: 5899, totalKop: 235960,
    })
  })
  it('derives litres', () => {
    expect(deriveFuel({ totalKop: 235960, pricePerLitreKop: 5899 }, ['totalKop', 'pricePerLitreKop'])).toEqual({
      litres: 40, pricePerLitreKop: 5899, totalKop: 235960,
    })
  })
  it('derives price', () => {
    expect(deriveFuel({ litres: 40, totalKop: 235960 }, ['litres', 'totalKop'])).toEqual({
      litres: 40, pricePerLitreKop: 5899, totalKop: 235960,
    })
  })
  it('rounds litres to 3 decimals', () => {
    expect(deriveFuel({ totalKop: 100000, pricePerLitreKop: 5899 }, ['totalKop', 'pricePerLitreKop'])?.litres).toBe(16.952)
  })
  it('ignores the derived field input value', () => {
    expect(
      deriveFuel({ litres: 40, pricePerLitreKop: 5899, totalKop: 1 }, ['litres', 'pricePerLitreKop'])?.totalKop,
    ).toBe(235960)
  })
  it('returns null for missing, zero, negative or non-finite sources', () => {
    expect(deriveFuel({ litres: 40 }, ['litres', 'pricePerLitreKop'])).toBeNull()
    expect(deriveFuel({ litres: 0, pricePerLitreKop: 5899 }, DEFAULT_SOURCES)).toBeNull()
    expect(deriveFuel({ litres: -1, pricePerLitreKop: 5899 }, DEFAULT_SOURCES)).toBeNull()
    expect(deriveFuel({ litres: NaN, pricePerLitreKop: 5899 }, DEFAULT_SOURCES)).toBeNull()
    expect(deriveFuel({ litres: Infinity, pricePerLitreKop: 5899 }, DEFAULT_SOURCES)).toBeNull()
  })
  it('returns null when a derived divisor rounds to 0', () => {
    expect(deriveFuel({ totalKop: 1, pricePerLitreKop: 5899 }, ['totalKop', 'pricePerLitreKop'])).toBeNull()
    expect(deriveFuel({ litres: 1000, totalKop: 1 }, ['litres', 'totalKop'])).toBeNull()
  })
})

describe('isFuelConsistent', () => {
  it('accepts a difference up to the tolerance', () => {
    expect(isFuelConsistent({ litres: 40, pricePerLitreKop: 5899, totalKop: 236060 })).toBe(true)
  })
  it('rejects a larger difference', () => {
    expect(isFuelConsistent({ litres: 40, pricePerLitreKop: 5899, totalKop: 236061 })).toBe(false)
  })
})
