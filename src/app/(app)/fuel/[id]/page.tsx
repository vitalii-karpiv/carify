import { notFound } from 'next/navigation'
import { EntryEditForm } from '@/components/forms/entry-edit-form'
import { requireUser } from '@/lib/auth/session'
import { getFuelEntry } from '@/lib/data/entries'
import { listVehicles } from '@/lib/data/vehicles'
import { toKyivLocalInput } from '@/lib/domain/dates'

export default async function EditFuelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const entry = await getFuelEntry(user.id, id)
  if (!entry) notFound()
  const vehicles = await listVehicles(user.id, { includeArchived: true })
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Edit fill-up</h1>
      <EntryEditForm
        kind="fuel"
        id={entry.id}
        vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, defaultGrade: v.defaultGrade }))}
        defaultValues={{
          vehicleId: entry.vehicleId,
          date: toKyivLocalInput(entry.date),
          odometer: String(entry.odometer),
          fuel: { litres: entry.litres, pricePerLitreKop: entry.pricePerLitreKop, totalKop: entry.totalKop },
          grade: entry.grade,
          isFull: entry.isFull,
          missedPrevious: entry.missedPrevious,
          station: entry.station ?? '',
          note: entry.note ?? '',
        }}
      />
    </div>
  )
}
