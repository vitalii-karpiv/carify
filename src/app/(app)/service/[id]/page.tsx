import { notFound } from 'next/navigation'
import { EntryEditForm } from '@/components/forms/entry-edit-form'
import { requireUser } from '@/lib/auth/session'
import { getServiceEntry } from '@/lib/data/entries'
import { listVehicles } from '@/lib/data/vehicles'
import { toKyivLocalInput } from '@/lib/domain/dates'
import { formatNumber } from '@/lib/domain/money'

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const entry = await getServiceEntry(user.id, id)
  if (!entry) notFound()
  const vehicles = await listVehicles(user.id, { includeArchived: true })
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Edit service</h1>
      <EntryEditForm
        kind="service"
        id={entry.id}
        vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, defaultGrade: v.defaultGrade }))}
        defaultValues={{
          vehicleId: entry.vehicleId,
          date: toKyivLocalInput(entry.date),
          odometer: String(entry.odometer),
          category: entry.category,
          total: formatNumber(entry.totalKop / 100, 2),
          garage: entry.garage ?? '',
          notes: entry.notes ?? '',
        }}
      />
    </div>
  )
}
