import Link from 'next/link'
import { Settings } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VehicleSwitcher, type SwitcherVehicle } from './vehicle-switcher'

export function TopBar({
  vehicles,
  selectedId,
}: {
  vehicles: SwitcherVehicle[]
  selectedId: string | null
}) {
  return (
    <header className="sticky top-0 z-30 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-2">
        <VehicleSwitcher vehicles={vehicles} selectedId={selectedId} />
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-10 rounded-full bg-card')}
        >
          <Settings className="size-5" />
        </Link>
      </div>
    </header>
  )
}
