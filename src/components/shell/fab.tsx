import Link from 'next/link'
import { Plus } from 'lucide-react'

export function Fab() {
  return (
    <Link
      href="/add?kind=fuel"
      aria-label="Add entry"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
    >
      <Plus className="size-6" />
    </Link>
  )
}
