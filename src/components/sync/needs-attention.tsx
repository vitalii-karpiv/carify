'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { FieldErrors } from '@/components/forms/field'
import { FuelFields, readFuelForm, type FuelFormDefaults } from '@/components/forms/fuel-fields'
import { ServiceFields, readServiceForm, type ServiceFormDefaults } from '@/components/forms/service-fields'
import { useSync } from '@/components/sync/sync-provider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDate, toKyivLocalInput } from '@/lib/domain/dates'
import { SERVICE_CATEGORIES, type FuelGrade, type ServiceCategory } from '@/lib/domain/enums'
import type { SnapshotVehicle } from '@/lib/domain/types'
import { formatKm } from '@/lib/domain/money'
import { buildOutboxPayload } from '@/lib/offline/entry-payload'
import { discard, listOutbox, retry, subscribeOutbox, type OutboxItem } from '@/lib/offline/outbox'
import { getSnapshotVehicles, refreshSnapshot } from '@/lib/offline/snapshot'

function fuelDefaults(p: Record<string, unknown>): FuelFormDefaults {
  const litres = Number(p.litres)
  const price = Number(p.pricePerLitreKop)
  const total = Number(p.totalKop)
  return {
    vehicleId: String(p.vehicleId),
    date: toKyivLocalInput(new Date(String(p.date))),
    odometer: String(p.odometer ?? ''),
    fuel:
      Number.isFinite(litres) && Number.isFinite(price) && Number.isFinite(total)
        ? { litres, pricePerLitreKop: price, totalKop: total }
        : undefined,
    grade: p.grade as FuelGrade,
    isFull: Boolean(p.isFull),
    missedPrevious: Boolean(p.missedPrevious),
    station: String(p.station ?? ''),
    note: String(p.note ?? ''),
  }
}

function serviceDefaults(p: Record<string, unknown>): ServiceFormDefaults {
  const kop = Number(p.totalKop)
  return {
    vehicleId: String(p.vehicleId),
    date: toKyivLocalInput(new Date(String(p.date))),
    odometer: String(p.odometer ?? ''),
    category: (SERVICE_CATEGORIES as readonly string[]).includes(String(p.category))
      ? (p.category as ServiceCategory)
      : undefined,
    total: Number.isFinite(kop) ? (kop / 100).toFixed(2).replace('.', ',') : '',
    garage: String(p.garage ?? ''),
    notes: String(p.notes ?? ''),
  }
}

export function NeedsAttention() {
  const { syncNow } = useSync()
  const [items, setItems] = useState<OutboxItem[]>([])
  const [vehicles, setVehicles] = useState<SnapshotVehicle[]>([])
  const [editing, setEditing] = useState<OutboxItem | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = useCallback(async () => {
    try {
      const [all, vs] = await Promise.all([listOutbox(), getSnapshotVehicles()])
      setItems(all.filter((i) => i.status === 'failed'))
      setVehicles(vs)
    } catch {
      // IndexedDB unavailable
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => void load())
    if (navigator.onLine) {
      void refreshSnapshot()
        .then(() => {
          if (!cancelled) return load()
        })
        .catch(() => {})
    }
    const unsub = subscribeOutbox(() => void load())
    return () => {
      cancelled = true
      unsub()
    }
  }, [load])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    const f = new FormData(e.currentTarget)
    if (!f.get('vehicleId')) {
      setErrors({ vehicleId: 'Choose a vehicle' })
      return
    }
    const values = editing.kind === 'fuel' ? readFuelForm(f) : readServiceForm(f)
    const result = buildOutboxPayload(editing.kind, values, editing.id)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    try {
      await retry(editing.id, result.payload)
      setEditing(null)
      setErrors({})
      await syncNow()
    } catch {
      toast.error('Could not retry the entry')
    }
  }

  if (items.length === 0) return <div id="needs-attention" />

  const known = (id: unknown) => vehicles.some((v) => v.id === id)
  const name = (id: unknown) => vehicles.find((v) => v.id === id)?.name ?? 'Unknown vehicle'

  const editKnown = editing ? known(editing.payload.vehicleId) : true
  const editVehicleId = editKnown ? String(editing?.payload.vehicleId) : ''
  const editVehicles = editKnown
    ? vehicles
    : [{ id: '', name: 'Unknown vehicle — choose one', defaultGrade: 'A95' as FuelGrade }, ...vehicles]

  return (
    <section id="needs-attention" className="flex scroll-mt-16 flex-col gap-3">
      <h2 className="text-base font-semibold">Needs attention</h2>
      {items.map((item) => {
        const date = new Date(String(item.payload.date))
        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium capitalize">{item.kind}</span>
              <span className="text-muted-foreground">
                {Number.isNaN(date.getTime()) ? '—' : formatDate(date)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {name(item.payload.vehicleId)} · {formatKm(Number(item.payload.odometer))}
            </div>
            <p className="text-destructive">{item.error?.message ?? 'Failed to sync'}</p>
            <div className="flex gap-2">
              {item.error?.code !== 'ID_CONFLICT' && (
                <Button
                  size="sm"
                  onClick={() => {
                    setErrors({})
                    setEditing(item)
                  }}
                >
                  Edit &amp; retry
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>Discard</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this entry?</AlertDialogTitle>
                    <AlertDialogDescription>It was never saved to your account and will be lost.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        void discard(item.id).then(() => toast.success('Discarded'))
                      }}
                    >
                      Discard
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )
      })}
      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Edit &amp; retry</SheetTitle>
            <SheetDescription>{editing?.error?.message}</SheetDescription>
          </SheetHeader>
          {editing && (
            <form key={editing.id} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              {editing.kind === 'fuel' ? (
                <FuelFields
                  vehicles={editVehicles}
                  defaultValues={{ ...fuelDefaults(editing.payload), vehicleId: editVehicleId }}
                  errors={errors}
                />
              ) : (
                <ServiceFields
                  vehicles={editVehicles}
                  defaultValues={{ ...serviceDefaults(editing.payload), vehicleId: editVehicleId }}
                  errors={errors}
                />
              )}
              {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId}</p>}
              <Button type="submit">Retry</Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
