'use client'

import { Field, selectClass, type FieldErrors } from '@/components/forms/field'
import { useFuelMath } from '@/components/forms/use-fuel-math'
import { Input } from '@/components/ui/input'
import { FUEL_GRADES, FUEL_GRADE_LABELS, type FuelGrade } from '@/lib/domain/enums'
import { fromKyivLocalInput } from '@/lib/domain/dates'
import type { FuelField, FuelValues } from '@/lib/domain/fuel-math'
import { parseDecimal } from '@/lib/domain/money'

export type FuelFormDefaults = {
  vehicleId?: string
  /** `datetime-local` value in Kyiv local time */
  date?: string
  odometer?: string
  fuel?: FuelValues
  grade?: FuelGrade
  isFull?: boolean
  missedPrevious?: boolean
  station?: string
  note?: string
}

type Vehicle = { id: string; name: string; defaultGrade: FuelGrade }

const FUEL_LABELS: Record<FuelField, string> = {
  litres: 'Litres',
  pricePerLitreKop: 'Price per litre, ₴',
  totalKop: 'Total, ₴',
}
const FUEL_ORDER: FuelField[] = ['litres', 'pricePerLitreKop', 'totalKop']

export function FuelFields({
  vehicles,
  defaultValues = {},
  errors = {},
  lockVehicle = false,
}: {
  vehicles: Vehicle[]
  defaultValues?: FuelFormDefaults
  errors?: FieldErrors
  /** read-only vehicle (edit screens) */
  lockVehicle?: boolean
}) {
  const math = useFuelMath(defaultValues.fuel)
  const vehicleId = defaultValues.vehicleId ?? vehicles[0]?.id
  const grade =
    defaultValues.grade ?? vehicles.find((v) => v.id === vehicleId)?.defaultGrade ?? 'A95'

  return (
    <>
      <Field id="vehicleId" label="Vehicle">
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={vehicleId}
          disabled={lockVehicle}
          className={selectClass}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="odometer" label="Odometer, km" error={errors.odometer}>
        <Input
          id="odometer"
          name="odometer"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={defaultValues.odometer}
          aria-invalid={errors.odometer ? true : undefined}
        />
      </Field>
      <Field id="date" label="Date and time" error={errors.date}>
        <Input
          id="date"
          name="date"
          type="datetime-local"
          defaultValue={defaultValues.date}
          aria-invalid={errors.date ? true : undefined}
        />
      </Field>
      {FUEL_ORDER.map((f) => {
        const isDerived = math.derived === f
        return (
          <Field
            key={f}
            id={`fuel-${f}`}
            label={FUEL_LABELS[f]}
            hint={isDerived ? 'calculated' : undefined}
            error={errors[f]}
          >
            <Input
              id={`fuel-${f}`}
              inputMode="decimal"
              autoComplete="off"
              value={math.inputs[f]}
              readOnly={isDerived}
              tabIndex={isDerived ? -1 : undefined}
              onChange={(e) => math.onChange(f, e.target.value)}
              aria-invalid={errors[f] ? true : undefined}
              className={isDerived ? 'bg-muted text-muted-foreground' : undefined}
            />
            <input type="hidden" name={f} value={math.values?.[f] ?? ''} />
          </Field>
        )
      })}
      <Field id="grade" label="Grade">
        <select id="grade" name="grade" defaultValue={grade} className={selectClass}>
          {FUEL_GRADES.map((g) => (
            <option key={g} value={g}>
              {FUEL_GRADE_LABELS[g]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isFull"
          defaultChecked={defaultValues.isFull ?? true}
          className="size-4 accent-primary"
        />
        Full tank
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="missedPrevious"
          defaultChecked={defaultValues.missedPrevious ?? false}
          className="size-4 accent-primary"
        />
        Missed previous fill-up
      </label>
      <Field id="station" label="Station (optional)" error={errors.station}>
        <Input id="station" name="station" defaultValue={defaultValues.station} />
      </Field>
      <Field id="note" label="Note (optional)" error={errors.note}>
        <Input id="note" name="note" defaultValue={defaultValues.note} />
      </Field>
    </>
  )
}

const num = (raw: FormDataEntryValue | null) => {
  const n = parseDecimal(String(raw ?? ''))
  return n === null ? undefined : n
}

/** Builds the payload for the fuel update/create schemas from a submitted `<FuelFields>` form. */
export function readFuelForm(f: FormData) {
  const text = (k: string) => String(f.get(k) ?? '')
  const date = fromKyivLocalInput(text('date'))
  return {
    vehicleId: text('vehicleId') || undefined,
    date: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
    odometer: num(f.get('odometer')),
    litres: f.get('litres') === '' ? undefined : Number(f.get('litres')),
    pricePerLitreKop: f.get('pricePerLitreKop') === '' ? undefined : Number(f.get('pricePerLitreKop')),
    totalKop: f.get('totalKop') === '' ? undefined : Number(f.get('totalKop')),
    grade: text('grade'),
    isFull: f.get('isFull') === 'on',
    missedPrevious: f.get('missedPrevious') === 'on',
    station: text('station'),
    note: text('note'),
  }
}
