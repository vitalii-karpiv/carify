export const FUEL_GRADES = ['A92', 'A95', 'A95_PLUS', 'A98', 'DIESEL', 'DIESEL_PLUS'] as const
export type FuelGrade = (typeof FUEL_GRADES)[number]
export const FUEL_GRADE_LABELS: Record<FuelGrade, string> = {
  A92: 'A-92',
  A95: 'A-95',
  A95_PLUS: 'A-95+',
  A98: 'A-98',
  DIESEL: 'Diesel',
  DIESEL_PLUS: 'Diesel+',
}

export const SERVICE_CATEGORIES = [
  'OIL_CHANGE',
  'BRAKES',
  'TYRES',
  'INSPECTION',
  'REPAIR',
  'OTHER',
] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  OIL_CHANGE: 'Oil change',
  BRAKES: 'Brakes',
  TYRES: 'Tyres',
  INSPECTION: 'Inspection',
  REPAIR: 'Repair',
  OTHER: 'Other',
}

export const GAS_STATIONS = ['OKKO', 'UKRNAFTA', 'UPG', 'WOG', 'OTHER'] as const
export type GasStation = (typeof GAS_STATIONS)[number]
export const GAS_STATION_LABELS: Record<GasStation, string> = {
  OKKO: 'OKKO',
  UKRNAFTA: 'Ukrnafta',
  UPG: 'UPG',
  WOG: 'WOG',
  OTHER: 'Other',
}
