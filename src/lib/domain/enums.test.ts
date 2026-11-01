import { describe, expect, it } from 'vitest'
import {
  FUEL_GRADES,
  FUEL_GRADE_LABELS,
  GAS_STATIONS,
  GAS_STATION_LABELS,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
} from './enums'

describe('enums', () => {
  it('pins stored fuel grade values and labels', () => {
    expect([...FUEL_GRADES]).toEqual(['A92', 'A95', 'A95_PLUS', 'A98', 'DIESEL', 'DIESEL_PLUS'])
    expect(FUEL_GRADES.map((g) => FUEL_GRADE_LABELS[g])).toEqual([
      'A-92', 'A-95', 'A-95+', 'A-98', 'Diesel', 'Diesel+',
    ])
  })
  it('pins stored service category values and labels', () => {
    expect([...SERVICE_CATEGORIES]).toEqual([
      'OIL_CHANGE', 'BRAKES', 'TYRES', 'INSPECTION', 'REPAIR', 'OTHER',
    ])
    expect(SERVICE_CATEGORIES.map((c) => SERVICE_CATEGORY_LABELS[c])).toEqual([
      'Oil change', 'Brakes', 'Tyres', 'Inspection', 'Repair', 'Other',
    ])
  })
  it('pins stored gas station values and labels', () => {
    expect([...GAS_STATIONS]).toEqual(['OKKO', 'UKRNAFTA', 'UPG', 'WOG', 'OTHER'])
    expect(GAS_STATIONS.map((s) => GAS_STATION_LABELS[s])).toEqual(['OKKO', 'Ukrnafta', 'UPG', 'WOG', 'Other'])
  })
})
