'use client'

import { useRef, useState } from 'react'
import { Field, selectClass, type FieldErrors } from '@/components/forms/field'
import { useFuelMath } from '@/components/forms/use-fuel-math'
import { Input } from '@/components/ui/input'
import {
  FUEL_GRADES,
  FUEL_GRADE_LABELS,
  GAS_STATIONS,
  GAS_STATION_LABELS,
  type FuelGrade,
  type GasStation,
} from '@/lib/domain/enums'
import { fromKyivLocalInput } from '@/lib/domain/dates'
import type { FuelField, FuelValues } from '@/lib/domain/fuel-math'
import { parseDecimal } from '@/lib/domain/money'
import { cn } from '@/lib/utils'

export type FuelFormDefaults = {
  vehicleId?: string
  /** `datetime-local` value in Kyiv local time */
  date?: string
  odometer?: string
  fuel?: FuelValues
  grade?: FuelGrade
  isFull?: boolean
  missedPrevious?: boolean
  /** '' = no station */
  station?: GasStation | ''
  note?: string
}

type Vehicle = { id: string; name: string; defaultGrade: FuelGrade; lastStation?: GasStation | null }

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
  const lastStationOf = (id: string | undefined) => vehicles.find((v) => v.id === id)?.lastStation ?? ''
  const [station, setStation] = useState<GasStation | ''>(defaultValues.station ?? lastStationOf(vehicleId))
  // Until the user picks a station, it follows the selected vehicle's last one.
  const stationTouched = useRef(defaultValues.station !== undefined)

  return (
    <>
      <Field id="vehicleId" label="Vehicle">
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={vehicleId}
          disabled={lockVehicle}
          className={selectClass}
          onChange={(e) => {
            if (!stationTouched.current) setStation(lastStationOf(e.target.value))
          }}
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
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-none font-medium">Station (optional)</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {GAS_STATIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={station === s}
              onClick={() => {
                stationTouched.current = true
                // tapping the selected station clears it
                setStation((prev) => (prev === s ? '' : s))
              }}
              className={cn(
                'h-10 rounded-xl border text-[13px] font-medium transition-colors',
                station === s
                  ? 'border-transparent bg-brand-gradient text-white shadow-brand'
                  : 'border-input bg-card text-foreground',
              )}
            >
              {GAS_STATION_LABELS[s]}
            </button>
          ))}
        </div>
        <input type="hidden" name="station" value={station} />
        {errors.station && <p className="text-sm text-destructive">{errors.station}</p>}
      </fieldset>
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
    /** raw datetime-local text; edit actions use it to keep an unchanged stored date exact */
    dateInput: text('date'),
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
