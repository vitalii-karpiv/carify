import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { requireUser } from '@/lib/auth/session'
import { listEntryVehicles } from '@/lib/data/entry-vehicles'
import { getSelectedVehicle } from '@/lib/vehicle-selection'
import { AddEntry } from './add-entry'

export default async function AddPage({ searchParams }: PageProps<'/add'>) {
  const user = await requireUser()
  const [vehicles, selected, { kind }] = await Promise.all([
    listEntryVehicles(user.id),
    getSelectedVehicle(user.id),
    searchParams,
  ])
  if (vehicles.length === 0) return <EmptyVehicles />
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Add entry</h1>
      <AddEntry
        vehicles={vehicles}
        selectedId={selected?.id ?? vehicles[0].id}
        initialKind={kind === 'service' ? 'service' : 'fuel'}
      />
    </div>
  )
}
