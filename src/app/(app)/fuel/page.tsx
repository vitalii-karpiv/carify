import { Fuel } from 'lucide-react'
import Link from 'next/link'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { listFuelEntries } from '@/lib/data/entries'
import { formatDate } from '@/lib/domain/dates'
import { FUEL_GRADE_LABELS } from '@/lib/domain/enums'
import { formatKm, formatNumber, formatUah } from '@/lib/domain/money'
import { cn } from '@/lib/utils'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

export default async function FuelPage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  const entries = await listFuelEntries(user.id, vehicle.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fuel</h1>
        <Link href="/add?kind=fuel" className={cn(buttonVariants({ size: 'sm' }))}>
          Add
        </Link>
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Fuel className="size-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">No fill-ups yet</h2>
            <p className="text-sm text-muted-foreground">Log your first fill-up for {vehicle.name}.</p>
          </div>
          <Link href="/add?kind=fuel" className={cn(buttonVariants())}>
            Add fill-up
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <Link key={e.id} href={`/fuel/${e.id}`}>
              <Card className="flex-row items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{formatDate(e.date)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatKm(e.odometer)} · {formatNumber(e.litres, 2)} L · {FUEL_GRADE_LABELS[e.grade]}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-medium">{formatUah(e.totalKop)}</div>
                  {!e.isFull && <Badge variant="secondary">Partial</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
