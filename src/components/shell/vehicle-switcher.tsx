'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { selectVehicleAction } from '@/lib/vehicle-selection-actions'

export type SwitcherVehicle = { id: string; name: string }

export function VehicleSwitcher({
  vehicles,
  selectedId,
}: {
  vehicles: SwitcherVehicle[]
  selectedId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const selected = vehicles.find((v) => v.id === selectedId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-10 max-w-[65vw] gap-1 px-2 text-xl font-bold tracking-tight" disabled={pending} />
        }
      >
        <span className="truncate">{selected?.name ?? 'No vehicle'}</span>
        <ChevronDown className="size-5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {vehicles.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onClick={() => {
              if (v.id === selectedId) return
              startTransition(async () => {
                try {
                  await selectVehicleAction(v.id)
                } catch {
                  toast.error('Could not switch vehicle')
                }
              })
            }}
          >
            <span className="flex-1">{v.name}</span>
            {v.id === selectedId && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        {vehicles.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem render={<Link href="/vehicles/new" />}>
          <Plus className="size-4" />
          Add vehicle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
