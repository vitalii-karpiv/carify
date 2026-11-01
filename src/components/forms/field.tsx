import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type FieldErrors = Record<string, string | undefined>

export const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm dark:bg-input/30'

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
