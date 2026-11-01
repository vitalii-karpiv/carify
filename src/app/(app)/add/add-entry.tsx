'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fuel, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { v7 as uuidv7 } from 'uuid'
import type { FieldErrors } from '@/components/forms/field'
import { FuelFields, readFuelForm } from '@/components/forms/fuel-fields'
import { ServiceFields, readServiceForm } from '@/components/forms/service-fields'
import { Button } from '@/components/ui/button'
import { toKyivLocalInput } from '@/lib/domain/dates'
import {
  buildEntryPayload,
  gradeAfterVehicleChange,
  isOdometerBelowLast,
  type EntryKind,
} from '@/lib/domain/entry-payload'
import { odometerRangeMessage, TOTAL_MISMATCH_MESSAGE } from '@/lib/domain/messages'
import type { EntryVehicle } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const PATHS: Record<EntryKind, string> = { fuel: '/api/fuel-entries', service: '/api/service-entries' }

type ErrorBody = {
  error?: string
  min?: number | null
  max?: number | null
  issues?: { path?: (string | number)[]; message?: string }[]
}

export function AddEntry({
  vehicles,
  selectedId,
  initialKind,
}: {
  vehicles: EntryVehicle[]
  selectedId: string
  initialKind: EntryKind
}) {
  const router = useRouter()
  const [kind, setKind] = useState<EntryKind>(initialKind)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [warning, setWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const gradeTouched = useRef(false)
  // One id per entry being added: a retry after a lost response is deduplicated by the server.
  const entryId = useRef<string | null>(null)
  const [date] = useState(() => toKyivLocalInput(new Date()))

  useEffect(() => {
    document.getElementById('odometer')?.focus()
  }, [kind])

  function checkWarning(f: HTMLFormElement) {
    const data = new FormData(f)
    const raw = String(data.get('odometer') ?? '')
    const v = vehicles.find((x) => x.id === data.get('vehicleId'))
    setWarning(raw.trim() !== '' && isOdometerBelowLast(Number(raw.replace(/\s/g, '')), v?.lastOdometer))
  }

  function onFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const target = e.target as unknown as HTMLSelectElement
    checkWarning(e.currentTarget)
    if (target.name === 'grade') gradeTouched.current = true
    if (target.name === 'vehicleId') {
      const grade = e.currentTarget.elements.namedItem('grade')
      if (grade instanceof HTMLSelectElement) {
        const v = vehicles.find((x) => x.id === target.value)
        grade.value = gradeAfterVehicleChange(gradeTouched.current, grade.value, v)
      }
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const values = kind === 'fuel' ? readFuelForm(data) : readServiceForm(data)
    entryId.current ??= uuidv7()
    const result = buildEntryPayload(kind, values, entryId.current)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      let res: Response
      try {
        res = await fetch(PATHS[kind], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.payload),
        })
      } catch {
        toast.error('No connection — try again')
        return
      }
      if (res.ok) {
        toast.success('Saved')
        router.push('/')
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => ({}))) as ErrorBody
      if (res.status === 401) {
        toast.error('Session expired — sign in again')
        router.push('/login')
      } else if (body.error === 'ODOMETER_OUT_OF_RANGE') {
        setErrors({ odometer: odometerRangeMessage(body.min, body.max) })
      } else if (body.error === 'VEHICLE_NOT_FOUND') {
        setErrors({ vehicleId: 'This vehicle no longer exists' })
        router.refresh()
      } else if (body.error === 'VALIDATION') {
        const next: FieldErrors = {}
        for (const issue of body.issues ?? []) {
          const field = String(issue.path?.[0] ?? 'form')
          next[field] ??= issue.message === 'TOTAL_MISMATCH' ? TOTAL_MISMATCH_MESSAGE : 'Invalid value'
        }
        setErrors(next)
      } else {
        if (body.error === 'ID_CONFLICT') entryId.current = null
        toast.error('Could not save the entry — try again')
      }
    } finally {
      setSaving(false)
    }
  }

  const defaults = { vehicleId: selectedId, date }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist">
        {(['fuel', 'service'] as const).map((k) => {
          const Icon = k === 'fuel' ? Fuel : Wrench
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k)
                setErrors({})
                setWarning(false)
                gradeTouched.current = false
                entryId.current = null
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-colors',
                kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Icon
                className={cn('size-4', kind === k && (k === 'fuel' ? 'text-tint-fuel' : 'text-tint-service'))}
              />
              {k === 'fuel' ? 'Fuel' : 'Service'}
            </button>
          )
        })}
      </div>
      <form
        key={kind}
        onSubmit={onSubmit}
        onInput={(e) => checkWarning(e.currentTarget)}
        onChange={onFormChange}
        className="flex flex-col gap-4"
        noValidate
      >
        {kind === 'fuel' ? (
          <FuelFields vehicles={vehicles} defaultValues={defaults} errors={errors} />
        ) : (
          <ServiceFields vehicles={vehicles} defaultValues={defaults} errors={errors} />
        )}
        {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId}</p>}
        {warning && (
          <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
            Odometer is lower than the last known reading.
          </p>
        )}
        <Button type="submit" size="lg" disabled={saving} className="h-11 rounded-xl">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  )
}
