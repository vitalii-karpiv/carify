import { notFound } from 'next/navigation'
import { VehicleForm } from '@/components/forms/vehicle-form'
import { requireUser } from '@/lib/auth/session'
import { getVehicle } from '@/lib/data/vehicles'
import { updateVehicleAction } from '../actions'
import { DangerZone } from './danger-zone'

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const vehicle = await getVehicle(user.id, id)
  if (!vehicle) notFound()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Edit vehicle</h1>
      <VehicleForm
        vehicle={vehicle}
        action={updateVehicleAction.bind(null, vehicle.id)}
        submitLabel="Save"
      />
      <DangerZone id={vehicle.id} name={vehicle.name} archived={!!vehicle.archivedAt} />
    </div>
  )
}
