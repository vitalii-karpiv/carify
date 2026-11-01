import { Wrench } from 'lucide-react'
import Link from 'next/link'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { listServiceEntries } from '@/lib/data/entries'
import { formatDate } from '@/lib/domain/dates'
import { SERVICE_CATEGORY_LABELS } from '@/lib/domain/enums'
import { formatKm, formatUah } from '@/lib/domain/money'
import { cn } from '@/lib/utils'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

export default async function ServicePage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  const entries = await listServiceEntries(user.id, vehicle.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Service</h1>
        <Link href="/add?kind=service" className={cn(buttonVariants({ size: 'sm' }))}>
          Add
        </Link>
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Wrench className="size-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">No service entries yet</h2>
            <p className="text-sm text-muted-foreground">Log the first service for {vehicle.name}.</p>
          </div>
          <Link href="/add?kind=service" className={cn(buttonVariants())}>
            Add service
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <Link key={e.id} href={`/service/${e.id}`}>
              <Card className="flex-row items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{SERVICE_CATEGORY_LABELS[e.category]}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {formatDate(e.date)} · {formatKm(e.odometer)}
                    {e.garage ? ` · ${e.garage}` : ''}
                  </div>
                </div>
                <div className="font-medium">{formatUah(e.totalKop)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
