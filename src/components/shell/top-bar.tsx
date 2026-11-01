import Link from 'next/link'
import { Settings } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SyncIndicator } from './sync-indicator'
import { VehicleSwitcher, type SwitcherVehicle } from './vehicle-switcher'

export function TopBar({
  vehicles,
  selectedId,
}: {
  vehicles: SwitcherVehicle[]
  selectedId: string | null
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-12 max-w-md items-center justify-between px-2">
        <VehicleSwitcher vehicles={vehicles} selectedId={selectedId} />
        <div className="flex items-center gap-1">
          <SyncIndicator />
          <Link
            href="/settings"
            aria-label="Settings"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  )
}
