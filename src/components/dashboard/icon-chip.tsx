import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tint = 'fuel' | 'service' | 'money' | 'consumption'

// Literal class names so Tailwind picks them up.
const TINT_CLASSES: Record<Tint, string> = {
  fuel: 'bg-tint-fuel/15 text-tint-fuel',
  service: 'bg-tint-service/15 text-tint-service',
  money: 'bg-tint-money/15 text-tint-money',
  consumption: 'bg-tint-consumption/15 text-tint-consumption',
}

export function IconChip({ icon: Icon, tint, className }: { icon: LucideIcon; tint: Tint; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-[10px]', TINT_CLASSES[tint], className)}
    >
      <Icon className="size-[18px]" strokeWidth={2.2} />
    </span>
  )
}
