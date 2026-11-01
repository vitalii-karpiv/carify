import Link from 'next/link'
import { CarFront } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyVehicles() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CarFront className="size-12 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">No vehicles yet</h2>
        <p className="text-sm text-muted-foreground">Add your first car to start tracking.</p>
      </div>
      <Link href="/vehicles/new" className={cn(buttonVariants())}>
        Add vehicle
      </Link>
    </div>
  )
}
