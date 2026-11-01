import { describe, expect, it } from 'vitest'
import {
  formatConsumption,
  formatKm,
  formatNumber,
  formatUah,
  parseDecimal,
  uahToKop,
} from './money'

const norm = (s: string) => s.replace(/\s/g, ' ')

describe('formatting', () => {
  it('formats UAH from kopiykas', () => {
    expect(norm(formatUah(123456))).toBe('1 234,56 ₴')
    expect(norm(formatUah(0))).toBe('0,00 ₴')
  })
  it('formats numbers with fixed fraction digits', () => {
    expect(norm(formatNumber(1234.5, 2))).toBe('1 234,50')
  })
  it('formats km', () => {
    expect(norm(formatKm(123456))).toBe('123 456 km')
  })
  it('formats consumption', () => {
    expect(norm(formatConsumption(7.3611))).toBe('7,4 L/100km')
  })
})

describe('parseDecimal', () => {
  it.each([
    ['45,5', 45.5],
    ['45.5', 45.5],
    [' 1 234,5 ', 1234.5],
    ['1 234,5', 1234.5],
    ['', null],
    ['abc', null],
    ['1,2,3', null],
    ['-5', null],
  ])('parses %j', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })
})

describe('uahToKop', () => {
  it('rounds to whole kopiykas', () => {
    expect(uahToKop(58.99)).toBe(5899)
  })
})
