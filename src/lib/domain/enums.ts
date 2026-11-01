export const FUEL_GRADES = ['A-92', 'A-95', 'A-95+', 'A-98', 'Diesel', 'Diesel+'] as const
export type FuelGrade = (typeof FUEL_GRADES)[number]
export const FUEL_GRADE_LABELS: Record<FuelGrade, string> = {
  'A-92': 'A-92',
  'A-95': 'A-95',
  'A-95+': 'A-95+',
  'A-98': 'A-98',
  Diesel: 'Diesel',
  'Diesel+': 'Diesel+',
}

export const SERVICE_CATEGORIES = [
  'oil_change',
  'brakes',
  'tyres',
  'inspection',
  'repair',
  'other',
] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  oil_change: 'Oil change',
  brakes: 'Brakes',
  tyres: 'Tyres',
  inspection: 'Inspection',
  repair: 'Repair',
  other: 'Other',
}
