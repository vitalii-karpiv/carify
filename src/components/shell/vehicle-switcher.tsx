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
import { selectVehicleAction } from '@/lib/vehicle-selection'

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
          <Button variant="ghost" className="max-w-[60vw] gap-1 px-2 text-base font-semibold" disabled={pending} />
        }
      >
        <span className="truncate">{selected?.name ?? 'No vehicle'}</span>
        <ChevronDown className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {vehicles.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onClick={() => startTransition(() => selectVehicleAction(v.id))}
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
