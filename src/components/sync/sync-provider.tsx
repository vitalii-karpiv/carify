'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { listOutbox, subscribeOutbox } from '@/lib/offline/outbox'
import { refreshSnapshot } from '@/lib/offline/snapshot'
import { syncOutbox } from '@/lib/offline/sync'

export type SyncState = {
  online: boolean
  pendingCount: number
  failedCount: number
  needsAuth: boolean
  syncNow(): Promise<void>
}

const SyncContext = createContext<SyncState | null>(null)

export function useSync(): SyncState {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  const [counts, setCounts] = useState({ pending: 0, failed: 0 })
  const [needsAuth, setNeedsAuth] = useState(false)

  const recount = useCallback(async () => {
    try {
      const items = await listOutbox()
      const failed = items.filter((i) => i.status === 'failed').length
      setCounts({ pending: items.length - failed, failed })
    } catch {
      // IndexedDB unavailable
    }
  }, [])

  const syncNow = useCallback(async () => {
    try {
      const res = await syncOutbox()
      setNeedsAuth(res.needsAuth)
    } catch {
      // best-effort; items stay in the outbox
    }
    await recount()
  }, [recount])

  useEffect(() => {
    const unsub = subscribeOutbox(() => void recount())
    if (navigator.onLine) void refreshSnapshot().catch(() => {})
    queueMicrotask(() => void syncNow())
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      unsub()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [recount, syncNow])

  const value = useMemo<SyncState>(
    () => ({ online, pendingCount: counts.pending, failedCount: counts.failed, needsAuth, syncNow }),
    [online, counts, needsAuth, syncNow],
  )
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
