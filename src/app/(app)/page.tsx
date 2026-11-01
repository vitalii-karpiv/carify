import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { requireUser } from '@/lib/auth/session'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

// Placeholder: Task 17 builds the real dashboard.
export default async function DashboardPage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  return <h1 className="text-xl font-semibold">{vehicle.name}</h1>
}
