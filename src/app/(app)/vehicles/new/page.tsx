import { VehicleForm } from '@/components/forms/vehicle-form'
import { createVehicleAction } from '../actions'

export default function NewVehiclePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Add vehicle</h1>
      <VehicleForm action={createVehicleAction} submitLabel="Add vehicle" />
    </div>
  )
}
