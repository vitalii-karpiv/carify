'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useSync } from '@/components/sync/sync-provider'

export function SyncIndicator() {
  const { pendingCount, failedCount } = useSync()
  if (failedCount > 0) {
    return (
      <Link
        href="/settings#needs-attention"
        aria-label={`${failedCount} entries need attention`}
        className="flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-white"
      >
        {failedCount}
      </Link>
    )
  }
  if (pendingCount > 0) {
    return (
      <span
        role="status"
        aria-label={`${pendingCount} entries syncing`}
        className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        {pendingCount}
      </span>
    )
  }
  return null
}
