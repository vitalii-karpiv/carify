'use client'

import { Field, selectClass, type FieldErrors } from '@/components/forms/field'
import { Input } from '@/components/ui/input'
import { fromKyivLocalInput } from '@/lib/domain/dates'
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, type FuelGrade, type ServiceCategory } from '@/lib/domain/enums'
import { parseDecimal, uahToKop } from '@/lib/domain/money'

export type ServiceFormDefaults = {
  vehicleId?: string
  /** `datetime-local` value in Kyiv local time */
  date?: string
  odometer?: string
  category?: ServiceCategory
  /** display text in UAH, e.g. `1 200,00` */
  total?: string
  garage?: string
  notes?: string
}

type Vehicle = { id: string; name: string; defaultGrade: FuelGrade }

export function ServiceFields({
  vehicles,
  defaultValues = {},
  errors = {},
  lockVehicle = false,
}: {
  vehicles: Vehicle[]
  defaultValues?: ServiceFormDefaults
  errors?: FieldErrors
  lockVehicle?: boolean
}) {
  return (
    <>
      <Field id="vehicleId" label="Vehicle">
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={defaultValues.vehicleId ?? vehicles[0]?.id}
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
      <Field id="category" label="Category" error={errors.category}>
        <select
          id="category"
          name="category"
          defaultValue={defaultValues.category ?? 'OIL_CHANGE'}
          className={selectClass}
        >
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SERVICE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="total" label="Total, ₴" error={errors.totalKop}>
        <Input
          id="total"
          name="total"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={defaultValues.total}
          aria-invalid={errors.totalKop ? true : undefined}
        />
      </Field>
      <Field id="garage" label="Garage (optional)" error={errors.garage}>
        <Input id="garage" name="garage" defaultValue={defaultValues.garage} />
      </Field>
      <Field id="notes" label="Notes (optional)" error={errors.notes}>
        <Input id="notes" name="notes" defaultValue={defaultValues.notes} />
      </Field>
    </>
  )
}

/** Builds the payload for the service update/create schemas from a submitted `<ServiceFields>` form. */
export function readServiceForm(f: FormData) {
  const text = (k: string) => String(f.get(k) ?? '')
  const date = fromKyivLocalInput(text('date'))
  const odometer = parseDecimal(text('odometer'))
  const total = parseDecimal(text('total'))
  return {
    vehicleId: text('vehicleId') || undefined,
    date: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
    /** raw datetime-local text; edit actions use it to keep an unchanged stored date exact */
    dateInput: text('date'),
    odometer: odometer === null ? undefined : odometer,
    category: text('category'),
    totalKop: total === null ? undefined : uahToKop(total),
    garage: text('garage'),
    notes: text('notes'),
  }
}
