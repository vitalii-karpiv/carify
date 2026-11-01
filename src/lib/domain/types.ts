import type { FuelGrade, GasStation, ServiceCategory } from './enums'

export type Vehicle = {
  id: string
  name: string
  make: string
  model: string
  year: number
  plate: string
  vin: string | null
  defaultGrade: FuelGrade
  archivedAt: Date | null
  createdAt: Date
}

export type FuelEntry = {
  id: string
  vehicleId: string
  date: Date
  odometer: number
  litres: number
  pricePerLitreKop: number
  totalKop: number
  currency: 'UAH'
  grade: FuelGrade
  isFull: boolean
  missedPrevious: boolean
  station: GasStation | null
  note: string | null
}

export type ServiceEntry = {
  id: string
  vehicleId: string
  date: Date
  odometer: number
  category: ServiceCategory
  totalKop: number
  currency: 'UAH'
  garage: string | null
  notes: string | null
}

/** A vehicle as the add-entry form needs it. */
export type EntryVehicle = {
  id: string
  name: string
  defaultGrade: FuelGrade
  lastOdometer: number | null
  lastStation: GasStation | null
}
