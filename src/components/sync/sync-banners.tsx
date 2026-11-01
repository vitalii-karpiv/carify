'use client'

import Link from 'next/link'
import { useSync } from './sync-provider'

export function SyncBanners() {
  const { online, pendingCount, needsAuth } = useSync()
  return (
    <>
      {!online && (
        <div role="status" className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
          {pendingCount > 0
            ? `Offline — ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} waiting to sync`
            : 'Offline'}
        </div>
      )}
      {needsAuth && (
        <Link
          href="/login"
          className="block bg-destructive/10 px-4 py-2 text-center text-sm text-destructive underline"
        >
          Session expired — sign in to sync your entries
        </Link>
      )}
    </>
  )
}
