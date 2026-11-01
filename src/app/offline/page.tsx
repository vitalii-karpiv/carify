'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { useSync } from '@/components/sync/sync-provider'

export default function OfflinePage() {
  const { pendingCount } = useSync()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        This page needs a connection. You can still add entries; they sync when you&apos;re back online.
      </p>
      {pendingCount > 0 && (
        <p className="text-sm">
          {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync
        </p>
      )}
      <Link href="/add" className={buttonVariants()}>
        Add entry
      </Link>
    </main>
  )
}
