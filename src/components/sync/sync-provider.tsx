'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { listOutbox, subscribeOutbox } from '@/lib/offline/outbox'
import { refreshSnapshot } from '@/lib/offline/snapshot'
import { backoffDelayFor, syncOutbox } from '@/lib/offline/sync'

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
  const router = useRouter()
  const pathname = usePathname()
  const syncRef = useRef<() => Promise<void>>(async () => {})
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      if (res.sent > 0) router.refresh()
    } catch {
      // best-effort; items stay in the outbox
    }
    await recount()
    // Wake up for the earliest backed-off item even if the app stays foregrounded.
    try {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      retryTimer.current = null
      const delay = backoffDelayFor(await listOutbox(), Date.now())
      if (delay !== null) retryTimer.current = setTimeout(() => void syncRef.current(), delay + 50)
    } catch {
      // IndexedDB unavailable
    }
  }, [recount, router])

  useEffect(() => {
    syncRef.current = syncNow
  }, [syncNow])

  useEffect(() => {
    const unsub = subscribeOutbox(() => void recount())
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      unsub()
      if (retryTimer.current) clearTimeout(retryTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [recount, syncNow])

  // Mount and every navigation (login, register, vehicle changes are client-side): refresh the offline
  // snapshot and sync; a successful sync also clears a stale `needsAuth`. Debounced to one run per navigation.
  useEffect(() => {
    const t = setTimeout(() => {
      if (navigator.onLine) void refreshSnapshot().catch(() => {})
      void syncNow()
    }, 150)
    return () => clearTimeout(t)
  }, [pathname, syncNow])

  const value = useMemo<SyncState>(
    () => ({ online, pendingCount: counts.pending, failedCount: counts.failed, needsAuth, syncNow }),
    [online, counts, needsAuth, syncNow],
  )
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
