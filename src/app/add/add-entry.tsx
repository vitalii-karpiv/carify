'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { v7 as uuidv7 } from 'uuid'
import type { FieldErrors } from '@/components/forms/field'
import { FuelFields, readFuelForm } from '@/components/forms/fuel-fields'
import { ServiceFields, readServiceForm } from '@/components/forms/service-fields'
import { useSync } from '@/components/sync/sync-provider'
import { Button } from '@/components/ui/button'
import { toKyivLocalInput } from '@/lib/domain/dates'
import type { FuelGrade } from '@/lib/domain/enums'
import type { SnapshotVehicle } from '@/lib/domain/types'
import { buildOutboxPayload, isOdometerBelowLast } from '@/lib/offline/entry-payload'
import { enqueue, type OutboxKind } from '@/lib/offline/outbox'
import {
  bumpLastOdometer,
  getLastUsedVehicleId,
  getSnapshotVehicles,
  setLastUsedVehicleId,
} from '@/lib/offline/snapshot'

type FormState = { key: number; vehicleId?: string; grade?: FuelGrade; date: string }

export function AddEntry() {
  const router = useRouter()
  const params = useSearchParams()
  const { online, syncNow } = useSync()
  const [kind, setKind] = useState<OutboxKind>(params.get('kind') === 'service' ? 'service' : 'fuel')
  const [vehicles, setVehicles] = useState<SnapshotVehicle[] | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [warning, setWarning] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [list, last] = await Promise.all([getSnapshotVehicles(), getLastUsedVehicleId()])
        if (cancelled) return
        setVehicles(list)
        const vehicleId = list.find((v) => v.id === last)?.id ?? list[0]?.id
        setForm({ key: 0, vehicleId, date: toKyivLocalInput(new Date()) })
      } catch {
        if (!cancelled) setVehicles([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (form) document.getElementById('odometer')?.focus()
  }, [form?.key, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vehicles) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (vehicles.length === 0) {
    return online ? (
      <p className="text-sm">
        <Link href="/vehicles/new" className="underline">
          Add a vehicle first
        </Link>
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">Open Carify once online to load your vehicles.</p>
    )
  }

  const current = form!

  function checkWarning(f: HTMLFormElement) {
    const data = new FormData(f)
    const odo = Number(String(data.get('odometer') ?? '').replace(/\s/g, ''))
    const v = vehicles!.find((x) => x.id === data.get('vehicleId'))
    setWarning(String(data.get('odometer') ?? '').trim() !== '' && isOdometerBelowLast(odo, v?.lastOdometer))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const values = kind === 'fuel' ? readFuelForm(data) : readServiceForm(data)
    const result = buildOutboxPayload(kind, values, uuidv7())
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const { payload } = result
      await enqueue(kind, payload)
      await bumpLastOdometer(String(payload.vehicleId), Number(payload.odometer))
      await setLastUsedVehicleId(String(payload.vehicleId))
      void syncNow()
      if (navigator.onLine) {
        toast.success('Saved')
        router.push('/')
        router.refresh()
      } else {
        toast.success('Saved — will sync when online')
        setWarning(false)
        setVehicles(await getSnapshotVehicles())
        setForm({
          key: current.key + 1,
          vehicleId: String(payload.vehicleId),
          grade: kind === 'fuel' ? (payload.grade as FuelGrade) : current.grade,
          date: toKyivLocalInput(new Date()),
        })
      }
    } catch {
      toast.error('Could not save the entry')
    } finally {
      setSaving(false)
    }
  }

  const defaults = { vehicleId: current.vehicleId, date: current.date }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {(['fuel', 'service'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k)
              setErrors({})
            }}
            className={`rounded-md py-1.5 text-sm font-medium ${kind === k ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            {k === 'fuel' ? 'Fuel' : 'Service'}
          </button>
        ))}
      </div>
      <form
        key={`${kind}-${current.key}`}
        onSubmit={onSubmit}
        onInput={(e) => checkWarning(e.currentTarget)}
        onChange={(e) => checkWarning(e.currentTarget)}
        className="flex flex-col gap-4"
        noValidate
      >
        {kind === 'fuel' ? (
          <FuelFields vehicles={vehicles} defaultValues={{ ...defaults, grade: current.grade }} errors={errors} />
        ) : (
          <ServiceFields vehicles={vehicles} defaultValues={defaults} errors={errors} />
        )}
        {warning && (
          <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
            Odometer is lower than the last known reading.
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  )
}
