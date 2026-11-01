import { z } from 'zod'
import { FUEL_GRADES, SERVICE_CATEGORIES } from './enums'
import { isFuelConsistent } from './fuel-math'

const optionalText = (max: number) =>
  z.preprocess(
    (v) => {
      if (v == null) return null
      if (typeof v !== 'string') return v
      const t = v.trim()
      return t === '' ? null : t
    },
    z.string().max(max).nullable(),
  )

const vin = z.preprocess(
  (v) => {
    if (v == null) return null
    if (typeof v !== 'string') return v
    const t = v.trim().toUpperCase()
    return t === '' ? null : t
  },
  z
    .string()
    .length(17)
    .regex(/^[A-HJ-NPR-Z0-9]+$/)
    .nullable(),
)

export const vehicleInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  // evaluated at parse time, not module load
  year: z
    .number()
    .int()
    .min(1950)
    .refine((y) => y <= new Date().getFullYear() + 1),
  plate: z.string().trim().toUpperCase().min(1).max(15),
  vin,
  defaultGrade: z.enum(FUEL_GRADES),
})

const odometer = z.number().int().min(0).max(2_000_000)

const fuelEntryBase = z.object({
  id: z.uuid(),
  vehicleId: z.uuid(),
  date: z.coerce.date(),
  odometer,
  litres: z.number().positive().max(99999.999),
  pricePerLitreKop: z.number().int().positive(),
  totalKop: z.number().int().positive(),
  grade: z.enum(FUEL_GRADES),
  isFull: z.boolean(),
  missedPrevious: z.boolean(),
  station: optionalText(100),
  note: optionalText(500),
})

function checkFuelTotal(
  v: { litres: number; pricePerLitreKop: number; totalKop: number },
  ctx: z.RefinementCtx,
) {
  if (!isFuelConsistent(v)) {
    ctx.addIssue({ code: 'custom', path: ['totalKop'], message: 'TOTAL_MISMATCH' })
  }
}

export const fuelEntryInputSchema = fuelEntryBase.superRefine(checkFuelTotal)

export const fuelEntryUpdateSchema = fuelEntryBase
  .omit({ id: true, vehicleId: true })
  .superRefine(checkFuelTotal)

const serviceEntryBase = z.object({
  id: z.uuid(),
  vehicleId: z.uuid(),
  date: z.coerce.date(),
  odometer,
  category: z.enum(SERVICE_CATEGORIES),
  totalKop: z.number().int().min(0),
  garage: optionalText(100),
  notes: optionalText(500),
})

export const serviceEntryInputSchema = serviceEntryBase
export const serviceEntryUpdateSchema = serviceEntryBase.omit({ id: true, vehicleId: true })

export type VehicleInput = z.infer<typeof vehicleInputSchema>
export type FuelEntryInput = z.infer<typeof fuelEntryInputSchema>
export type ServiceEntryInput = z.infer<typeof serviceEntryInputSchema>
export type FuelEntryUpdate = z.infer<typeof fuelEntryUpdateSchema>
export type ServiceEntryUpdate = z.infer<typeof serviceEntryUpdateSchema>
