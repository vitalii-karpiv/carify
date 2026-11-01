import Link from 'next/link'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { listVehicles } from '@/lib/data/vehicles'
import { cn } from '@/lib/utils'
import type { Vehicle } from '@/lib/domain/types'
import { RestoreButton } from './restore-button'

function VehicleRow({ v, archived }: { v: Vehicle; archived?: boolean }) {
  return (
    <Card className="flex-row items-center justify-between gap-3 px-4 py-3">
      <Link href={`/vehicles/${v.id}`} className="min-w-0 flex-1">
        <div className="truncate font-medium">{v.name}</div>
        <div className="truncate text-sm text-muted-foreground">
          {v.make} {v.model} · {v.year} · {v.plate}
        </div>
      </Link>
      {archived && <RestoreButton id={v.id} />}
    </Card>
  )
}

export default async function VehiclesPage() {
  const user = await requireUser()
  const all = await listVehicles(user.id, { includeArchived: true })
  const active = all.filter((v) => !v.archivedAt)
  const archived = all.filter((v) => v.archivedAt)
  if (all.length === 0) return <EmptyVehicles />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vehicles</h1>
        <Link href="/vehicles/new" className={cn(buttonVariants({ size: 'sm' }))}>
          Add vehicle
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {active.map((v) => (
          <VehicleRow key={v.id} v={v} />
        ))}
      </div>
      {archived.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((v) => (
              <VehicleRow key={v.id} v={v} archived />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
