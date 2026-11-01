import { describe, expect, it } from 'vitest'
import { chooseVehicleId, readVehicleCookie } from './vehicle-choice'

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('chooseVehicleId', () => {
  it('prefers last used', () => expect(chooseVehicleId(list, 'c', 'b')).toBe('c'))
  it('falls back to the cookie vehicle', () => expect(chooseVehicleId(list, null, 'b')).toBe('b'))
  it('ignores ids missing from the snapshot', () => expect(chooseVehicleId(list, 'x', 'y')).toBe('a'))
  it('returns undefined for an empty list', () => expect(chooseVehicleId([], 'a', 'a')).toBeUndefined())
})

describe('readVehicleCookie', () => {
  it('finds the cookie among others', () => expect(readVehicleCookie('x=1; vehicleId=abc; y=2')).toBe('abc'))
  it('returns null when absent', () => expect(readVehicleCookie('x=1')).toBeNull())
})
