'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FUEL_GRADES, FUEL_GRADE_LABELS } from '@/lib/domain/enums'
import type { Vehicle } from '@/lib/domain/types'

type Result = { ok: true } | { ok: false; fieldErrors?: Record<string, string[] | undefined>; error?: string }

export function VehicleForm({
  vehicle,
  action,
  submitLabel,
}: {
  vehicle?: Vehicle
  action: (input: unknown) => Promise<Result>
  submitLabel: string
}) {
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '')
    const year = text('year').trim()
    const input = {
      name: text('name'),
      make: text('make'),
      model: text('model'),
      year: year === '' ? undefined : Number(year),
      plate: text('plate'),
      vin: text('vin'),
      defaultGrade: text('defaultGrade'),
    }
    start(async () => {
      const res = await action(input)
      // a successful create/update redirects, so we only get here on failure
      if (res && !res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error ?? null)
      }
    })
  }

  const field = (name: string, label: string, props: React.ComponentProps<'input'> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={props.defaultValue}
        aria-invalid={errors[name] ? true : undefined}
        {...props}
      />
      {errors[name] && <p className="text-sm text-destructive">Invalid value</p>}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {field('name', 'Name', { defaultValue: vehicle?.name, placeholder: 'Golf', required: true })}
      {field('make', 'Make', { defaultValue: vehicle?.make, required: true })}
      {field('model', 'Model', { defaultValue: vehicle?.model, required: true })}
      {field('year', 'Year', { type: 'number', inputMode: 'numeric', defaultValue: vehicle?.year, required: true })}
      {field('plate', 'Plate', { defaultValue: vehicle?.plate, autoCapitalize: 'characters', required: true })}
      {field('vin', 'VIN (optional)', { defaultValue: vehicle?.vin ?? '', autoCapitalize: 'characters' })}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultGrade">Default fuel grade</Label>
        <select
          id="defaultGrade"
          name="defaultGrade"
          defaultValue={vehicle?.defaultGrade ?? 'A95'}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        >
          {FUEL_GRADES.map((g) => (
            <option key={g} value={g}>
              {FUEL_GRADE_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
