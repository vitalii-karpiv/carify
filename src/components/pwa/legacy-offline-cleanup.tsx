'use client'

import { useEffect } from 'react'

// Earlier builds shipped a service worker, `carify-*` caches and a `carify` IndexedDB for offline use.
// Remove them from devices that still have them. Safe to delete this component once old installs are gone.
export function LegacyOfflineCleanup() {
  useEffect(() => {
    void (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.filter((k) => k.startsWith('carify-')).map((k) => caches.delete(k)))
        }
        indexedDB?.deleteDatabase('carify')
      } catch {
        // best-effort
      }
    })()
  }, [])
  return null
}
